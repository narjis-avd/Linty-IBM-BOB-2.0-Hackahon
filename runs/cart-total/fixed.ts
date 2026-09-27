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
