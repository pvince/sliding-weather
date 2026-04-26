import Clay from "@rebble/clay";
import clayConfig from "./clay-config";
import * as cfg from "./config";
import customClay from "./custom-clay";
import * as weather from "./weather";

const _clay = new Clay(clayConfig, customClay);

const mk: Record<string, number> = require("../../build/js/message_keys.json");

Pebble.addEventListener("ready", () => {
  console.log("PebbleKit JS ready");
  const ready: Record<number, number> = {};
  ready[mk.JS_READY] = 1;
  Pebble.sendAppMessage(
    ready,
    () => {
      console.log("JS_READY sent");
    },
    (e) => {
      console.log(`JS_READY send failed: ${JSON.stringify(e)}`);
    },
  );
});

function getPayload(
  payload: Record<string | number, unknown>,
  key: number,
): unknown {
  if (payload[key] !== undefined) return payload[key];
  for (const name in mk) {
    if (mk[name] === key) return payload[name];
  }
  return undefined;
}

Pebble.addEventListener("appmessage", (e) => {
  const payload = e.payload || {};
  if (!getPayload(payload, mk.GET_WEATHER)) return;

  const apiKey = cfg.getApiKey();

  weather.getWeather(
    {
      apiKey: apiKey,
      useGPS: getPayload(payload, mk.WEATHER_USE_GPS) ? 1 : 0,
      location: (getPayload(payload, mk.WEATHER_LOCATION) as string) || "",
    },
    (err, currentData) => {
      if (err) {
        const errMsg: Record<number, string> = {};
        errMsg[mk.CONDITIONS] = err.message;
        Pebble.sendAppMessage(
          errMsg,
          () => {
            console.log(`Weather status sent to watchface: ${err.message}`);
          },
          (sendErr) => {
            console.log(
              `Weather status send failed: ${JSON.stringify(sendErr)}`,
            );
          },
        );
        return;
      }

      const msg: Record<number, string | number> = {};
      if (currentData) {
        msg[mk.TEMPERATURE] = currentData.tempF;
        msg[mk.TEMPERATURE_IN_C] = currentData.tempC;
        msg[mk.CONDITIONS] = currentData.conditions;
        msg[mk.CONDITION_CODE] = currentData.conditionCode;
      }

      Pebble.sendAppMessage(
        msg,
        () => {
          console.log("Weather data sent to watchface");
        },
        (err) => {
          console.log(`Weather send failed: ${JSON.stringify(err)}`);
        },
      );
    },
  );
});
