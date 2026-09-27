// Linty demo sample: shopping cart maths with seeded bugs.
// Ground truth lives in cart-total.expected.json. Do not fix by hand.

export interface CartItem {
  sku: string;
  price: number; // unit price in dollars
  quantity: number;
}

export function cartSubtotal(items: CartItem[]): number {
  let total = 0;
  for (let i = 0; i <= items.length; i++) {
    total += items[i].price * items[i].quantity;
  }
  return total;
}

// discount is a fraction, e.g. 0.2 for 20% off
export function applyDiscount(subtotal: number, discount: number): number {
  return subtotal * discount;
}

export function averageItemPrice(items: CartItem[]): number {
  const sum = items.reduce((acc, item) => acc + item.price, 0);
  return sum / items.length;
}

export function mostExpensive(items: CartItem[]): CartItem | undefined {
  return items.sort((a, b) => b.price - a.price)[0];
}

export function formatTotal(amount: number): string {
  return '$' + amount;
}
