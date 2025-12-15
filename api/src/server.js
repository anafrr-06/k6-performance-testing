const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const compression = require('compression');

const app = express();
app.use(express.json());
app.use(compression());

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'perf-test-secret';

// Metrics tracking
const metrics = {
  requests: 0,
  errors: 0,
  startTime: Date.now()
};

// Simulate database latency (configurable via env)
const DB_LATENCY_MS = parseInt(process.env.DB_LATENCY_MS || '10');
const DEGRADATION_THRESHOLD = parseInt(process.env.DEGRADATION_THRESHOLD || '100');

const simulateDbLatency = async (baseLatency = DB_LATENCY_MS) => {
  // Simulate degradation under load
  const currentRps = metrics.requests / ((Date.now() - metrics.startTime) / 1000);
  const degradationFactor = currentRps > DEGRADATION_THRESHOLD ?
    Math.min(currentRps / DEGRADATION_THRESHOLD, 5) : 1;

  const latency = baseLatency * degradationFactor + Math.random() * 5;
  await new Promise(resolve => setTimeout(resolve, latency));
};

// Generate mock data
const generateProducts = (count) => {
  const categories = ['electronics', 'clothing', 'books', 'home', 'sports'];
  const products = [];
  for (let i = 1; i <= count; i++) {
    products.push({
      id: i.toString(),
      name: `Product ${i}`,
      description: `Description for product ${i}. High quality item with excellent features.`,
      price: Math.round((Math.random() * 500 + 10) * 100) / 100,
      stock: Math.floor(Math.random() * 1000),
      category: categories[Math.floor(Math.random() * categories.length)],
      rating: Math.round((Math.random() * 2 + 3) * 10) / 10,
      reviews: Math.floor(Math.random() * 500)
    });
  }
  return products;
};

const generateUsers = (count) => {
  const users = [];
  for (let i = 1; i <= count; i++) {
    users.push({
      id: i.toString(),
      email: `user${i}@test.com`,
      password: 'password123',
      name: `User ${i}`,
      createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
    });
  }
  return users;
};

// In-memory database
const db = {
  products: generateProducts(1000),
  users: generateUsers(100),
  orders: [],
  carts: new Map()
};

// Rate limiting (simple in-memory)
const rateLimiter = new Map();
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT || '1000');
const RATE_WINDOW_MS = 60000;

const checkRateLimit = (ip) => {
  const now = Date.now();
  const windowStart = now - RATE_WINDOW_MS;

  if (!rateLimiter.has(ip)) {
    rateLimiter.set(ip, []);
  }

  const requests = rateLimiter.get(ip).filter(time => time > windowStart);
  requests.push(now);
  rateLimiter.set(ip, requests);

  return requests.length <= RATE_LIMIT;
};

// Middleware
app.use((req, res, next) => {
  metrics.requests++;
  const ip = req.ip || req.connection.remoteAddress;

  if (!checkRateLimit(ip)) {
    metrics.errors++;
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Try again later.'
    });
  }
  next();
});

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    metrics.errors++;
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const token = authHeader.split(' ')[1];
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    metrics.errors++;
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Health & Metrics
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor((Date.now() - metrics.startTime) / 1000),
    timestamp: new Date().toISOString()
  });
});

app.get('/metrics', (req, res) => {
  const uptime = (Date.now() - metrics.startTime) / 1000;
  res.json({
    totalRequests: metrics.requests,
    totalErrors: metrics.errors,
    errorRate: metrics.requests > 0 ? (metrics.errors / metrics.requests * 100).toFixed(2) + '%' : '0%',
    requestsPerSecond: (metrics.requests / uptime).toFixed(2),
    uptimeSeconds: Math.floor(uptime)
  });
});

// Auth endpoints
app.post('/api/auth/login', async (req, res) => {
  await simulateDbLatency(20);

  const { email, password } = req.body;
  if (!email || !password) {
    metrics.errors++;
    return res.status(400).json({ error: 'Email and password required' });
  }

  const user = db.users.find(u => u.email === email);
  if (!user || user.password !== password) {
    metrics.errors++;
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

app.post('/api/auth/register', async (req, res) => {
  await simulateDbLatency(30);

  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    metrics.errors++;
    return res.status(400).json({ error: 'All fields required' });
  }

  if (db.users.find(u => u.email === email)) {
    metrics.errors++;
    return res.status(409).json({ error: 'Email already exists' });
  }

  const user = {
    id: uuidv4(),
    email,
    password,
    name,
    createdAt: new Date().toISOString()
  };
  db.users.push(user);

  const token = jwt.sign({ id: user.id, email }, JWT_SECRET, { expiresIn: '1h' });
  res.status(201).json({ token, user: { id: user.id, email, name } });
});

// Products endpoints
app.get('/api/products', async (req, res) => {
  await simulateDbLatency();

  let products = [...db.products];

  // Filtering
  if (req.query.category) {
    products = products.filter(p => p.category === req.query.category);
  }
  if (req.query.minPrice) {
    products = products.filter(p => p.price >= parseFloat(req.query.minPrice));
  }
  if (req.query.maxPrice) {
    products = products.filter(p => p.price <= parseFloat(req.query.maxPrice));
  }
  if (req.query.search) {
    const search = req.query.search.toLowerCase();
    products = products.filter(p =>
      p.name.toLowerCase().includes(search) ||
      p.description.toLowerCase().includes(search)
    );
  }

  // Sorting
  if (req.query.sort) {
    const [field, order] = req.query.sort.split(':');
    products.sort((a, b) => {
      if (order === 'desc') return b[field] > a[field] ? 1 : -1;
      return a[field] > b[field] ? 1 : -1;
    });
  }

  // Pagination
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const startIndex = (page - 1) * limit;
  const paginatedProducts = products.slice(startIndex, startIndex + limit);

  res.json({
    data: paginatedProducts,
    pagination: {
      page,
      limit,
      total: products.length,
      totalPages: Math.ceil(products.length / limit)
    }
  });
});

app.get('/api/products/:id', async (req, res) => {
  await simulateDbLatency();

  const product = db.products.find(p => p.id === req.params.id);
  if (!product) {
    metrics.errors++;
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json(product);
});

// Cart endpoints
app.get('/api/cart', authenticate, async (req, res) => {
  await simulateDbLatency();

  const cart = db.carts.get(req.user.id) || { items: [], total: 0 };
  res.json(cart);
});

app.post('/api/cart/items', authenticate, async (req, res) => {
  await simulateDbLatency(15);

  const { productId, quantity = 1 } = req.body;
  if (!productId) {
    metrics.errors++;
    return res.status(400).json({ error: 'Product ID required' });
  }

  const product = db.products.find(p => p.id === productId);
  if (!product) {
    metrics.errors++;
    return res.status(404).json({ error: 'Product not found' });
  }

  let cart = db.carts.get(req.user.id) || { items: [], total: 0 };

  const existingItem = cart.items.find(i => i.productId === productId);
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    cart.items.push({
      productId,
      name: product.name,
      price: product.price,
      quantity
    });
  }

  cart.total = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  cart.total = Math.round(cart.total * 100) / 100;

  db.carts.set(req.user.id, cart);
  res.json(cart);
});

app.delete('/api/cart/items/:productId', authenticate, async (req, res) => {
  await simulateDbLatency();

  let cart = db.carts.get(req.user.id);
  if (!cart) {
    metrics.errors++;
    return res.status(404).json({ error: 'Cart not found' });
  }

  cart.items = cart.items.filter(i => i.productId !== req.params.productId);
  cart.total = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  cart.total = Math.round(cart.total * 100) / 100;

  db.carts.set(req.user.id, cart);
  res.json(cart);
});

// Orders endpoints
app.post('/api/orders', authenticate, async (req, res) => {
  await simulateDbLatency(50); // Orders are slower (payment processing simulation)

  const cart = db.carts.get(req.user.id);
  if (!cart || cart.items.length === 0) {
    metrics.errors++;
    return res.status(400).json({ error: 'Cart is empty' });
  }

  const order = {
    id: uuidv4(),
    userId: req.user.id,
    items: [...cart.items],
    total: cart.total,
    status: 'confirmed',
    createdAt: new Date().toISOString()
  };

  db.orders.push(order);
  db.carts.set(req.user.id, { items: [], total: 0 });

  res.status(201).json(order);
});

app.get('/api/orders', authenticate, async (req, res) => {
  await simulateDbLatency();

  const orders = db.orders.filter(o => o.userId === req.user.id);
  res.json({ data: orders, total: orders.length });
});

app.get('/api/orders/:id', authenticate, async (req, res) => {
  await simulateDbLatency();

  const order = db.orders.find(o => o.id === req.params.id && o.userId === req.user.id);
  if (!order) {
    metrics.errors++;
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json(order);
});

// Search endpoint (heavier operation)
app.get('/api/search', async (req, res) => {
  await simulateDbLatency(30); // Search is slower

  const { q } = req.query;
  if (!q || q.length < 2) {
    return res.json({ products: [], total: 0 });
  }

  const searchTerm = q.toLowerCase();
  const results = db.products.filter(p =>
    p.name.toLowerCase().includes(searchTerm) ||
    p.description.toLowerCase().includes(searchTerm) ||
    p.category.toLowerCase().includes(searchTerm)
  ).slice(0, 50);

  res.json({ products: results, total: results.length });
});

// Slow endpoint for testing (simulates report generation)
app.get('/api/reports/sales', authenticate, async (req, res) => {
  await simulateDbLatency(200); // Heavy operation

  const totalSales = db.orders.reduce((sum, o) => sum + o.total, 0);
  const orderCount = db.orders.length;

  res.json({
    totalSales: Math.round(totalSales * 100) / 100,
    orderCount,
    averageOrderValue: orderCount > 0 ? Math.round((totalSales / orderCount) * 100) / 100 : 0,
    generatedAt: new Date().toISOString()
  });
});

// Error handler
app.use((err, req, res, next) => {
  metrics.errors++;
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`E-commerce API running on http://localhost:${PORT}`);
  console.log(`Products: ${db.products.length}, Users: ${db.users.length}`);
  console.log('Test user: user1@test.com / password123');
});
