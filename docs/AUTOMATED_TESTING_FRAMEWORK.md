# Blood AI – Automated Testing Framework Guide

## Testing Layers

1. **Performance Testing (K6 Engine):**
   - **Baseline / Load:** 40 VUs (100 in CI), measures RPS, latency percentiles (P50, P90, P95, P99).
   - **Stress Testing:** Ramp-up to 80 VUs (250 in CI), determines breaking points.
   - **Spike Testing:** Sudden surge to 100 VUs (200 in CI), tests system recovery.
   - **Soak / Endurance:** 30 VUs (50 in CI), tests memory endurance and connection pooling.

2. **Selenium Web E2E Testing (308 Test Cases):**
   - 20 modules tested end-to-end with headless Chrome.
   - Complete coverage of registration, passwordless login, request workflows, assessments, health profiles, and responsive UI.

3. **Appium Android E2E Testing (312 Test Cases):**
   - 24 native modules targeting `com.lifelink.bloodai` and `BloodAI.apk`.
   - Splash lifecycle, GPS geolocation, offline sync, biometrics, hardware back buttons, and orientation change.

4. **Reporting Engines:**
   - 7 Excel Reports (`.xlsx`) generated via ExcelJS in `Test-Reports-Passed-Excel/`.
   - 6 JUnit XML Test Results files in `test-reports/xml/` and `Test-Reports-Passed-Excel/`.
   - Integrated into GitHub Actions workflow (`.github/workflows/blood-ai-testing.yml`).
