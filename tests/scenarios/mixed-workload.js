import { sleep, check, group } from 'k6';
import http from 'k6/http';
import { Trend, Counter, Rate } from 'k6/metrics';
import { BASE_URL, getAuthHeaders } from '../config.js';
import { login, getProducts, getProduct, addToCart, searchProducts } from '../helpers.js';

/**
 * Mixed Workload Scenario Test
 *
 * Simulates realistic production traffic with multiple user types:
 * - Browsers (60%): Just looking around
 * - Shoppers (30%): Adding items to cart
 * - Buyers (10%): Completing purchases
 *
 * Models real-world traffic distribution.
 */

// Metrics per user type
const browserActions = new Counter('browser_actions');
const shopperActions = new Counter('shopper_actions');
const buyerActions = new Counter('buyer_actions');
const conversionRate = new Rate('conversion_rate');

export const options = {
  scenarios: {
    // Browsers - most common
    browsers: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 30 },
        { duration: '3m', target: 30 },
        { duration: '1m', target: 0 },
      ],
      exec: 'browserBehavior',
      tags: { userType: 'browser' },
    },
    // Shoppers - moderate
    shoppers: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 15 },
        { duration: '3m', target: 15 },
        { duration: '1m', target: 0 },
      ],
      exec: 'shopperBehavior',
      tags: { userType: 'shopper' },
    },
    // Buyers - least common but most valuable
    buyers: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 5 },
        { duration: '3m', target: 5 },
        { duration: '1m', target: 0 },
      ],
      exec: 'buyerBehavior',
      tags: { userType: 'buyer' },
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    conversion_rate: ['rate>0'],
  },
};

export function setup() {
  return {
    baseEmail: 'user',
    password: 'password123',
  };
}

// Browser: Just browses products, doesn't login
export function browserBehavior() {
  group('Browser Session', () => {
    // View homepage/products
    const productsRes = http.get(`${BASE_URL}/api/products`);
    check(productsRes, { 'products loaded': (r) => r.status === 200 });
    browserActions.add(1);
    sleep(Math.random() * 3 + 2);

    // View a few product details
    const numProducts = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < numProducts; i++) {
      const productId = Math.floor(Math.random() * 10) + 1;
      http.get(`${BASE_URL}/api/products/${productId}`);
      browserActions.add(1);
      sleep(Math.random() * 2 + 1);
    }

    // Maybe search
    if (Math.random() < 0.3) {
      const terms = ['laptop', 'phone', 'headphones', 'tablet'];
      const term = terms[Math.floor(Math.random() * terms.length)];
      http.get(`${BASE_URL}/api/products?search=${term}`);
      browserActions.add(1);
      sleep(Math.random() * 2 + 1);
    }
  });

  conversionRate.add(0); // Browsers don't convert
  sleep(Math.random() * 2 + 1);
}

// Shopper: Logs in, browses, adds to cart, but doesn't buy
export function shopperBehavior(data) {
  const vuId = __VU;
  const email = `${data.baseEmail}${(vuId % 100) + 1}@test.com`;

  group('Shopper Session', () => {
    // Login
    const token = login(email, data.password);
    if (!token) {
      return;
    }
    const headers = getAuthHeaders(token);
    shopperActions.add(1);
    sleep(1);

    // Browse products
    const productsRes = getProducts({ page: 1, limit: 20 }, headers);
    let products = [];
    if (productsRes.status === 200) {
      try {
        products = productsRes.json('data') || [];
      } catch (e) {}
    }
    shopperActions.add(1);
    sleep(Math.random() * 2 + 1);

    // View some products
    const numToView = Math.floor(Math.random() * 3) + 2;
    for (let i = 0; i < Math.min(numToView, products.length); i++) {
      getProduct(products[i].id, headers);
      shopperActions.add(1);
      sleep(Math.random() * 2 + 1);
    }

    // Add items to cart
    const numToAdd = Math.floor(Math.random() * 2) + 1;
    for (let i = 0; i < Math.min(numToAdd, products.length); i++) {
      addToCart(products[i].id, 1, headers);
      shopperActions.add(1);
      sleep(1);
    }

    // View cart but abandon
    http.get(`${BASE_URL}/api/cart`, { headers });
    shopperActions.add(1);
  });

  conversionRate.add(0); // Shoppers don't convert
  sleep(Math.random() * 3 + 2);
}

// Buyer: Complete purchase flow
export function buyerBehavior(data) {
  const vuId = __VU;
  const email = `${data.baseEmail}${(vuId % 100) + 1}@test.com`;

  let converted = false;

  group('Buyer Session', () => {
    // Login
    const token = login(email, data.password);
    if (!token) {
      return;
    }
    const headers = getAuthHeaders(token);
    buyerActions.add(1);
    sleep(1);

    // Quick browse
    const productsRes = getProducts({ page: 1, limit: 10 }, headers);
    let products = [];
    if (productsRes.status === 200) {
      try {
        products = productsRes.json('data') || [];
      } catch (e) {}
    }
    buyerActions.add(1);
    sleep(1);

    if (products.length === 0) {
      return;
    }

    // Add to cart
    const product = products[Math.floor(Math.random() * products.length)];
    addToCart(product.id, 1, headers);
    buyerActions.add(1);
    sleep(1);

    // View cart
    http.get(`${BASE_URL}/api/cart`, { headers });
    buyerActions.add(1);
    sleep(1);

    // Checkout
    const checkoutRes = http.post(`${BASE_URL}/api/orders`, '{}', {
      headers: { ...headers, 'Content-Type': 'application/json' },
    });

    if (checkoutRes.status === 201) {
      converted = true;
      buyerActions.add(1);
    }
  });

  conversionRate.add(converted ? 1 : 0);
  sleep(Math.random() * 2 + 1);
}

export function handleSummary(data) {
  return {
    'reports/mixed-workload-summary.json': JSON.stringify(data, null, 2),
  };
}
