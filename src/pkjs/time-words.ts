export const HOURS: readonly string[] = [
  "",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];

export const ONES: readonly string[] = [
  "",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
];

export const TEENS: readonly string[] = [
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];

export const TENS: readonly string[] = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
];

export function computeTimeWords(hour24: number, minute: number): string[] {
  let h = hour24 % 12;
  if (h === 0) h = 12;

  const result = [HOURS[h]];

  if (minute === 0) {
    result.push("o'clock");
  } else if (minute < 10) {
    result.push(ONES[minute]);
  } else if (minute < 20) {
    result.push(TEENS[minute - 10]);
  } else {
    const tensDigit = Math.floor(minute / 10);
    const onesDigit = minute % 10;
    result.push(TENS[tensDigit]);
    if (onesDigit > 0) {
      result.push(ONES[onesDigit]);
    }
  }

  return result;
}
