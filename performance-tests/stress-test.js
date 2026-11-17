import http from 'k6/http';
import { check, sleep } from 'k6';

// TEST 2: STRESS TESTING
// Objective: Identify the maximum traffic the Blood AI backend can handle before breaking

export const options = {
  stages: [
    { duration: '15s', target: 25 },  // Warm up to moderate load
    { duration: '25s', target: 75 },  // Normal high traffic
    { duration: '30s', target: 150 }, // Stress stage
    { duration: '30s', target: 250 }, // Maximum stress peak
    { duration: '20s', target: 0 },   // Recovery ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2500'],
    http_req_failed: ['rate<0.10'], // Less than 10% errors under peak stress
  },
};

const BASE_URL = __ENV.BLOOD_AI_BASE_URL || 'http://localhost:5000/api';

export default function () {
  const headers = { 'Content-Type': 'application/json' };

  // 1. Health Ping
  const res1 = http.get(`${BASE_URL}/health`, { headers });
  check(res1, { 'health ok': (r) => r.status === 200 });

  // 2. Active Requisitions
  const res2 = http.get(`${BASE_URL}/blood-requests`, { headers });
  check(res2, { 'requests returned': (r) => r.status === 200 });

  // 3. AI Demand Predictions
  const res3 = http.get(`${BASE_URL}/blood-requests/predict-demand`, { headers });
  check(res3, { 'predictions ok': (r) => r.status === 200 });

  sleep(0.3);
}

export function handleSummary(data) {
  return {
    'test-reports/summary/stress-test-k6.json': JSON.stringify(data, null, 2),
    stdout: `
======================================================
BLOOD AI - STRESS TEST SUMMARY
======================================================
Max Peak VUs: 250
Duration: 2 minutes
Peak Requests Per Second: ${data.metrics.http_reqs ? data.metrics.http_reqs.values.rate.toFixed(1) : 0}
Total Requests: ${data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0}
Average Response Time: ${data.metrics.http_req_duration ? data.metrics.http_req_duration.values.avg.toFixed(1) : 0}ms
Maximum Response Time: ${data.metrics.http_req_duration ? data.metrics.http_req_duration.values.max.toFixed(1) : 0}ms
P95 Response Time: ${data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(95)'].toFixed(1) : 0}ms
P99 Response Time: ${data.metrics.http_req_duration ? (data.metrics.http_req_duration.values['p(99)'] || data.metrics.http_req_duration.values.max).toFixed(1) : 0}ms
HTTP Failure Rate: ${data.metrics.http_req_failed ? (data.metrics.http_req_failed.values.rate * 100).toFixed(2) : 0}%
======================================================
`,
  };
}
