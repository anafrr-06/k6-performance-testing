import { sleep, check, group } from 'k6';
import http from 'k6/http';
import { Counter, Trend, Rate } from 'k6/metrics';
import { BASE_URL, THRESHOLDS, getAuthHeaders } from '../config.js';
import { login } from '../helpers.js';

/**
 * API CRUD Operations Load Test
 *
 * Tests complete CRUD lifecycle under load:
 * - Create resources
 * - Read resources
 * - Update resources
 * - Delete resources
 *
 * Measures performance of each operation type.
 */

// Custom metrics per operation
const createDuration = new Trend('crud_create_duration');
const readDuration = new Trend('crud_read_duration');
const updateDuration = new Trend('crud_update_duration');
const deleteDuration = new Trend('crud_delete_duration');
const crudSuccess = new Rate('crud_success_rate');

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Warm up
    { duration: '1m', target: 25 },    // Ramp up
    { duration: '2m', target: 25 },    // Steady state
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    ...THRESHOLDS,
    crud_create_duration: ['p(95)<300'],
    crud_read_duration: ['p(95)<200'],
    crud_update_duration: ['p(95)<300'],
    crud_delete_duration: ['p(95)<250'],
    crud_success_rate: ['rate>0.95'],
  },
  tags: {
    testType: 'api-crud',
  },
};

export function setup() {
  // Get auth token for tests
  const token = login('user1@test.com', 'password123');
  return { token };
}

export default function (data) {
  const headers = getAuthHeaders(data.token);
  let createdItemId = null;

  // CREATE
  group('01_Create', () => {
    const payload = JSON.stringify({
      productId: String(Math.floor(Math.random() * 10) + 1),
      quantity: Math.floor(Math.random() * 3) + 1,
    });

    const start = Date.now();
    const response = http.post(`${BASE_URL}/api/cart/items`, payload, {
      headers: { ...headers, 'Content-Type': 'application/json' },
      tags: { operation: 'create' },
    });
    createDuration.add(Date.now() - start);

    const success = check(response, {
      'create status 200/201': (r) => r.status === 200 || r.status === 201,
      'create has response body': (r) => r.body && r.body.length > 0,
    });
    crudSuccess.add(success);

    if (response.status === 200 || response.status === 201) {
      try {
        const body = response.json();
        if (body.items && body.items.length > 0) {
          createdItemId = body.items[0].productId;
        }
      } catch (e) {}
    }

    sleep(0.5);
  });

  // READ
  group('02_Read', () => {
    const start = Date.now();
    const response = http.get(`${BASE_URL}/api/cart`, {
      headers,
      tags: { operation: 'read' },
    });
    readDuration.add(Date.now() - start);

    const success = check(response, {
      'read status 200': (r) => r.status === 200,
      'read has items': (r) => {
        try {
          const body = r.json();
          return body.items !== undefined;
        } catch {
          return false;
        }
      },
    });
    crudSuccess.add(success);

    sleep(0.5);
  });

  // UPDATE (add more of same item)
  group('03_Update', () => {
    if (createdItemId) {
      const payload = JSON.stringify({
        productId: createdItemId,
        quantity: 5,
      });

      const start = Date.now();
      const response = http.post(`${BASE_URL}/api/cart/items`, payload, {
        headers: { ...headers, 'Content-Type': 'application/json' },
        tags: { operation: 'update' },
      });
      updateDuration.add(Date.now() - start);

      const success = check(response, {
        'update status 200': (r) => r.status === 200,
      });
      crudSuccess.add(success);
    }

    sleep(0.5);
  });

  // DELETE (clear cart)
  group('04_Delete', () => {
    const start = Date.now();
    const response = http.del(`${BASE_URL}/api/cart`, null, {
      headers,
      tags: { operation: 'delete' },
    });
    deleteDuration.add(Date.now() - start);

    const success = check(response, {
      'delete status 200/204': (r) => r.status === 200 || r.status === 204,
    });
    crudSuccess.add(success);

    sleep(0.5);
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'reports/api-crud-summary.json': JSON.stringify(data, null, 2),
  };
}
