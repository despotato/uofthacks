# Live Friends Map (MVP)
A map-first “live friends” web app with Google OAuth, Mongo-backed sessions, paging via email, and a lightweight suggestion engine that learns from feedback.

## Quickstart
1) Install deps: `npm install`
2) Copy env: `cp .env.example .env` then fill Mongo + Google creds (or leave Google blank and use Dev Login).  
3) Run dev server: `npm run dev` (listens on `http://localhost:3000`)

## Environment variables
See `.env.example` for all variables. Required: `MONGO_URI`, `SESSION_SECRET`. Optional: Google OAuth keys, SMTP creds (for real email), `AMPLITUDE_API_KEY`.

## Features
- Express + Passport (Google OAuth) with Mongo-backed sessions (connect-mongo)
- Dev login fallback (`/auth/dev-login`) for quick demos
- Presence + location API (zod-validated); privacy-respecting: only available users show on the map
- Paging via email (nodemailer) with 5-minute per-sender/recipient cooldown
- Ethereal auto-fallback if SMTP creds missing; preview URLs surface in the UI alert
- Deterministic suggestion engine with simple learning persisted in MongoDB
- Amplitude instrumentation (client + server) with graceful no-op when no key
- Leaflet map (OpenStreetMap tiles) + minimal overlay UI in vanilla JS/CSS

## Running locally
```bash
npm install
cp .env.example .env
# edit .env with your values
npm run dev
```

## Paging email (Ethereal)
- If `SMTP_*` vars are empty, the server auto-creates an Ethereal account.  
- Send a page; the UI alert shows a “preview” URL. Open it to view the email.

## Demo tips (multi-window)
1) Open 2–3 browser/incognito windows to log in as different emails (use Dev Login or Google).  
2) Toggle “Available”, send location (or enable “Simulate location” and push coords).  
3) Watch the map update every ~5s; click “Page” to email others.  
4) Try Accept/Dismiss on suggestions; after a couple clicks the list reorders/changes.

## Scripts
- `npm run dev` — start with nodemon
- `npm start` — run server normally

## Working together (team notes)
- Repo layout: backend in `server.js`, `routes/`, `models/`, `services/`, `config/`; frontend in `public/`.
- Auth: Google OAuth if keys set; otherwise use `/auth/dev-login` with an email to fake sign-in.
- DB: MongoDB required; collections auto-create via Mongoose models listed in `models/`.
- Suggestions: server-side in `services/suggestions.js`; feedback endpoint updates weights.
- Amplitude: If no key, events become no-ops; safe to develop without it.
- Styling/JS: vanilla HTML/CSS/JS—no build step. Just edit files in `public/` and refresh.

## Common dev flows
- Start local: `npm run dev` then open http://localhost:3000
- Multi-user demo: open multiple incognito windows; dev-login with different emails.
- Location: use browser geolocation or toggle “Simulate location” and push coords.
- Paging: click “Page”; if SMTP not configured, check the Ethereal preview URL in the alert.

## Pull requests / coding style
- Use small, focused changes; keep comments minimal and helpful.
- Prefer `rg`/`npm test` equivalents if adding tests (none required for MVP).
- Stick to ES modules style already used (CommonJS backend, plain JS frontend).
