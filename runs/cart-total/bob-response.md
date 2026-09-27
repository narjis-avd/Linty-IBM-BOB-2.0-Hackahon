## Agent 1 — Analyzer

```json
{
  "errors": [
    {
      "id": "E1",
      "type": "Runtime",
      "description": "Off-by-one error: loop condition uses `<=` instead of `<`, so `items[items.length]` is accessed, which is `undefined`, causing a TypeError at runtime.",
      "line": 12,
      "severity": "High",
      "suggestion": "Change `i <= items.length` to `i < items.length`."
    },
    {
      "id": "E2",
      "type": "Logical",
      "description": "`applyDiscount` returns `subtotal * discount` instead of `subtotal * (1 - discount)`. A 20% discount should reduce the subtotal by 20%, not reduce it to 20% of its value.",
      "line": 20,
      "severity": "High",
      "suggestion": "Return `subtotal * (1 - discount)` to apply the discount correctly."
    },
    {
      "id": "E3",
      "type": "Runtime",
      "description": "`averageItemPrice` divides by `items.length` without guarding against an empty array, resulting in division by zero (returns `NaN`).",
      "line": 25,
      "severity": "Medium",
      "suggestion": "Return `0` (or `NaN`) early when `items.length === 0`."
    },
    {
      "id": "E4",
      "type": "Logical",
      "description": "`mostExpensive` calls `Array.prototype.sort` in-place, mutating the caller's array. The original order is destroyed as a side-effect.",
      "line": 29,
      "severity": "Medium",
      "suggestion": "Spread the array before sorting: `[...items].sort(...)`."
    },
    {
      "id": "E5",
      "type": "Logical",
      "description": "`formatTotal` concatenates a number directly onto a string, producing values like `'$9.999999999'` instead of a properly formatted currency string.",
      "line": 33,
      "severity": "Low",
      "suggestion": "Use `amount.toFixed(2)` to produce a two-decimal currency string: `'$' + amount.toFixed(2)`."
    }
  ],
  "risk_level": "High",
  "summary": "The file contains two High-severity bugs (an off-by-one loop that crashes at runtime and an inverted discount formula that returns the wrong value), two Medium bugs (division-by-zero on empty input and destructive in-place sort), and one Low issue (unformatted currency output). The High bugs make `cartSubtotal` and `applyDiscount` completely unusable in production."
}
```

---

## Agent 2 — Fixer

```ts
// Linty demo sample: shopping cart maths with seeded bugs.
// Ground truth lives in cart-total.expected.json. Do not fix by hand.

export interface CartItem {
  sku: string;
  price: number; // unit price in dollars
  quantity: number;
}

export function cartSubtotal(items: CartItem[]): number {
  let total = 0;
  for (let i = 0; i < items.length; i++) { // E1: < not <=
    total += items[i].price * items[i].quantity;
  }
  return total;
}

// discount is a fraction, e.g. 0.2 for 20% off
export function applyDiscount(subtotal: number, discount: number): number {
  return subtotal * (1 - discount); // E2: apply discount, not replace with fraction
}

export function averageItemPrice(items: CartItem[]): number {
  if (items.length === 0) return 0; // E3: guard against empty array
  const sum = items.reduce((acc, item) => acc + item.price, 0);
  return sum / items.length;
}

export function mostExpensive(items: CartItem[]): CartItem | undefined {
  return [...items].sort((a, b) => b.price - a.price)[0]; // E4: copy before sort
}

export function formatTotal(amount: number): string {
  return '$' + amount.toFixed(2); // E5: two-decimal currency format
}
```

```json
[
  { "issueId": "E1", "change": "Changed loop condition from `i <= items.length` to `i < items.length` to prevent out-of-bounds access." },
  { "issueId": "E2", "change": "Changed return value from `subtotal * discount` to `subtotal * (1 - discount)` so the discount is subtracted, not applied as a multiplier." },
  { "issueId": "E3", "change": "Added an early-return guard `if (items.length === 0) return 0;` before the divide to prevent NaN." },
  { "issueId": "E4", "change": "Replaced `items.sort(...)` with `[...items].sort(...)` so the original array is not mutated." },
  { "issueId": "E5", "change": "Replaced `'$' + amount` with `'$' + amount.toFixed(2)` to produce a properly formatted currency string." }
]
```

---

## Agent 3 — Tester

```ts
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
```

---

## Agent 4 — Reporter

```json
{
  "summary": "Analysis identified 5 bugs across the 5 exported functions: 2 High-severity (off-by-one loop crash in `cartSubtotal`, inverted discount formula in `applyDiscount`), 2 Medium-severity (division-by-zero in `averageItemPrice`, in-place mutation in `mostExpensive`), and 1 Low-severity (unformatted currency output in `formatTotal`). Every High and Medium issue was fixed with a single-line change each, preserving all function signatures and exports. The Vitest suite covers all 5 fixed issues with targeted regression tests plus 2 edge-case tests (empty-cart subtotal and undefined return from `mostExpensive` on empty input), giving 12 test cases in total. No issues remain unfixed after the Agent 2 pass.",
  "recommendations": [
    "Add input-validation or TypeScript branded types to `applyDiscount` to enforce that `discount` is in the range [0, 1), preventing logically invalid discounts such as negative values or values ≥ 1.",
    "Run the Vitest suite in CI on every pull request to catch regressions in cart arithmetic before they reach production.",
    "Consider replacing the manual `for` loop in `cartSubtotal` with `Array.prototype.reduce` to eliminate the category of off-by-one loop bugs entirely.",
    "Evaluate whether `averageItemPrice` should return `0` or `NaN` for an empty cart and document the contract explicitly so callers handle it consistently."
  ]
}
```
