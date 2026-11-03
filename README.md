# Marrakech Culture Experience

An interactive, real-time cultural presentation platform celebrating the rich history, architecture, artisans, traditions, gastronomy, and music of Marrakech, Morocco.

Designed for live events, exhibitions, classrooms, and conferences, the platform seamlessly synchronizes three distinct interfaces in real time:
1. **The Projector Screen (`/present?session=SESSION_CODE`)**: A cinematic, large-format visual display designed for venue screens, free from private notes or administrative controls.
2. **The Presenter Control Center (`/admin/presentation`)**: An authenticated control hub for hosts with speaker notes, slide progression, keyboard shortcuts, poll & quiz triggers, and audience moderation.
3. **The Audience Mobile Interface (`/join`)**: A mobile-first interactive screen allowing attendees to join via QR code or session code, vote in live polls, compete in cultural quizzes, submit questions, and react with live emojis.

---

## Source Code Map

```
Marrakech-Culture-Experience/
├── artifacts/
│   ├── marrakech/                       # Frontend SPA (Vite + React 18 + Tailwind CSS + Radix UI + Wouter)
│   │   ├── src/
│   │   │   ├── assets/                  # High-resolution cultural photography of Marrakech
│   │   │   │   ├── atlas-garden.jpg
│   │   │   │   ├── craft-workshop.jpg
│   │   │   │   ├── jemaa-square.jpg
│   │   │   │   ├── marrakech-dusk.jpg
│   │   │   │   ├── medina-lanes.jpg
│   │   │   │   ├── moroccan-table.jpg
│   │   │   │   └── zellige-courtyard.jpg
│   │   │   ├── components/              # Interactive UI and presentation components
│   │   │   │   ├── audience-live-slide.tsx       # Live mobile slide renderer with active activity prompts
│   │   │   │   ├── error-boundary.tsx            # React crash resilience
│   │   │   │   ├── presentation-control-extras.tsx # Admin controls for Q&A moderation, submissions & cloud
│   │   │   │   ├── projector-screen.tsx          # Full-screen cinematic projector presentation engine
│   │   │   │   ├── quiz-question-picker.tsx      # Presenter quiz launcher and question selector
│   │   │   │   └── ui/                           # Radix UI primitives (dialogs, buttons, toasts, tabs, etc.)
│   │   │   ├── hooks/                   # Custom React hooks (use-mobile, use-toast)
│   │   │   ├── lib/
│   │   │   │   ├── realtime.ts          # Socket.IO client with exponential backoff & auto-reconnect
│   │   │   │   └── utils.ts             # Tailwind class merge utilities (clsx + twMerge)
│   │   │   ├── pages/
│   │   │   │   ├── projector-page.tsx   # Projector screen route entry (/present)
│   │   │   │   └── not-found.tsx        # 404 handler
│   │   │   ├── App.tsx                  # Master application orchestrator with all routes & pages:
│   │   │   │                            #   - HomePage, EditorialPage (cultural narratives)
│   │   │   │                            #   - AdminPresentationPage (/admin/presentation)
│   │   │   │                            #   - JoinPage (/join)
│   │   │   │                            #   - AdminOverviewPage, AdminParticipantsPage, AdminQuizPage
│   │   │   │                            #   - AdminResultsPage, AdminContentPage
│   │   │   ├── main.tsx                 # React DOM mount & dynamic API base URL initializer
│   │   │   ├── index.css                # Base typography, Tailwind styling & Moroccan palette
│   │   │   ├── live-ui.css              # Audience & real-time badge animations
│   │   │   ├── projector-screen.css     # 4K & 1080p cinematic presentation transitions
│   │   │   └── admin-results.css        # Presenter analytics, charts & moderation styling
│   │   ├── index.html                   # HTML entry point with responsive viewport settings
│   │   ├── vite.config.ts               # Vite configuration with SPA build pipeline
│   │   └── package.json                 # Frontend dependencies & scripts
│   │
│   └── api-server/                      # Persistent Node.js REST API & WebSocket Server (Express + Socket.IO)
│       ├── src/
│       │   ├── lib/
│       │   │   ├── logger.ts            # Pino structured JSON logger
│       │   │   ├── marrakech-auth.ts    # Admin session authentication, bcrypt, signed cookies
│       │   │   ├── marrakech-cors.ts    # Cross-origin authorization (Vercel previews, production, localhost)
│       │   │   ├── marrakech-realtime.ts# Socket.IO room handling, broadcast events, connection lifecycle
│       │   │   └── marrakech-seed.ts    # Seed script inserting default cultural slides & quiz bank
│       │   ├── routes/
│       │   │   ├── health.ts            # Health check endpoint (/api/healthz)
│       │   │   ├── marrakech-auth.ts    # Admin login/logout & session verification
│       │   │   ├── marrakech-culture.ts # Public cultural slides (with notes redacted) & admin slide editors
│       │   │   ├── marrakech-presentations.ts # Session creation, slide sync, state transitions, participant counts
│       │   │   ├── marrakech-polls.ts   # Poll creation, voting, fraud prevention, results closing
│       │   │   ├── marrakech-quiz.ts    # Quiz start/end, question reveal, score calculation, leaderboard
│       │   │   └── marrakech-audience.ts# Reactions, word cloud entries, Q&A question moderation
│       │   ├── tests/
│       │   │   ├── integration.test.ts  # Complete 11-step integration verification test suite
│       │   │   └── run.ts               # Automated Node.js test runner
│       │   ├── app.ts                   # Express application setup, middlewares, rate limiting
│       │   └── index.ts                 # HTTP server listener, real-time binder & auto-seeder
│       └── package.json                 # API server dependencies & scripts
│
├── lib/
│   ├── db/                              # Database layer (Drizzle ORM + PostgreSQL)
│   │   ├── migrations/
│   │   │   └── 0000_elite_phantom_reporter.sql # Migration generating all 10 relational tables & indexes
│   │   ├── src/
│   │   │   ├── schema/
│   │   │   │   ├── index.ts             # Schema exports
│   │   │   │   ├── marrakech-presentations.ts # Sessions, participants, and slides tables
│   │   │   │   ├── marrakech-interactions.ts  # Polls, votes, audience submissions, reactions
│   │   │   │   └── marrakech-quiz.ts    # Quiz questions, active quiz sessions, answers
│   │   │   ├── index.ts                 # Database client pool & test injection interface
│   │   │   └── migrate.ts               # Programmatic migration executor
│   │   └── drizzle.config.ts            # Drizzle Kit configuration
│   │
│   ├── api-zod/                         # Shared Zod validation schemas for requests and responses
│   └── api-client-react/                # Auto-generated React Query API client with custom fetch & cookies
│
├── .env.example                         # Safe configuration template without secrets
├── package.json                         # Monorepo root configuration & pnpm scripts
├── pnpm-workspace.yaml                  # pnpm monorepo workspace configuration
├── tsconfig.base.json                   # Base TypeScript compiler settings
├── tsconfig.json                        # Monorepo root TypeScript configuration
└── vercel.json                          # Vercel deployment specification (SPA rewrite rules & headers)
```

---

## Prerequisites

- **Node.js**: `v20.x` or `v22.x` or `v24.x`
- **Package Manager**: `pnpm` (v9 or v10)
- **Database**: PostgreSQL (v14+) or managed service (Neon, Supabase, Railway, RDS)

---

## Quick Start (Local Development)

### 1. Clone & Install Dependencies
```bash
# Clone the repository
git clone <repository-url>
cd Marrakech-Culture-Experience

# Install dependencies across all workspace packages
pnpm install
```

### 2. Configure Environment Variables
Copy `.env.example` to create your local environment:
```bash
cp .env.example .env
```

Set the essential values in your `.env`:
```ini
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/marrakech?sslmode=disable
SESSION_SECRET=local-development-session-secret-change-me-in-production-min32
ADMIN_PASSWORD=marrakech_secret_admin_2026
PORT=3001
VITE_API_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
```

### 3. Run Database Migrations
Run the Drizzle migration to create all tables and indexes in your PostgreSQL database:
```bash
pnpm --filter @workspace/db run migrate
```

### 4. Start the Application
Start the API server and the frontend client simultaneously:
```bash
# In Terminal 1 (Start API server on http://localhost:3001):
pnpm --filter @workspace/api-server run dev

# In Terminal 2 (Start Frontend on http://localhost:5173):
pnpm --filter @workspace/marrakech run dev
```

Open your browser:
- **Audience Interface**: [http://localhost:5173/join](http://localhost:5173/join)
- **Presenter Control Center**: [http://localhost:5173/admin/presentation](http://localhost:5173/admin/presentation)
- **Projector Screen**: [http://localhost:5173/present?session=MARRAKECH-XXXXX](http://localhost:5173/present)

---

## Automated Verification & Testing

The repository includes a comprehensive integration test suite verifying the complete 15-step presentation workflow (authentication, sessions, slide sync, poll lifecycle, quiz scoring, duplicate prevention, and clean teardown):

```bash
# Run integration test suite (uses embedded zero-dependency PGlite database)
pnpm test

# Run TypeScript compilation checks across all monorepo packages
pnpm run typecheck

# Run production build across all packages
pnpm run build
```

---

## Production Deployment Guide

### Architecture Overview

- **Frontend (Vercel)**: Static Single Page Application (SPA) served via Vercel Edge CDN with instantaneous worldwide caching and client-side route rewrites.
- **Backend & WebSockets (Persistent Node.js Host)**: Hosted on a service that supports persistent WebSocket connections (Railway, Render, Fly.io, or VPS).
- **Authoritative Database**: PostgreSQL (Neon, Supabase, Railway, or AWS RDS).

---

### Step A: Deploy Managed PostgreSQL
1. Create a database instance on **Neon**, **Supabase**, or **Railway**.
2. Retrieve your connection string (`postgresql://<user>:<password>@<host>/<database>?sslmode=require`).
3. Run migrations from your terminal:
   ```bash
   DATABASE_URL="<your-database-url>" pnpm --filter @workspace/db run migrate
   ```

---

### Step B: Deploy the Real-Time API Server
Deploy `artifacts/api-server` to **Railway**, **Render**, or **Fly.io**:

1. **Root Directory**: `.` (monorepo root)
2. **Build Command**: `pnpm --filter @workspace/api-server run build`
3. **Start Command**: `pnpm --filter @workspace/api-server run start`
4. **Environment Variables**:
   | Variable | Description | Example |
   |---|---|---|
   | `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |
   | `SESSION_SECRET` | 32+ character random string for signing cookies | `b9f847c2e4...` |
   | `ADMIN_PASSWORD` | Secure password for presenter login | `ComplexAdminPass2026!` |
   | `FRONTEND_URL` | URL of your deployed Vercel frontend | `https://marrakech-experience.vercel.app` |
   | `CROSS_ORIGIN_COOKIES`| Enable cross-origin authentication cookies | `true` |
   | `COOKIE_SAME_SITE` | Cookie SameSite policy | `none` |
   | `NODE_ENV` | Production environment flag | `production` |
   | `PORT` | Listening port (injected by host) | `3001` or `8080` |

---

### Step C: Deploy Frontend to Vercel

1. Link this repository in **Vercel**.
2. Configure Project Settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `.`
   - **Build Command**: `pnpm --filter @workspace/marrakech run build`
   - **Output Directory**: `artifacts/marrakech/dist/public`
3. Add Environment Variables in Vercel:
   | Variable | Value |
   |---|---|
   | `VITE_API_URL` | Your deployed API server URL (e.g. `https://api.marrakech-culture.up.railway.app`) |
   | `VITE_SOCKET_URL` | Your deployed API server URL (e.g. `https://api.marrakech-culture.up.railway.app`) |
4. Deploy! Vercel will build the frontend and serve it using [`vercel.json`](file:///c:/Users/Ignisflare/Downloads/Marrakech-Culture-Experience%20(3)/Marrakech-Culture-Experience/vercel.json).

---

## Security Model

1. **Speaker Notes Protection**: The public slides endpoint (`/api/slides`) strictly strips `presenterNotes`. Notes are only accessible via the protected `/api/admin/slides` endpoint with an active admin session.
2. **Quiz Answer Protection**: Active questions distributed to the projector and audience lack `correctIndex` and `explanation`. These fields remain hidden on the server until the presenter explicitly triggers the reveal endpoint.
3. **Cross-Origin Cookie Security**: Cookies use `HttpOnly`, `SameSite=None`, and `Secure=true` when configured for cross-origin hosting.
4. **Fraud & Manipulation Prevention**: Database unique constraints enforce one vote per attendee per poll, and answer submissions are rejected once a question is locked.
