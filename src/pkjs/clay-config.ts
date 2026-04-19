interface ClayOption {
  label: string;
  value: string;
}

interface ClayItem {
  type: string;
  id?: string;
  messageKey?: string;
  label?: string;
  description?: string;
  defaultValue?: string | number | boolean;
  options?: ClayOption[];
  attributes?: Record<string, string>;
  sunlight?: boolean;
}

interface ClaySection {
  type: string;
  capabilities?: string[];
  items?: ClayItem[];
  defaultValue?: string;
}

const clayConfig: ClaySection[] = [
  {
    type: "section",
    items: [
      {
        type: "heading",
        defaultValue: "OpenWeatherMap",
      },
      {
        type: "input",
        id: "owmApiKey",
        label: "API Key",
        description:
          "Get a free key at openweathermap.org/api. Stored only on your phone.",
        defaultValue: "",
        attributes: {
          placeholder: "Paste your OWM API key here",
          type: "password",
        },
      },
    ],
  },
  {
    type: "section",
    capabilities: ["COLOR"],
    items: [
      {
        type: "heading",
        defaultValue: "Colors",
      },
      {
        type: "color",
        messageKey: "BACKGROUND_COLOR",
        label: "Background",
        defaultValue: 0x000000,
        sunlight: true,
      },
      {
        type: "color",
        messageKey: "HR_COLOR",
        label: "Hours",
        defaultValue: 0xffffff,
        sunlight: true,
      },
      {
        type: "color",
        messageKey: "MIN_COLOR",
        label: "Minutes",
        defaultValue: 0xffffff,
        sunlight: true,
      },
      {
        type: "color",
        messageKey: "WD_COLOR",
        label: "Weather & Date",
        defaultValue: 0xffffff,
        sunlight: true,
      },
    ],
  },
  {
    type: "section",
    items: [
      {
        type: "heading",
        defaultValue: "Weather",
      },
      {
        type: "toggle",
        messageKey: "WEATHER_USE_GPS",
        label: "Use GPS location",
        defaultValue: true,
      },
      {
        type: "input",
        messageKey: "WEATHER_LOCATION",
        label: "Static location",
        description: "Used when GPS is disabled",
        defaultValue: "",
        attributes: {
          placeholder: "e.g. London, UK",
        },
      },
      {
        type: "select",
        messageKey: "USE_CELSIUS",
        label: "Temperature unit",
        defaultValue: "0",
        options: [
          { label: "Fahrenheit", value: "0" },
          { label: "Celsius", value: "1" },
        ],
      },
      {
        type: "select",
        messageKey: "WEATHER_FREQUENCY",
        label: "Update frequency",
        defaultValue: "30",
        options: [
          { label: "Every 15 min", value: "15" },
          { label: "Every 30 min", value: "30" },
          { label: "Every 60 min", value: "60" },
          { label: "Every 2 hours", value: "120" },
        ],
      },
      {
        type: "toggle",
        messageKey: "SHAKE_FOR_LOHI",
        label: "Shake for hi/lo temps",
        defaultValue: false,
      },
    ],
  },
  {
    type: "section",
    items: [
      {
        type: "heading",
        defaultValue: "Display",
      },
      {
        type: "toggle",
        messageKey: "DISPLAY_O_PREFIX",
        label: "Show degree symbol",
        defaultValue: true,
      },
      {
        type: "toggle",
        messageKey: "DISPLAY_DATE",
        label: "Show date",
        defaultValue: true,
      },
      {
        type: "toggle",
        messageKey: "VIBBRATE_BT_STATUS",
        label: "Vibrate on BT disconnect",
        defaultValue: true,
      },
    ],
  },
  {
    type: "section",
    capabilities: ["RECT"],
    items: [
      {
        type: "heading",
        defaultValue: "Layout",
      },
      {
        type: "select",
        messageKey: "HOURMINUTES_ALIGNMENT",
        label: "Time alignment",
        defaultValue: "1",
        options: [
          { label: "Center", value: "0" },
          { label: "Left", value: "1" },
          { label: "Right", value: "2" },
        ],
      },
    ],
  },
  {
    type: "section",
    items: [
      {
        type: "heading",
        defaultValue: "Readability",
      },
      {
        type: "select",
        messageKey: "WEATHERDATE_READABILITY",
        label: "Weather text size",
        defaultValue: "0",
        options: [
          { label: "Small", value: "0" },
          { label: "Small Bold", value: "1" },
          { label: "Large", value: "2" },
          { label: "Large Bold", value: "3" },
        ],
      },
    ],
  },
  {
    type: "submit",
    defaultValue: "Save",
  },
];

export default clayConfig;
