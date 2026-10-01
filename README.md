# Skylight

Live weather from [OpenWeatherMap](https://openweathermap.org/api). Current temperature, sky, humidity, and wind come from weather-station observations. The coming hours and five-day forecast come from the same API.

Open-Meteo was removed because its “current” values are a weather model, and those readings were off for South African cities.

## API key

1. Create a free key at [OpenWeather API keys](https://home.openweathermap.org/api_keys).
2. Open this page and paste the key into **OpenWeather API key**, then choose **Save key**.
3. The key stays in this browser only. It is not written into the project.

A new key can take up to two hours before OpenWeather accepts it.

## Run

Open `index.html` in a browser.

## What it shows

- Station temperature, feels-like, humidity, wind, and rain
- The next 24 hours in 3-hour steps
- Five-day high, low, and rain total
- A refresh every 10 minutes while the page is open
