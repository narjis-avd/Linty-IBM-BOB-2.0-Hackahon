import { describe, it, expect } from 'vitest';
import {
  cartSubtotal,
  applyDiscount,
  averageItemPrice,
  mostExpensive,
  formatTotal,
  CartItem,
} from './subject';

const sampleItems: CartItem[] = [
  { sku: 'A', price: 10, quantity: 2 },
  { sku: 'B', price: 5,  quantity: 3 },
  { sku: 'C', price: 20, quantity: 1 },
];

describe('cartSubtotal', () => {
  it('[E1] does not throw on a non-empty array', () => {
    // Original crashes with TypeError due to off-by-one; fixed returns a number.
    expect(() => cartSubtotal(sampleItems)).not.toThrow();
  });

  it('[E1] returns the correct subtotal', () => {
    // 10*2 + 5*3 + 20*1 = 55
    expect(cartSubtotal(sampleItems)).toBe(55);
  });
});

describe('applyDiscount', () => {
  it('[E2] deducts 20% from the subtotal', () => {
    // Original returns 100 * 0.2 = 20; fixed returns 100 * 0.8 = 80.
    expect(applyDiscount(100, 0.2)).toBe(80);
  });

  it('[E2] a 0% discount leaves the subtotal unchanged', () => {
    expect(applyDiscount(50, 0)).toBe(50);
  });
});

describe('averageItemPrice', () => {
  it('[E3] returns 0 for an empty array instead of NaN', () => {
    // Original divides 0/0 = NaN; fixed returns 0.
    expect(averageItemPrice([])).toBe(0);
  });

  it('[E3] computes the correct average for non-empty input', () => {
    // (10 + 5 + 20) / 3 ≈ 11.666...
    expect(averageItemPrice(sampleItems)).toBeCloseTo(11.667, 2);
  });
});

describe('mostExpensive', () => {
  it('[E4] does not mutate the original array', () => {
    const items: CartItem[] = [
      { sku: 'X', price: 1, quantity: 1 },
      { sku: 'Y', price: 3, quantity: 1 },
      { sku: 'Z', price: 2, quantity: 1 },
    ];
    const originalOrder = items.map((i) => i.sku);
    mostExpensive(items);
    expect(items.map((i) => i.sku)).toEqual(originalOrder);
  });

  it('[E4] returns the item with the highest price', () => {
    expect(mostExpensive(sampleItems)?.sku).toBe('C');
  });
});

describe('formatTotal', () => {
  it('[E5] formats a whole number with two decimal places', () => {
    // Original returns '$9'; fixed returns '$9.00'.
    expect(formatTotal(9)).toBe('$9.00');
  });

  it('[E5] rounds a floating-point value to two decimals', () => {
    // Original returns '$9.999999999'; fixed returns '$10.00'.
    expect(formatTotal(9.999999999)).toBe('$10.00');
  });
});

// ── Edge cases ──────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('cartSubtotal returns 0 for an empty cart', () => {
    expect(cartSubtotal([])).toBe(0);
  });

  it('mostExpensive returns undefined for an empty array', () => {
    expect(mostExpensive([])).toBeUndefined();
  });
});
