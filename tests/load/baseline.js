import { sleep } from 'k6';
import { BASE_URL, THRESHOLDS, getAuthHeaders } from '../config.js';
import { login, getProducts, getProduct, searchProducts, randomInt } from '../helpers.js';

/**
 * Baseline Load Test
 *
 * Purpose: Establish performance baseline under normal load conditions
 * Simulates: Regular traffic patterns during business hours
 *
 * Target metrics:
 * - p95 response time < 500ms
 * - Error rate < 1%
 * - Throughput baseline establishment
 */

export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Ramp up to 10 users
    { duration: '3m', target: 10 },   // Stay at 10 users
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: THRESHOLDS,
  tags: {
    testType: 'baseline',
  },
};

export function setup() {
  // Login once and share token across VUs
  const token = login();
  return { token };
}

export default function (data) {
  const authHeaders = data.token ? getAuthHeaders(data.token) : undefined;

  // Simulate typical user behavior
  const scenario = randomInt(1, 10);

  if (scenario <= 5) {
    // 50% - Browse products
    getProducts({ page: randomInt(1, 10), limit: 20 });
    sleep(randomInt(1, 3));

    // View a random product
    getProduct(randomInt(1, 100).toString());
    sleep(randomInt(1, 2));

  } else if (scenario <= 8) {
    // 30% - Search products
    const searchTerms = ['laptop', 'phone', 'shirt', 'book', 'camera'];
    searchProducts(searchTerms[randomInt(0, searchTerms.length - 1)]);
    sleep(randomInt(2, 4));

  } else {
    // 20% - Filter products
    const categories = ['electronics', 'clothing', 'books', 'home', 'sports'];
    getProducts({
      category: categories[randomInt(0, categories.length - 1)],
      minPrice: randomInt(10, 100),
      maxPrice: randomInt(200, 500),
    });
    sleep(randomInt(1, 3));
  }
}

export function handleSummary(data) {
  return {
    'reports/baseline-summary.json': JSON.stringify(data, null, 2),
  };
}
