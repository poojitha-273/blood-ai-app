# Blood AI - Smart Blood Management Platform

[![Blood AI Automated Testing Suite](https://github.com/poojitha-273/blood-ai-app/actions/workflows/blood-ai-testing.yml/badge.svg)](https://github.com/poojitha-273/blood-ai-app/actions/workflows/blood-ai-testing.yml)

Blood AI (LifeLink) is a unified, smart blood management system connecting blood donors and hospitals in real-time. It features an automated end-to-end testing framework with GitHub Actions CI/CD and comprehensive downloadable Excel reports for web, mobile, and backend performance.

---

## 🚀 Key Platform Capabilities

1. **Donor Portal:**
   - Real-time nearby blood requests feed with GPS distance calculation.
   - One-tap Request Acceptance workflow.
   - Comprehensive 20+ condition Medical Health Questionnaire.
   - Automated Health Report Generation with Risk Scoring.
   - Dynamic 90-day cooldown & temporary/permanent Eligibility Status calculation.
   - Digital Blood Donor Card with QR code.
   - Push notifications & real-time alerts.

2. **Hospital Dashboard:**
   - Emergency and Standard Blood Request creation with live urgency flags.
   - Real-time 6-Stage Donor Assessment Workflow:
     1. Mark Donor as Reached Hospital
     2. Physical Donor Screening (Vitals, Weight, Hemoglobin)
     3. Donor Health Report Review
     4. Medical Eligibility Decision (Approve / Defer / Reject)
     5. Phlebotomy Collection Progress Tracking (Units / Volume)
     6. Donation Verification & Digital Certificate Issuance
   - Registered Donors directory (with test data cleanup).
   - AI-driven Blood Demand Forecasting.
   - **Blood Inventory Management Completely Removed** as per hospital architectural requirements.

3. **Android Application (`com.lifelink.bloodai`):**
   - High-performance Capacitor Android native wrapper.
   - Fixed mobile layout: horizontal title alignment, proper word-wrap, zero letter-breaking.
   - Pre-built downloadable APK artifact: `BloodAI.apk`.

---

## 🧪 Comprehensive Automated Testing Framework

```text
BLOOD AI APP/
├── .github/
│   └── workflows/
│       └── blood-ai-testing.yml          # GitHub Actions CI/CD Workflow
│
├── performance-tests/                    # K6 Performance Testing Suite
│   ├── baseline-load.js                  # 100 VUs Baseline / Load Test
│   ├── stress-test.js                    # 250 VUs Stress Test & Degradation Analysis
│   ├── spike-test.js                     # 200 VUs Sudden Surge & Recovery
│   ├── soak-test.js                      # 50 VUs Endurance & Memory Leak Test
│   ├── run-perf-tests.js                 # Authenticated Node HTTP Benchmark Engine
│   └── package.json
│
├── selenium-tests/                       # Selenium Web E2E Testing Suite (308 Test Cases)
│   ├── tests/
│   │   └── login-tests.js                # Authentication & Role Guard Tests
│   ├── utils/
│   │   ├── test-definitions.js           # 308 Full Test Case Definitions (20 Modules)
│   │   └── generate-test-cases.js
│   ├── reports/
│   ├── run-selenium-tests.js             # Master Selenium E2E Runner
│   └── package.json
│
├── appium-tests/                         # Appium Android E2E Testing Suite (312 Test Cases)
│   ├── tests/
│   │   └── app-tests.js                  # Native Android App Lifecycle Tests
│   ├── utils/
│   │   ├── app-definitions.js            # 312 Full Android Test Definitions (24 Modules)
│   │   └── generate-app-cases.js
│   ├── reports/
│   ├── run-appium-tests.js               # Master Appium Android Runner
│   └── package.json
│
├── test-reports/                         # Excel Report Engine & Summaries
│   ├── excel/                            # 7 Generated Excel (.xlsx) Reports
│   │   ├── Baseline_Load_Test_Report.xlsx
│   │   ├── Stress_Test_Report.xlsx
│   │   ├── Spike_Test_Report.xlsx
│   │   ├── Soak_Test_Report.xlsx
│   │   ├── Selenium_E2E_Test_Report.xlsx
│   │   ├── Appium_E2E_Test_Report.xlsx
│   │   └── Blood_AI_Overall_Test_Summary.xlsx
│   ├── summary/                          # JSON Metrics & Percentiles
│   └── generate-excel-reports.js
│
├── BloodAI.apk                           # Android Debug Release APK
└── package.json
```

---

## 📊 The 7 Excel Reports (.xlsx)

Each workbook is formatted in LifeLink Crimson (`#B71C1C`) theme with thin cell borders, zebra striping, status color coding (`PASS` green, `FAIL` red, `BLOCKED` amber), auto-fitted columns, and 3 distinct sheets:

| # | Excel Report File Name | Focus Area | Total Cases / Load |
|---|------------------------|------------|---------------------|
| 1 | `Baseline_Load_Test_Report.xlsx` | Normal concurrent traffic performance | 100 VUs / 60s |
| 2 | `Stress_Test_Report.xlsx` | Breaking point & degradation analysis | Up to 250 VUs |
| 3 | `Spike_Test_Report.xlsx` | Sudden traffic surges & recovery | 10 to 200 VUs burst |
| 4 | `Soak_Test_Report.xlsx` | Long-term memory & connection endurance | 50 Sustained VUs |
| 5 | `Selenium_E2E_Test_Report.xlsx` | Full Web Application User Journeys | 308 Test Cases (20 Modules) |
| 6 | `Appium_E2E_Test_Report.xlsx` | Native Android APK User Journeys | 312 Test Cases (24 Modules) |
| 7 | `Blood_AI_Overall_Test_Summary.xlsx` | Cross-Platform Parity & SLA Executive Summary | Consolidated Master View |

### Structure of Every Excel Workbook:
- **Sheet 1: Executive Summary** - KPI metrics, pass percentages, execution durations, SLA benchmarks, and overall verdicts.
- **Sheet 2: Detailed Test Results** - Full test execution log with IDs, Modules, Scenarios, Steps, Expected, Actual, Status, and Durations.
- **Sheet 3: Analytics & Coverage** - Module-level pass rates, response time percentiles (P50, P90, P95, P99), and SLA compliance distributions.

---

## 🏃 Running Tests Locally

```bash
# 1. Run all performance benchmark scenarios:
npm run test:perf

# 2. Run all 308 Selenium Web E2E test cases:
npm run test:selenium

# 3. Run all 312 Appium Android E2E test cases:
npm run test:appium

# 4. Generate all 7 Excel (.xlsx) Reports:
npm run test:reports

# 5. Execute everything in a single pipeline:
npm run test:all
```

---

## 📥 Downloading Excel Reports from GitHub Actions

1. Go to the **Actions** tab in this GitHub repository: [Actions Workflow Runs](https://github.com/poojitha-273/blood-ai-app/actions).
2. Click on the latest workflow run: **Blood AI Complete Automated Testing Suite & Reports**.
3. Scroll down to the **Artifacts** section at the bottom of the summary page.
4. Click on **`Blood-AI-All-Test-Excel-Reports`** to download the complete zip archive containing all 7 `.xlsx` reports.

---

## 📱 Installing the Android APK

1. Transfer `BloodAI.apk` located in the root directory to your physical Android device.
2. In Android Settings, allow "Install from Unknown Sources".
3. Open `BloodAI.apk` and tap **Install**.
4. Launch **Blood AI** from your app launcher.
