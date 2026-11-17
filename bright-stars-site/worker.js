import { recommend, summaryText } from "./public/engine.js";
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
async function enquiry(request, env) {
  let b; try { b = await request.json(); } catch { return json({ ok: false }, 400); }
  if (b.website) return json({ ok: true });                       // honeypot
  const name = String(b.name || "").trim().slice(0, 80);
  const phone = String(b.phone || "").replace(/[^\d+]/g, "");
  const postcode = String(b.postcode || "").trim().slice(0, 10);
  const method = b.method === "WhatsApp" ? "WhatsApp" : "Phone call";
  const a = b.answers || {};
  const okAns = Number.isInteger(a.year) && a.year >= 0 && a.year <= 6 && Array.isArray(a.subjects) && a.subjects.length > 0 &&
    a.subjects.every(s => ["Maths", "English"].includes(s)) && ["confidence", "catchup", "ahead", "sats", "reading"].includes(a.goal) && ["once", "twice", "flexible"].includes(a.freq);
  if (name.length < 2 || !/^(\+44|0044|0)7\d{9}$/.test(phone) || !okAns) return json({ ok: false, error: "invalid" }, 400);
  const rec = recommend(a), c = { name, phone, postcode, method };   // recomputed on the server, never trusted from the browser
  let saved = false, emailed = false;
  try { if (env.DB) { await env.DB.prepare("INSERT INTO enquiries (name,phone,postcode,contact_method,answers,recommendation,total_price) VALUES (?,?,?,?,?,?,?)").bind(name, phone, postcode, method, JSON.stringify(a), JSON.stringify(rec), rec.price.total).run(); saved = true; } } catch (e) { console.error("db", e); }
  try {
    if (env.RESEND_API_KEY) {
      const res = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "content-type": "application/json" },
        body: JSON.stringify({ from: "Bright Stars Learning <enquiries@brightstarslearning.co.uk>", to: [env.OWNER_EMAIL || "info@brightstarslearning.co.uk"], subject: `New tuition enquiry: ${name}`, text: summaryText(rec, c) }) });
      emailed = res.ok;
    }
  } catch (e) { console.error("email", e); }
  return json({ ok: saved || emailed, saved, emailed }, saved || emailed ? 200 : 500);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/enquiry") {
      return request.method === "POST" ? enquiry(request, env) : new Response("Method not allowed", { status: 405 });
    }
    return env.ASSETS.fetch(request);
  }
};
