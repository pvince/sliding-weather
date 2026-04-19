var __loader = (function() {

var loader = {};

loader.packages = {};

loader.packagesLinenoOrder = [{ filename: 'loader.js', lineno: 0 }];

loader.fileExts = ['?', '?.js', '?.json'];
loader.folderExts = ['?/index.js', '?/index.json'];

loader.basepath = function(path) {
  return path.replace(/[^\/]*$/, '');
};

loader.joinpath = function() {
  var result = arguments[0];
  for (var i = 1; i < arguments.length; ++i) {
    if (arguments[i][0] === '/') {
      result = arguments[i];
    } else if (result[result.length-1] === '/') {
      result += arguments[i];
    } else {
      result += '/' + arguments[i];
    }
  }

  if (result[0] === '/') {
    result = result.substr(1);
  }
  return result;
};

var replace = function(a, regexp, b) {
  var z;
  do {
    z = a;
  } while (z !== (a = a.replace(regexp, b)));
  return z;
};

loader.normalize = function(path) {
  path = replace(path, /(?:(^|\/)\.?\/)+/g, '$1');
  path = replace(path, /[^\/]*\/\.\.\//, '');
  path = path.replace(/\/\/+/g, '/');
  path = path.replace(/^\//, '');
  return path;
};

function _require(module) {
  if (module.exports) {
    return module.exports;
  }

  var require = function(path) { return loader.require(path, module); };

  module.exports = {};
  module.loader(module.exports, module, require);
  module.loaded = true;

  return module.exports;
}

loader.require = function(path, requirer) {
  var module = loader.getPackage(path, requirer);
  if (!module) {
    throw new Error("Cannot find module '" + path + "'");
  }

  return _require(module);
};

var compareLineno = function(a, b) { return a.lineno - b.lineno; };

loader.define = function(path, lineno, loadfun) {
  var module = {
    filename: path,
    lineno: lineno,
    loader: loadfun,
  };

  loader.packages[path] = module;
  loader.packagesLinenoOrder.push(module);
  loader.packagesLinenoOrder.sort(compareLineno);
};

loader.getPackageForPath = function(path) {
  return loader.getPackageForFile(path) || loader.getPackageForDirectory(path);
};

loader.getPackage = function(path, requirer) {
  var module;
  var fullPath;
  if (requirer && requirer.filename) {
    fullPath = loader.joinpath(loader.basepath(requirer.filename), path);
  } else {
    fullPath = path;
  }

if (loader.builtins.indexOf(path) !== -1) {
    return loader.packages[path];
}

  // Try loading the module from a path, if it is trying to load from a path.
  if (path.substr(0, 2) === './' || path.substr(0, 1) === '/' || path.substr(0, 3) === '../') {
    module = loader.getPackageForPath(fullPath);
  }

  if (!module) {
    module = loader.getPackageFromSDK(path);
  }

  if (!module) {
    module = loader.getPackageFromBuildOutput(path);
  }

  if (!module) {
    module = loader.getPackageForNodeModule(path);
  }

  return module;
};

loader.getPackageForFile = function(path) {
  path = loader.normalize(path);

  var module;
  var fileExts = loader.fileExts;
  for (var i = 0, ii = fileExts.length; !module && i < ii; ++i) {
    var filepath = fileExts[i].replace('?', path);
    module = loader.packages[filepath];
  }

  return module;
};

loader.getPackageForDirectory = function(path) {
  path = loader.normalize(path);

  var module;
  var packagePackage = loader.packages[loader.joinpath(path, 'package.json')];
  if (packagePackage) {
    var info = _require(packagePackage);
    if (info.main) {
      module = loader.getPackageForFile(loader.joinpath(path, info.main));
    }
  }

  if (!module) {
    module = loader.getPackageForFile(loader.joinpath(path, 'index'));
  }

  return module;
};

loader.getPackageFromSDK = function (path) {
  return loader.getPackageForPath(path);
};

loader.getPackageFromBuildOutput = function(path) {
  var moduleBuildPath = loader.normalize(loader.joinpath('build', 'js', path));

  return loader.getPackageForPath(moduleBuildPath);
};

// Nested node_modules are banned, so we can do a simple search here.
loader.getPackageForNodeModule = function(path) {
  var modulePath = loader.normalize(loader.joinpath('node_modules', path));

  return loader.getPackageForPath(modulePath);
};

loader.getPackageByLineno = function(lineno) {
  var packages = loader.packagesLinenoOrder;
  var module;
  for (var i = 0, ii = packages.length; i < ii; ++i) {
    var next = packages[i];
    if (next.lineno > lineno) {
      break;
    }
    module = next;
  }
  return module;
};

loader.builtins = ['safe'];

return loader;

})();

__loader.define('safe', 192, function(exports, module, require) {
/* safe.js - Building a safer world for Pebble.JS Developers
 *
 * This library provides wrapper around all the asynchronous handlers that developers
 * have access to so that error messages are caught and displayed nicely in the pebble tool
 * console.
 */

/* global __loader */

var safe = {};

/* The name of the concatenated file to translate */
safe.translateName = 'pebble-js-app.js';

safe.indent = '    ';

/* Translates a source line position to the originating file */
safe.translatePos = function(name, lineno, colno) {
  if (name === safe.translateName) {
    var pkg = __loader.getPackageByLineno(lineno);
    if (pkg) {
      name = pkg.filename;
      lineno -= pkg.lineno;
    }
  }
  return name + ':' + lineno + ':' + colno;
};

var makeTranslateStack = function(stackLineRegExp, translateLine) {
  return function(stack, level) {
    var lines = stack.split('\n');
    var firstStackLine = -1;
    for (var i = lines.length - 1; i >= 0; --i) {
      var m = lines[i].match(stackLineRegExp);
      if (!m) {
        continue;
      }
      var line = lines[i] = translateLine.apply(this, m);
      if (line) {
        firstStackLine = i;
        if (line.indexOf(module.filename) !== -1) {
          lines.splice(i, 1);
        }
      } else {
        lines.splice(i, lines.length - i);
      }
    }
    if (firstStackLine > -1) {
      lines.splice(firstStackLine, level);
    }
    return lines;
  };
};

/* Translates a node style stack trace line */
var translateLineV8 = function(line, msg, scope, name, lineno, colno) {
  var pos = safe.translatePos(name, lineno, colno);
  return msg + (scope ? ' ' + scope + ' (' + pos + ')' : pos);
};

/* Matches <msg> (<scope> '(')? <name> ':' <lineno> ':' <colno> ')'? */
var stackLineRegExpV8 = /(.+?)(?:\s+([^\s]+)\s+\()?([^\s@:]+):(\d+):(\d+)\)?/;

safe.translateStackV8 = makeTranslateStack(stackLineRegExpV8, translateLineV8);

/* Translates an iOS stack trace line to node style */
var translateLineIOS = function(line, scope, name, lineno, colno) {
  var pos = safe.translatePos(name, lineno, colno);
  return safe.indent + 'at ' + (scope ? scope  + ' (' + pos + ')' : pos);
};

/* Matches (<scope> '@' )? <name> ':' <lineno> ':' <colno> */
var stackLineRegExpIOS = /(?:([^\s@]+)@)?([^\s@:]+):(\d+):(\d+)/;

safe.translateStackIOS = makeTranslateStack(stackLineRegExpIOS, translateLineIOS);

/* Translates an Android stack trace line to node style */
var translateLineAndroid = function(line, msg, scope, name, lineno, colno) {
  if (name !== 'jskit_startup.js') {
    return translateLineV8(line, msg, scope, name, lineno, colno);
  }
};

/* Matches <msg> <scope> '('? filepath <name> ':' <lineno> ':' <colno> ')'? */
var stackLineRegExpAndroid = /^(.*?)(?:\s+([^\s]+)\s+\()?[^\s\(]*?([^\/]*?):(\d+):(\d+)\)?/;

safe.translateStackAndroid = makeTranslateStack(stackLineRegExpAndroid, translateLineAndroid);

/* Translates a stack trace to the originating files */
safe.translateStack = function(stack, level) {
  level = level || 0;
  if (Pebble.platform === 'pypkjs') {
    return safe.translateStackV8(stack, level);
  } else if (stack.match('com.getpebble.android')) {
    return safe.translateStackAndroid(stack, level);
  } else {
    return safe.translateStackIOS(stack, level);
  }
};

var normalizeIndent = function(lines, pos) {
  pos = pos || 0;
  var label = lines[pos].match(/^[^\s]* /);
  if (label) {
    var indent = label[0].replace(/./g, ' ');
    for (var i = pos + 1, ii = lines.length; i < ii; i++) {
      lines[i] = lines[i].replace(/^\t/, indent);
    }
  }
  return lines;
};

safe.translateError = function(err, intro, level) {
  var name = err.name;
  var message = err.message || err.toString();
  var stack = err.stack;
  var result = [intro || 'JavaScript Error:'];
  if (message && (!stack || stack.indexOf(message) === -1)) {
    if (name && message.indexOf(name + ':') === -1) {
      message = name + ': ' + message;
    }
    result.push(message);
  }
  if (stack) {
    Array.prototype.push.apply(result, safe.translateStack(stack, level));
  }
  return normalizeIndent(result, 1).join('\n');
};

/* Dumps error messages to the console. */
safe.dumpError = function(err, intro, level) {
  if (typeof err === 'object') {
    console.log(safe.translateError(err, intro, level));
  } else {
    console.log('Error: dumpError argument is not an object');
  }
};

/* Logs runtime warnings to the console. */
safe.warn = function(message, level, name) {
  var err = new Error(message);
  err.name = name || 'Warning';
  safe.dumpError(err, 'Warning:', 1);
};

/* Takes a function and return a new function with a call to it wrapped in a try/catch statement */
safe.protect = function(fn) {
  return fn ? function() {
    try {
      fn.apply(this, arguments);
    } catch (err) {
      safe.dumpError(err);
    }
  } : undefined;
};

/* Wrap event handlers added by Pebble.addEventListener */
var pblAddEventListener = Pebble.addEventListener;
Pebble.addEventListener = function(eventName, eventCallback) {
  pblAddEventListener.call(this, eventName, safe.protect(eventCallback));
};

var pblSendMessage = Pebble.sendAppMessage;
Pebble.sendAppMessage = function(message, success, failure) {
  return pblSendMessage.call(this, message, safe.protect(success), safe.protect(failure));
};

/* Wrap setTimeout and setInterval */
var originalSetTimeout = setTimeout;
window.setTimeout = function(callback, delay) {
  if (safe.warnSetTimeoutNotFunction !== false && typeof callback !== 'function') {
    safe.warn('setTimeout was called with a `' + (typeof callback) + '` type. ' +
              'Did you mean to pass a function?');
    safe.warnSetTimeoutNotFunction = false;
  }
  return originalSetTimeout(safe.protect(callback), delay);
};

var originalSetInterval = setInterval;
window.setInterval = function(callback, delay) {
  if (safe.warnSetIntervalNotFunction !== false && typeof callback !== 'function') {
    safe.warn('setInterval was called with a `' + (typeof callback) + '` type. ' +
              'Did you mean to pass a function?');
    safe.warnSetIntervalNotFunction = false;
  }
  return originalSetInterval(safe.protect(callback), delay);
};

/* Wrap the geolocation API Callbacks */
var watchPosition = navigator.geolocation.watchPosition;
navigator.geolocation.watchPosition = function(success, error, options) {
  return watchPosition.call(this, safe.protect(success), safe.protect(error), options);
};

var getCurrentPosition = navigator.geolocation.getCurrentPosition;
navigator.geolocation.getCurrentPosition = function(success, error, options) {
  return getCurrentPosition.call(this, safe.protect(success), safe.protect(error), options);
};

var ajax;

/* Try to load the ajax library if available and silently fail if it is not found. */
try {
  ajax = require('ajax');
} catch (err) {}

/* Wrap the success and failure callback of the ajax library */
if (ajax) {
  ajax.onHandler = function(eventName, callback) {
    return safe.protect(callback);
  };
}

module.exports = safe;
});
__loader.define('src/pkjs/app.js', 408, function(exports, module, require) {
var BASE_CONFIG_URL = 'http://singleserveapps.github.io/sliding-time-wd-config/';
//var BASE_CONFIG_URL = 'http://singleserveapps.github.io/sliding-time-beta-config/';

var APPID = 'd54c895c6e05649ee2ddef0d64532069';

var weatherProvider = 'ow';
var useWeatherGPS = 1;
var weatherLoc;

var xhrRequest = function (url, type, callback) {
  var xhr = new XMLHttpRequest();
  xhr.onload = function () {
    callback(this.responseText);
  };
  xhr.open(type, url);
  xhr.send();
};

Pebble.addEventListener('showConfiguration', function() {
  var rectURL = BASE_CONFIG_URL + 'index.html';
  var roundURL = BASE_CONFIG_URL + 'config_round.html';
  var watch;
  
  if(Pebble.getActiveWatchInfo) {
    try {
      watch = Pebble.getActiveWatchInfo();
    } catch(err) {
      watch = {
        platform: "basalt",
      };
    }
  } else {
    watch = {
      platform: "aplite",
    };
  }

  if(watch.platform == "aplite"){
    Pebble.openURL(rectURL);
  } else if(watch.platform == "chalk") {
    Pebble.openURL(roundURL);
  } else {
    Pebble.openURL(rectURL);
  }
});

Pebble.addEventListener('webviewclosed', function(e) {
	var configData = JSON.parse(decodeURIComponent(e.response));

	console.log('Configuration page returned: ' + JSON.stringify(configData));

	if (configData.backgroundColor) {
    console.log("backgroundColor: ", parseInt(configData.backgroundColor, 16));  
    console.log("hrColor: ", parseInt(configData.hrColor, 16));
    console.log("minColor: ", parseInt(configData.minColor, 16));
    console.log("wdColor: ", parseInt(configData.wdColor, 16));    
    console.log("weatherFrequency: ", parseInt(configData.weatherFrequency, 10));
    console.log("useGPS: ", parseInt(configData.useGPS, 10));
    console.log("weatherLocation: ", configData.weatherLocation);
    console.log("shakeforLoHi: ", parseInt(configData.shakeforLoHi, 10));
    console.log("useCelsius: ", parseInt(configData.useCelsius, 10));
    console.log("displayPrefix: ", parseInt(configData.displayPrefix, 10));
    console.log("displayDate: ", parseInt(configData.displayDate, 10));    
    console.log("weatherDateAlignment:  ", parseInt(configData.weatherDateAlignment, 10));
    console.log("hourMinutesAlignment: ", parseInt(configData.hourMinutesAlignment, 10));
    console.log("hourMinutesReadability: ", parseInt(configData.hourMinutesReadability, 10));
    console.log("weatherDateReadability: ", parseInt(configData.weatherDateReadability, 10));
    console.log("vibrateBT: ", parseInt(configData.vibrateBT, 10));    
    
      // Assemble dictionary using our keys
      var options_dictionary = {
        "KEY_BACKGROUND_COLOR": parseInt(configData.backgroundColor, 16),
        "KEY_HR_COLOR": parseInt(configData.hrColor, 16),
        "KEY_MIN_COLOR": parseInt(configData.minColor, 16),
        "KEY_WD_COLOR": parseInt(configData.wdColor, 16),        
        "KEY_WEATHER_FREQUENCY": parseInt(configData.weatherFrequency, 10),
        "KEY_WEATHER_USE_GPS":  parseInt(configData.useGPS, 10),
        "KEY_WEATHER_LOCATION":  configData.weatherLocation,
        "KEY_SHAKE_FOR_LOHI": parseInt(configData.shakeforLoHi, 10),
        "KEY_USE_CELSIUS": parseInt(configData.useCelsius, 10),
        "KEY_DISPLAY_O_PREFIX": parseInt(configData.displayPrefix, 10),
        "KEY_DISPLAY_DATE": parseInt(configData.displayDate, 10),        
        "KEY_WEATHERDATE_ALIGNMENT": parseInt(configData.weatherDateAlignment, 10),
        "KEY_HOURMINUTES_ALIGNMENT": parseInt(configData.hourMinutesAlignment, 10),
        "KEY_WEATHERDATE_READABILITY": parseInt(configData.weatherDateReadability, 10),
        "KEY_MINUTES_READABILITY": parseInt(configData.hourMinutesReadability, 10),
        "KEY_VIBBRATE_BT_STATUS": parseInt(configData.vibrateBT, 10)      
      };
    
      //getWeather();

      // Send to Pebble
      Pebble.sendAppMessage(options_dictionary,
        function(e) {
          console.log("webviewclosed: Watchface options successfully sent to Pebble");
        },
        function(e) {
          console.log('webviewclosed: Unable to deliver message with transactionId=' + e.data.transactionId + ' Error is: ' + e.error.message);
        }
      );
	}
});

function locationSuccessYahoo(pos) {
  
  var url = 'http://nominatim.openstreetmap.org/reverse?format=json&lat=' + pos.coords.latitude + '&lon=' + pos.coords.longitude; 
  xhrRequest(url, 'GET', 
             function(responseText) { 
               
               // responseText contains a JSON object with weather info 
               var json = JSON.parse(responseText);
               var location = json.display_name; 
               
               localStorage.setItem('weather_loc', location);
             }
            );

    getGPSweatherYahoo();
}

function getGPSweatherYahoo() {
  
  // Construct URL
  var location =  localStorage.getItem('weather_loc');
  
  var url = 'https://query.yahooapis.com/v1/public/yql?q=' +
          encodeURIComponent('select item.condition, item.forecast from weather.forecast where woeid in (select woeid from geo.places(1) where text="' +
          location + '") and u="c" limit 1') + '&format=json';

  console.log(url);
  
  //getGPSweather();
  updateWeatherData(url);

}

function staticLocationYahoo() {

  if(weatherLoc !== "") {
    var url = 'https://query.yahooapis.com/v1/public/yql?q=' +
        encodeURIComponent('select item.condition, item.forecast from weather.forecast where woeid in (select woeid from geo.places(1) where text="' +
                           weatherLoc + '") and u="c" limit 1') + '&format=json';
    console.log(url);

    updateWeatherData(url);
  } else {
    useWeatherGPS = 1;
    getWeather();
  }
}

function updateWeatherData(url) {
  try {    
      xhrRequest(url, 'GET',
    function(responseText) {
      // responseText contains a JSON object with weather info
      var json = JSON.parse(responseText);
      var condition = json.query.results.channel.item.condition;
      var forecast = json.query.results.channel.item.forecast;

      if(json.query.count == "1") {
        
        var temperature = Math.round(((condition.temp) * 1.8) + 32);
        console.log("Temperature in Fahrenheit is " + temperature); 
        
        var temperaturec = Math.round(condition.temp);
        console.log("Temperature in Celsius is " + temperaturec);
  
        // Conditions
        var conditions = condition.text;      
        console.log("Conditions are " + conditions);
        
        var conditioncode = Math.round(condition.code);
        console.log("Condition code is " + conditioncode);
        
        var tempFLo = Math.round(((forecast.low) * 1.8) + 32);
        console.log("Temperature in Fahrenheit Lo is " + tempFLo);
        
        var tempFHi = Math.round(((forecast.high) * 1.8) + 32);
        console.log("Temperature in Fahrenheit Hi is " + tempFHi);
        
        var tempCLo = Math.round(forecast.low);
        console.log("Temperature in Celsius Lo is " + tempCLo);
        
        var tempCHi = Math.round(forecast.high);
        console.log("Temperature in Celsius Hi is " + tempCHi);

        // Assemble dictionary using our keys
        var weather_dictionary = {
          "KEY_TEMPERATURE": temperature,
          "KEY_TEMPERATURE_IN_C": temperaturec,
          "KEY_CONDITIONS": conditions,
          "KEY_TEMPERATURE_LO": tempFLo,
          "KEY_TEMPERATURE_HI": tempFHi,
          "KEY_TEMPERATURE_IN_C_LO": tempCLo,
          "KEY_TEMPERATURE_IN_C_HI": tempCHi,
          "KEY_CONDITION_CODE": conditioncode
        };
        
        // Send to Pebble
        Pebble.sendAppMessage(weather_dictionary,
          function(e) {
            console.log("updateWeatherData: Weather info sent to Pebble successfully!");
          },
          function(e) {
            console.log('updateWeatherData: Unable to deliver message with transactionId=' + e.data.transactionId + ' Error is: ' + e.error.message);
          }
        );
      }
    }
    );
  }
  catch (exception){
    console.log(JSON.stringify(exception));
  }
}

function locationSuccessOW(pos) {
  
  // Construct URL
  var url = 'http://api.openweathermap.org/data/2.5/weather?lat=' + pos.coords.latitude + '&lon=' + pos.coords.longitude + '&APPID=' + APPID;
  var urlForecast = 'http://api.openweathermap.org/data/2.5/forecast/daily?lat=' + pos.coords.latitude + '&lon=' + pos.coords.longitude + '&cnt=1&APPID=' + APPID;
  console.log('url: ' + url);
  console.log('urlForecast: ' + urlForecast);
  
  updateWeatherDataOW(url, urlForecast);
}

function staticLocationOW() {
  
      if(weatherLoc !== '') {
        var url =  "http://api.openweathermap.org/data/2.5/weather?q=" + encodeURIComponent(weatherLoc) + '&APPID=' + APPID;
        var urlForecast = 'http://api.openweathermap.org/data/2.5/forecast/daily?q=' + encodeURIComponent(weatherLoc) + '&cnt=1&APPID=' + APPID;
        console.log('url: ' + url);
        console.log('urlForecast: ' + urlForecast);
        updateWeatherDataOW(url, urlForecast);
    } else {
      useWeatherGPS = 1;
      updateWeatherDataOW();
    }
}

function updateWeatherDataOW(url, urlForecast) {

  // Send request to forecast.io
  xhrRequest(url, 'GET', function(responseText) {
      try {

        // responseText contains a JSON object with weather info
        var json = JSON.parse(responseText);
  
        var temperature = Math.round(((json.main.temp - 273.15) * 1.8) + 32);
        console.log("Temperature in Fahrenheit is " + temperature); 
        
        var temperaturec = Math.round(json.main.temp - 273.15);
        console.log("Temperature in Celsius is " + temperaturec);
  
        // Conditions
        var conditions = json.weather[0].main;      
        console.log("Conditions are " + conditions);
        
        //placeholder
        var conditioncode = 0;
        console.log("Condition code is " + conditioncode);
        
        xhrRequest(urlForecast, 'GET', function(forecastRespText) {
          try {

            console.log('Retrieving forecast data from OpenWeatherMap');
            var fResp = JSON.parse(forecastRespText);

            var tempFLo = Math.round(((fResp.list[0].temp.min - 273.15) * 1.8) + 32);
            console.log("Temperature in Fahrenheit Lo is " + tempFLo);

            var tempFHi = Math.round(((fResp.list[0].temp.max - 273.15) * 1.8) + 32);
            console.log("Temperature in Fahrenheit Hi is " + tempFHi);

            var tempCLo = Math.round(fResp.list[0].temp.min - 273.15);
            console.log("Temperature in Celsius Lo is " + tempCLo);

            var tempCHi = Math.round(fResp.list[0].temp.max - 273.15);
            console.log("Temperature in Celsius Hi is " + tempCHi);

            // Assemble dictionary using our keys
            var weather_dictionary = {
              "KEY_TEMPERATURE": temperature,
              "KEY_TEMPERATURE_IN_C": temperaturec,
              "KEY_CONDITIONS": conditions,
              "KEY_TEMPERATURE_LO": tempFLo,
              "KEY_TEMPERATURE_HI": tempFHi,
              "KEY_TEMPERATURE_IN_C_LO": tempCLo,
              "KEY_TEMPERATURE_IN_C_HI": tempCHi,
              "KEY_CONDITION_CODE": conditioncode
            };

            // Send to Pebble
            Pebble.sendAppMessage(weather_dictionary,
                                  function(e) {
                                    console.log("locationSuccessOW: Weather info sent to Pebble successfully!");
                                  },
                                  function(e) {
                                    console.log('locationSuccessOW: Unable to deliver message with transactionId=' + e.data.transactionId + ' Error is: ' + e.error.message);
                                  });
          }
          catch (exception){
            console.log(JSON.stringify(exception));
          }
        });
      }
    catch (ex) {
      console.log('Failure requesting current weather from OpenWeatherMap');
      console.log(ex.stack);
    }
  });
}

function locationError(err) {
  console.log('Error requesting location!');
}

function getWeather() {
  
  if (weatherProvider=='yahoo') {
  
    if (useWeatherGPS) {
      navigator.geolocation.getCurrentPosition(
        locationSuccessYahoo,
        locationError,
        {timeout: 15000, maximumAge: 60000}
      );
    }
    else {
      staticLocationYahoo();
    }
  }
  else {
    if (useWeatherGPS) {
      navigator.geolocation.getCurrentPosition(
        locationSuccessOW,
        locationError,
        {timeout: 15000, maximumAge: 60000}
      );
    }
    else {
      staticLocationOW();
    }    
  }
}

Pebble.addEventListener('ready', function() {
  console.log('PebbleKit JS Ready!');

  // Notify the watchapp that it is now safe to send messages
  Pebble.sendAppMessage({ 'KEY_JS_READY': 1 });
  
  //getWeather();
});

Pebble.addEventListener('appmessage',
  function(e) {
    console.log("Got message: " + JSON.stringify(e));
    
    if (e.payload.KEY_GET_WEATHER) {
      console.log('AppMessage received! Updating weather.');
      useWeatherGPS = e.payload.KEY_WEATHER_USE_GPS;
      weatherLoc = e.payload.KEY_WEATHER_LOCATION;
      getWeather();
    }
  }
);
});
__loader.define('build/js/message_keys.json', 780, function(exports, module, require) {
module.exports = {
    "KEY_BACKGROUND_COLOR": 3,
    "KEY_CONDITIONS": 2,
    "KEY_CONDITION_CODE": 20,
    "KEY_DISPLAY_DATE": 27,
    "KEY_DISPLAY_O_PREFIX": 7,
    "KEY_DISPLAY_WEATHER": 8,
    "KEY_GET_WEATHER": 12,
    "KEY_HOURMINUTES_ALIGNMENT": 11,
    "KEY_HR_COLOR": 28,
    "KEY_JS_READY": 25,
    "KEY_MINUTES_READABILITY": 15,
    "KEY_MIN_COLOR": 29,
    "KEY_MIN_SINCE_WEATHER_UPDATE": 9,
    "KEY_OPTIONS": 99,
    "KEY_SHAKE_FOR_LOHI": 21,
    "KEY_TEMPERATURE": 13,
    "KEY_TEMPERATURE_HI": 17,
    "KEY_TEMPERATURE_IN_C": 1,
    "KEY_TEMPERATURE_IN_C_HI": 19,
    "KEY_TEMPERATURE_IN_C_LO": 18,
    "KEY_TEMPERATURE_LO": 16,
    "KEY_TIME_COLOR": 4,
    "KEY_USE_CELSIUS": 6,
    "KEY_VIBBRATE_BT_STATUS": 22,
    "KEY_WD_COLOR": 26,
    "KEY_WEATHERDATE_ALIGNMENT": 10,
    "KEY_WEATHERDATE_READABILITY": 14,
    "KEY_WEATHER_FREQUENCY": 5,
    "KEY_WEATHER_LOCATION": 24,
    "KEY_WEATHER_USE_GPS": 23
};
});
(function() {
  var safe = __loader.require('safe');
  safe.protect(function() {
    __loader.require('./src/pkjs/app');
  })();
})();