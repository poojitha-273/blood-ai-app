// Blood AI - Automated Performance Test Benchmark Engine
// Executes real HTTP requests against Blood AI backend and records full latency distributions.

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE_URL = process.env.BLOOD_AI_BASE_URL || 'http://localhost:5000/api';
const SUMMARY_DIR = path.resolve(__dirname, '../test-reports/summary');

if (!fs.existsSync(SUMMARY_DIR)) {
  fs.mkdirSync(SUMMARY_DIR, { recursive: true });
}

// Generate valid JWT token for authenticated benchmark requests
function generateAuthToken(role = 'hospital') {
  const secret = process.env.JWT_SECRET || 'bloodbank-smart-system-secret-2024';
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      id: 'perf-test-benchmark-user',
      role,
      email: 'perf.tester@bloodai.org',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400,
    })
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

const AUTH_TOKEN = generateAuthToken();

function calculatePercentiles(latencies) {
  if (!latencies.length) {
    return { min: 0, max: 0, avg: 0, med: 0, p90: 0, p95: 0, p99: 0 };
  }
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const avg = Number((sum / sorted.length).toFixed(1));
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const med = sorted[Math.floor(sorted.length * 0.5)];
  const p90 = sorted[Math.floor(sorted.length * 0.9)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  return { min, max, avg, med, p90, p95, p99 };
}

function makeRequest(fullUrl) {
  return new Promise((resolve) => {
    const start = Date.now();
    const urlObj = new URL(fullUrl);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      protocol: urlObj.protocol,
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'User-Agent': 'BloodAI-Performance-Agent/1.0',
      },
    };

    const req = client.request(options, (res) => {
      res.on('data', () => {});
      res.on('end', () => {
        const duration = Date.now() - start;
        resolve({
          statusCode: res.statusCode,
          duration,
          success: res.statusCode >= 200 && res.statusCode < 400,
        });
      });
    });

    req.on('error', () => {
      resolve({
        statusCode: 0,
        duration: Date.now() - start,
        success: false,
      });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve({
        statusCode: 408,
        duration: 5000,
        success: false,
      });
    });

    req.end();
  });
}

async function runScenario({ name, vus, durationSeconds, endpoints }) {
  console.log(`\n======================================================`);
  console.log(`RUNNING PERFORMANCE TEST: ${name}`);
  console.log(`Virtual Users: ${vus} | Duration: ${durationSeconds}s | Base URL: ${BASE_URL}`);
  console.log(`======================================================`);

  const startTime = Date.now();
  const endTime = startTime + durationSeconds * 1000;
  const latencies = [];
  let successfulRequests = 0;
  let failedRequests = 0;

  async function worker() {
    let epIdx = 0;
    while (Date.now() < endTime) {
      const ep = endpoints[epIdx % endpoints.length];
      epIdx++;
      const fullUrl = `${BASE_URL}${ep}`;
      const res = await makeRequest(fullUrl);
      latencies.push(res.duration);
      if (res.success) {
        successfulRequests++;
      } else {
        failedRequests++;
      }
      // Pacing delay
      await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 20) + 10));
    }
  }

  // Spawn concurrent virtual users
  const workers = Array.from({ length: vus }, () => worker());
  await Promise.all(workers);

  const totalTimeSeconds = Math.max(1, (Date.now() - startTime) / 1000);
  const totalRequests = successfulRequests + failedRequests;
  const rps = Number((totalRequests / totalTimeSeconds).toFixed(1));
  const stats = calculatePercentiles(latencies);
  const failureRate = Number(((failedRequests / Math.max(1, totalRequests)) * 100).toFixed(2));

  const result = {
    testName: name,
    virtualUsers: vus,
    durationSeconds: Math.round(totalTimeSeconds),
    durationFormatted: `${Math.round(totalTimeSeconds)}s`,
    totalRequests,
    requestsPerSecond: rps,
    successfulRequests,
    failedRequests,
    httpFailureRate: failureRate,
    latency: stats,
    timestamp: new Date().toISOString(),
    status: failureRate < 2.0 && stats.p95 < 500 ? 'PASSED' : failureRate < 10.0 ? 'DEGRADED' : 'FAILED',
  };

  console.log(`Total Requests: ${totalRequests} | RPS: ${rps}`);
  console.log(`Avg: ${stats.avg}ms | Min: ${stats.min}ms | Max: ${stats.max}ms | Median: ${stats.med}ms | P95: ${stats.p95}ms | P99: ${stats.p99}ms`);
  console.log(`Success: ${successfulRequests} | Failed: ${failedRequests} (${failureRate}%)`);
  console.log(`Outcome: ${result.status}`);

  return result;
}

async function main() {
  const endpoints = [
    '/health',
    '/blood-requests',
    '/blood-requests/predict-demand',
  ];

  const targetTest = process.argv[2] || 'all';

  if (targetTest === 'baseline' || targetTest === 'all') {
    const baseline = await runScenario({
      name: 'Baseline / Load Testing',
      vus: 40,
      durationSeconds: 12,
      endpoints,
    });
    fs.writeFileSync(
      path.join(SUMMARY_DIR, 'baseline-load-summary.json'),
      JSON.stringify(baseline, null, 2)
    );
  }

  if (targetTest === 'stress' || targetTest === 'all') {
    const stress = await runScenario({
      name: 'Stress Testing',
      vus: 80,
      durationSeconds: 12,
      endpoints,
    });
    fs.writeFileSync(
      path.join(SUMMARY_DIR, 'stress-test-summary.json'),
      JSON.stringify(stress, null, 2)
    );
  }

  if (targetTest === 'spike' || targetTest === 'all') {
    const spike = await runScenario({
      name: 'Spike Testing',
      vus: 100,
      durationSeconds: 10,
      endpoints,
    });
    fs.writeFileSync(
      path.join(SUMMARY_DIR, 'spike-test-summary.json'),
      JSON.stringify(spike, null, 2)
    );
  }

  if (targetTest === 'soak' || targetTest === 'all') {
    const soak = await runScenario({
      name: 'Soak / Endurance Testing',
      vus: 30,
      durationSeconds: 15,
      endpoints,
    });
    fs.writeFileSync(
      path.join(SUMMARY_DIR, 'soak-test-summary.json'),
      JSON.stringify(soak, null, 2)
    );
  }

  console.log(`\nAll performance test summaries written to ${SUMMARY_DIR}`);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { runScenario, makeRequest, calculatePercentiles, generateAuthToken };
