import { sleep, check, group } from 'k6';
import http from 'k6/http';
import { Counter, Trend, Rate } from 'k6/metrics';
import { BASE_URL, THRESHOLDS } from '../config.js';

/**
 * Authentication Stress Test
 *
 * Tests authentication endpoints under heavy load:
 * - Login throughput
 * - Token validation
 * - Session management
 * - Rate limiting behavior
 */

const loginSuccess = new Counter('auth_login_success');
const loginFailed = new Counter('auth_login_failed');
const loginDuration = new Trend('auth_login_duration');
const tokenValidation = new Trend('auth_token_validation');
const authErrorRate = new Rate('auth_error_rate');

export const options = {
  scenarios: {
    // Scenario 1: Normal login traffic
    normal_logins: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '1m', target: 20 },
        { duration: '30s', target: 0 },
      ],
      exec: 'normalLogin',
    },
    // Scenario 2: Burst login traffic (simulates marketing campaign)
    burst_logins: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 100,
      stages: [
        { duration: '10s', target: 10 },
        { duration: '20s', target: 50 },
        { duration: '10s', target: 10 },
      ],
      exec: 'burstLogin',
      startTime: '2m',
    },
    // Scenario 3: Token validation load
    token_validation: {
      executor: 'constant-vus',
      vus: 10,
      duration: '2m',
      exec: 'validateToken',
      startTime: '30s',
    },
  },
  thresholds: {
    ...THRESHOLDS,
    auth_login_duration: ['p(95)<500', 'p(99)<1000'],
    auth_token_validation: ['p(95)<100'],
    auth_error_rate: ['rate<0.05'],
  },
};

// Shared token storage
let validToken = null;

export function setup() {
  // Get one valid token for validation tests
  const response = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: 'user1@test.com',
    password: 'password123',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (response.status === 200) {
    validToken = response.json('token');
  }

  return { validToken };
}

export function normalLogin() {
  const vuId = __VU;
  const email = `user${(vuId % 100) + 1}@test.com`;

  group('Normal Login Flow', () => {
    const payload = JSON.stringify({
      email: email,
      password: 'password123',
    });

    const start = Date.now();
    const response = http.post(`${BASE_URL}/api/auth/login`, payload, {
      headers: { 'Content-Type': 'application/json' },
      tags: { scenario: 'normal' },
    });
    loginDuration.add(Date.now() - start);

    const success = check(response, {
      'login successful': (r) => r.status === 200,
      'has token': (r) => {
        try {
          return r.json('token') !== undefined;
        } catch {
          return false;
        }
      },
    });

    if (success) {
      loginSuccess.add(1);
      authErrorRate.add(0);
    } else {
      loginFailed.add(1);
      authErrorRate.add(1);
    }
  });

  sleep(Math.random() * 2 + 1);
}

export function burstLogin() {
  const iteration = __ITER;
  const email = `user${(iteration % 100) + 1}@test.com`;

  const payload = JSON.stringify({
    email: email,
    password: 'password123',
  });

  const start = Date.now();
  const response = http.post(`${BASE_URL}/api/auth/login`, payload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { scenario: 'burst' },
  });
  loginDuration.add(Date.now() - start);

  const success = check(response, {
    'burst login successful': (r) => r.status === 200 || r.status === 429,
  });

  if (response.status === 200) {
    loginSuccess.add(1);
    authErrorRate.add(0);
  } else if (response.status === 429) {
    // Rate limited is expected behavior
    authErrorRate.add(0);
  } else {
    loginFailed.add(1);
    authErrorRate.add(1);
  }
}

export function validateToken(data) {
  if (!data.validToken) {
    return;
  }

  group('Token Validation', () => {
    const start = Date.now();
    const response = http.get(`${BASE_URL}/api/products`, {
      headers: {
        'Authorization': `Bearer ${data.validToken}`,
      },
      tags: { scenario: 'validation' },
    });
    tokenValidation.add(Date.now() - start);

    const success = check(response, {
      'token accepted': (r) => r.status === 200,
      'returns data': (r) => r.body && r.body.length > 0,
    });

    authErrorRate.add(success ? 0 : 1);
  });

  sleep(0.5);
}

export function handleSummary(data) {
  return {
    'reports/auth-stress-summary.json': JSON.stringify(data, null, 2),
  };
}
