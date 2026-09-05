# Development prompt — Simulated mobile money app (web + mobile client + admin portal)

## Context

You are building the **client-facing web app, mobile app, and the admin portal** for a final-year group project: *AI-Based Detection of Suspicious Mobile Money Transactions Caused by Account Compromise and Abnormal Transaction Behaviour*.

This is a **simulated mobile money platform** (not a real MoMo integration) built to demonstrate two fraud-detection capabilities: **Account Takeover Detection (ATOD)** and **Transaction Anomaly Detection**. A third area, **High-Risk Receiver Detection**, is explicitly **out of scope** for this project.

Your role on this build is **all three client-facing surfaces**: the end-user web app, the end-user mobile app, and the admin portal used by fraud analysts/reviewers. A teammate owns the backend API, database, and ML fraud service. Build against the API contract below; do not implement fraud-scoring logic client-side — the clients only send transaction/auth data (or, for the admin portal, request case data) and render whatever the backend returns.

---

## 1. Project scope (from the approved project scope document)

### In scope — what the system must demonstrate
1. **Account Takeover Detection (ATOD)** — a fraudster gains unauthorised access to a legitimate user's account. Detected via:
   - New device
   - New location
   - Unusual transaction amount
   - Abnormal transaction frequency
2. **Transaction Anomaly Detection** — the account is legitimate, but the transaction itself is abnormal relative to the user's own history (e.g. usual range GHS 50–300, current transaction GHS 8,000 → high fraud probability score).

### Explicitly out of scope — do not build detection logic for these
- High-Risk Receiver Detection (suspicious destination accounts) — not implemented in this phase.
- SIM swap fraud — requires real telecom operator data; this project uses a **simulated e-SIM profile** instead of a physical SIM, purely as a way to represent "device identity" in software. Do not imply real SIM-swap detection anywhere in UI copy or docs.
- Social engineering scams (fake calls, fake agents).
- Money laundering network detection.
- Mobile money agent fraud.
- Real-world MNO / telecom-level fraud prevention.

### Implementation-layer additions (not fraud-research scope, but required app functionality)
- Layered authentication (PIN + biometric/facial) — this is app security UX, not one of the four ATOD detection signals. Do not present auth-layer outcomes as core ML input features in documentation; they are what *triggers* step-up verification when the backend's fraud signals fire.
- Admin portal (built by teammate, not part of this client-app task, but the client app must support handing off to it conceptually — e.g. a case ID shown to the user references what the admin sees).
- Wallet functions (send, cash out, cash in, pay bill, buy goods, balance check) — needed to generate realistic transaction data, not a scope expansion.

---

## 2. Tech stack

| Layer | Technology |
|---|---|
| Web app | React.js + Tailwind CSS |
| Mobile app | React Native (Expo) |
| Admin portal | React.js + Tailwind CSS (separate app, own auth/login) |
| Shared logic | Shared types + API client in a `/packages/shared` workspace package |
| Charts (admin analytics) | Recharts or Chart.js |
| Real-time sync | Socket.io client (connects to backend WebSocket) |
| Animations (optional) | GSAP for web transaction/status transitions |
| Biometric auth (mobile) | `expo-local-authentication` (genuinely functional, reads device sensor) |
| Deployment (web + admin) | Vercel |
| Deployment (mobile, demo) | Expo Go link |

Recommended monorepo layout:
```
/apps
  /web        → React + Tailwind (end-user)
  /mobile     → React Native + Expo (end-user)
  /admin      → React + Tailwind (fraud analyst / reviewer)
/packages
  /shared     → shared types, API client, constants, design tokens
```

---

## 3. Design system

- **Typeface**: Satoshi. Not available on the standard CDN allowlist most sandboxes use — self-host the Satoshi woff2 files or embed via Fontshare's `@font-face` link. Fallback stack: `'Satoshi', -apple-system, 'Segoe UI', sans-serif`.
- **Palette**: white as the dominant surface, deep red (`#8A0F13` or similar — pick one exact hex and use it consistently) reserved for primary actions, alerts, and flagged/danger states. Black/near-black for primary text and high-emphasis figures (balance, nav). Avoid overusing red — it should read as premium/alert, not decorative.
- **Status color logic** (avoid default traffic-light red/amber/green):
  - Deep red = blocked / high-risk
  - Muted red/pink tint = under review / pending
  - Black/gray = normal / completed
- **Tone**: sentence case throughout, no exclamation marks, active voice on buttons ("Send money", not "Send Money Now!").

---

## 4. Core features to build (client apps)

### Onboarding & identity
- Simulated KYC signup: name, phone number, PIN setup, simulated Ghana Card ID field
- Device registration on first login — generates a simulated e-SIM profile (carrier tag, device fingerprint) client-side and sends it to the backend on signup/login
- Location capture on login/transaction: GPS (mobile) or IP-based geolocation (web), sent to backend as part of the transaction/auth payload

### Authentication (layered)
- **Layer 1 — PIN**: required for login and as the base layer before any transaction
- **Layer 2 — Biometric or facial**, required *after* PIN, before a transaction is executed:
  - Mobile: fingerprint via `expo-local-authentication`, or simulated facial verification flow (camera opens → "Verifying" state → pass/fail) if fingerprint unavailable
  - Web: simulated facial verification flow (no fingerprint sensor available)
- Step-up escalation: if the backend returns a "flagged" status for a transaction, force facial re-verification even if biometric already passed, and show a "Verifying — this may take a moment" hold state
- Failed second-factor twice → transaction blocked client-side, status shown as "Blocked — under review", case reference number displayed

### Wallet functions
- Send money (phone number / MoMo tag)
- Cash out (simulated agent code/token flow)
- Cash in (simulated agent deposit)
- Pay bill (simulated utility/merchant payment)
- Buy goods / pay merchant (simulated till/merchant number)
- Balance check (on-demand)
- Transaction history with status: completed / flagged / blocked / under review
- Mini statement (last 5–10 transactions)

### Fraud-detection touchpoints (UI only — logic lives in backend/ML service)
- Real-time transaction status rendering: instant / held-for-review / blocked, with plain-language reason text returned by the backend (e.g. "Unusual amount for your account", "New device detected")
- Notification/alert center: security-style alerts ("We noticed a login from a new device")
- Session awareness: "Also active on: Web / Mobile" indicator

### Sync (web ↔ mobile)
- Both clients connect to the same backend via Socket.io
- Balance, transaction list, and status changes must update live on both platforms without manual refresh — build this as a real requirement, test it explicitly (e.g. send on mobile, confirm balance updates on web within ~1 second)

---

## 5. Admin portal (separate app, your scope)

The admin portal is a **distinct login and interface** from the end-user apps — a fraud analyst logs in here, not a wallet user. Do not merge it into the end-user web app; build it as its own app in `/apps/admin`, same design system, same backend.

### Monitoring
- Live feed of flagged transactions, updated in real time via the same Socket.io connection (subscribe to an admin-scoped event channel, not the per-user channel)
- Tag each case clearly as **ATOD** or **Transaction anomaly** — mirror the distinction from the scope document, don't blend them into one generic "fraud" label
- Filterable/sortable queue: by risk level, detection type, status, date

### Case detail view
- Full transaction context: user history, device profile (simulated e-SIM), location, amount vs. the user's historical range, and whatever contributing signals/score the ML service returns
- Side-by-side comparison: "usual behaviour" vs. "this transaction" (e.g. GHS 50–300 range vs. GHS 8,000 attempt) — this is the clearest visual for your defense, build it early

### Actions
- Approve transaction
- Block transaction
- Escalate case
- Freeze account (simulated — flips a status flag, no real account lock needed)
- Add analyst notes to a case

### Analytics
- Flags over time (simple line/bar chart)
- ATOD vs. anomaly split
- Top flagged accounts
- Use deep red for danger/flagged states, black/gray for neutral data — stay inside the app's two-color-plus-neutral system rather than defaulting to red/green/yellow

### Admin-specific API needs (confirm with backend teammate)
```
POST /admin/auth/login          → separate analyst login, role-checked
GET  /admin/cases               → flagged transaction queue
GET  /admin/cases/:id           → full case detail
POST /admin/cases/:id/approve
POST /admin/cases/:id/block
POST /admin/cases/:id/escalate
POST /admin/accounts/:id/freeze
GET  /admin/analytics           → aggregate stats for dashboard
WS   /admin/sync                → live case feed
```

---

## 6. Expected API contract (end-user apps) (build against this; confirm exact shape with backend teammate)

```
POST /auth/signup
POST /auth/login              → returns JWT + session info
POST /auth/device-register     → simulated e-SIM profile payload
POST /auth/verify-biometric
POST /auth/verify-facial

GET  /wallet/balance
GET  /wallet/transactions
POST /wallet/send
POST /wallet/cash-out
POST /wallet/cash-in
POST /wallet/pay-bill
POST /wallet/buy-goods

WS   /sync                     → real-time balance/transaction/status events
```

Every transaction-type POST should accept: `{ amount, receiver, deviceProfile, location, authLayersPassed }` and return `{ status: "completed" | "flagged" | "blocked", reason?, caseId? }`.

If the backend isn't ready yet, stub these with a local mock server (e.g. `json-server` or an Express mock) so frontend work isn't blocked — but keep the contract identical so swapping in the real API later is a config change, not a rewrite.

---

## 7. Explicitly not this task's job

- Do not implement the ML fraud-scoring model or its features — that's a separate FastAPI service owned by another teammate.
- Do not implement High-Risk Receiver Detection, SIM-swap detection, social-engineering detection, money-laundering-network detection, or agent-fraud detection — all explicitly out of scope per the project scope document.
- Do not claim or imply real biometric/facial matching accuracy — these are simulated flows for demo purposes only.
- Do not build the backend API, database, or ML service — a teammate owns those; you build against the contract above.

---

## 8. Suggested build order

1. Design tokens + shared component library (colors, typography, buttons, cards) in `/packages/shared`
2. Onboarding + PIN auth (web + mobile in parallel)
3. Wallet dashboard (balance, quick actions, transaction list) with mock API
4. Individual transaction flows (send, cash out, cash in, pay bill, buy goods)
5. Biometric/facial step-up layer
6. Real-time sync via Socket.io (end-user apps)
7. Fraud-status UI states (flagged/blocked/under review) wired to real or mock backend responses
8. Admin portal: monitoring feed + case detail view (build once end-user transaction flow produces real flagged data to review)
9. Admin portal: actions (approve/block/escalate/freeze) + analytics dashboard
10. Polish pass: animations, empty states, error states, notification center — across all three apps
