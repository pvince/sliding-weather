'use strict';

// -------------------------------------------------------
// Mock Pebble global
// -------------------------------------------------------
global.Pebble = {
  sendAppMessage: jest.fn(),
  openURL: jest.fn(),
  getActiveWatchInfo: jest.fn().mockReturnValue({ platform: 'basalt' }),
  addEventListener: jest.fn()
};

// -------------------------------------------------------
// Mock navigator.geolocation
// -------------------------------------------------------
global.navigator = global.navigator || {};
global.navigator.geolocation = {
  getCurrentPosition: jest.fn()
};

// -------------------------------------------------------
// Mock XMLHttpRequest
// -------------------------------------------------------
var MockXHR = (function () {
  function MockXHR() {
    this.onload  = null;
    this.onerror = null;
    this.responseText = '';
    this.status = 0;  // PebbleKit JS default: 0 (proxy does not set status)
    MockXHR._instances.push(this);
  }
  MockXHR.prototype.open  = jest.fn();
  MockXHR.prototype.send  = jest.fn();
  MockXHR._instances = [];
  MockXHR.reset = function () { MockXHR._instances = []; };

  /** Simulate a successful JSON response on the most recent (or nth) request. */
  MockXHR.respond = function (data, idx, status) {
    var i = (idx === undefined) ? MockXHR._instances.length - 1 : idx;
    var xhr = MockXHR._instances[i];
    if (!xhr) throw new Error('No XHR instance at index ' + i);
    xhr.status = (status !== undefined) ? status : 200;
    xhr.responseText = JSON.stringify(data);
    if (xhr.onload) xhr.onload();
  };

  /** Simulate a network error on the most recent (or nth) request. */
  MockXHR.fail = function (idx) {
    var i = (idx === undefined) ? MockXHR._instances.length - 1 : idx;
    var xhr = MockXHR._instances[i];
    if (!xhr) throw new Error('No XHR instance at index ' + i);
    if (xhr.onerror) xhr.onerror();
  };

  return MockXHR;
})();

global.XMLHttpRequest = MockXHR;

// -------------------------------------------------------
// Mock localStorage
// -------------------------------------------------------
var _store = {};
global.localStorage = {
  getItem:    jest.fn(function (k) { return _store[k] !== undefined ? _store[k] : null; }),
  setItem:    jest.fn(function (k, v) { _store[k] = String(v); }),
  removeItem: jest.fn(function (k) { delete _store[k]; }),
  clear:      jest.fn(function () { _store = {}; }),
  _reset:     function () {
    _store = {};
    global.localStorage.getItem.mockClear();
    global.localStorage.setItem.mockClear();
    global.localStorage.removeItem.mockClear();
    global.localStorage.clear.mockClear();
  }
};

module.exports = { MockXHR: MockXHR };
