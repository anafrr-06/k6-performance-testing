#!/bin/bash

# Quick smoke test for CI
# Usage: ./scripts/run-quick.sh [base_url]

BASE_URL=${1:-"http://localhost:3000"}

echo "Running quick performance smoke test..."

k6 run -e BASE_URL=$BASE_URL \
  --vus 5 \
  --duration 30s \
  tests/load/baseline.js

echo "Quick test completed!"
