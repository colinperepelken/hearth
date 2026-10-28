import { describe, expect, it } from 'vitest';
import { feet, formatImperial, inches, parseLength } from './units';

describe('formatImperial', () => {
  it('formats feet, inches and fractions', () => {
    expect(formatImperial(feet(3) + inches(6.5))).toBe(`3' 6 1/2"`);
    expect(formatImperial(inches(24))).toBe(`2' 0"`);
    expect(formatImperial(inches(11.75))).toBe(`11 3/4"`);
  });
});

describe('parseLength', () => {
  it.each([
    [`3' 6"`, feet(3) + inches(6)],
    [`3ft 6 1/2in`, feet(3) + inches(6.5)],
    [`42"`, inches(42)],
    [`42`, inches(42)],
    [`10'`, feet(10)],
    [`1067mm`, 1067],
    [`1.2m`, 1200],
    [`90cm`, 900],
  ])('parses %s', (input, expected) => {
    expect(parseLength(input)).toBeCloseTo(expected);
  });

  it('reads bare numbers as mm in metric', () => {
    expect(parseLength('600', 'metric')).toBe(600);
  });

  it('rejects junk', () => {
    expect(parseLength('abc')).toBeNull();
    expect(parseLength('')).toBeNull();
  });
});
