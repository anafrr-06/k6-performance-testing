import { sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, HEADERS, getAuthHeaders } from '../config.js';
import { login, getProducts, searchProducts, randomInt } from '../helpers.js';

/**
 * Spike Test - Sudden Traffic Surge
 *
 * Purpose: Test system behavior under sudden, dramatic load increases
 * Simulates: Flash sales, viral content, marketing campaign launches
 *
 * Key observations:
 * - How quickly the system responds to sudden load
 * - Recovery time after spike subsides
 * - Error handling during high load
 */

// Custom metrics
const spikeErrors = new Counter('spike_errors');
const recoveryTime = new Trend('recovery_time');
const spikeResponseTime = new Trend('spike_response_time');

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Normal load baseline
    { duration: '10s', target: 200 },  // SPIKE! Sudden surge
    { duration: '1m', target: 200 },   // Maintain spike
    { duration: '10s', target: 10 },   // Sudden drop
    { duration: '1m', target: 10 },    // Recovery period
    { duration: '10s', target: 150 },  // Second spike
    { duration: '30s', target: 150 },  // Maintain
    { duration: '10s', target: 10 },   // Drop
    { duration: '30s', target: 10 },   // Final recovery
  ],
  thresholds: {
    http_req_failed: ['rate<0.15'],            // Allow up to 15% failures during spike
    spike_response_time: ['p(95)<3000'],       // 3s max during spike
  },
  tags: {
    testType: 'spike',
  },
};

export function setup() {
  const token = login();
  return { token };
}

export default function (data) {
  const authHeaders = data.token ? getAuthHeaders(data.token) : undefined;
  const currentVUs = __VU;
  const isSpikePeriod = currentVUs > 50;

  const startTime = Date.now();

  // During spike, simulate high-value actions users would do
  if (isSpikePeriod) {
    // Flash sale behavior - everyone searching and viewing products
    const operation = randomInt(1, 10);

    if (operation <= 6) {
      // 60% - Search for deals
      searchProducts('product');
    } else {
      // 40% - Browse product listings
      getProducts({ page: 1, limit: 50 });
    }
  } else {
    // Normal behavior
    getProducts({ page: randomInt(1, 10), limit: 20 });
  }

  const duration = Date.now() - startTime;
  spikeResponseTime.add(duration);

  // Track recovery
  if (!isSpikePeriod && duration < 200) {
    recoveryTime.add(duration);
  }

  // Minimal sleep - spike tests should maintain pressure
  sleep(isSpikePeriod ? 0.1 : randomInt(0.5, 1.5));
}

export function handleSummary(data) {
  return {
    'reports/spike-summary.json': JSON.stringify(data, null, 2),
  };
}
