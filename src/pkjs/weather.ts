const OWM_BASE = "https://api.openweathermap.org/data/2.5/";

export interface CurrentWeather {
  tempF: number;
  tempC: number;
  conditions: string;
  conditionCode: number;
}

export interface WeatherError {
  message: string;
}

export interface WeatherOptions {
  apiKey: string;
  useGPS?: number;
  location?: string;
}

interface UrlOptions {
  apiKey: string;
  lat?: number;
  lon?: number;
  location?: string;
}

interface OWMCurrentResponse {
  main?: { temp: number };
  weather?: Array<{ main?: string; id?: number }>;
}

type WeatherCallback = (
  err: WeatherError | null,
  current?: CurrentWeather | null,
) => void;

export function kelvinToF(k: number): number {
  return Math.round((k - 273.15) * 1.8 + 32);
}

export function kelvinToC(k: number): number {
  return Math.round(k - 273.15);
}

export function buildCurrentWeatherUrl(opts: UrlOptions): string {
  const base = `${OWM_BASE}weather?`;
  if (opts.lat !== undefined && opts.lon !== undefined) {
    return `${base}lat=${opts.lat}&lon=${opts.lon}&appid=${opts.apiKey}`;
  }
  return `${base}q=${encodeURIComponent(opts.location || "")}&appid=${opts.apiKey}`;
}

export function parseCurrentWeather(
  json: OWMCurrentResponse | null,
): CurrentWeather | null {
  if (!json || !json.main || !json.weather || !json.weather[0]) {
    return null;
  }
  const tempK = json.main.temp;
  return {
    tempF: kelvinToF(tempK),
    tempC: kelvinToC(tempK),
    conditions: json.weather[0].main || "Unknown",
    conditionCode: json.weather[0].id || 0,
  };
}

function httpGet(
  url: string,
  callback: (err: Error | null, json: unknown) => void,
): void {
  const xhr = new XMLHttpRequest();
  xhr.open("GET", url, true);
  xhr.onload = () => {
    if (xhr.status >= 100) {
      if (xhr.status === 401) {
        callback(new Error("Invalid API Key"), null);
        return;
      }
      if (xhr.status === 429) {
        callback(new Error("API Rate Limit"), null);
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        callback(new Error("Weather Error"), null);
        return;
      }
    }
    try {
      const json = JSON.parse(xhr.responseText);
      callback(null, json);
    } catch (e) {
      callback(new Error(`JSON parse error: ${(e as Error).message}`), null);
    }
  };
  xhr.onerror = () => {
    callback(new Error("Network Error"), null);
  };
  xhr.send();
}

export function getWeather(
  opts: WeatherOptions,
  onComplete: WeatherCallback,
): void {
  if (!opts.apiKey) {
    console.log("No OWM API key configured — skipping weather fetch");
    onComplete({ message: "No API Key" });
    return;
  }

  function fetchWithCoords(lat: number, lon: number): void {
    const coordOpts: UrlOptions = { apiKey: opts.apiKey, lat: lat, lon: lon };
    httpGet(buildCurrentWeatherUrl(coordOpts), (err, current) => {
      if (err) {
        console.log(`Current weather error: ${err.message}`);
        onComplete({ message: err.message });
        return;
      }
      const currentData = parseCurrentWeather(current as OWMCurrentResponse);
      if (!currentData) {
        console.log("Unexpected current weather response structure");
        onComplete({ message: "Weather Error" });
        return;
      }
      onComplete(null, currentData);
    });
  }

  function fetchWithLocation(location: string): void {
    const locOpts: UrlOptions = { apiKey: opts.apiKey, location: location };
    httpGet(buildCurrentWeatherUrl(locOpts), (err, current) => {
      if (err) {
        console.log(`Current weather error: ${err.message}`);
        onComplete({ message: err.message });
        return;
      }
      const currentData = parseCurrentWeather(current as OWMCurrentResponse);
      if (!currentData) {
        console.log("Unexpected current weather response structure");
        onComplete({ message: "Weather Error" });
        return;
      }
      onComplete(null, currentData);
    });
  }

  if (opts.useGPS) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetchWithCoords(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        console.log(`Geolocation error: ${err.message}`);
        if (opts.location) {
          fetchWithLocation(opts.location);
        } else {
          onComplete({ message: "No Location" });
        }
      },
      { timeout: 15000 },
    );
  } else if (opts.location) {
    fetchWithLocation(opts.location);
  } else {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetchWithCoords(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        console.log(`Geolocation fallback error: ${err.message}`);
        onComplete({ message: "No Location" });
      },
      { timeout: 15000 },
    );
  }
}
