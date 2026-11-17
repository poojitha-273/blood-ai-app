# Blood AI - Smart Blood Management Platform

[![Blood AI Automated Testing Suite](https://github.com/poojitha-273/blood-ai-app/actions/workflows/blood-ai-testing.yml/badge.svg)](https://github.com/poojitha-273/blood-ai-app/actions/workflows/blood-ai-testing.yml)

Blood AI (LifeLink) is a unified, smart blood management system connecting blood donors and hospitals in real-time. It features an automated end-to-end testing framework with GitHub Actions CI/CD and comprehensive downloadable Excel reports for web, mobile, and backend performance.

---

## 📁 Repository Folder Structure

```text
BLOOD AI APP/
│
├── .github/
│   └── workflows/
│       └── blood-ai-testing.yml          # GitHub Actions CI/CD Workflow
│
├── frontend/                             # Complete Frontend Source Code (React + Vite + Tailwind)
│   ├── src/
│   │   ├── pages/                        # Donor, Hospital, Auth, Landing pages
│   │   ├── components/                   # UI components, maps, modals
│   │   ├── contexts/                     # AuthContext & Session management
│   │   └── lib/                          # API client & Supabase connector
│   ├── public/                           # Static assets, SVG icons
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── backend/                              # Complete Backend Source Code (Express + Node.js)
│   ├── routes/                           # Auth, Blood Requests, Donor, Hospital APIs
│   ├── middleware/                       # JWT auth & role-based access control
│   ├── services/                         # Email & notification dispatch services
│   ├── config/                           # Supabase configuration & client
│   ├── db/                               # Database schemas & migrations
│   ├── index.js                          # Express server entry point
│   └── package.json
│
├── android/                              # Complete Native Android Project (Capacitor)
│   ├── app/                              # Android app module (Gradle, Manifest, Java)
│   ├── gradle/wrapper/                   # Gradle wrapper configuration
│   ├── build.gradle                      # Top-level Gradle build file
│   └── BloodAI.apk                       # Compiled Android Debug Release APK
│
├── performance-tests/                    # K6 & Node.js Performance Benchmark Suite
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
│   ├── reports/                          # JSON execution logs
│   ├── run-selenium-tests.js             # Master Selenium E2E Runner
│   └── package.json
│
├── appium-tests/                         # Appium Android E2E Testing Suite (312 Test Cases)
│   ├── tests/
│   │   └── app-tests.js                  # Native Android App Lifecycle Tests
│   ├── utils/
│   │   ├── app-definitions.js            # 312 Full Android Test Definitions (24 Modules)
│   │   └── generate-app-cases.js
│   ├── reports/                          # JSON execution logs
│   ├── run-appium-tests.js               # Master Appium Android Runner
│   └── package.json
│
├── test-reports/                         # Raw Metrics, XML and Summaries
│   ├── excel/                            # 7 Generated Excel (.xlsx) Reports
│   ├── xml/                              # 6 JUnit XML Test Results Files
│   │   ├── Baseline_Load_Test_Results.xml
│   │   ├── Stress_Test_Results.xml
│   │   ├── Spike_Test_Results.xml
│   │   ├── Soak_Test_Results.xml
│   │   ├── Selenium_E2E_Test_Results.xml
│   │   └── Appium_E2E_Test_Results.xml
│   ├── summary/                          # JSON Metrics & Percentiles
│   └── generate-excel-reports.js
│
├── Test-Reports-Passed-Excel/            # Dedicated Verified Reports Folder
│   ├── Baseline_Load_Test_Report.xlsx
│   ├── Stress_Test_Report.xlsx
│   ├── Spike_Test_Report.xlsx
│   ├── Soak_Test_Report.xlsx
│   ├── Selenium_E2E_Test_Report.xlsx
│   ├── Appium_E2E_Test_Report.xlsx
│   ├── Blood_AI_Overall_Test_Summary.xlsx
│   ├── Baseline_Load_Test_Results.xml    # 4 Performance XML Test Results
│   ├── Stress_Test_Results.xml
│   ├── Spike_Test_Results.xml
│   ├── Soak_Test_Results.xml
│   └── README.md                         # Detailed guide to verified passed reports
│
├── docs/                                 # Architectural & Technical Documentation
│   ├── ARCHITECTURE.md
│   ├── API_DOCUMENTATION.md
│   └── AUTOMATED_TESTING_FRAMEWORK.md
│
├── BloodAI.apk                           # Android Debug Release APK (4.23 MB)
├── .env.example                          # Environment template (zero exposed secrets)
├── .gitignore                            # Comprehensive ignore configuration
└── package.json                          # Root package configuration
```

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

## 📊 The 7 Excel Reports & 4 XML Files (All Passed)

All reports are available in the dedicated folder **`Test-Reports-Passed-Excel/`**:

| # | Excel Report File Name | XML Results File | Focus Area | Status |
|---|------------------------|------------------|------------|:------:|
| 1 | `Baseline_Load_Test_Report.xlsx` | `Baseline_Load_Test_Results.xml` | 100 VUs / 60s Load Benchmark | **PASSED** |
| 2 | `Stress_Test_Report.xlsx` | `Stress_Test_Results.xml` | Ramp-up to 250 VUs Stress Test | **PASSED** |
| 3 | `Spike_Test_Report.xlsx` | `Spike_Test_Results.xml` | Sudden 200 VUs Burst Surge Test | **PASSED** |
| 4 | `Soak_Test_Report.xlsx` | `Soak_Test_Results.xml` | 50 VUs Sustained Endurance Test | **PASSED** |
| 5 | `Selenium_E2E_Test_Report.xlsx` | `Selenium_E2E_Test_Results.xml` | 308 Web E2E Test Cases (20 Modules) | **PASSED** |
| 6 | `Appium_E2E_Test_Report.xlsx` | `Appium_E2E_Test_Results.xml` | 312 Android E2E Test Cases (24 Modules) | **PASSED** |
| 7 | `Blood_AI_Overall_Test_Summary.xlsx` | - | Consolidated Quality Matrix & SLA | **PASSED** |

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
