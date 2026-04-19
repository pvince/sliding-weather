'use strict';

var weather = require('./weather');
var cfg     = require('./config');
var mk      = require('../../build/js/message_keys.json');

// ============================================================
// Initialization
// ============================================================

Pebble.addEventListener('ready', function () {
  console.log('PebbleKit JS ready');
  var ready = {};
  ready[mk.JS_READY] = 1;
  Pebble.sendAppMessage(ready, function () {
    console.log('JS_READY sent');
  }, function (e) {
    console.log('JS_READY send failed: ' + JSON.stringify(e));
  });
});

// ============================================================
// Weather request from watchapp
// ============================================================

// PebbleKit JS delivers payload keys as numeric IDs on the emulator but as
// string names on real hardware.  Look up by both so the code works everywhere.
function getPayload(payload, key) {
  if (payload[key] !== undefined) return payload[key];
  for (var name in mk) {
    if (mk[name] === key) return payload[name];
  }
  return undefined;
}

Pebble.addEventListener('appmessage', function (e) {
  var payload = e.payload || {};
  if (!getPayload(payload, mk.GET_WEATHER)) return;

  var apiKey = cfg.getApiKey();

  weather.getWeather({
    apiKey:   apiKey,
    useGPS:   getPayload(payload, mk.WEATHER_USE_GPS) ? 1 : 0,
    location: getPayload(payload, mk.WEATHER_LOCATION) || ''
  }, function (err, currentData, forecastData) {
    if (err) {
      var errMsg = {};
      errMsg[mk.CONDITIONS] = err.message;
      Pebble.sendAppMessage(errMsg, function () {
        console.log('Weather status sent to watchface: ' + err.message);
      }, function (sendErr) {
        console.log('Weather status send failed: ' + JSON.stringify(sendErr));
      });
      return;
    }

    var msg = {};
    msg[mk.TEMPERATURE]       = currentData.tempF;
    msg[mk.TEMPERATURE_IN_C]  = currentData.tempC;
    msg[mk.CONDITIONS]        = currentData.conditions;
    msg[mk.CONDITION_CODE]    = currentData.conditionCode;

    if (forecastData) {
      msg[mk.TEMPERATURE_LO]      = forecastData.loF;
      msg[mk.TEMPERATURE_HI]      = forecastData.hiF;
      msg[mk.TEMPERATURE_IN_C_LO] = forecastData.loC;
      msg[mk.TEMPERATURE_IN_C_HI] = forecastData.hiC;
    }

    Pebble.sendAppMessage(msg, function () {
      console.log('Weather data sent to watchface');
    }, function (err) {
      console.log('Weather send failed: ' + JSON.stringify(err));
    });
  });
});

// ============================================================
// Configuration UI
// ============================================================

Pebble.addEventListener('showConfiguration', function () {
  var platform = '';
  try {
    platform = Pebble.getActiveWatchInfo().platform;
  } catch (e) {
    console.log('getActiveWatchInfo failed: ' + e.message);
  }
  var storedRaw = cfg.loadStoredConfig();
  var url = cfg.getConfigUrl(platform, storedRaw);
  console.log('Opening config URL: ' + url);
  Pebble.openURL(url);
});

Pebble.addEventListener('webviewclosed', function (e) {
  if (!e.response || e.response === 'CANCELLED') return;

  var raw;
  try {
    raw = JSON.parse(decodeURIComponent(e.response));
  } catch (err) {
    console.log('Failed to parse config response: ' + err.message);
    return;
  }

  // Store API key separately in localStorage (never sent to C watchapp)
  if (raw.owmApiKey !== undefined) {
    cfg.storeApiKey(raw.owmApiKey);
    delete raw.owmApiKey;
  }

  // Persist the rest of the raw config for pre-populating the config page next time
  cfg.storeConfig(raw);

  // Parse and build message to send to C watchapp
  var parsed = cfg.parseConfigResponse(raw);
  var msg    = cfg.buildAppMessage(parsed, mk);

  Pebble.sendAppMessage(msg, function () {
    console.log('Config sent to watchface');
  }, function (err) {
    console.log('Config send failed: ' + JSON.stringify(err));
  });
});
