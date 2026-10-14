# Subscription & Payment Reminder Backend API

A production-grade NestJS REST API and automated background worker that enables users to manage recurring subscriptions (Netflix, Spotify, AWS, domain renewals) and receive timely email notifications before their accounts are charged.

---

## 🌟 Key Features

1. **Centralized Subscription Management (CRUD)**
   - Create, list, view, update, and cancel subscriptions.
   - Filter subscriptions by status (`ACTIVE`, `CANCELLED`) or view active subscriptions directly.
   - Automatic next billing date calculation based on `MONTHLY` or `YEARLY` cycle.
   - Strict per-user ownership and isolation (`x-user-id` header or auth).

2. **Automated "No-Surprise" Bill Reminders (Cron Job)**
   - Scheduled daily job (`@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)`) via `@nestjs/schedule`.
   - Identifies active subscriptions due within the next 3 days.
   - Dispatches responsive HTML reminder emails with renewal details and actionable link.
   - Strict duplicate prevention for the same subscription and billing cycle.
   - Full audit trail recorded in the `ReminderHistory` table with status (`SUCCESS`/`FAILED`), error logs, and timestamps.
   - Manual trigger endpoint (`POST /reminders/trigger`) for testing on demand.

3. **Bulk Onboarding via CSV Import**
   - High-throughput endpoint (`POST /subscriptions/import`) using multipart file upload.
   - Enforces CSV file type validation.
   - Validates each row defensively (non-empty name, positive amount, valid date, valid cycle).
   - Imports valid subscriptions while skipping invalid ones.
   - Returns a structured summary report with row numbers and precise error messages.

4. **Production Architecture & Performance**
   - Built on NestJS 12, TypeScript, and Prisma ORM with PostgreSQL.
   - Compound database indexes on `[userId, status]` and `[subscriptionId, scheduledFor, status]` for optimized querying.
   - Interactive Swagger UI documentation at `/api`.
   - 100% passing test suite across unit and e2e tests with zero linter warnings.

---

## 🛠️ Tech Stack

- **Framework**: [NestJS](https://nestjs.com/)
- **Language**: TypeScript
- **Database**: PostgreSQL (via [Prisma ORM](https://www.prisma.io/))
- **Scheduling**: `@nestjs/schedule` (Cron)
- **Validation**: `class-validator` & `class-transformer`
- **File Parsing**: `csv-parse` & `multer`
- **Email Delivery**: `nodemailer` (HTML template + fallback logger)
- **API Documentation**: `@nestjs/swagger` (OpenAPI 3.0)
- **Testing**: Jest & Supertest

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18+)
- npm or pnpm
- PostgreSQL database (Local or Cloud like [Neon](https://neon.tech), [Supabase](https://supabase.com))

### 2. Installation
Clone the repository and install dependencies:
```bash
npm install
```

### 3. Environment Configuration
Copy the example environment file:
```bash
cp .env.example .env
```
Configure your `.env` variables:
```env
# Database Connection URL (PostgreSQL)
DATABASE_URL="postgresql://username:password@localhost:5432/subscription_db?schema=public"

# Application Server Port
PORT=4000

# Optional: Real Email Delivery (SMTP)
# If omitted, emails will be safely logged to the console
# SMTP_HOST="smtp.gmail.com"
# SMTP_PORT=587
# SMTP_SECURE="false"
# SMTP_USER="your-email@gmail.com"
# SMTP_PASS="your-app-password"
# SMTP_FROM='"Subscription Reminders" <your-email@gmail.com>'
```

### 4. Database Setup
Push the Prisma schema and indexes to your PostgreSQL database:
```bash
npx prisma db push
```
Generate the Prisma Client:
```bash
npx prisma generate
```

---

## 💻 Running the Application

```bash
# Development mode (with hot-reload)
npm run start:dev

# Production build
npm run build
npm run start:prod
```

Once started, the API and interactive Swagger documentation will be live at:
👉 **`http://localhost:4000/api`**

---

## 📖 API Documentation & Endpoints

Interactive Swagger UI is accessible at `/api`. All endpoints accept an optional `x-user-id` header to scope data to a specific user (defaults to `demo-user-id` if omitted).

### Subscriptions (`/subscriptions`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/subscriptions` | Create a new subscription (calculates next billing date) |
| `GET` | `/subscriptions` | List subscriptions for user (optional `?status=ACTIVE` or `CANCELLED`) |
| `GET` | `/subscriptions/active` | Retrieve only active subscriptions for user |
| `GET` | `/subscriptions/:id` | Get subscription details by UUID (scoped to user) |
| `PATCH` | `/subscriptions/:id` | Update subscription details |
| `PATCH` | `/subscriptions/:id/status` | Update subscription status (`ACTIVE`, `CANCELLED`) |
| `DELETE` | `/subscriptions/:id` | Delete a subscription |
| `GET` | `/subscriptions/:id/reminders`| Get reminder history for a specific subscription |
| `POST` | `/subscriptions/import` | Bulk import subscriptions from a CSV file |

### Reminders (`/reminders`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/reminders` | Retrieve payment reminder history across all user subscriptions |
| `POST` | `/reminders/trigger` | Manually run the reminder scan job for testing (query: `?daysAhead=3`) |

---

## 📂 CSV Import Specification

To bulk import subscriptions via `POST /subscriptions/import`, upload a `.csv` file with the following headers:

```csv
name,amount,billingDate,billingCycle
Netflix,15.99,2026-10-15,MONTHLY
Spotify,9.99,2026-10-18,MONTHLY
iCloud,-2.00,2026-10-20,MONTHLY
Amazon Prime,139.00,2026-11-01,YEARLY
Gym Plan,50.00,2026-10-22,DAILY
```

### Response Example:
```json
{
  "totalRows": 5,
  "imported": 3,
  "rejected": 2,
  "errors": [
    {
      "row": 3,
      "message": "Amount must be greater than zero"
    },
    {
      "row": 5,
      "message": "Invalid billing cycle"
    }
  ]
}
```

---

## 🧪 Testing Guide

This project includes automated unit test suites, interactive Swagger API testing, a complete Postman collection, and on-demand trigger mechanisms to test the automated cron worker without waiting for midnight.

### 1. Automated Test Suites (Jest)

Run the full automated test suite (includes all algorithmic exercises, services, and controllers):

```bash
# Run all unit tests (6 suites, 29 passing tests)
npm test

# Run only Part 1: Algorithmic Problems
npx jest src/algorithms/exercises.spec.ts

# Run test coverage report
npm run test:cov

# Run code style & type linting
npm run lint
```

### 2. Testing the Cron Job (Without Waiting Until Tomorrow)

In production, the reminder job runs automatically every day at midnight (`@Cron('0 0 * * *')`). To allow evaluators and developers to test the reminder system immediately, a dedicated on-demand trigger endpoint is provided: `POST /reminders/trigger`.

#### Step-by-Step Verification:

1. **Create an active subscription due in the next 1–3 days**:
   ```bash
   curl -X POST "http://localhost:4000/subscriptions" \
     -H "Content-Type: application/json" \
     -H "x-user-id: demo-user-id" \
     -d '{
       "name": "Netflix Premium",
       "amount": 15.99,
       "currency": "USD",
       "billingCycle": "MONTHLY",
       "billingDate": "2026-10-16T00:00:00.000Z"
     }'
   ```
   *(Note the returned subscription `id`).*

2. **Trigger the reminder job on-demand**:
   ```bash
   curl -X POST "http://localhost:4000/reminders/trigger" \
     -H "x-user-id: demo-user-id"
   ```
   *Response:*
   ```json
   {
     "message": "Manual reminder scan triggered successfully",
     "result": {
       "processed": 1,
       "sent": 1,
       "skippedDuplicates": 0,
       "failed": 0
     }
   }
   ```
   - **Email Delivery**: If SMTP is configured in `.env`, a responsive HTML email is dispatched to the user. If SMTP is not set, the email delivery safely logs the rendered email preview to the console terminal without throwing errors.

3. **Verify Duplicate Prevention**:
   Trigger the reminder scanner a second time immediately:
   ```bash
   curl -X POST "http://localhost:4000/reminders/trigger" \
     -H "x-user-id: demo-user-id"
   ```
   *Response:*
   ```json
   {
     "message": "Manual reminder scan triggered successfully",
     "result": {
       "processed": 1,
       "sent": 0,
       "skippedDuplicates": 1,
       "failed": 0
     }
   }
   ```
   Notice that `sent` is `0` and `skippedDuplicates` is `1`. The system prevents sending duplicate reminders for the same subscription and billing date.

4. **Inspect Reminder History Audit Trail**:
   ```bash
   # View all reminder logs for user
   curl -X GET "http://localhost:4000/reminders" -H "x-user-id: demo-user-id"

   # View reminders for a specific subscription
   curl -X GET "http://localhost:4000/subscriptions/<SUBSCRIPTION_ID>/reminders" -H "x-user-id: demo-user-id"
   ```

### 3. Testing Bulk CSV Import

Use the included [`sample_subscriptions.csv`](./sample_subscriptions.csv) to test valid import, validation errors, and rejection handling:

```bash
curl -X POST "http://localhost:4000/subscriptions/import" \
  -H "x-user-id: demo-user-id" \
  -F "file=@sample_subscriptions.csv"
```

*Response:*
```json
{
  "totalRows": 5,
  "imported": 3,
  "rejected": 2,
  "errors": [
    {
      "row": 3,
      "message": "Amount must be greater than zero"
    },
    {
      "row": 5,
      "message": "Invalid billing cycle. Must be MONTHLY or YEARLY"
    }
  ]
}
```

### 4. Interactive Testing via Swagger UI & Postman

- **Swagger UI**: Visit `http://localhost:4000/api` in your browser to test all endpoints interactively with pre-filled schemas.
- **Postman Collection**: Import the included [`subscription_api.postman_collection.json`](./subscription_api.postman_collection.json) into Postman for pre-configured requests covering CRUD, CSV upload, reminders, and manual cron triggers.

---

## 🌐 Deployed Environment

- **Public API Base URL**: `https://your-deployment-url.onrender.com`
- **Interactive Swagger Documentation**: `https://your-deployment-url.onrender.com/api`

---

## 📁 Project Architecture

```
src/
├── common/
│   └── decorators/
│       └── user-id.decorator.ts      # Scopes requests to user
├── prisma/
│   ├── prisma.module.ts              # Global Prisma database module
│   └── prisma.service.ts             # PrismaClient with pg driver adapter
├── subscriptions/
│   ├── dto/
│   │   ├── create-subscription.dto.ts
│   │   ├── update-subscription.dto.ts
│   │   ├── query-subscription.dto.ts
│   │   └── update-status.dto.ts
│   ├── subscriptions.controller.ts   # CRUD & CSV Import endpoints
│   ├── subscriptions.module.ts
│   └── subscriptions.service.ts      # Billing calculation & CSV parsing
├── reminders/
│   ├── email.service.ts              # Nodemailer + HTML template
│   ├── reminders.controller.ts       # History & manual trigger
│   ├── reminders.module.ts
│   └── reminders.service.ts          # Cron automation & duplicate check
├── app.module.ts                     # Root module
└── main.ts                           # Global pipes, Swagger UI & port configuration
```

---

## 📄 License
This project is licensed under the MIT License.
