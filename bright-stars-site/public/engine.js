// One pricing and recommendation engine, used by the website, the saved enquiry and the owner email.
import CONFIG from "./config.js";
export { CONFIG };
const r2 = n => Math.round(n * 100) / 100;

export function priceFor(hours, weeks) {
  const { packages: P, standalone: S, minRate } = CONFIG;
  const total = P[hours] ?? (hours > 0 && hours < 6 ? Math.floor(hours / 2) * S[2] + (hours % 2) * S[1] : null);
  if (total == null) throw new Error("Not a valid package size: " + hours);
  const rate = r2(total / hours);
  if (rate < minRate) throw new Error("Rate below minimum");
  return { hours, total, rate, weekly: weeks ? r2(total / weeks) : null, monthly: weeks ? r2(total / weeks * 52 / 12) : null };
}

const PRI = {
  early: { Maths: ["Number recognition", "Number bonds", "Addition and subtraction"], English: ["Phonics and letter sounds", "Blending and early reading", "Reading fluency and vocabulary"] },
  mid: { Maths: ["Times tables", "Multiplication and division", "Fractions and decimals", "Arithmetic and problem-solving"], English: ["Reading comprehension", "Spelling, punctuation and grammar", "Writing"] },
  y5: { Maths: ["Strengthening foundations", "Identifying learning gaps", "Preparing for future Year 6 SATs"], English: ["Strengthening foundations", "Reading comprehension and grammar", "Preparing for future Year 6 SATs"] },
  y6: { Maths: ["Arithmetic", "Reasoning and problem-solving", "Exam-style practice"], English: ["Reading comprehension", "Grammar, punctuation and spelling", "Exam confidence and practice"] }
};
const PH = {
  A: [[1/3, "Identify the starting point and priority areas, then begin focused teaching."], [2/3, "Develop core understanding, practise skills and reinforce learning."], [1, "Apply learning more independently, consolidate and review progress and next steps."]],
  B: [[.25, "Establish priorities and strengthen core concepts."], [.5, "Targeted teaching to develop understanding."], [.75, "Practise increasingly challenging questions and independent application."], [1, "Consolidate learning, review progress and identify further priorities."]],
  C: [[1/6, "Establish a starting point, identify priority gaps and agree objectives."], [5/12, "Address foundational weaknesses with structured teaching and essential practice."], [2/3, "Develop understanding, apply learning and strengthen confidence."], [5/6, "Consolidate key concepts and tackle more challenging material."], [1, "Review progress, reinforce learning and agree next steps."]],
  D: [[.25, "Identify priority topics and establish a starting point."], [.5, "Targeted teaching and structured practice on weaker topics."], [.75, "Exam-style questions, reasoning, reading and grammar practice."], [1, "Consolidation, timed practice where appropriate and final review."]],
  E: [[1/3, "Establish the starting point with letter sounds and blending."], [2/3, "Build reading fluency, vocabulary and comprehension."], [1, "Consolidate, build confidence and agree next steps."]]
};
const NAMES = { A: "Confidence & Foundations", B: "Building Understanding & Getting Ahead", C: "Catch-up & Targeted Improvement", D: "Year 6 SATs Preparation", E: "Early Reading & Phonics" };
const GOALS = { confidence: "Build confidence and strengthen foundations", catchup: "Catch up with areas they are finding difficult", ahead: "Improve understanding and get ahead", sats: "Prepare for SATs", reading: "Improve reading, writing or phonics" };

function phases(t, weeks) {
  let s = 1; const out = [];
  PH[t].forEach(([f, tx], i, arr) => {
    if (s > weeks) return;
    const e = i === arr.length - 1 ? weeks : Math.max(s, Math.round(f * weeks));
    out.push({ weeks: s === e ? `Week ${s}` : `Weeks ${s} to ${e}`, text: tx }); s = e + 1;
  });
  return out;
}

export function recommend(a, today = new Date()) {
  const y = Number(a.year); let subs = [...a.subjects]; const both = subs.length === 2;
  let type, weeks, hpw, note = "";
  if (a.goal === "reading") { subs = ["English"]; type = y <= 2 ? "E" : "A"; weeks = 6; hpw = 1; }
  else if (a.goal === "sats" && y === 6) {
    type = "D";
    const left = CONFIG.satsExamDate ? Math.floor((new Date(CONFIG.satsExamDate) - today) / 6048e5) : 99;
    weeks = left >= 12 ? 12 : left >= 6 ? 6 : 3; hpw = weeks === 3 ? 2 : both ? 2 : 1;
    if (left < 12) note = "We have shortened the programme to fit the time left before the SATs.";
  }
  else if (a.goal === "sats") { type = "B"; weeks = both ? 6 : 12; hpw = both ? 2 : 1; }
  else if (a.goal === "confidence") { type = "A"; weeks = 6; hpw = both ? 2 : 1; }
  else if (a.goal === "ahead") { type = "B"; weeks = both ? 6 : 12; hpw = both ? 2 : 1; }
  else { type = "C"; weeks = 12; hpw = 2; }
  const hours = weeks * hpw;
  const band = a.goal === "sats" ? (y === 6 ? "y6" : "y5") : y <= 2 ? "early" : "mid";
  const priorities = Object.fromEntries(subs.map(s => [s, PRI[band][s]]));
  const name = a.goal === "sats" && y === 5 ? "Preparing for Year 6 SATs" : NAMES[type];
  const why = {
    confidence: "Confidence grows fastest when a child secures the basics in short, regular sessions.",
    catchup: "Where several topics feel difficult, steady twice-weekly support over a longer period usually works better than short bursts.",
    ahead: "A focused programme lets your child deepen understanding and apply it independently.",
    sats: y === 6 ? "Structured practice and familiarity with question styles build exam confidence." : "Year 5 is the time to strengthen foundations ready for Year 6.",
    reading: "Targeted English sessions build fluency and confidence without unrelated content."
  }[a.goal];
  const freqWords = { once: "once a week", twice: "twice a week", flexible: "a flexible arrangement" }[a.freq];
  const mk = (h, w) => ({ weeks: w, hpw: h, hours: w * h, price: priceFor(w * h, w) });
  let alt = null;
  if (a.freq === "once" && hpw === 2 && hours <= 24) alt = mk(1, hours);
  if (a.freq === "twice" && hpw === 1) alt = mk(2, hours / 2);
  const rec = {
    answers: a, type, name, subjects: subs, weeks, hpw, visits: hpw, visitLength: 1, hours, note,
    price: priceFor(hours, weeks), priorities, phases: phases(type, weeks), why, alt,
    requested: `You asked for ${freqWords}.` + (alt && hpw === 2 ? ` We recommend ${hpw} hours a week (two one-hour visits). If that does not suit you, the same hours can run once a week over ${alt.weeks} weeks.` : alt ? ` The same hours can be completed sooner with two visits a week over ${alt.weeks} weeks.` : ""),
    includes: ["Face-to-face one-to-one lessons", "A planned programme matched to your child's year group", "Regular updates for parents", "Free 15-minute parent call before you commit"],
    travel: CONFIG.travelCharge, disclaimer: "Your indicative tuition estimate: subject to confirmation of the final tuition arrangement and availability."
  };
  return rec;
}

export const summaryText = (rec, c) => [
  `New Tuition Finder enquiry`, `Parent: ${c.name}`, `Mobile: ${c.phone}`, `Postcode: ${c.postcode || "not given"}`, `Preferred contact: ${c.method}`, ``,
  `Year: ${rec.answers.year === 0 ? "Reception" : "Year " + rec.answers.year}`, `Subjects: ${rec.subjects.join(" and ")}`, `Goal: ${GOALS[rec.answers.goal]}`, `Requested frequency: ${rec.answers.freq}`, ``,
  `Recommended: ${rec.name}`, `${rec.weeks} weeks, ${rec.hpw} hour(s) a week, ${rec.hours} hours in total`,
  `Total £${rec.price.total} (£${rec.price.rate}/hour), about £${rec.price.weekly} a week, £${rec.price.monthly} monthly equivalent`,
  ...(rec.alt ? [`Alternative: ${rec.alt.hpw} hour(s) a week over ${rec.alt.weeks} weeks`] : []), ``,
  ...Object.entries(rec.priorities).map(([s, p]) => `${s}: ${p.join(", ")}`), ``, ...rec.phases.map(p => `${p.weeks}: ${p.text}`)
].join("\n");
