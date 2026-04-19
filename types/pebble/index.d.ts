interface PebbleWatchInfo {
  platform: string;
}

declare namespace Pebble {
  function sendAppMessage(
    message: Record<string | number, unknown>,
    success?: () => void,
    error?: (err: unknown) => void
  ): void;
  function openURL(url: string): void;
  function getActiveWatchInfo(): PebbleWatchInfo;
  function addEventListener(event: 'ready', handler: () => void): void;
  function addEventListener(
    event: 'appmessage',
    handler: (e: { payload?: Record<string | number, unknown> }) => void
  ): void;
  function addEventListener(event: string, handler: (...args: any[]) => void): void;
}

declare function require(module: string): any;
