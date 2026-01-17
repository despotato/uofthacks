# Live Friends Map (MVP)
A map-first “live friends” web app with Google OAuth (or dev login), Mongo-backed sessions, paging via email, and a simple learning suggestion engine. Frontend is plain HTML/CSS/JS with Leaflet; backend is Express + Mongoose. Package-lock is present—use `npm install` (not yarn/pnpm) to stay consistent.

## Quickstart
1) Install: `npm install`
2) Env: `cp .env.example .env` and fill values (Mongo URI + session secret required).
3) Run: `npm run dev` then open http://localhost:3000

## Stack at a glance
- Backend: Express, Passport (Google OAuth), sessions via connect-mongo, zod validation, nodemailer.
- Frontend: `public/` with vanilla JS modules; Leaflet + OSM tiles (no key required).
- Data: MongoDB + Mongoose models for users, presence, pages, suggestion weights/feedback.
- Instrumentation: Amplitude browser/node wrappers; no-op if no key set.

## Environment variables (see `.env.example`)
- Required: `MONGO_URI`, `SESSION_SECRET`
- Optional: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`
- Optional SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`) — if missing, Ethereal auto-fallback is used and preview URLs are shown in alerts.
- Optional: `AMPLITUDE_API_KEY`, `ALLOW_DEV_LOGIN`, `BASE_URL`

## Auth flows
- Google: `/auth/google` → `/auth/google/callback` when keys are provided.
- Dev login: `/auth/dev-login` with `{ email, name? }` when `ALLOW_DEV_LOGIN` is true (default).
- Logout: `/auth/logout`
- Current user: `/api/me`

## Key features
- Presence: `/api/availability`, `/api/location`, `/api/presence` (only available users are returned).
- Paging: `/api/page` with 5-minute sender→recipient cooldown; nodemailer with Ethereal fallback.
- Suggestions: `/api/suggestions` and `/api/suggestions/feedback`; weights stored in MongoDB and adjust after a couple clicks.
- Map: Leaflet markers for available users; client polls presence every ~5s.

## Running locally (detailed)
```bash
npm install          # uses package-lock
cp .env.example .env
# set MONGO_URI + SESSION_SECRET; add Google/SMTP keys if you have them
npm run dev          # nodemon server.js
```

## Email paging test checklist
1) Ensure Mongo is running and `MONGO_URI` is valid.
2) Start server: `npm run dev`.
3) Open http://localhost:3000 in two browsers/incognito profiles.
4) Log in both (Dev Login is fine if Google keys aren’t set).
5) Toggle “Available” and send or simulate location on each.
6) Click “Page” to send a page. Results:
   - If SMTP vars are unset: alert shows an Ethereal preview URL; open it to view the email.
   - If SMTP vars are set correctly: the recipient email inbox should receive it; sender also gets a receipt.
7) Cooldown: paging the same user again within 5 minutes returns HTTP 429 with a cooldown message.

## Demo tips
- Multi-user: open 2–3 incognito windows; dev-login with different emails if Google isn’t configured.
- Location: click “Simulate location” to set lat/lon manually when indoors.
- Paging: click “Page”; if SMTP isn’t set, use the Ethereal preview link shown in the alert.
- Suggestions: Accept/Dismiss a couple times to see ordering change (weights +/-2, clamped).
- Location perms: the app prompts for geolocation on first load; when “Location: Shared” is on (Available), it continuously tracks and sends updates. Use “Simulate location” to bypass GPS.

## AI agent hook
- `services/aiAgent.js` exposes `buildPagingContext(userId)` and `decidePagingFromContext(context)`. The latter is a simple rule-based stub; swap it with your AI call and map the AI output back to `{ shouldPage, targetUserId, reason }`.
- Keep it side-effect free: let the AI decide, then call existing `/api/page` to execute paging so cooldowns, logging, and email delivery still apply.

## Repo layout
- Backend: `server.js`, `routes/`, `models/`, `services/`, `config/`
- Frontend: `public/` (`index.html`, `styles.css`, `app.js`, `auth.js`, `map.js`, `suggestions.js`, `amplitude.js`)

## Team workflow notes
- Keep changes small and focused; minimal comments.
- Stick to CommonJS on the server and plain JS in `public/`; no build step.
- Use `npm install` to respect `package-lock.json`.
