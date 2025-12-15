import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, HEADERS } from './config.js';

// k6 doesn't have URLSearchParams, so we create a simple helper
function buildQueryString(params) {
  const pairs = [];
  for (const key in params) {
    if (params.hasOwnProperty(key) && params[key] !== undefined) {
      pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`);
    }
  }
  return pairs.length > 0 ? pairs.join('&') : '';
}

export function login(email = 'user1@test.com', password = 'password123') {
  const response = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email, password }),
    { headers: HEADERS, tags: { type: 'auth' } }
  );

  const success = check(response, {
    'login successful': (r) => r.status === 200,
    'token received': (r) => r.json('token') !== undefined,
  });

  if (success) {
    return response.json('token');
  }
  return null;
}

export function register(email, password, name) {
  const response = http.post(
    `${BASE_URL}/api/auth/register`,
    JSON.stringify({ email, password, name }),
    { headers: HEADERS, tags: { type: 'auth' } }
  );

  check(response, {
    'registration successful': (r) => r.status === 201,
  });

  if (response.status === 201) {
    return response.json('token');
  }
  return null;
}

export function getProducts(params = {}, authHeaders = HEADERS) {
  const queryString = buildQueryString(params);
  const url = queryString ? `${BASE_URL}/api/products?${queryString}` : `${BASE_URL}/api/products`;

  const response = http.get(url, {
    headers: authHeaders,
    tags: { type: 'read' },
  });

  check(response, {
    'products fetched': (r) => r.status === 200,
    'has data': (r) => r.json('data') !== undefined,
  });

  return response;
}

export function getProduct(productId, authHeaders = HEADERS) {
  const response = http.get(`${BASE_URL}/api/products/${productId}`, {
    headers: authHeaders,
    tags: { type: 'read' },
  });

  check(response, {
    'product fetched': (r) => r.status === 200,
  });

  return response;
}

export function searchProducts(query, authHeaders = HEADERS) {
  const response = http.get(`${BASE_URL}/api/search?q=${encodeURIComponent(query)}`, {
    headers: authHeaders,
    tags: { type: 'search' },
  });

  check(response, {
    'search successful': (r) => r.status === 200,
  });

  return response;
}

export function addToCart(productId, quantity, authHeaders) {
  const response = http.post(
    `${BASE_URL}/api/cart/items`,
    JSON.stringify({ productId, quantity }),
    { headers: authHeaders, tags: { type: 'write' } }
  );

  check(response, {
    'item added to cart': (r) => r.status === 200,
  });

  return response;
}

export function getCart(authHeaders) {
  const response = http.get(`${BASE_URL}/api/cart`, {
    headers: authHeaders,
    tags: { type: 'read' },
  });

  check(response, {
    'cart fetched': (r) => r.status === 200,
  });

  return response;
}

export function checkout(authHeaders) {
  const response = http.post(
    `${BASE_URL}/api/orders`,
    '{}',
    { headers: authHeaders, tags: { type: 'write' } }
  );

  check(response, {
    'order created': (r) => r.status === 201,
  });

  return response;
}

export function getOrders(authHeaders) {
  const response = http.get(`${BASE_URL}/api/orders`, {
    headers: authHeaders,
    tags: { type: 'read' },
  });

  check(response, {
    'orders fetched': (r) => r.status === 200,
  });

  return response;
}

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}
