<h1 align="center">FitTrack</h1>

> FitTrack is a multi-platform gym management system developed for **Sertfit Athletics Gym and Sports Hub**. The project consists of a web-based Management Information System (MIS) with Performance Analytics and a dedicated mobile Fitness Engagement Application with Workout Tracking and Session Booking.

## Deployment

- **Website:** [sertfit-fittrack.live](https://sertfit-fittrack.live/)
- **Mobile Application:** *Currently available as Android APK and iOS TestFlight*

---

## Tech Stack

| Category | Technologies |
|---|---|
| **Languages** | ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white) ![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black) ![CSS](https://img.shields.io/badge/CSS-1572B6?style=for-the-badge&logo=css&logoColor=white) ![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white) |
| **Web Development** | ![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black) ![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white) ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white) |
| **Mobile Development** | ![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB) ![Expo](https://img.shields.io/badge/Expo-000020?style=for-the-badge&logo=expo&logoColor=white) |
| **Platforms** | ![Android](https://img.shields.io/badge/Android-3DDC84?style=for-the-badge&logo=android&logoColor=white) ![iOS](https://img.shields.io/badge/iOS-000000?style=for-the-badge&logo=apple&logoColor=white) |
| **Backend & Database** | ![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white) ![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white) ![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white) ![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white) ![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white) |
| **AI Services** | ![MediaPipe Web](https://img.shields.io/badge/MediaPipe_Web-0097A7?style=for-the-badge&logo=google&logoColor=white) ![MediaPipe Mobile](https://img.shields.io/badge/MediaPipe_Mobile-0097A7?style=for-the-badge&logo=google&logoColor=white) ![Ultralytics YOLO](https://img.shields.io/badge/Ultralytics_YOLO-111F68?style=for-the-badge&logo=yolo&logoColor=white) ![OpenRouter](https://img.shields.io/badge/OpenRouter-6467F2?style=for-the-badge&logo=openrouter&logoColor=white) |
| **Tools & Deployment** | ![pnpm](https://img.shields.io/badge/pnpm-F69220?style=for-the-badge&logo=pnpm&logoColor=white) ![Turborepo](https://img.shields.io/badge/Turborepo-EF4444?style=for-the-badge&logo=turborepo&logoColor=white) ![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white) ![Railway](https://img.shields.io/badge/Railway-0B0D0E?style=for-the-badge&logo=railway&logoColor=white) |

---

## SYSTEM MODULES
### General

> **ALL ROLES** have Login, Profile, Notifications, and Settings.

### Website

| Role | Modules |
|---|---|
| **ADMIN** | Analytics, Facilities, Ranking Governance, Milestone, BrodigyAI |
| **STAFF** | Accounts, Gym Operations, Inventory, Gym Actions, Exercise Lab, Membership |
| **COACH** | Dashboard, Clients, Sessions, Earnings, BrodigyAI |
| **MEMBER** | Home, Facilities, Bookings, BrodigyAI |
| **NON-MEMBER** | *Same as MEMBER, except BrodigyAI is disabled* |

> **ADMIN** has access to all **STAFF** modules, but **STAFF** does not have access to **ADMIN** modules.

### Mobile Application

| Role | Modules |
|---|---|
| **COACH** | Clients, Sessions, Earnings |
| **MEMBER** | Registration, Home, Bookings, Assessments, Facilities, Nutrition, Muscle Mastery, Workout, BrodigyAI |
| **NON-MEMBER** | *Same as MEMBER, except Muscle Mastery, Workout, and BrodigyAI are disabled* |

---

## Project Structure

```
FitTrack/
├── apps/
│   ├── ai-microservice/                   # FastAPI service (pose detection, AI domains)
│   │   ├── app/
│   │   │   ├── api/
│   │   │   ├── models/                    # Pydantic schemas, not ML weights
│   │   │   └── services/
│   │   ├── models/                        # actual ML model assets (e.g. gym-equipment)
│   │   └── tests/
│   │
│   ├── api/                               # NestJS backend
│   │   ├── prisma/
│   │   ├── src/
│   │   │   ├── admin/
│   │   │   ├── ai/                        # BrodigyAI chat/insight domains
│   │   │   ├── analytics/
│   │   │   ├── audit/
│   │   │   ├── auth/
│   │   │   ├── booking-venue/             # venue/facility bookings
│   │   │   ├── bookings/                  # session bookings
│   │   │   ├── coach-appointment/
│   │   │   ├── coaching/
│   │   │   ├── common/
│   │   │   ├── config/
│   │   │   ├── files/
│   │   │   ├── fitness/
│   │   │   ├── gym-actions/               # staff-logged gym action reports
│   │   │   ├── gym-layout/
│   │   │   ├── inventory/
│   │   │   ├── jwt/
│   │   │   ├── mail/
│   │   │   ├── membership/
│   │   │   ├── notifications/
│   │   │   ├── nutrition/
│   │   │   ├── prisma/
│   │   │   ├── queue/
│   │   │   ├── staff/
│   │   │   ├── types/                     # ambient .d.ts declarations
│   │   │   └── user/
│   │   └── test/
│   │
│   ├── web/                               # Next.js web app
│   │   ├── app/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── constants/
│   │   ├── contexts/
│   │   ├── data/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── public/
│   │   ├── styles/
│   │   └── utils/
│   │
│   └── mobile/                            # Expo / React Native app
│       ├── app/
│       ├── assets/
│       ├── components/
│       ├── contexts/
│       ├── data/
│       ├── hooks/
│       ├── lib/
│       ├── public/
│       ├── scripts/
│       ├── styles/
│       └── utils/
│
├── packages/                              # shared workspace packages
│   ├── api-client/
│   ├── app-config/
│   ├── app-core/
│   ├── hooks/
│   ├── query/
│   ├── types/
│   ├── ui/
│   ├── utils/
│   └── validators/
│
├── patches/                               # pnpm patches for native/RN dependencies
├── scripts/                               # dev-stack, seeding, and deployment tooling
├── tests/                                 # Playwright UI/e2e specs
│
├── docker-compose.local-infra.yml         # Postgres + Redis only, for local dev
├── docker-compose.yml                     # full containerized stack (all services)
├── turbo.json
├── pnpm-workspace.yaml
└── package.json                           # root-level scripts (dev, build, db:*, test:*)
```

> **Note:** Highlighted comments are limited to folders with unclear or vague purposes from name alone.

---

## Getting Started

### Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 20.x |
| pnpm | 10.x |
| Docker & Docker Compose | latest |
| Python | 3.11+ (for the AI microservice, managed via `uv`) |

### 1. Clone and install dependencies

```bash
git clone <repository-url-here>
cd fittrack
pnpm install
```

### 2. Configure environment variables

Copy the provided format file and fill in your own secrets (database credentials, JWT secret, OAuth keys, PayMongo keys, OpenRouter API key, etc.):

```bash
cp .env.format .env
```

### 3. Start local infrastructure (PostgreSQL + Redis)

```bash
pnpm infra:up
```

### 4. Set up the database

```bash
pnpm db:generate       # Generate Prisma client
pnpm db:push           # Push schema to the database
pnpm db:seed           # (optional) Seed with sample data
```

### 5. Run the apps

```bash
# Backend API (NestJS)
pnpm dev:api

# Web app (Next.js)
pnpm dev:web

# Mobile app (Expo)
pnpm dev:mobile

# AI microservice (FastAPI)
pnpm dev:ai
```

Or start the whole stack together:

```bash
pnpm dev:stack:web:ai
```

The web app runs on `http://localhost:8080` and the API on `http://localhost:3001/v1` by default.

### Alternative: Full Docker Stack

The repository also includes a full `docker-compose.yml` that builds and runs every service in containers (Postgres, Redis, the AI microservice, the API, the web app, plus Prometheus/Grafana for monitoring). Use this if you'd rather not run each app locally:

```bash
cp .env.docker.format .env.docker
docker compose up -d
```

## License

This project is unlicensed, so don't even think about it.

---
