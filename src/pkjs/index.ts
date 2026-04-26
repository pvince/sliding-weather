import Clay from "@rebble/clay";
import clayConfig from "./clay-config";
import * as cfg from "./config";
import customClay from "./custom-clay";
import * as weather from "./weather";

interface ClaySettingsValue {
  value: string | number | boolean;
}

interface ClayInstance {
  generateUrl(): string;
  getSettings(
    response: string,
    convert?: boolean,
  ): Record<string | number, string | number | ClaySettingsValue>;
  meta: {
    userData: {
      apiKey?: string;
    };
  };
}

interface ClayConstructor {
  new (
  config: typeof clayConfig,
  customFn: typeof customClay,
  options: { autoHandleEvents: boolean; userData: Record<string, never> },
  ): ClayInstance;
  prepareSettingsForAppMessage(
    settings: Record<string, ClaySettingsValue>,
  ): Record<string | number, unknown>;
}

const ClayCtor = Clay as unknown as ClayConstructor;

const clay = new ClayCtor(clayConfig, customClay, {
  autoHandleEvents: false,
  userData: {},
});

const mk: Record<string, number> = require("../../build/js/message_keys.json");

Pebble.addEventListener("showConfiguration", () => {
  clay.meta.userData.apiKey = cfg.getApiKey();
  Pebble.openURL(clay.generateUrl());
});

Pebble.addEventListener("webviewclosed", (e) => {
  if (!e || !e.response) return;

  const rawSettings = clay.getSettings(e.response, false) as Record<
    string,
    ClaySettingsValue
  >;
  const apiKey = rawSettings.OWM_API_KEY?.value;
  if (typeof apiKey === "string") {
    cfg.storeApiKey(apiKey);
  }

  const sanitizedSettings: Record<string, ClaySettingsValue> = {};
  for (const key in rawSettings) {
    if (key === "OWM_API_KEY") {
      continue;
    }

    sanitizedSettings[key] = rawSettings[key];
  }

  const outboundSettings = ClayCtor.prepareSettingsForAppMessage(
    sanitizedSettings,
  );

  // Clay returns string values for <select> items (e.g. "0", "1", "30").
  // Coerce any numeric string to a JS number so the C layer receives an
  // int32 AppMessage tuple rather than a CSTRING.
  const coercedSettings: Record<string | number, unknown> = {};
  for (const key in outboundSettings) {
    const val = outboundSettings[key];
    coercedSettings[key] =
      typeof val === "string" && val.trim() !== "" && !Number.isNaN(Number(val))
        ? Number(val)
        : val;
  }

  Pebble.sendAppMessage(
    coercedSettings,
    () => {
      console.log("Sent config data to Pebble");
    },
    (error) => {
      console.log("Failed to send config data!");
      console.log(JSON.stringify(error));
    },
  );
});

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
