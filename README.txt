BRIGHT STARS LEARNING SITE (Cloudflare Workers with static assets)
public/        the website: index.html, config.js (prices, availability, travel charge, exam date), engine.js (pricing and recommendation engine)
worker.js      handles POST /api/enquiry (saves to D1 and emails the owner) and serves the site
wrangler.jsonc project settings, including the D1 binding called DB
schema.sql     database table (already run)
Secrets to add in Cloudflare: RESEND_API_KEY (and optionally OWNER_EMAIL).
