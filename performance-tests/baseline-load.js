import http from 'k6/http';
import { check, sleep } from 'k6';

// TEST 1: BASELINE / LOAD TESTING
// Objective: Test Blood AI under normal expected concurrent traffic (100 VUs, 1 minute)

export const options = {
  vus: 100,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(95)<1500', 'avg<600'],
    http_req_failed: ['rate<0.02'], // 98%+ success rate
  },
};

const BASE_URL = __ENV.BLOOD_AI_BASE_URL || 'http://localhost:5000/api';

export default function () {
  const headers = { 'Content-Type': 'application/json' };

  // 1. System Health Check
  const healthRes = http.get(`${BASE_URL}/health`, { headers });
  check(healthRes, {
    'health status is 200': (r) => r.status === 200,
    'health returns ok': (r) => r.json('status') === 'ok',
  });

  // 2. Public Blood Requests Feed
  const requestsRes = http.get(`${BASE_URL}/blood-requests`, { headers });
  check(requestsRes, {
    'requests status is 200': (r) => r.status === 200,
    'requests payload is array': (r) => Array.isArray(r.json()),
  });

  // 3. AI Demand Predictions
  const predictRes = http.get(`${BASE_URL}/blood-requests/predict-demand`, { headers });
  check(predictRes, {
    'predictions status is 200': (r) => r.status === 200,
  });

  sleep(0.5);
}

export function handleSummary(data) {
  return {
    'test-reports/summary/baseline-load-k6.json': JSON.stringify(data, null, 2),
    stdout: `
======================================================
BLOOD AI - BASELINE / LOAD TEST SUMMARY
======================================================
Virtual Users: ${data.metrics.vus ? data.metrics.vus.values.value : 100}
Duration: 1 minute
Requests Per Second: ${data.metrics.http_reqs ? data.metrics.http_reqs.values.rate.toFixed(1) : 0}
Total Requests: ${data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0}
Average Response Time: ${data.metrics.http_req_duration ? data.metrics.http_req_duration.values.avg.toFixed(1) : 0}ms
Minimum: ${data.metrics.http_req_duration ? data.metrics.http_req_duration.values.min.toFixed(1) : 0}ms
Maximum: ${data.metrics.http_req_duration ? data.metrics.http_req_duration.values.max.toFixed(1) : 0}ms
Median (P50): ${data.metrics.http_req_duration ? data.metrics.http_req_duration.values.med.toFixed(1) : 0}ms
P90: ${data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(90)'].toFixed(1) : 0}ms
P95: ${data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(95)'].toFixed(1) : 0}ms
HTTP Failures: ${data.metrics.http_req_failed ? (data.metrics.http_req_failed.values.rate * 100).toFixed(2) : 0}%
======================================================
`,
  };
}
