'use strict';

var STORAGE_KEY_API_KEY = 'sliding_weather_owm_api_key';

// ============================================================
// Persistent storage helpers (localStorage)
// ============================================================

function storeApiKey(key) {
  localStorage.setItem(STORAGE_KEY_API_KEY, key || '');
}

function getApiKey() {
  return localStorage.getItem(STORAGE_KEY_API_KEY) || '';
}

module.exports = {
  storeApiKey: storeApiKey,
  getApiKey: getApiKey
};
