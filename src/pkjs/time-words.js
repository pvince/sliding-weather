'use strict';

// ============================================================
// Word lookup tables
// ============================================================

var HOURS = [
  '', 'one', 'two', 'three', 'four', 'five', 'six',
  'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'
];

var ONES = [
  '', 'one', 'two', 'three', 'four', 'five',
  'six', 'seven', 'eight', 'nine'
];

var TEENS = [
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen',
  'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'
];

var TENS = [
  '', '', 'twenty', 'thirty', 'forty', 'fifty'
];

// ============================================================
// Time-to-words conversion
// ============================================================

/**
 * Convert a 24h hour and minute into an array of 2-3 lowercase word strings.
 * Always uses 12h format (ignores system 24h setting).
 *
 * @param {number} hour24 - Hour in 24h format (0-23)
 * @param {number} minute - Minute (0-59)
 * @returns {string[]} Array of 2-3 word strings
 */
function computeTimeWords(hour24, minute) {
  // Convert to 12h
  var h = hour24 % 12;
  if (h === 0) h = 12;

  var result = [HOURS[h]];

  if (minute === 0) {
    result.push("o'clock");
  } else if (minute < 10) {
    result.push(ONES[minute]);
  } else if (minute < 20) {
    result.push(TEENS[minute - 10]);
  } else {
    var tensDigit = Math.floor(minute / 10);
    var onesDigit = minute % 10;
    result.push(TENS[tensDigit]);
    if (onesDigit > 0) {
      result.push(ONES[onesDigit]);
    }
  }

  return result;
}

module.exports = {
  computeTimeWords: computeTimeWords,
  HOURS: HOURS,
  ONES: ONES,
  TEENS: TEENS,
  TENS: TENS
};
