# K6 Performance Testing Portfolio

Comprehensive performance testing suite using **k6** demonstrating load, stress, spike, and soak testing patterns.

[![Performance Tests](https://github.com/YOUR_USERNAME/k6-performance-testing/actions/workflows/performance.yml/badge.svg)](https://github.com/YOUR_USERNAME/k6-performance-testing/actions/workflows/performance.yml)

## What This Portfolio Demonstrates

| Skill | Implementation |
|-------|---------------|
| **Load Testing** | Baseline and purchase flow tests |
| **Stress Testing** | Breaking point identification |
| **Spike Testing** | Sudden traffic surge handling |
| **Soak Testing** | Endurance and memory leak detection |
| **Custom Metrics** | Business-specific KPIs |
| **Thresholds** | SLA validation |
| **CI Integration** | GitHub Actions pipeline |

## Project Structure

```
k6-performance-testing/
├── api/                      # E-commerce API for testing
│   └── src/server.js         # Express API with realistic latencies
├── tests/
│   ├── config.js             # Shared configuration & thresholds
│   ├── helpers.js            # Reusable test functions
│   ├── load/
│   │   ├── baseline.js       # Normal traffic patterns
│   │   └── purchase-flow.js  # E2E purchase journey
│   ├── stress/
│   │   └── breaking-point.js # Find system limits
│   ├── spike/
│   │   └── sudden-traffic.js # Flash sale simulation
│   └── soak/
│       └── endurance.js      # Long-running stability test
├── scripts/
│   ├── run-all.sh            # Run complete test suite
│   └── run-quick.sh          # Quick smoke test
├── reports/                  # Test results output
├── docker-compose.yml
└── .github/workflows/
```

## Quick Start

### Prerequisites

- Node.js 20+
- [k6](https://k6.io/docs/getting-started/installation/)
- Docker (optional)

### 1. Start the API

```bash
cd api
npm install
npm start
```

API runs at `http://localhost:3000`

### 2. Run Tests

```bash
# Baseline load test
k6 run tests/load/baseline.js

# Purchase flow test
k6 run tests/load/purchase-flow.js

# Stress test
k6 run tests/stress/breaking-point.js

# Spike test
k6 run tests/spike/sudden-traffic.js

# Soak test (extended duration)
k6 run tests/soak/endurance.js

# Run all tests
./scripts/run-all.sh
```

### 3. Docker

```bash
# Run API + tests
docker-compose up

# Run specific test
docker-compose run k6 run /tests/stress/breaking-point.js

# With monitoring (Grafana + InfluxDB)
docker-compose --profile monitoring up
```

## Test Types Explained

### Load Test (Baseline)
```
VUs: 10 constant
Duration: 5 minutes
Purpose: Establish performance baseline
```
Validates system performance under normal expected load.

### Load Test (Purchase Flow)
```
VUs: 5 → 20 → 50
Duration: 10 minutes
Purpose: Test realistic user journeys
```
Simulates complete e-commerce purchase flow with login, browse, cart, checkout.

### Stress Test
```
VUs: 20 → 50 → 100 → 150 → 200 → 250 → 300
Duration: 15 minutes
Purpose: Find breaking point
```
Gradually increases load to identify system limits and failure modes.

### Spike Test
```
VUs: 10 → 200 (sudden) → 10 → 150 → 10
Duration: 5 minutes
Purpose: Test sudden traffic surges
```
Simulates flash sales or viral content scenarios.

### Soak Test
```
VUs: 30 constant
Duration: 10+ minutes (configurable)
Purpose: Detect memory leaks and degradation
```
Long-running test to identify gradual performance degradation.

## API Endpoints

| Endpoint | Description | Latency |
|----------|-------------|---------|
| `GET /health` | Health check | ~1ms |
| `GET /metrics` | Performance metrics | ~1ms |
| `POST /api/auth/login` | User authentication | ~20ms |
| `GET /api/products` | List products (paginated) | ~10ms |
| `GET /api/products/:id` | Single product | ~10ms |
| `GET /api/search?q=` | Product search | ~30ms |
| `GET /api/cart` | View cart | ~10ms |
| `POST /api/cart/items` | Add to cart | ~15ms |
| `POST /api/orders` | Create order | ~50ms |
| `GET /api/reports/sales` | Sales report | ~200ms |

The API simulates realistic behavior:
- **Latency simulation**: Configurable base latency
- **Degradation under load**: Response times increase with RPS
- **Rate limiting**: 1000 req/min per IP

## Thresholds & SLAs

```javascript
// Default thresholds
http_req_duration: ['p(95)<500', 'p(99)<1000']  // Response time
http_req_failed: ['rate<0.01']                   // Error rate < 1%

// Per endpoint type
'http_req_duration{type:auth}': ['p(95)<300']
'http_req_duration{type:read}': ['p(95)<200']
'http_req_duration{type:write}': ['p(95)<500']
'http_req_duration{type:search}': ['p(95)<400']
```

## Custom Metrics

| Metric | Description |
|--------|-------------|
| `purchase_success` | Successful order completions |
| `purchase_failed` | Failed order attempts |
| `checkout_duration` | Time to complete checkout |
| `error_rate` | Custom error tracking |
| `degraded_responses` | Responses exceeding SLA |
| `spike_response_time` | Response time during spikes |

## Sample Output

```
     scenarios: (100.00%) 1 scenario, 50 max VUs, 10m30s max duration
     execution: local
        script: tests/load/purchase-flow.js

     ✓ login successful
     ✓ products fetched
     ✓ item added to cart
     ✓ order created

     checks.........................: 98.5% ✓ 4925  ✗ 75
     data_received..................: 15 MB 25 kB/s
     data_sent......................: 1.2 MB 2.0 kB/s
     http_req_duration..............: avg=45ms min=5ms max=520ms p(95)=180ms
     http_reqs......................: 5000  83/s
     purchase_success...............: 156

     ✓ p(95) response time < 500ms
     ✓ error rate < 1%
```

## CI/CD Integration

Tests run automatically on push/PR. Manual trigger supports test type selection:

```yaml
workflow_dispatch:
  inputs:
    test_type:
      options: [baseline, purchase-flow, stress, spike, all]
```

## Key Patterns Demonstrated

### 1. Staged Load Profiles
```javascript
stages: [
  { duration: '1m', target: 10 },   // Ramp up
  { duration: '3m', target: 10 },   // Steady state
  { duration: '1m', target: 0 },    // Ramp down
]
```

### 2. Custom Metrics
```javascript
const purchaseSuccess = new Counter('purchase_success');
const checkoutDuration = new Trend('checkout_duration');

// Usage
purchaseSuccess.add(1);
checkoutDuration.add(duration);
```

### 3. Grouped Scenarios
```javascript
group('01_Login', function() {
  // Login logic
});

group('02_Browse', function() {
  // Browsing logic
});
```

### 4. Threshold Validation
```javascript
thresholds: {
  http_req_duration: ['p(95)<500'],
  purchase_success: ['count>10'],
}
```

## Author

**Ana Flavia Roca Rojas**
- LinkedIn: [ana-flavia-roca-rojas](https://linkedin.com/in/ana-flavia-roca-rojas/)
- Email: annachess96@gmail.com

## License

MIT
