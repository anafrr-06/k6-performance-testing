#!/bin/bash

# Run all performance tests
# Usage: ./scripts/run-all.sh [base_url]

BASE_URL=${1:-"http://localhost:3000"}
REPORTS_DIR="reports"

echo "==================================="
echo "K6 Performance Test Suite"
echo "Target: $BASE_URL"
echo "==================================="

mkdir -p $REPORTS_DIR

# Check if API is running
echo "Checking API health..."
if ! curl -s "$BASE_URL/health" | grep -q "ok"; then
    echo "ERROR: API is not running at $BASE_URL"
    echo "Start the API first: cd api && npm start"
    exit 1
fi
echo "API is healthy!"

# Run tests
echo ""
echo "1/4 Running Baseline Load Test..."
k6 run -e BASE_URL=$BASE_URL tests/load/baseline.js --out json=reports/baseline-results.json

echo ""
echo "2/4 Running Purchase Flow Test..."
k6 run -e BASE_URL=$BASE_URL tests/load/purchase-flow.js --out json=reports/purchase-flow-results.json

echo ""
echo "3/4 Running Spike Test..."
k6 run -e BASE_URL=$BASE_URL tests/spike/sudden-traffic.js --out json=reports/spike-results.json

echo ""
echo "4/4 Running Stress Test..."
k6 run -e BASE_URL=$BASE_URL tests/stress/breaking-point.js --out json=reports/stress-results.json

echo ""
echo "==================================="
echo "All tests completed!"
echo "Reports saved to: $REPORTS_DIR/"
echo "==================================="
