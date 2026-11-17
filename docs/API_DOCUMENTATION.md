# Blood AI – REST API Specification

## Base URL
- Production / Staging: `https://api.bloodai.org/api`
- Local Development: `http://localhost:5000/api`

## Authentication
All protected routes require an HTTP Authorization header:
```http
Authorization: Bearer <JWT_TOKEN>
```

## Endpoints

### 1. Health Check
- `GET /health`: Returns server status, mode, and timestamp.

### 2. Authentication
- `POST /auth/send-token`: Sends 6-digit OTP to donor or hospital email.
- `POST /auth/verify-token`: Verifies OTP and returns user profile + JWT.

### 3. Blood Requests
- `GET /blood-requests`: Retrieves active blood requests within hospital/donor vicinity.
- `POST /blood-requests`: Creates a new emergency or standard blood request.
- `GET /blood-requests/predict-demand`: AI demand prediction for blood units by group.
- `PATCH /blood-requests/:id/status`: Updates blood request status (ACTIVE, FULFILLED, CANCELLED).

### 4. Donor Workflow
- `POST /donor/health-profile`: Saves 20+ medical questions and computes risk score.
- `GET /donor/health-report/:id`: Retrieves structured health profile report.
- `POST /donor/accept-request`: Donor commits to fulfilling a hospital blood request.

### 5. Hospital Assessment Workflow (6 Stages)
- `POST /hospital/mark-reached`: Stage 1 - Marks donor arrival at hospital.
- `POST /hospital/physical-screening`: Stage 2 - Records donor vitals (BP, Hb, Weight).
- `GET /hospital/review-health-report`: Stage 3 - Inspects donor medical questionnaire.
- `POST /hospital/screening-decision`: Stage 4 - Approves, defers, or rejects donor.
- `POST /hospital/collection-progress`: Stage 5 - Tracks blood bag phlebotomy collection.
- `POST /hospital/verify-donation`: Stage 6 - Finalizes donation and issues certificate.
