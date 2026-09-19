const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 5173);
const ROOT = __dirname;

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

function send(response, statusCode, body, contentType = "text/plain; charset=utf-8") {
  response.writeHead(statusCode, {
    "content-type": contentType,
    "cache-control": "no-store",
  });
  response.end(body);
}

function sendJson(response, statusCode, value) {
  send(response, statusCode, JSON.stringify(value), "application/json; charset=utf-8");
}

function resolveStaticPath(requestPath) {
  const cleanPath = requestPath === "/" ? "/index.html" : requestPath;
  const absolutePath = path.normalize(path.join(ROOT, cleanPath));

  if (!absolutePath.startsWith(ROOT)) {
    return null;
  }

  return absolutePath;
}

async function proxySwiggy(requestUrl, response) {
  const target = requestUrl.searchParams.get("url");

  if (!target) {
    sendJson(response, 400, { error: "Missing Swiggy URL." });
    return;
  }

  let swiggyUrl;
  try {
    swiggyUrl = new URL(target);
  } catch (error) {
    sendJson(response, 400, { error: "The Swiggy URL is not valid." });
    return;
  }

  const allowedHost = swiggyUrl.hostname === "www.swiggy.com" || swiggyUrl.hostname.endsWith(".swiggy.com");
  if (swiggyUrl.protocol !== "https:" || !allowedHost) {
    sendJson(response, 400, { error: "Only HTTPS Swiggy URLs can be fetched." });
    return;
  }

  try {
    await fetchWithHttps(swiggyUrl, response);
  } catch (error) {
    sendJson(response, 502, { error: "Could not fetch Swiggy from the local proxy." });
  }
}

function fetchWithHttps(swiggyUrl, response) {
  return new Promise((resolve) => {
    const proxyRequest = https.get(
      swiggyUrl,
      {
        headers: {
          accept: "application/json,text/plain,*/*",
          "accept-language": "en-US,en;q=0.9",
          referer: "https://www.swiggy.com/",
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
        },
      },
      (proxyResponse) => {
        const chunks = [];

        proxyResponse.on("data", (chunk) => chunks.push(chunk));
        proxyResponse.on("end", () => {
          const body = Buffer.concat(chunks);
          const contentType = proxyResponse.headers["content-type"] || "application/json; charset=utf-8";
          send(response, proxyResponse.statusCode || 502, body, contentType);
          resolve();
        });
      },
    );

    proxyRequest.on("error", () => {
      sendJson(response, 502, { error: "Could not fetch Swiggy from the local proxy." });
      resolve();
    });

    proxyRequest.setTimeout(15000, () => {
      proxyRequest.destroy();
      sendJson(response, 504, { error: "Swiggy took too long to respond." });
      resolve();
    });
  });
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);

  if (requestUrl.pathname === "/api/swiggy") {
    await proxySwiggy(requestUrl, response);
    return;
  }

  const staticPath = resolveStaticPath(requestUrl.pathname);
  if (!staticPath) {
    send(response, 403, "Forbidden");
    return;
  }

  fs.readFile(staticPath, (error, data) => {
    if (error) {
      send(response, 404, "Not found");
      return;
    }

    send(response, 200, data, MIME_TYPES[path.extname(staticPath)] || "application/octet-stream");
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Swiggy Restaurant Explorer running at http://${HOST}:${PORT}`);
});
