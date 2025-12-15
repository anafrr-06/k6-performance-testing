import { sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { BASE_URL, THRESHOLDS, getAuthHeaders } from '../config.js';
import {
  login,
  getProducts,
  getProduct,
  searchProducts,
  addToCart,
  getCart,
  randomInt,
} from '../helpers.js';

/**
 * Soak Test - Endurance Test
 *
 * Purpose: Test system stability over extended periods
 * Identifies: Memory leaks, resource exhaustion, gradual degradation
 *
 * Duration: Extended run (reduce for CI, increase for production validation)
 *
 * Watch for:
 * - Gradual increase in response times
 * - Memory growth
 * - Connection pool exhaustion
 * - Log file growth
 */

// Custom metrics
const hourlyErrors = new Counter('hourly_errors');
const memoryIndicator = new Trend('memory_indicator_response_time');

export const options = {
  stages: [
    { duration: '2m', target: 30 },    // Ramp up
    { duration: '10m', target: 30 },   // Soak period (increase for real soak test)
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    ...THRESHOLDS,
    http_req_failed: ['rate<0.01'],    // Very low error tolerance for soak
  },
  tags: {
    testType: 'soak',
  },
};

export function setup() {
  const token = login();
  return { token, startTime: Date.now() };
}

export default function (data) {
  const authHeaders = data.token ? getAuthHeaders(data.token) : undefined;
  const elapsedMinutes = Math.floor((Date.now() - data.startTime) / 60000);

  // Realistic user journey simulation
  const journey = randomInt(1, 100);

  if (journey <= 40) {
    // 40% - Browse and search (read-heavy)
    getProducts({ page: randomInt(1, 20), limit: 20 });
    sleep(randomInt(2, 5));

    if (randomInt(1, 2) === 1) {
      searchProducts(['laptop', 'phone', 'camera', 'book'][randomInt(0, 3)]);
    }

  } else if (journey <= 70) {
    // 30% - Product detail viewing
    const productId = randomInt(1, 500).toString();
    const startTime = Date.now();
    getProduct(productId);
    memoryIndicator.add(Date.now() - startTime);
    sleep(randomInt(1, 3));

  } else if (journey <= 90) {
    // 20% - Cart operations
    if (authHeaders) {
      getCart(authHeaders);
      sleep(1);

      if (randomInt(1, 3) === 1) {
        addToCart(randomInt(1, 100).toString(), 1, authHeaders);
      }
    }
    sleep(randomInt(2, 4));

  } else {
    // 10% - Heavy operations (reports, complex searches)
    searchProducts('product description quality');
    sleep(randomInt(3, 6));
  }

  // Log errors by time period
  if (__ITER % 100 === 0) {
    console.log(`[Soak] Minute ${elapsedMinutes}: VU ${__VU}, Iteration ${__ITER}`);
  }
}

export function handleSummary(data) {
  const summary = {
    ...data,
    soakAnalysis: {
      totalDuration: data.state ? data.state.testRunDurationMs : 'N/A',
      avgResponseTimeStart: 'Check time-series data',
      avgResponseTimeEnd: 'Check time-series data',
      memoryTrend: data.metrics.memory_indicator_response_time ?
        data.metrics.memory_indicator_response_time.values : 'N/A',
    },
  };

  return {
    'reports/soak-summary.json': JSON.stringify(summary, null, 2),
  };
}
