import { describe, expect, test } from "bun:test";
import * as tw from "../../src/pkjs/time-words";

describe("computeTimeWords — hour conversion", () => {
  test("hours 1-12 produce correct hour word", () => {
    const expected = [
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
    for (let h = 1; h <= 12; h++) {
      const words = tw.computeTimeWords(h, 0);
      expect(words[0]).toBe(expected[h - 1]);
    }
  });

  test("midnight (hour 0) maps to twelve", () => {
    const words = tw.computeTimeWords(0, 0);
    expect(words[0]).toBe("twelve");
  });

  test("PM hours 13-23 map to 1-11", () => {
    expect(tw.computeTimeWords(13, 0)[0]).toBe("one");
    expect(tw.computeTimeWords(18, 0)[0]).toBe("six");
    expect(tw.computeTimeWords(23, 0)[0]).toBe("eleven");
  });

  test("noon (hour 12) maps to twelve", () => {
    const words = tw.computeTimeWords(12, 0);
    expect(words[0]).toBe("twelve");
  });

  test("hour 24 wraps to twelve (same as 0)", () => {
    const words = tw.computeTimeWords(24, 0);
    expect(words[0]).toBe("twelve");
  });
});

describe("computeTimeWords — minute :00", () => {
  test("produces 2 words: hour + o'clock", () => {
    const words = tw.computeTimeWords(3, 0);
    expect(words).toEqual(["three", "o'clock"]);
  });

  test("midnight 0:00", () => {
    expect(tw.computeTimeWords(0, 0)).toEqual(["twelve", "o'clock"]);
  });

  test("noon 12:00", () => {
    expect(tw.computeTimeWords(12, 0)).toEqual(["twelve", "o'clock"]);
  });
});

describe("computeTimeWords — minutes :01-:09", () => {
  test(":01 produces hour + one", () => {
    expect(tw.computeTimeWords(3, 1)).toEqual(["three", "one"]);
  });

  test(":05 produces hour + five", () => {
    expect(tw.computeTimeWords(3, 5)).toEqual(["three", "five"]);
  });

  test(":09 produces hour + nine", () => {
    expect(tw.computeTimeWords(3, 9)).toEqual(["three", "nine"]);
  });

  test("all single-digit minutes 1-9", () => {
    const ones = [
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
    for (let m = 1; m <= 9; m++) {
      const words = tw.computeTimeWords(1, m);
      expect(words).toEqual(["one", ones[m - 1]]);
    }
  });
});

describe("computeTimeWords — minutes :10-:19", () => {
  test(":10 produces hour + ten", () => {
    expect(tw.computeTimeWords(3, 10)).toEqual(["three", "ten"]);
  });

  test(":13 produces hour + thirteen", () => {
    expect(tw.computeTimeWords(3, 13)).toEqual(["three", "thirteen"]);
  });

  test(":19 produces hour + nineteen", () => {
    expect(tw.computeTimeWords(3, 19)).toEqual(["three", "nineteen"]);
  });

  test("all teen minutes 10-19", () => {
    const teens = [
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
    for (let m = 10; m <= 19; m++) {
      const words = tw.computeTimeWords(5, m);
      expect(words).toEqual(["five", teens[m - 10]]);
    }
  });
});

describe("computeTimeWords — exact tens", () => {
  test(":20 produces hour + twenty", () => {
    expect(tw.computeTimeWords(3, 20)).toEqual(["three", "twenty"]);
  });

  test(":30 produces hour + thirty", () => {
    expect(tw.computeTimeWords(3, 30)).toEqual(["three", "thirty"]);
  });

  test(":40 produces hour + forty", () => {
    expect(tw.computeTimeWords(3, 40)).toEqual(["three", "forty"]);
  });

  test(":50 produces hour + fifty", () => {
    expect(tw.computeTimeWords(3, 50)).toEqual(["three", "fifty"]);
  });
});

describe("computeTimeWords — tens + ones", () => {
  test(":21 produces hour + twenty + one", () => {
    expect(tw.computeTimeWords(3, 21)).toEqual(["three", "twenty", "one"]);
  });

  test(":35 produces hour + thirty + five", () => {
    expect(tw.computeTimeWords(7, 35)).toEqual(["seven", "thirty", "five"]);
  });

  test(":49 produces hour + forty + nine", () => {
    expect(tw.computeTimeWords(1, 49)).toEqual(["one", "forty", "nine"]);
  });

  test(":53 produces hour + fifty + three", () => {
    expect(tw.computeTimeWords(10, 53)).toEqual(["ten", "fifty", "three"]);
  });

  test(":59 produces hour + fifty + nine", () => {
    expect(tw.computeTimeWords(12, 59)).toEqual(["twelve", "fifty", "nine"]);
  });
});

describe("computeTimeWords — matches screenshots", () => {
  test("10:53 → ten / fifty / three", () => {
    expect(tw.computeTimeWords(10, 53)).toEqual(["ten", "fifty", "three"]);
  });

  test("3:13 → three / thirteen", () => {
    expect(tw.computeTimeWords(3, 13)).toEqual(["three", "thirteen"]);
  });

  test("15:13 (3:13 PM) → three / thirteen", () => {
    expect(tw.computeTimeWords(15, 13)).toEqual(["three", "thirteen"]);
  });

  test("10:45 → ten / forty / five", () => {
    expect(tw.computeTimeWords(10, 45)).toEqual(["ten", "forty", "five"]);
  });

  test("3:05 → three / five", () => {
    expect(tw.computeTimeWords(3, 5)).toEqual(["three", "five"]);
  });
});

describe("computeTimeWords — result structure", () => {
  test("always returns at least 2 elements", () => {
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m++) {
        const words = tw.computeTimeWords(h, m);
        expect(words.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  test("never returns more than 3 elements", () => {
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m++) {
        const words = tw.computeTimeWords(h, m);
        expect(words.length).toBeLessThanOrEqual(3);
      }
    }
  });

  test("all elements are non-empty strings", () => {
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m++) {
        const words = tw.computeTimeWords(h, m);
        words.forEach((w) => {
          expect(typeof w).toBe("string");
          expect(w.length).toBeGreaterThan(0);
        });
      }
    }
  });

  test("all elements are lowercase", () => {
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m++) {
        const words = tw.computeTimeWords(h, m);
        words.forEach((w) => {
          expect(w).toBe(w.toLowerCase());
        });
      }
    }
  });
});

describe("word table exports", () => {
  test("HOURS has 13 entries (index 0 is empty)", () => {
    expect(tw.HOURS).toHaveLength(13);
    expect(tw.HOURS[0]).toBe("");
    expect(tw.HOURS[12]).toBe("twelve");
  });

  test("ONES has 10 entries (index 0 is empty)", () => {
    expect(tw.ONES).toHaveLength(10);
    expect(tw.ONES[0]).toBe("");
    expect(tw.ONES[9]).toBe("nine");
  });

  test("TEENS has 10 entries for 10-19", () => {
    expect(tw.TEENS).toHaveLength(10);
    expect(tw.TEENS[0]).toBe("ten");
    expect(tw.TEENS[9]).toBe("nineteen");
  });

  test("TENS has 6 entries (indices 0-1 empty, 2-5 are twenty-fifty)", () => {
    expect(tw.TENS).toHaveLength(6);
    expect(tw.TENS[0]).toBe("");
    expect(tw.TENS[1]).toBe("");
    expect(tw.TENS[2]).toBe("twenty");
    expect(tw.TENS[5]).toBe("fifty");
  });
});
