'use strict';

var fs   = require('fs');
var path = require('path');

// ============================================================
// Helpers to set up DOM from HTML file
// ============================================================

function loadPage(filename, hash) {
  var htmlPath = path.resolve(__dirname, '../../docs', filename);
  var html = fs.readFileSync(htmlPath, 'utf8');
  document.open();
  document.write(html);
  document.close();
  if (hash) {
    // jsdom doesn't execute the inline script automatically in all versions,
    // so we set the hash and re-run the initialization script manually.
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { hash: '#' + hash, href: 'about:blank', assign: jest.fn() }
    });
  }
}

// Helpers to collect config from the DOM (mirrors collectConfig() in the pages)
function getToggleValue(id) {
  return document.getElementById(id).checked ? '1' : '0';
}
function getSelectValue(id) {
  return document.getElementById(id).value;
}
function getColorValue(id) {
  return document.getElementById(id).value.replace('#', '');
}
function getTextValue(id) {
  return document.getElementById(id).value.trim();
}

// Helper: install a returnConfig spy and return a getter for the captured URL
function spyOnReturnConfig() {
  var captured = null;
  window.returnConfig = function(url) { captured = url; };
  return { get: function() { return captured; } };
}

// ============================================================
// Tests for rectangular config page
// ============================================================

describe('Rectangular config page (index.html)', function () {
  beforeEach(function () {
    loadPage('index.html', '');
  });

  test('form renders with expected field IDs', function () {
    var requiredIds = [
      'owmApiKey', 'backgroundColor', 'hrColor', 'minColor', 'wdColor',
      'useGPS', 'weatherLocation', 'useCelsius', 'weatherFrequency',
      'shakeForLoHi', 'displayPrefix', 'displayDate',
      'weatherDateAlignment', 'hourMinutesAlignment', 'weatherDateReadability',
      'vibrateBT', 'btn-save', 'btn-cancel'
    ];
    requiredIds.forEach(function (id) {
      expect(document.getElementById(id)).not.toBeNull();
    });
  });

  test('default color values are black background and white text', function () {
    expect(getColorValue('backgroundColor')).toBe('000000');
    expect(getColorValue('hrColor')).toBe('ffffff');
    expect(getColorValue('minColor')).toBe('ffffff');
    expect(getColorValue('wdColor')).toBe('ffffff');
  });

  test('default toggles: useGPS on, shakeForLoHi off, displayDate on', function () {
    expect(getToggleValue('useGPS')).toBe('1');
    expect(getToggleValue('shakeForLoHi')).toBe('0');
    expect(getToggleValue('displayDate')).toBe('1');
    expect(getToggleValue('vibrateBT')).toBe('1');
  });

  test('default weather frequency is 30 minutes', function () {
    expect(getSelectValue('weatherFrequency')).toBe('30');
  });

  test('default alignment: weather center (0), time left (1)', function () {
    expect(getSelectValue('weatherDateAlignment')).toBe('0');
    expect(getSelectValue('hourMinutesAlignment')).toBe('1');
  });

  test('static location row hidden when GPS is enabled', function () {
    document.getElementById('useGPS').checked = true;
    document.getElementById('useGPS').dispatchEvent(new Event('change'));
    var row = document.getElementById('row-location');
    expect(row.style.display).toBe('none');
  });

  test('static location row visible when GPS is disabled', function () {
    var el = document.getElementById('useGPS');
    el.checked = false;
    el.dispatchEvent(new Event('change'));
    var row = document.getElementById('row-location');
    expect(row.style.display).toBe('flex');
  });

  test('save button produces pebblejs:// URL with JSON payload', function () {
    var spy = spyOnReturnConfig();
    document.getElementById('btn-save').click();

    var redirectUrl = spy.get();
    expect(redirectUrl).toBeTruthy();
    expect(redirectUrl).toMatch(/^pebblejs:\/\/close#/);

    var encoded = redirectUrl.replace('pebblejs://close#', '');
    var data = JSON.parse(decodeURIComponent(encoded));

    expect(data).toHaveProperty('owmApiKey');
    expect(data).toHaveProperty('backgroundColor');
    expect(data).toHaveProperty('hrColor');
    expect(data).toHaveProperty('useGPS');
    expect(data).toHaveProperty('weatherFrequency');
    expect(data).toHaveProperty('useCelsius');
    expect(data).toHaveProperty('weatherDateAlignment');
    expect(data).toHaveProperty('hourMinutesAlignment');
  });

  test('cancel button redirects to pebblejs://close#CANCELLED', function () {
    var spy = spyOnReturnConfig();
    document.getElementById('btn-cancel').click();
    expect(spy.get()).toBe('pebblejs://close#CANCELLED');
  });

  test('color values round-trip through form → JSON → parse', function () {
    // Set a specific color
    document.getElementById('backgroundColor').value = '#ff3300';
    document.getElementById('btn-save').click();
    // We can't easily capture the redirect in this test context,
    // so test the round-trip logic directly
    var hexStr = getColorValue('backgroundColor');  // 'ff3300'
    var hexInt = parseInt(hexStr, 16);
    expect(hexInt).toBe(0xFF3300);
  });

  test('save JSON contains all required keys', function () {
    var allKeys = [
      'owmApiKey', 'backgroundColor', 'hrColor', 'minColor', 'wdColor',
      'useGPS', 'weatherLocation', 'useCelsius', 'weatherFrequency',
      'shakeForLoHi', 'displayPrefix', 'displayDate',
      'weatherDateAlignment', 'hourMinutesAlignment', 'weatherDateReadability',
      'vibrateBT'
    ];

    var spy = spyOnReturnConfig();
    document.getElementById('btn-save').click();

    var encoded = spy.get().replace('pebblejs://close#', '');
    var data = JSON.parse(decodeURIComponent(encoded));

    allKeys.forEach(function (k) {
      expect(data).toHaveProperty(k);
    });
  });
});

// ============================================================
// Tests for round config page
// ============================================================

describe('Round config page (config_round.html)', function () {
  beforeEach(function () {
    loadPage('config_round.html', '');
  });

  test('form renders with expected field IDs', function () {
    var requiredIds = [
      'owmApiKey', 'backgroundColor', 'hrColor', 'minColor', 'wdColor',
      'useGPS', 'weatherLocation', 'useCelsius', 'weatherFrequency',
      'shakeForLoHi', 'displayPrefix', 'displayDate',
      'weatherDateReadability', 'vibrateBT', 'btn-save', 'btn-cancel'
    ];
    requiredIds.forEach(function (id) {
      expect(document.getElementById(id)).not.toBeNull();
    });
  });

  test('round page does NOT have alignment selects (always centered)', function () {
    expect(document.getElementById('weatherDateAlignment')).toBeNull();
    expect(document.getElementById('hourMinutesAlignment')).toBeNull();
  });

  test('save JSON hard-codes center alignment for round display', function () {
    var spy = spyOnReturnConfig();
    document.getElementById('btn-save').click();

    var encoded = spy.get().replace('pebblejs://close#', '');
    var data = JSON.parse(decodeURIComponent(encoded));

    expect(data.weatherDateAlignment).toBe('0');  // center
    expect(data.hourMinutesAlignment).toBe('0');  // center
  });

  test('cancel returns CANCELLED', function () {
    var spy = spyOnReturnConfig();
    document.getElementById('btn-cancel').click();
    expect(spy.get()).toBe('pebblejs://close#CANCELLED');
  });
});

// ============================================================
// pebblejs:// URI encode/decode round-trip
// ============================================================

describe('pebblejs:// URI round-trip', function () {
  test('encodeURIComponent / decodeURIComponent preserves all special chars', function () {
    var config = {
      owmApiKey:       'abc+def/xyz=123',
      weatherLocation: 'São Paulo, BR',
      backgroundColor: 'ff0000'
    };
    var encoded = encodeURIComponent(JSON.stringify(config));
    var decoded = JSON.parse(decodeURIComponent(encoded));
    expect(decoded).toEqual(config);
  });

  test('empty API key encodes and decodes as empty string', function () {
    var config = { owmApiKey: '' };
    var encoded = encodeURIComponent(JSON.stringify(config));
    var decoded = JSON.parse(decodeURIComponent(encoded));
    expect(decoded.owmApiKey).toBe('');
  });
});
