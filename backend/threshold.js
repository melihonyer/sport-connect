// Threshold — sends one activity event to the owner's Threshold hub.
// Copy this file into an app (CommonJS). Contract:
//  - fire-and-forget: callers never await it, it never throws;
//  - 3 s timeout, so a slow hub can never hold a request;
//  - no-op until THRESHOLD_URL and THRESHOLD_KEY are set in the app's .env;
//  - payloads stay minimal: e-mail addresses are stripped, names shortened.
const EMAIL = /[^\s@()<>,;]+@[^\s@()<>,;]+\.[a-z]{2,}/gi;

// "Ayşe Kaya Demir" → "Ayşe D." (the owner needs who, not a full identity).
function shortName(full) {
  if (!full) return null;
  const parts = String(full).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toLocaleUpperCase("tr")}.` : parts[0];
}

function scrub(text) {
  if (text == null) return text;
  return String(text).replace(EMAIL, "").replace(/\(\s*\)/g, "").replace(/\s{2,}/g, " ").replace(/\s+·\s*$/, "").trim();
}

function threshold(event) {
  const url = (process.env.THRESHOLD_URL || "").replace(/\/+$/, "");
  const key = process.env.THRESHOLD_KEY;
  if (!url || !key || typeof fetch !== "function" || !event || !event.title) return;
  try {
    fetch(`${url}/api/v1/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ ...event, title: scrub(event.title), body: scrub(event.body), actor: scrub(event.actor) }),
      signal: AbortSignal.timeout(3000),
    }).catch(() => {});
  } catch {
    /* never let notification plumbing touch the caller */
  }
}

module.exports = { threshold, shortName, scrub };
