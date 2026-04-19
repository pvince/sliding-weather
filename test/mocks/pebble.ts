import { jest } from "bun:test";

// -------------------------------------------------------
// Mock Pebble global
// -------------------------------------------------------
(globalThis as any).Pebble = {
  sendAppMessage: jest.fn(),
  openURL: jest.fn(),
  getActiveWatchInfo: jest.fn().mockReturnValue({ platform: "basalt" }),
  addEventListener: jest.fn(),
};

// -------------------------------------------------------
// Mock navigator.geolocation
// -------------------------------------------------------
(globalThis as any).navigator = (globalThis as any).navigator || {};
(globalThis as any).navigator.geolocation = {
  getCurrentPosition: jest.fn(),
};

// -------------------------------------------------------
// Mock XMLHttpRequest
// -------------------------------------------------------
export class MockXHR {
  static _instances: MockXHR[] = [];

  static reset(): void {
    MockXHR._instances = [];
  }

  static respond(data: unknown, idx?: number, status?: number): void {
    const i = idx !== undefined ? idx : MockXHR._instances.length - 1;
    const xhr = MockXHR._instances[i];
    if (!xhr) throw new Error(`No XHR instance at index ${i}`);
    xhr.status = status !== undefined ? status : 200;
    xhr.responseText = JSON.stringify(data);
    if (xhr.onload) xhr.onload();
  }

  static fail(idx?: number): void {
    const i = idx !== undefined ? idx : MockXHR._instances.length - 1;
    const xhr = MockXHR._instances[i];
    if (!xhr) throw new Error(`No XHR instance at index ${i}`);
    if (xhr.onerror) xhr.onerror();
  }

  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  responseText = "";
  status = 0;

  constructor() {
    MockXHR._instances.push(this);
  }

  // Placeholder methods — replaced by jest.fn() on prototype below
  open(..._args: any[]): void {}
  send(..._args: any[]): void {}
}

// Override prototype methods with jest mocks for shared call tracking.
// Tests inspect MockXHR.prototype.open.mock.calls to verify URLs.
(MockXHR.prototype as any).open = jest.fn();
(MockXHR.prototype as any).send = jest.fn();

(globalThis as any).XMLHttpRequest = MockXHR;

// -------------------------------------------------------
// Mock localStorage
// -------------------------------------------------------
let _store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: jest.fn((k: string) => (_store[k] !== undefined ? _store[k] : null)),
  setItem: jest.fn((k: string, v: any) => {
    _store[k] = String(v);
  }),
  removeItem: jest.fn((k: string) => {
    delete _store[k];
  }),
  clear: jest.fn(() => {
    _store = {};
  }),
  _reset() {
    _store = {};
    mockLocalStorage.getItem.mockClear();
    mockLocalStorage.setItem.mockClear();
    mockLocalStorage.removeItem.mockClear();
    mockLocalStorage.clear.mockClear();
  },
};

(globalThis as any).localStorage = mockLocalStorage;
