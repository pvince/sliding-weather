const STORAGE_KEY_API_KEY = "sliding_weather_owm_api_key";

export function storeApiKey(key: string | null): void {
  localStorage.setItem(STORAGE_KEY_API_KEY, key || "");
}

export function getApiKey(): string {
  return localStorage.getItem(STORAGE_KEY_API_KEY) || "";
}
