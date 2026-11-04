# FinTrack – Personal Finance Tracker

A full-stack personal finance app built with the **MERN** stack in plain JavaScript. Track accounts, income, expenses and transfers, set budgets and savings goals, automate recurring bills, and follow your mutual funds, SIPs and stocks, all in one dashboard.

[![CI](https://github.com/Ashish-Pawar-AP/fintrack/actions/workflows/ci.yml/badge.svg)](https://github.com/<your-username>/fintrack/actions)
![Node](https://img.shields.io/badge/node-%3E%3D20.19-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/react-vite-61DAFB?logo=react&logoColor=black)
![MongoDB](https://img.shields.io/badge/mongodb-atlas-47A248?logo=mongodb&logoColor=white)

**Live demo:** `https://app.onrender.com` (add your link)

<!-- Add screenshots to docs/ and uncomment
![Dashboard](docs/dashboard.png)
-->

---

## Features

**Money management**
- Multiple accounts (savings, cash, wallet, credit card…) with calculated balances
- Six transaction types: income, expense, transfer, investment, refund, adjustment
- Search, filter by type and date, pagination, edit, soft delete and CSV export
- Monthly budgets per category with 80% warning and over-budget alerts
- Recurring rules (weekly, monthly, yearly) that create transactions automatically
- Savings goals with contributions, required monthly saving and status (on track, at risk, behind)

**Investments**
- Mutual funds: buy, sell, dividend, NAV updates, units, P&L and XIRR
- SIPs with pause, resume and instalment recording
- US and Indian stocks with average-cost P&L, realised gains and dividends
- US stocks split into stock P&L and currency P&L in INR

**Dashboard**
- Net worth, cash, investments, income, expenses and savings rate with month-over-month change
- 6-month net-worth trend, income vs expense chart, expense breakdown
- Upcoming bills, goals, budgets and recent transactions

**Security**
- bcrypt password hashing, 15-minute JWT access token, 30-day rotating refresh token in an httpOnly cookie
- Password reset by email with single-use, 30-minute tokens
- Helmet CSP, rate limiting, NoSQL-injection sanitiser, CSRF origin check, Zod validation
- Every query scoped to the signed-in user

**UI**
- Responsive dark interface (sidebar on desktop, tab bar on mobile)
- Accessible custom select and date pickers, keyboard support, reduced-motion support
- Quick-add floating button on every page

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite, React Router, Tailwind CSS v4, Framer Motion, Recharts, Axios, lucide-react |
| Backend | Node.js 20.19+, Express 5, Mongoose, Zod, node-cron, nodemailer |
| Database | MongoDB (Atlas) |
| Auth and security | jsonwebtoken, bcryptjs, helmet, cors, express-rate-limit |
| Testing | node:test, supertest, mongodb-memory-server |
| CI | GitHub Actions |

---

## How it works

- **Balances are calculated, not stored.** An account balance is its opening balance plus all transaction effects, so history can never drift and past dates can be rebuilt.
- **Pure financial engine.** `engine.js` and `ledger.js` have no database or HTTP code, so units, P&L, XIRR, balances and goal status are unit-tested directly.
- **Idempotent automation.** Unique partial indexes ensure a recurring rule or SIP creates at most one transaction per due date, so the cron job, dashboard load and manual button can all run safely.
- **Single deployment.** In production, Express serves the built React app, so one Node process is the whole app.

---

## Project structure

```text
fintrack/
├── package.json              root scripts
├── .github/workflows/ci.yml  tests + client build
├── server/
│   ├── .env.example
│   ├── src/
│   │   ├── server.js         connect DB, cron, graceful shutdown
│   │   ├── app.js            middleware, routes, static React
│   │   ├── config.js         env validation
│   │   ├── models/           Mongoose schemas
│   │   ├── middleware/       auth, error handler
│   │   ├── routes/           auth, money, goals, investments, dashboard
│   │   ├── services/         finance (portfolio, dashboard, SIP), recurring
│   │   └── utils/            engine, ledger, crud, http, mailer
│   └── tests/                unit + API integration tests
└── client/
    └── src/
        ├── pages/            Dashboard, Transactions, Accounts, Budgets, ...
        ├── components/       Layout, QuickAdd, ui, pickers
        ├── context/          AuthContext
        └── lib/              api (axios + refresh), bus, format
```

---

## Getting started

**Prerequisites:** Node.js 20.19 or newer (22 recommended) and a MongoDB database (a free [Atlas](https://www.mongodb.com/atlas) cluster works).

```bash
# 1. Install dependencies for server and client
npm run install:all

# 2. Configure the server
cp server/.env.example server/.env
#    set MONGO_URI and JWT_SECRET, keep NODE_ENV=development

# 3. Start both (API on :5000, web app on :5173)
npm run dev
```

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Open <http://localhost:5173>, register an account and add your first bank account.

---

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `MONGO_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Random string; 32+ characters in production |
| `NODE_ENV` | Yes | `development` locally, `production` when deployed |
| `PORT` | No | Defaults to 5000 |
| `CLIENT_URL` / `ALLOWED_ORIGINS` | No | Only if the web app is on a different origin than the API |
| `APP_URL` | No | Public site URL used in password-reset links |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | No | SMTP settings for reset emails. Without SMTP, the link is printed to the console in development and nothing is sent in production |

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run install:all` | Install server and client dependencies |
| `npm run dev` | Run API and web app in development |
| `npm run build` | Build the client into `client/dist` |
| `npm start` | Start the production server (serves API and built client) |
| `npm test` | Run unit and API integration tests |
| `node --test server/tests/unit.test.js` | Unit tests only (no database needed) |

---

## Testing

- **Unit tests** cover units, P&L, savings rate, XIRR, month-end date logic, goal status, average-cost positions, balances, transfers and stock currency P&L.
- **API tests** run the real Express app on an in-memory MongoDB and check that users cannot access each other's data, validation errors, transfers, parallel token refresh and the password-reset flow.
- GitHub Actions runs the tests and the client build on every push and pull request.

The API tests download a `mongod` binary on first run, so they need network access once.

---

## Deployment

Express serves the built React app, so one Node process is the whole deployment. HTTPS is required in production because the refresh cookie is `Secure`.

### Render (Node runtime)

1. Push the repo to GitHub and create a **Web Service** on [Render](https://render.com).
2. **Build command:** `npm run render-build`
3. **Start command:** `npm start`
4. **Health check path:** `/healthz`
5. Set environment variables: `NODE_ENV=production`, `MONGO_URI`, `JWT_SECRET` (32+ chars), `NODE_VERSION=22`, and optionally `APP_URL` and the SMTP variables.
6. In MongoDB Atlas, allow Render's IPs under Network Access (or `0.0.0.0/0` with a strong database password).

### Your own server (VPS)

```bash
git clone https://github.com/<your-username>/fintrack.git && cd fintrack
npm run install:all && npm run build
export NODE_ENV=production MONGO_URI="..." JWT_SECRET="..." APP_URL="https://your-domain"
npm i -g pm2
pm2 start npm --name fintrack -- start
```

Put Caddy or Nginx in front for HTTPS, for example with Caddy:

```text
your-domain.com {
    reverse_proxy localhost:5000
}
```

### After deploying

- `GET /healthz` should return `{"ok":true}`
- Register, add an account and a transaction, then refresh the page; you should stay signed in

---

## API overview

All routes are under `/api/v1`. Everything except `/auth/*` needs `Authorization: Bearer <token>`.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/register`, `/login`, `/refresh`, `/logout`, `/logout-all`, `/forgot-password`, `/reset-password`; `GET/PATCH /auth/me` |
| Accounts | `GET/POST /accounts`, `PATCH/DELETE /accounts/:id` |
| Transactions | `GET/POST /transactions`, `PATCH/DELETE /transactions/:id`, `GET /transactions/export` |
| Categories | `GET/POST /categories` |
| Budgets | `GET/PUT /budgets`, `DELETE /budgets/:id` |
| Recurring | `GET/POST /recurring`, `PATCH/DELETE /recurring/:id`, `POST /recurring/run` |
| Goals | `GET/POST /goals`, `PATCH/DELETE /goals/:id`, `POST /goals/:id/contributions` |
| Investments | `/investments/summary`, `/funds`, `/sips`, `/stocks` (holdings, transactions, prices) |
| Dashboard | `GET /dashboard?month=YYYY-MM` |

Errors always use the same shape: `{ "success": false, "error": { "code", "message", "fields" } }`.

---

## Roadmap

- [ ] Email verification and two-factor authentication
- [ ] CSV import
- [ ] Budget and bill notifications
- [ ] Audit log
- [ ] Live NAV and stock price providers
- [ ] Automated backups
- [ ] Dashboard aggregation for very large histories

---

## Author

**Ashish Pawar** · [GitHub](https://github.com/Ashish-Pawar-AP) · [LinkedIn](https://linkedin.com/in/ashish-pawar-ap)
