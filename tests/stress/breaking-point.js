import { sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { BASE_URL, getAuthHeaders } from '../config.js';
import { login, getProducts, getProduct, searchProducts, randomInt } from '../helpers.js';

/**
 * Stress Test - Breaking Point
 *
 * Purpose: Find the system's breaking point by gradually increasing load
 * Goal: Identify at what point the system starts to degrade or fail
 *
 * Metrics to watch:
 * - Response time degradation
 * - Error rate increase
 * - System resource exhaustion
 */

// Custom metrics
const errorRate = new Rate('error_rate');
const degradedResponses = new Counter('degraded_responses');
const responseTime = new Trend('response_time_trend');

export const options = {
  stages: [
    { duration: '1m', target: 20 },    // Baseline
    { duration: '2m', target: 50 },    // Normal load
    { duration: '2m', target: 100 },   // High load
    { duration: '2m', target: 150 },   // Very high load
    { duration: '2m', target: 200 },   // Stress load
    { duration: '2m', target: 250 },   // Breaking point search
    { duration: '2m', target: 300 },   // Maximum stress
    { duration: '2m', target: 0 },     // Recovery
  ],
  thresholds: {
    error_rate: ['rate<0.1'],                    // Allow up to 10% errors during stress
    http_req_duration: ['p(95)<2000'],           // Relaxed threshold for stress
    degraded_responses: ['count<1000'],          // Track degraded responses
  },
  tags: {
    testType: 'stress',
  },
};

const DEGRADATION_THRESHOLD_MS = 500;

export function setup() {
  const token = login();
  return { token };
}

export default function (data) {
  const authHeaders = data.token ? getAuthHeaders(data.token) : undefined;
  const startTime = Date.now();

  // Mix of operations to stress different parts of the system
  const operation = randomInt(1, 10);
  let response;

  if (operation <= 4) {
    // 40% - List products (read-heavy)
    response = getProducts({ page: randomInt(1, 50), limit: 50 }, authHeaders);

  } else if (operation <= 7) {
    // 30% - Search (CPU-intensive)
    const terms = ['product', 'quality', 'best', 'new', 'sale', 'premium'];
    response = searchProducts(terms[randomInt(0, terms.length - 1)], authHeaders);

  } else {
    // 30% - Individual product (cache test)
    response = getProduct(randomInt(1, 1000).toString(), authHeaders);
  }

  const duration = Date.now() - startTime;
  responseTime.add(duration);

  // Track errors and degradation
  const isError = response.status >= 400;
  errorRate.add(isError);

  if (duration > DEGRADATION_THRESHOLD_MS && !isError) {
    degradedResponses.add(1);
  }

  // Minimal sleep to maintain pressure
  sleep(randomInt(0.1, 0.5));
}

export function handleSummary(data) {
  // Calculate breaking point indicators
  const summary = {
    ...data,
    analysis: {
      maxVUs: data.metrics.vus_max ? data.metrics.vus_max.values.max : 'N/A',
      errorRateFinal: data.metrics.error_rate ? data.metrics.error_rate.values.rate : 'N/A',
      p95ResponseTime: data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(95)'] : 'N/A',
      degradedCount: data.metrics.degraded_responses ? data.metrics.degraded_responses.values.count : 0,
    },
  };

  return {
    'reports/stress-summary.json': JSON.stringify(summary, null, 2),
  };
}
