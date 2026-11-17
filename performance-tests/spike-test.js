import http from 'k6/http';
import { check, sleep } from 'k6';

// TEST 3: SPIKE TESTING
// Objective: Test how Blood AI responds to sudden extreme traffic spikes and measures recovery

export const options = {
  stages: [
    { duration: '10s', target: 10 },  // Baseline low traffic
    { duration: '10s', target: 200 }, // Sudden massive spike!
    { duration: '20s', target: 200 }, // Hold sudden traffic spike
    { duration: '10s', target: 10 },  // Sudden drop back down
    { duration: '20s', target: 10 },  // Observe recovery and stabilization
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    http_req_failed: ['rate<0.15'], // Less than 15% errors during severe spike
  },
};

const BASE_URL = __ENV.BLOOD_AI_BASE_URL || 'http://localhost:5000/api';

export default function () {
  const headers = { 'Content-Type': 'application/json' };

  const res = http.get(`${BASE_URL}/health`, { headers });
  check(res, {
    'spike health responded': (r) => r.status === 200,
  });

  const res2 = http.get(`${BASE_URL}/blood-requests`, { headers });
  check(res2, {
    'spike requests responded': (r) => r.status === 200,
  });

  sleep(0.2);
}

export function handleSummary(data) {
  return {
    'test-reports/summary/spike-test-k6.json': JSON.stringify(data, null, 2),
    stdout: `
======================================================
BLOOD AI - SPIKE TEST SUMMARY
======================================================
Spike Traffic Peak: 200 VUs
Spike Duration: 1m 10s
Average Response Time: ${data.metrics.http_req_duration ? data.metrics.http_req_duration.values.avg.toFixed(1) : 0}ms
Peak Response Time: ${data.metrics.http_req_duration ? data.metrics.http_req_duration.values.max.toFixed(1) : 0}ms
P95 Response Time: ${data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(95)'].toFixed(1) : 0}ms
HTTP Error Percentage: ${data.metrics.http_req_failed ? (data.metrics.http_req_failed.values.rate * 100).toFixed(2) : 0}%
System Recovered: ${data.metrics.http_req_failed && data.metrics.http_req_failed.values.rate < 0.15 ? 'YES (PASSED)' : 'DEGRADED'}
======================================================
`,
  };
}
