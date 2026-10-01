const GEO_URL = "https://api.openweathermap.org/geo/1.0/direct";
const REVERSE_URL = "https://api.openweathermap.org/geo/1.0/reverse";
const CURRENT_URL = "https://api.openweathermap.org/data/2.5/weather";
const FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast";
const PLACE_KEY = "skylight-place";
const API_KEY = "skylight-owm-key";

const form = document.querySelector("#search-form");
const cityInput = document.querySelector("#city");
const keyForm = document.querySelector("#key-form");
const keyInput = document.querySelector("#api-key");
const statusEl = document.querySelector("#status");
const suggestions = document.querySelector("#suggestions");
const report = document.querySelector("#report");

let refreshTimer = 0;

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = cityInput.value.trim();
  if (!query) {
    setStatus("Type a city name.", true);
    return;
  }
  await showMatches(query);
});

cityInput.addEventListener("input", () => {
  suggestions.hidden = true;
  suggestions.innerHTML = "";
});

keyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const key = keyInput.value.trim();
  if (!key) {
    setStatus("Paste an OpenWeather API key first.", true);
    return;
  }
  localStorage.setItem(API_KEY, key);
  keyInput.value = "";
  keyInput.placeholder = "Key saved on this browser";
  await boot();
});

document.querySelector("#locate").addEventListener("click", () => {
  if (!requireKey()) return;
  if (!navigator.geolocation) {
    setStatus("This browser cannot read your location.", true);
    return;
  }
  setStatus("Finding your location…");
  navigator.geolocation.getCurrentPosition(async (position) => {
    const key = localStorage.getItem(API_KEY);
    try {
      const response = await fetch(`${REVERSE_URL}?lat=${position.coords.latitude}&lon=${position.coords.longitude}&limit=1&appid=${encodeURIComponent(key)}`);
      const places = await readJson(response);
      const match = places[0];
      await loadWeather(match ? toPlace(match) : {
        name: "Your location",
        admin1: "",
        country: "",
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      });
    } catch (error) {
      setStatus(error.message, true);
    }
  }, () => {
    setStatus("Location was blocked. Search for a city instead.", true);
  });
});

suggestions.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-index]");
  if (!button) return;
  suggestions.hidden = true;
  await loadWeather(JSON.parse(button.dataset.place));
});

boot();

async function boot() {
  if (!localStorage.getItem(API_KEY)) {
    report.hidden = true;
    setStatus("Add your OpenWeather API key to load station observations.", true);
    return;
  }
  keyInput.placeholder = "Key saved on this browser";
  const saved = localStorage.getItem(PLACE_KEY);
  if (saved) {
    try {
      await loadWeather(JSON.parse(saved));
      return;
    } catch {
      localStorage.removeItem(PLACE_KEY);
    }
  }
  await loadWeather({
    name: "Johannesburg",
    admin1: "Gauteng",
    country: "ZA",
    latitude: -26.20227,
    longitude: 28.04363
  });
}

async function showMatches(query) {
  const key = requireKey();
  if (!key) return;
  setStatus("Searching…");
  try {
    const response = await fetch(`${GEO_URL}?q=${encodeURIComponent(query)}&limit=5&appid=${encodeURIComponent(key)}`);
    const results = await readJson(response);
    if (!results.length) {
      setStatus(`No city found for “${query}”.`, true);
      suggestions.hidden = true;
      return;
    }
    const places = results.map(toPlace);
    if (places.length === 1) {
      await loadWeather(places[0]);
      return;
    }
    suggestions.innerHTML = places.map((place, index) => `
      <li><button type="button" data-index="${index}" data-place="${escapeAttr(JSON.stringify(place))}">
        ${escapeHtml(labelFor(place))}
      </button></li>
    `).join("");
    suggestions.hidden = false;
    setStatus("Choose a match.");
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function loadWeather(place) {
  const key = requireKey();
  if (!key) return;
  setStatus(`Loading ${place.name}…`);
  const query = `lat=${place.latitude}&lon=${place.longitude}&units=metric&appid=${encodeURIComponent(key)}`;
  try {
    const [currentResponse, forecastResponse] = await Promise.all([
      fetch(`${CURRENT_URL}?${query}`),
      fetch(`${FORECAST_URL}?${query}`)
    ]);
    const current = await readJson(currentResponse);
    const forecast = await readJson(forecastResponse);
    localStorage.setItem(PLACE_KEY, JSON.stringify(place));
    render(place, current, forecast);
    setStatus("");
    clearInterval(refreshTimer);
    refreshTimer = setInterval(() => loadWeather(place), 10 * 60 * 1000);
  } catch (error) {
    setStatus(error.message, true);
  }
}

function render(place, current, forecast) {
  const weather = current.weather[0];
  document.querySelector("#place").textContent = labelFor(place);
  document.querySelector("#condition").textContent = titleCase(weather.description);
  document.querySelector("#temperature").textContent = Math.round(current.main.temp);
  document.querySelector("#feels").textContent = `${Math.round(current.main.feels_like)}°`;
  document.querySelector("#humidity").textContent = `${current.main.humidity}%`;
  document.querySelector("#wind").textContent = `${Math.round(current.wind.speed * 3.6)} km/h`;
  document.querySelector("#rain").textContent = `${rainAmount(current)} mm`;
  document.querySelector("#updated").textContent = `Updated ${formatStamp(current.dt)} · OpenWeather stations`;

  const upcoming = forecast.list.slice(0, 8);
  document.querySelector("#hourly").innerHTML = upcoming.map((item) => `
    <article class="hour">
      <small>${formatStamp(item.dt)}</small>
      <strong>${Math.round(item.main.temp)}°</strong>
      <small>${Math.round(item.pop * 100)}%</small>
    </article>
  `).join("");

  document.querySelector("#daily").innerHTML = groupDays(forecast.list).map((day) => `
    <li class="day">
      <span>${formatDay(day.date)}</span>
      <small>${titleCase(day.description)}</small>
      <strong>${Math.round(day.max)}° / ${Math.round(day.min)}°</strong>
      <small>${day.rain.toFixed(1)} mm</small>
    </li>
  `).join("");

  report.hidden = false;
  cityInput.value = place.name === "Your location" ? "" : place.name;
}

function groupDays(list) {
  const groups = new Map();
  for (const item of list) {
    const date = item.dt_txt.slice(0, 10);
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date).push(item);
  }
  return [...groups.entries()].slice(0, 5).map(([date, items]) => {
    const sample = items[Math.floor(items.length / 2)];
    return {
      date,
      description: sample.weather[0].description,
      max: Math.max(...items.map((item) => item.main.temp_max)),
      min: Math.min(...items.map((item) => item.main.temp_min)),
      rain: items.reduce((sum, item) => sum + (item.rain?.["3h"] || item.snow?.["3h"] || 0), 0)
    };
  });
}

function rainAmount(current) {
  return current.rain?.["1h"] || current.snow?.["1h"] || 0;
}

function toPlace(match) {
  return {
    name: match.name,
    admin1: match.state || "",
    country: match.country || "",
    latitude: match.lat,
    longitude: match.lon
  };
}

function requireKey() {
  const key = localStorage.getItem(API_KEY);
  if (!key) {
    setStatus("Add your OpenWeather API key to load station observations.", true);
    return "";
  }
  return key;
}

async function readJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (response.ok) return payload;
  if (response.status === 401) {
    throw new Error("OpenWeather rejected the API key. A brand-new key can take up to two hours to activate.");
  }
  if (response.status === 429) {
    throw new Error("OpenWeather’s free limit was reached. Wait a minute and try again.");
  }
  throw new Error(payload.message || "OpenWeather could not complete that request.");
}

function labelFor(place) {
  const country = place.country === "ZA" ? "South Africa" : place.country;
  return [place.name, place.admin1, country].filter(Boolean).join(", ");
}

function titleCase(value) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatStamp(unixSeconds) {
  return new Date(unixSeconds * 1000).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}

function formatDay(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
}

function setStatus(message, isError) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", Boolean(isError));
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}
