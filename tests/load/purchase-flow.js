import { sleep, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { BASE_URL, THRESHOLDS, getAuthHeaders } from '../config.js';
import {
  login,
  getProducts,
  getProduct,
  addToCart,
  getCart,
  checkout,
  randomInt,
} from '../helpers.js';

/**
 * Purchase Flow Load Test
 *
 * Purpose: Test complete e-commerce purchase flow under load
 * Simulates: Users browsing, adding to cart, and completing purchases
 *
 * Flow:
 * 1. Login
 * 2. Browse products
 * 3. View product details
 * 4. Add to cart
 * 5. View cart
 * 6. Checkout
 */

// Custom metrics
const purchaseSuccess = new Counter('purchase_success');
const purchaseFailed = new Counter('purchase_failed');
const checkoutDuration = new Trend('checkout_duration');

export const options = {
  stages: [
    { duration: '30s', target: 5 },    // Warm up
    { duration: '2m', target: 20 },    // Ramp up to 20 users
    { duration: '3m', target: 20 },    // Steady state
    { duration: '1m', target: 50 },    // Peak load
    { duration: '2m', target: 50 },    // Sustain peak
    { duration: '1m', target: 0 },     // Ramp down
  ],
  thresholds: {
    ...THRESHOLDS,
    purchase_success: ['count>0'],  // At least 1 successful purchase
    checkout_duration: ['p(95)<1000'],
  },
  tags: {
    testType: 'purchase-flow',
  },
};

export function setup() {
  // Pre-generate user credentials for each VU
  return {
    baseEmail: 'user',
    password: 'password123',
  };
}

export default function (data) {
  const vuId = __VU;
  const email = `${data.baseEmail}${(vuId % 100) + 1}@test.com`;

  // Step 1: Login
  let token;
  group('01_Login', function () {
    token = login(email, data.password);
    if (!token) {
      purchaseFailed.add(1);
      return;
    }
    sleep(1);
  });

  if (!token) return;

  const authHeaders = getAuthHeaders(token);

  // Step 2: Browse products
  let products;
  group('02_Browse', function () {
    const response = getProducts({ page: 1, limit: 20 }, authHeaders);
    if (response.status === 200) {
      products = response.json('data');
    }
    sleep(randomInt(2, 4));
  });

  if (!products || products.length === 0) {
    purchaseFailed.add(1);
    return;
  }

  // Step 3: View product details
  const selectedProduct = products[randomInt(0, Math.min(products.length - 1, 19))];
  group('03_ViewProduct', function () {
    getProduct(selectedProduct.id, authHeaders);
    sleep(randomInt(1, 3));
  });

  // Step 4: Add to cart
  group('04_AddToCart', function () {
    addToCart(selectedProduct.id, randomInt(1, 3), authHeaders);
    sleep(1);
  });

  // Step 5: View cart
  group('05_ViewCart', function () {
    getCart(authHeaders);
    sleep(randomInt(1, 2));
  });

  // Step 6: Checkout (100% for first VU to ensure threshold passes, 30% for others)
  const shouldCheckout = __VU === 1 || randomInt(1, 10) <= 3;
  if (shouldCheckout) {
    group('06_Checkout', function () {
      const startTime = Date.now();
      const response = checkout(authHeaders);
      const duration = Date.now() - startTime;

      checkoutDuration.add(duration);

      if (response.status === 201) {
        purchaseSuccess.add(1);
      } else {
        purchaseFailed.add(1);
      }
    });
  }

  sleep(randomInt(1, 3));
}

export function handleSummary(data) {
  return {
    'reports/purchase-flow-summary.json': JSON.stringify(data, null, 2),
  };
}
