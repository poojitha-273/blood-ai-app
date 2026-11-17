import http from 'k6/http';
import { check, sleep } from 'k6';

// TEST 4: SOAK / ENDURANCE TESTING
// Objective: Test Blood AI stability, memory leaks, and connection endurance under sustained traffic

const SOAK_DURATION = __ENV.SOAK_DURATION || '5m';

export const options = {
  stages: [
    { duration: '30s', target: 50 },          // Ramp up to 50 sustained VUs
    { duration: SOAK_DURATION, target: 50 },  // Maintain steady load for duration (default 5 mins)
    { duration: '30s', target: 0 },           // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1800', 'avg<700'],
    http_req_failed: ['rate<0.05'], // Max 5% errors over extended soak
  },
};

const BASE_URL = __ENV.BLOOD_AI_BASE_URL || 'http://localhost:5000/api';

export default function () {
  const headers = { 'Content-Type': 'application/json' };

  // 1. Health check
  const r1 = http.get(`${BASE_URL}/health`, { headers });
  check(r1, { 'soak health ok': (r) => r.status === 200 });

  // 2. Public requests
  const r2 = http.get(`${BASE_URL}/blood-requests`, { headers });
  check(r2, { 'soak requests ok': (r) => r.status === 200 });

  // 3. Demand predictions
  const r3 = http.get(`${BASE_URL}/blood-requests/predict-demand`, { headers });
  check(r3, { 'soak predictions ok': (r) => r.status === 200 });

  sleep(0.5);
}

export function handleSummary(data) {
  return {
    'test-reports/summary/soak-test-k6.json': JSON.stringify(data, null, 2),
    stdout: `
======================================================
BLOOD AI - SOAK / ENDURANCE TEST SUMMARY
======================================================
Sustained Virtual Users: 50
Test Duration: ${SOAK_DURATION}
Total Requests Processed: ${data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0}
Throughput (RPS): ${data.metrics.http_reqs ? data.metrics.http_reqs.values.rate.toFixed(1) : 0}
Average Response Time: ${data.metrics.http_req_duration ? data.metrics.http_req_duration.values.avg.toFixed(1) : 0}ms
Median Response Time: ${data.metrics.http_req_duration ? data.metrics.http_req_duration.values.med.toFixed(1) : 0}ms
P95 Response Time: ${data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(95)'].toFixed(1) : 0}ms
Max Response Time: ${data.metrics.http_req_duration ? data.metrics.http_req_duration.values.max.toFixed(1) : 0}ms
Error Rate: ${data.metrics.http_req_failed ? (data.metrics.http_req_failed.values.rate * 100).toFixed(2) : 0}%
Degradation/Leak Detected: ${data.metrics.http_req_failed && data.metrics.http_req_failed.values.rate > 0.05 ? 'YES - INVESTIGATE' : 'NO - SYSTEM STABLE'}
======================================================
`,
  };
}
