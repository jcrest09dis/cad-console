# CAD Dispatcher Console

React (Vite) SPA for dispatchers: live unit board, incident queue, create
incidents, assign units, add notes, resolve/cancel — the full first-pass
scope from the design.

## Setup

```bash
npm install
npm run dev
```

Runs on `http://localhost:5173` by default. Expects the backend
(`cad-backend`) running on `http://localhost:3000` — override with a
`.env` file containing `VITE_API_BASE_URL=http://your-backend:port` if
different.

You'll need at least one admin account (see the backend's
`SEED_ADMIN_USERNAME` bootstrap, since `/auth/enroll` now requires an
existing admin — no more shared secret) to create staff/venues/events
through this console's admin panel, plus at least one dispatcher account
enrolled and checked into an event before you can sign in and see a
dispatch board.

## How it maps to the design

- **Login** (`src/pages/Login.jsx`) — username + TOTP code, matches the
  backend auth flow exactly.
- **Event picker** (`src/pages/EventPicker.jsx`) — lists events from
  `/me/events` (added to the backend specifically to support this; there
  was no prior way for a logged-in user to discover their own events).
  Only dispatcher-role events are selectable here — this console doesn't
  attempt a field-staff view.
- **Dashboard** (`src/pages/Dashboard.jsx`) — the control-room split
  layout: units on the left, incidents on the right, sorted with
  UNCONFIRMED assignments forced to the top (that's the escalation
  ladder's "hand off to a human" signal — it has to be the first thing a
  dispatcher sees, not something they scroll to). Units can be dispatched
  by dragging an available unit's row onto an unassigned incident's row
  (native HTML5 drag-and-drop, no library) — the incident detail panel's
  dropdown-based assign flow still exists too, both do the same thing;
  drag-and-drop is a faster path from the board, the dropdown is the
  only keyboard-accessible one. Clicking a unit (rather than dragging it)
  opens `UnitDetailPanel` — lets a dispatcher set any of the four
  progression stages directly (not just "next," since dispatchers have
  override authority — matches their existing ability to cancel/complete
  assignments freely), or mark/return from `OUT_OF_SERVICE`.
- **Incident detail** (`src/components/IncidentDetailPanel.jsx`) — now
  shows the full note history (every revision, with author and
  timestamp) rather than just the current text, matching the reporting
  view — write access still respects the OPEN/DISPATCHED edit window
  from the PHI boundary — the UI just hides the compose box once
  terminal, the real enforcement is server-side), assignment (create/
  cancel/complete), resolve/cancel.

## Real-time: WebSocket, with polling as a resilience backstop

Upgraded from the original all-polling build. `src/routes/live.js` +
`src/services/liveUpdates.js` implement a console-only WebSocket at
`GET /events/:eventId/live` — deliberately console-only, matching the
original design rationale: a WebSocket only makes sense where connections
stay open and foregrounded (the dispatcher console), not on mobile, where
OS-level backgrounding is exactly why the field app uses push+ack+escalate
instead.

- In-memory, single-process pub/sub (`liveUpdates.js`) — fine at this
  scale (a handful of concurrent events). If this backend ever runs as
  multiple instances behind a load balancer, this registry would need to
  move to something shared (Redis pub/sub, etc.), since a broadcast from
  one process can't currently reach a socket held by another.
- Sends a lightweight `{ type: 'refresh' }` signal, not a diffed payload —
  the console already has correct, RBAC-filtered REST endpoints for every
  list it shows; re-deriving exact push payloads for every mutation path
  was judged not worth the complexity at this connection count.
- Auth can't use the normal `Authorization`-header flow — browsers'
  native `WebSocket` API doesn't support custom headers on the handshake.
  The JWT travels as a query parameter (`?token=...`) instead and is
  verified manually in the route handler; same trust level, different
  transport.
- Broadcasts fire from every state-changing route (assignment create/ack/
  cancel/complete, unit status, incident create/resolve/cancel) and from
  the escalation worker itself (so an assignment aging into
  `ESCALATED_SMS` or `UNCONFIRMED` shows up on the console within
  moments, not on the next poll).
- Polling still runs underneath this (`usePolling` calls in
  `Dashboard.jsx`), just lengthened from 4s to 20s — redundant with the
  socket when it's healthy, but keeps data from going stale indefinitely
  if a connection silently drops. The console also shows a small
  "Live"/"Reconnecting…" indicator in the topbar so a dispatcher isn't
  looking at possibly-stale data without knowing it.

## Admin tools (`src/pages/AdminPanel.jsx`)

No longer a separate secret-gated screen — admin access is now just a
property of a normal logged-in account (`staff.is_admin`, from the
backend's real admin auth). "Admin tools" appears as a link on the event
picker and in the dashboard's topbar, but only for staff whose `/me`
response has `is_admin: true`; everyone else never sees it. Under the
hood, `src/adminApi.js` uses the exact same JWT as everything else now
(`getAuthToken()` from `src/api.js`) — there's no separate secret stored
anywhere in the browser anymore.

Four tabs now — **Units** was split out from the Events tab into its
own, since it was originally nested inside "Manage" on a specific event
and turned out hard to find:
- **Staff** — create staff records, promote/demote admin status (won't
  let you remove the last remaining admin), and enroll each one's
  authenticator app (shows the secret + provisioning URI once, then a
  field to confirm with the current code — the admin needs the staffer's
  phone in hand for that last step, or the staffer reads the code over
  the phone).
- **Venues** — create venues, and manage each one's zone list inline
  (used for the incident-location `<datalist>` suggestions now, not a
  required dropdown — see below).
- **Events** — create events, and drill into each one to manage its
  staffing (check people in with a role, check them out).
- **Units** — units are pooled now, the same way staff are (created once,
  assigned to events later, not recreated per event). Adding a unit
  needs only a label — no event required. Each row has an inline
  dropdown to assign it to an event (or set it back to "Unassigned"),
  which is what actually makes it appear on that event's live dispatch
  board.

## Self-check-in (`src/pages/EventPicker.jsx`)

Field staff (or dispatchers before they're granted that role) can check
themselves into any active event directly from the event picker — no
admin needed for this anymore. Self-check-in always grants `field_staff`;
promoting someone to `dispatcher` still requires the admin panel.

## Gaps carried over from backend work

None currently — the two gaps flagged here (admin UI, self-check-in) are
now addressed above.

## Incident history / reporting (`src/pages/ReportsPage.jsx`)

Reachable via an "Incident history" link — same pattern as admin tools:
appears for staff whose `/me` response has `canViewReports: true`
(admins, plus anyone who's ever dispatched at least one event), no
separate secret or login.

Filterable list (event, type, priority, status) spanning every event,
not just the currently active one. Clicking an incident opens the full
history: complete assignment history (every unit ever dispatched to it),
and the complete note revision history — every note ever added, with
author and timestamp, not just the current text. This is real PHI
access outside the live-dispatch RBAC window (field staff's OPEN/
DISPATCHED-only note editing doesn't apply here — reporting shows
everything, to anyone with `canViewReports`), which is why access is
gated the way it is on the backend side rather than left open.

## Incident location: free text, and assigned-unit display

`NewIncidentPanel.jsx`'s location field is now free text (with a
`<datalist>` suggesting previously-used zone names as you type) instead
of a required dropdown into a predefined zone list — matches real usage
feedback; `venue_zones`/admin zone management still exist, just aren't
required for creating an incident anymore. Backend accepts
`locationText` now instead of `locationZoneId` — see the backend README
for the full data-model change.

The Units column also now shows an actively-assigned unit's incident
location and call type directly on its row (`UnitRow.jsx`), not just a
status badge — sourced from data the board already polls, no extra
request.

## Not built

Map view (deliberately cut early on — see the original design
discussion; text/dropdown zone selection was judged sufficient).
