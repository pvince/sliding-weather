'use strict';

var STORAGE_KEY = 'sliding_weather_owm_api_key';

module.exports = function (minified) {
  var clayConfig = this;
  var apiKeyItem = null;

  clayConfig.on(clayConfig.EVENTS.AFTER_BUILD, function () {
    apiKeyItem = clayConfig.getItemById('owmApiKey');
    if (!apiKeyItem) return;

    // Load stored API key into the input field
    try {
      var stored = localStorage.getItem(STORAGE_KEY) || '';
      if (stored) {
        apiKeyItem.set(stored);
      }
    } catch (e) {
      // localStorage may not be available
    }
  });

  clayConfig.on(clayConfig.EVENTS.BEFORE_DESTROY, function () {
    if (!apiKeyItem) return;
    try {
      var val = apiKeyItem.get() || '';
      localStorage.setItem(STORAGE_KEY, val);
    } catch (e) {
      // localStorage may not be available
    }
  });
};
