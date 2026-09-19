const IMAGE_BASE = "https://media-assets.swiggy.com/swiggy/image/upload/fl_lossy,f_auto,q_auto,w_660/";

const state = {
  restaurants: [],
};

const elements = {
  apiUrl: document.querySelector("#apiUrl"),
  fetchBtn: document.querySelector("#fetchBtn"),
  jsonInput: document.querySelector("#jsonInput"),
  parseBtn: document.querySelector("#parseBtn"),
  searchInput: document.querySelector("#searchInput"),
  sortSelect: document.querySelector("#sortSelect"),
  grid: document.querySelector("#restaurantGrid"),
  status: document.querySelector("#status"),
  count: document.querySelector("#restaurantCount"),
};

function normalizeRestaurant(info) {
  const sla = info.sla || {};
  return {
    id: String(info.id || info.name || crypto.randomUUID()),
    name: info.name || "Unnamed restaurant",
    rating: Number(info.avgRating || info.avgRatingString || 0),
    cuisines: Array.isArray(info.cuisines) ? info.cuisines : [],
    area: info.areaName || info.locality || "",
    deliveryTime: Number(sla.deliveryTime || sla.minDeliveryTime || 0),
    costForTwo: info.costForTwo || info.costForTwoMessage || "",
    imageId: info.cloudinaryImageId || "",
  };
}

function collectRestaurants(value, found = new Map()) {
  if (!value || typeof value !== "object") return found;

  if (value.info && value.info.name && Array.isArray(value.info.cuisines)) {
    const restaurant = normalizeRestaurant(value.info);
    found.set(restaurant.id, restaurant);
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectRestaurants(item, found));
  } else {
    Object.values(value).forEach((item) => collectRestaurants(item, found));
  }

  return found;
}

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.style.color = isError ? "#a83a1a" : "";
}

function restaurantMatches(restaurant, query) {
  if (!query) return true;
  const haystack = [
    restaurant.name,
    restaurant.area,
    restaurant.costForTwo,
    restaurant.cuisines.join(" "),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function sortRestaurants(restaurants) {
  const sortBy = elements.sortSelect.value;
  const sorted = [...restaurants];

  if (sortBy === "name") {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy === "time") {
    sorted.sort((a, b) => (a.deliveryTime || 999) - (b.deliveryTime || 999));
  } else {
    sorted.sort((a, b) => b.rating - a.rating);
  }

  return sorted;
}

function renderRestaurants() {
  const query = elements.searchInput.value.trim();
  const restaurants = sortRestaurants(state.restaurants.filter((item) => restaurantMatches(item, query)));

  elements.count.textContent = restaurants.length;

  if (!restaurants.length) {
    elements.grid.innerHTML = `<div class="empty">No restaurants found yet. Fetch the API or paste a Swiggy JSON response.</div>`;
    return;
  }

  elements.grid.innerHTML = restaurants
    .map((restaurant) => {
      const imageStyle = restaurant.imageId
        ? `style="background-image: url('${IMAGE_BASE}${restaurant.imageId}')"`
        : "";
      const cuisines = restaurant.cuisines.slice(0, 4).join(", ") || "Cuisine not listed";
      const rating = restaurant.rating ? restaurant.rating.toFixed(1) : "New";
      const time = restaurant.deliveryTime ? `${restaurant.deliveryTime} min` : "Time unavailable";

      return `
        <article class="card">
          <div class="image" ${imageStyle}></div>
          <div class="content">
            <h2 class="name">${escapeHtml(restaurant.name)}</h2>
            <div class="meta">
              <span class="pill rating">${escapeHtml(rating)}</span>
              <span class="pill">${escapeHtml(time)}</span>
              ${restaurant.costForTwo ? `<span class="pill">${escapeHtml(restaurant.costForTwo)}</span>` : ""}
            </div>
            <p class="details-text">${escapeHtml(cuisines)}</p>
            <div class="area">${escapeHtml(restaurant.area || "Area not listed")}</div>
          </div>
        </article>
      `;
    })
    .join("");
}

function loadJson(json) {
  const restaurants = [...collectRestaurants(json).values()];
  state.restaurants = restaurants;
  setStatus(`Loaded ${restaurants.length} restaurants.`);
  renderRestaurants();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function fetchRestaurants() {
  const url = elements.apiUrl.value.trim();
  if (!url) {
    setStatus("Please enter a Swiggy API URL.", true);
    return;
  }

  setStatus("Fetching Swiggy JSON...");

  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json,text/plain,*/*",
      },
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    loadJson(json);
  } catch (error) {
    setStatus(
      "The browser could not fetch this API directly. Swiggy may be blocking CORS. Open the URL, copy the JSON, and paste it into the box above.",
      true,
    );
  }
}

function parsePastedJson() {
  try {
    const json = JSON.parse(elements.jsonInput.value);
    loadJson(json);
  } catch (error) {
    setStatus("That pasted text is not valid JSON yet.", true);
  }
}

elements.fetchBtn.addEventListener("click", fetchRestaurants);
elements.parseBtn.addEventListener("click", parsePastedJson);
elements.searchInput.addEventListener("input", renderRestaurants);
elements.sortSelect.addEventListener("change", renderRestaurants);

renderRestaurants();
