import { recommend, summaryText } from "./public/engine.js";
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const MAX_BODY = 4096;          // bytes: a real enquiry is well under 1 KB
const PER_PHONE_PER_HOUR = 3;   // the same number can't flood us
const EMAILS_PER_HOUR = 30;     // hard cap on emails sent (protects your Resend allowance); enquiries are still saved

const SCHEMA = "CREATE TABLE IF NOT EXISTS enquiries (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, name TEXT, phone TEXT, postcode TEXT, contact_method TEXT, answers TEXT, recommendation TEXT, total_price REAL, status TEXT DEFAULT 'new')";
let tableReady = false;
async function ensureTable(env) { if (tableReady || !env.DB) return; await env.DB.prepare(SCHEMA).run(); tableReady = true; }   // no manual database setup needed
function same(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }

async function admin(request, env) {
  const url = new URL(request.url), origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return json({ ok: false, error: "forbidden" }, 403);
  const key = env.ADMIN_KEY || "", given = request.headers.get("x-admin-key") || "";
  if (key.length < 16 || !same(given, key)) { await new Promise(r => setTimeout(r, 800)); return json({ ok: false, error: "unauthorised" }, 401); }
  if (!env.DB) return json({ ok: false, error: "no_database" }, 500);
  await ensureTable(env);
  const { results } = await env.DB.prepare("SELECT id, created_at, name, phone, postcode, contact_method, answers, recommendation, total_price FROM enquiries ORDER BY id DESC LIMIT 200").all();
  const rows = (results || []).map(r => { let a = {}, p = {}; try { a = JSON.parse(r.answers); } catch {} try { p = JSON.parse(r.recommendation); } catch {}
    return { id: r.id, created: r.created_at, name: r.name, phone: r.phone, postcode: r.postcode, contact: r.contact_method, year: a.year, subjects: a.subjects, goal: a.goal, freq: a.freq, plan: p.name, weeks: p.weeks, hpw: p.hpw, hours: p.hours, total: r.total_price }; });
  return json({ ok: true, config: { database: true, emailKeySet: !!env.RESEND_API_KEY }, rows });
}

async function enquiry(request, env) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return json({ ok: false, error: "forbidden" }, 403);          // only our own pages may post
  if (!(request.headers.get("content-type") || "").includes("application/json")) return json({ ok: false, error: "invalid" }, 415);
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ ok: false, error: "too_large" }, 413);
  let b; try { b = JSON.parse(raw); } catch { return json({ ok: false, error: "invalid" }, 400); }
  if (!b || typeof b !== "object") return json({ ok: false, error: "invalid" }, 400);
  if (b.website) return json({ ok: true });                                                          // honeypot
  const name = String(b.name || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 80);
  const phone = String(b.phone || "").replace(/[^\d+]/g, "");
  const postcode = String(b.postcode || "").replace(/[^\w\s]/g, "").trim().slice(0, 10);
  const method = b.method === "WhatsApp" ? "WhatsApp" : "Phone call";
  const a0 = b.answers || {};
  const a = { year: a0.year, subjects: Array.isArray(a0.subjects) ? [...new Set(a0.subjects)] : [], goal: a0.goal, freq: a0.freq };
  const okAns = Number.isInteger(a.year) && a.year >= 0 && a.year <= 6 && a.subjects.length >= 1 && a.subjects.length <= 2 &&
    a.subjects.every(s => ["Maths", "English"].includes(s)) && ["confidence", "catchup", "ahead", "sats", "reading", "homework"].includes(a.goal) && ["once", "twice", "flexible"].includes(a.freq);
  if (name.length < 2 || !/^(\+44|0044|0)7\d{9}$/.test(phone) || !okAns || (a.goal === "sats" && a.year < 5)) return json({ ok: false, error: "invalid" }, 400);

  try { await ensureTable(env); } catch (e) { console.error("schema", e); }
  let hourTotal = 0;
  try {
    if (env.DB) {
      const same = await env.DB.prepare("SELECT COUNT(*) AS c FROM enquiries WHERE phone = ? AND created_at > datetime('now','-1 hour')").bind(phone).first();
      if ((same?.c ?? 0) >= PER_PHONE_PER_HOUR) return json({ ok: false, error: "too_many" }, 429);
      const all = await env.DB.prepare("SELECT COUNT(*) AS c FROM enquiries WHERE created_at > datetime('now','-1 hour')").first();
      hourTotal = all?.c ?? 0;
    }
  } catch (e) { console.error("limit check", e); }

  const rec = recommend(a), c = { name, phone, postcode, method };                                    // recomputed here, never trusted from the browser
  let saved = false, emailed = false;
  try { if (env.DB) { await env.DB.prepare("INSERT INTO enquiries (name,phone,postcode,contact_method,answers,recommendation,total_price) VALUES (?,?,?,?,?,?,?)").bind(name, phone, postcode, method, JSON.stringify(a), JSON.stringify(rec), rec.price.total).run(); saved = true; } } catch (e) { console.error("db", e); }
  try {
    if (env.RESEND_API_KEY && hourTotal < EMAILS_PER_HOUR) {
      const res = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "content-type": "application/json" },
        body: JSON.stringify({ from: "Bright Stars Learning <enquiries@brightstarslearning.co.uk>", to: [env.OWNER_EMAIL || "info@brightstarslearning.co.uk"], subject: `New enquiry: ${name}, ${a.year === 0 ? "Reception" : "Year " + a.year}, ${rec.name}, £${rec.price.total}`, text: summaryText(rec, c) }) });
      emailed = res.ok;
    } else if (hourTotal >= EMAILS_PER_HOUR) { console.warn("email cap reached; enquiry saved only"); }
  } catch (e) { console.error("email", e); }
  const ok = saved || emailed;
  return json({ ok, saved, emailed }, ok ? 200 : 500);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/enquiry") {
      return request.method === "POST" ? enquiry(request, env) : new Response("Method not allowed", { status: 405, headers: { allow: "POST" } });
    }
    if (url.pathname === "/api/admin") {
      return request.method === "POST" ? admin(request, env) : new Response("Method not allowed", { status: 405, headers: { allow: "POST" } });
    }
    return env.ASSETS.fetch(request);
  }
};
