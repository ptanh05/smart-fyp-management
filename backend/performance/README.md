# Performance Testing Guide

This directory contains performance testing tools and configurations for the External Evaluation System.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Load Testing with Locust](#load-testing-with-locust)
3. [Django Performance Tests](#django-performance-tests)
4. [Frontend Performance Tests](#frontend-performance-tests)
5. [Performance Targets](#performance-targets)
6. [Interpreting Results](#interpreting-results)

---

## Prerequisites

### Backend

```bash
# Install performance testing dependencies
cd backend/performance
pip install -r requirements.txt
```

### Frontend

```bash
# Frontend performance tests use Playwright (already configured)
cd frontend
npm install
```

---

## Load Testing with Locust

Locust provides distributed load testing capabilities.

### Starting Load Tests

```bash
# Navigate to performance directory
cd backend/performance

# Start Locust web UI
locust -f locustfile.py --host=http://localhost:8000

# Or run headless with specific parameters
locust -f locustfile.py --host=http://localhost:8000 \
  --users 50 \
  --spawn-rate 10 \
  --run-time 5m \
  --headless
```

### Web UI Options

1. Open http://localhost:8089
2. Set number of users (e.g., 50)
3. Set spawn rate (e.g., 10 users/second)
4. Start swarming

### User Types Simulated

| User Type | Weight | Description |
|-----------|--------|-------------|
| ExternalExaminerUser | 3 | Dashboard, groups, evaluations |
| CommitteeMemberUser | 2 | Group management, assignments |
| StudentUser | 4 | Dashboard, profile, results |
| AnonymousUser | 1 | Unauthorized access attempts |

### Key Metrics to Monitor

- **RPS (Requests Per Second)**: Target > 100 RPS
- **Response Time (50th percentile)**: Target < 200ms
- **Response Time (95th percentile)**: Target < 500ms
- **Failure Rate**: Target < 1%

---

## Django Performance Tests

Run Django's built-in performance tests:

```bash
# Navigate to backend
cd backend

# Run all performance tests
python manage.py test app.tests.test_performance -v 2

# Run specific test class
python manage.py test app.tests.test_performance.APIResponseTimeTests -v 2
python manage.py test app.tests.test_performance.DatabaseQueryPerformanceTests -v 2
python manage.py test app.tests.test_performance.ConcurrentRequestTests -v 2
python manage.py test app.tests.test_performance.MemoryUsageTests -v 2
python manage.py test app.tests.test_performance.PaginationPerformanceTests -v 2
```

### Test Categories

| Test Class | Purpose |
|------------|---------|
| APIResponseTimeTests | Measures individual endpoint response times |
| DatabaseQueryPerformanceTests | Detects N+1 queries and slow queries |
| ConcurrentRequestTests | Tests under concurrent load |
| MemoryUsageTests | Detects memory leaks |
| PaginationPerformanceTests | Tests large dataset handling |

---

## Frontend Performance Tests

Run Playwright performance tests:

```bash
# Navigate to frontend
cd frontend

# Run all performance tests
npm run test:e2e -- e2e/performance/

# Run with verbose output
npm run test:e2e -- e2e/performance/ --reporter=list

# Generate HTML report
npm run test:e2e -- e2e/performance/ --reporter=html
```

### Metrics Tested

| Metric | Target | Description |
|--------|--------|-------------|
| Page Load Time | < 3s | Total time to load page |
| First Contentful Paint | < 1.8s | First visual content |
| Largest Contentful Paint | < 2.5s | Main content loaded |
| Cumulative Layout Shift | < 0.1 | Visual stability |
| Time to Interactive | < 3.8s | Page becomes interactive |
| API Response Time | < 500ms | Backend response time |

---

## Performance Targets

### Backend API

| Metric | Target | Critical |
|--------|--------|----------|
| Response Time (avg) | < 200ms | < 500ms |
| Response Time (p95) | < 500ms | < 1000ms |
| Database Queries/Request | < 10 | < 20 |
| Query Time | < 50ms | < 100ms |
| Memory Usage | Stable | < 512MB |
| Concurrent Users | 50+ | 100+ |

### Frontend

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| LCP | < 2.5s | 2.5s - 4.0s | > 4.0s |
| FID | < 100ms | 100ms - 300ms | > 300ms |
| CLS | < 0.1 | 0.1 - 0.25 | > 0.25 |
| FCP | < 1.8s | 1.8s - 3.0s | > 3.0s |
| TTFB | < 800ms | 800ms - 1800ms | > 1800ms |

---

## Interpreting Results

### Locust Results

```
Type     Name                                    # reqs   # fails  Avg    Min    Max   Median
---------------------------------------------------------------------------------------------
GET      /api/external/dashboard/                  500      0       89     45     234   85
GET      /api/external/groups/                     400      0       112    56     345   102
POST     /api/external/evaluations/create/         100      2       245    89     567   223
---------------------------------------------------------------------------------------------
         Aggregated                                1000     2       123    45     567   98
```

**Key Indicators:**
- `# fails`: Should be 0 or very low (< 1%)
- `Avg`: Average response time should be < 200ms
- `Max`: Maximum should not exceed 2-3x average
- `Median`: More representative than average for skewed distributions

### Django Test Output

```
External Dashboard: 45.23ms ✅
External Profile: 12.56ms ✅
External Groups List: 78.34ms ✅
Dashboard Queries: 5 ✅
Groups List Queries: 7 ✅
```

**Key Indicators:**
- Response times should be below thresholds
- Query counts should indicate proper use of select_related/prefetch_related
- Memory should remain stable over multiple requests

### Frontend Test Output

```
📊 Login Page Performance:
   Page Load Time: 1234ms ✅
   DOM Content Loaded: 456ms ✅
   First Contentful Paint: 234ms ✅
   Resources: 15 files, 456KB ✅
```

**Key Indicators:**
- All metrics should be below thresholds
- Resource count should be reasonable (< 50 for initial load)
- Transfer size should be optimized (< 2MB total)

---

## Troubleshooting

### Slow API Responses

1. Check database queries with Django Debug Toolbar
2. Add `select_related()` or `prefetch_related()` for N+1 queries
3. Add database indexes for frequently queried fields
4. Consider caching for expensive operations

### High Memory Usage

1. Check for memory leaks in long-running processes
2. Use `gc.collect()` after large operations
3. Consider streaming responses for large datasets
4. Use pagination for list endpoints

### Slow Page Loads

1. Enable gzip compression
2. Minify JavaScript and CSS
3. Lazy load images and non-critical resources
4. Use code splitting for large bundles
5. Enable browser caching with proper headers

---

## Continuous Integration

Add performance tests to CI pipeline:

```yaml
# .github/workflows/performance.yml
name: Performance Tests

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 6 * * *'  # Daily at 6 AM

jobs:
  backend-performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: pip install -r backend/requirements.txt -r backend/performance/requirements.txt
      - name: Run performance tests
        run: python backend/manage.py test app.tests.test_performance -v 2

  frontend-performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: cd frontend && npm ci
      - name: Run performance tests
        run: cd frontend && npm run test:e2e -- e2e/performance/
```

---

## Additional Resources

- [Locust Documentation](https://docs.locust.io/)
- [Django Performance Tips](https://docs.djangoproject.com/en/4.2/topics/performance/)
- [Web Vitals](https://web.dev/vitals/)
- [Playwright Performance](https://playwright.dev/docs/network#network-events)
