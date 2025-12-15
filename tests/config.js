export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const THRESHOLDS = {
  // Response time thresholds
  http_req_duration: ['p(95)<500', 'p(99)<1000'],
  // Error rate threshold
  http_req_failed: ['rate<0.01'],
  // Custom thresholds per endpoint type
  'http_req_duration{type:auth}': ['p(95)<300'],
  'http_req_duration{type:read}': ['p(95)<200'],
  'http_req_duration{type:write}': ['p(95)<500'],
  'http_req_duration{type:search}': ['p(95)<400'],
};

export const HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

export function getAuthHeaders(token) {
  return {
    ...HEADERS,
    Authorization: `Bearer ${token}`,
  };
}
