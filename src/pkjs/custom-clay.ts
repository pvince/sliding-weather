interface ClayConfigInstance {
  EVENTS: {
    AFTER_BUILD: string;
    BEFORE_DESTROY: string;
  };
  on(event: string, handler: () => void): void;
  getItemById(id: string): { get(): string; set(value: string): void } | null;
}

const STORAGE_KEY = "sliding_weather_owm_api_key";

export default function customClay(
  this: ClayConfigInstance,
  _minified: unknown,
): void {
  let apiKeyItem: { get(): string; set(value: string): void } | null = null;

  this.on(this.EVENTS.AFTER_BUILD, () => {
    apiKeyItem = this.getItemById("owmApiKey");
    if (!apiKeyItem) return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY) || "";
      if (stored) {
        apiKeyItem.set(stored);
      }
    } catch (_e) {
      // localStorage may not be available
    }
  });

  this.on(this.EVENTS.BEFORE_DESTROY, () => {
    if (!apiKeyItem) return;
    try {
      const val = apiKeyItem.get() || "";
      localStorage.setItem(STORAGE_KEY, val);
    } catch (_e) {
      // localStorage may not be available
    }
  });
}
