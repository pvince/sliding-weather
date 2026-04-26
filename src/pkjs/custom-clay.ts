interface ClayConfigInstance {
  meta: {
    userData?: {
      apiKey?: unknown;
    };
  };
  EVENTS: {
    AFTER_BUILD: string;
  };
  on(event: string, handler: () => void): void;
  getItemById(id: string): { get(): string; set(value: string): void } | null;
}

export default function customClay(
  this: ClayConfigInstance,
  _minified: unknown,
): void {
  this.on(this.EVENTS.AFTER_BUILD, () => {
    const apiKeyItem = this.getItemById("owmApiKey");
    if (!apiKeyItem) return;

    const stored = this.meta.userData?.apiKey;
    if (typeof stored === "string" && stored) {
      apiKeyItem.set(stored);
    }
  });
}
