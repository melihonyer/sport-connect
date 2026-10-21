// Threshold — the owner's activity hub. Copy this file into an app (CommonJS).
// Two things go out, both fire-and-forget (never awaited, never throw, 3 s
// timeout) and both silent until THRESHOLD_URL and THRESHOLD_KEY are set:
//  - threshold(event): one activity event (signup, order, message…);
//  - touchUser(user, req): "this user is signed in and here"; a batch goes
//    out every 30 s so the owner sees who is on the site, by name.
// Full names are allowed (owner's decision, 21.10.2026); e-mail addresses
// are always stripped; phone numbers and message text never belong here.
const EMAIL = /[^\s@()<>,;]+@[^\s@()<>,;]+\.[a-z]{2,}/gi;

function scrub(text) {
  if (text == null) return text;
  return String(text).replace(EMAIL, "").replace(/\(\s*\)/g, "").replace(/\s{2,}/g, " ").replace(/\s+·\s*$/, "").trim();
}

// The person's name as they wrote it, e-mail addresses removed.
function personName(full) {
  if (!full) return null;
  return scrub(full).slice(0, 80) || null;
}

// Older call sites: "Ayşe Kaya Demir" → "Ayşe D.". Use personName for new code.
function shortName(full) {
  if (!full) return null;
  const parts = String(full).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toLocaleUpperCase("tr")}.` : parts[0];
}

function hub() {
  const url = (process.env.THRESHOLD_URL || "").replace(/\/+$/, "");
  const key = process.env.THRESHOLD_KEY;
  return url && key && typeof fetch === "function" ? { url, key } : null;
}

function post(path, body) {
  const h = hub();
  if (!h) return;
  try {
    fetch(`${h.url}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${h.key}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000),
    }).catch(() => {});
  } catch {
    /* never let notification plumbing touch the caller */
  }
}

function threshold(event) {
  if (!event || !event.title) return;
  post("/api/v1/events", { ...event, title: scrub(event.title), body: scrub(event.body), actor: scrub(event.actor) });
}

// ---------- presence: who is signed in right now ----------

const seen = new Map();
let timer = null;
let lastSent = 0;

function deviceOf(ua = "") {
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && /Mobile/.test(ua))) return "tablet";
  if (/iPhone|Android.*Mobile|Mobile Safari/.test(ua)) return "phone";
  return ua ? "desktop" : null;
}

// The page the user is on: an API call's Referer (same origin) names it;
// a page request is its own path.
function pagePath(req) {
  try {
    const ref = req.headers.referer || req.headers.referrer;
    if (ref) return new URL(ref).pathname;
  } catch {
    /* bad Referer */
  }
  return String(req.originalUrl || req.url || "").split("?")[0] || null;
}

// Users seen since the last batch; an empty batch every 2 minutes tells
// Threshold this app reports even when nobody is signed in.
function flushPresence() {
  if (!hub()) return;
  if (!seen.size && Date.now() - lastSent < 120_000) return;
  const users = [...seen.values()].slice(0, 300);
  seen.clear();
  lastSent = Date.now();
  post("/api/v1/presence", { users });
}

function startPresence() {
  if (timer || !hub()) return;
  timer = setInterval(flushPresence, 30_000);
  if (timer.unref) timer.unref();
}

// Call on every authenticated request (Express: after the auth check).
// user: { id, name, staff? }  · staff = admin/team member, shown apart.
function touchUser(user, req) {
  if (!user || user.id == null || !hub()) return;
  try {
    const id = String(user.id);
    seen.set(id, {
      id,
      name: personName(user.name) || "Üye",
      path: user.path || (req ? pagePath(req) : null),
      device: user.device || (req ? deviceOf(req.headers["user-agent"]) : null),
      staff: user.staff === true,
    });
    startPresence();
  } catch {
    /* presence is optional */
  }
}

startPresence();

module.exports = { threshold, touchUser, flushPresence, personName, shortName, scrub };
