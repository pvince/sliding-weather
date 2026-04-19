'use strict';

var OWM_BASE = 'https://api.openweathermap.org/data/2.5/';

// ============================================================
// Temperature conversions
// ============================================================

function kelvinToF(k) {
  return Math.round((k - 273.15) * 1.8 + 32);
}

function kelvinToC(k) {
  return Math.round(k - 273.15);
}

// ============================================================
// URL builders
// ============================================================

function buildCurrentWeatherUrl(opts) {
  var base = OWM_BASE + 'weather?';
  if (opts.lat !== undefined && opts.lon !== undefined) {
    return base + 'lat=' + opts.lat + '&lon=' + opts.lon + '&appid=' + opts.apiKey;
  }
  return base + 'q=' + encodeURIComponent(opts.location) + '&appid=' + opts.apiKey;
}

function buildForecastUrl(opts) {
  var base = OWM_BASE + 'forecast/daily?cnt=1&';
  if (opts.lat !== undefined && opts.lon !== undefined) {
    return base + 'lat=' + opts.lat + '&lon=' + opts.lon + '&appid=' + opts.apiKey;
  }
  return base + 'q=' + encodeURIComponent(opts.location) + '&appid=' + opts.apiKey;
}

// ============================================================
// Response parsers
// ============================================================

function parseCurrentWeather(json) {
  if (!json || !json.main || !json.weather || !json.weather[0]) {
    return null;
  }
  var tempK = json.main.temp;
  return {
    tempF:      kelvinToF(tempK),
    tempC:      kelvinToC(tempK),
    conditions: json.weather[0].main || 'Unknown',
    conditionCode: (json.weather[0].id) || 0
  };
}

function parseForecast(json) {
  if (!json || !json.list || !json.list[0] || !json.list[0].temp) {
    return null;
  }
  var t = json.list[0].temp;
  return {
    loF: kelvinToF(t.min),
    hiF: kelvinToF(t.max),
    loC: kelvinToC(t.min),
    hiC: kelvinToC(t.max)
  };
}

// ============================================================
// Ajax helper
// ============================================================

function httpGet(url, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.onload = function () {
    // PebbleKit JS proxies XHR through the phone app; xhr.status may be
    // 0 or undefined for successful requests.  Only inspect status when
    // the runtime actually provides a real HTTP status code (>= 100).
    if (xhr.status >= 100) {
      if (xhr.status === 401) {
        callback(new Error('Invalid API Key'), null);
        return;
      }
      if (xhr.status === 429) {
        callback(new Error('API Rate Limit'), null);
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        callback(new Error('Weather Error'), null);
        return;
      }
    }
    try {
      var json = JSON.parse(xhr.responseText);
      callback(null, json);
    } catch (e) {
      callback(new Error('JSON parse error: ' + e.message), null);
    }
  };
  xhr.onerror = function () {
    callback(new Error('Network Error'), null);
  };
  xhr.send();
}

// ============================================================
// Main weather fetch
// ============================================================

/**
 * Fetch current weather + forecast and call onComplete with the merged result.
 * opts: { apiKey, lat?, lon?, location?, useGPS }
 */
function getWeather(opts, onComplete) {
  if (!opts.apiKey) {
    console.log('No OWM API key configured — skipping weather fetch');
    onComplete({ message: 'No API Key' });
    return;
  }

  function fetchWithCoords(lat, lon) {
    var coordOpts = { apiKey: opts.apiKey, lat: lat, lon: lon };
    httpGet(buildCurrentWeatherUrl(coordOpts), function (err, current) {
      if (err) {
        console.log('Current weather error: ' + err.message);
        onComplete({ message: err.message });
        return;
      }
      var currentData = parseCurrentWeather(current);
      if (!currentData) {
        console.log('Unexpected current weather response structure');
        onComplete({ message: 'Weather Error' });
        return;
      }
      httpGet(buildForecastUrl(coordOpts), function (errF, forecast) {
        var forecastData = (errF || !forecast) ? null : parseForecast(forecast);
        onComplete(null, currentData, forecastData);
      });
    });
  }

  function fetchWithLocation(location) {
    var locOpts = { apiKey: opts.apiKey, location: location };
    httpGet(buildCurrentWeatherUrl(locOpts), function (err, current) {
      if (err) {
        console.log('Current weather error: ' + err.message);
        onComplete({ message: err.message });
        return;
      }
      var currentData = parseCurrentWeather(current);
      if (!currentData) {
        console.log('Unexpected current weather response structure');
        onComplete({ message: 'Weather Error' });
        return;
      }
      httpGet(buildForecastUrl(locOpts), function (errF, forecast) {
        var forecastData = (errF || !forecast) ? null : parseForecast(forecast);
        onComplete(null, currentData, forecastData);
      });
    });
  }

  if (opts.useGPS) {
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        fetchWithCoords(pos.coords.latitude, pos.coords.longitude);
      },
      function (err) {
        console.log('Geolocation error: ' + err.message);
        // Fallback to static location if available
        if (opts.location) {
          fetchWithLocation(opts.location);
        } else {
          onComplete({ message: 'No Location' });
        }
      },
      { timeout: 15000 }
    );
  } else if (opts.location) {
    fetchWithLocation(opts.location);
  } else {
    // No location configured — fall back to GPS
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        fetchWithCoords(pos.coords.latitude, pos.coords.longitude);
      },
      function (err) {
        console.log('Geolocation fallback error: ' + err.message);
        onComplete({ message: 'No Location' });
      },
      { timeout: 15000 }
    );
  }
}

module.exports = {
  kelvinToF: kelvinToF,
  kelvinToC: kelvinToC,
  buildCurrentWeatherUrl: buildCurrentWeatherUrl,
  buildForecastUrl: buildForecastUrl,
  parseCurrentWeather: parseCurrentWeather,
  parseForecast: parseForecast,
  getWeather: getWeather
};
