/* Ezzy AI — web edition. Ports Brain/Agent/Voice/Templates/OrbView/Prefs (Android) to the browser. */
"use strict";

/* ---------- Prefs (localStorage, mirrors Android SharedPreferences) ---------- */
const Prefs = {
  DEFAULTS: { name: "Dean", groq: "", fish: "", voice: "5d9a5e88ee264c3491be61313b70f537", model: "openai/gpt-oss-20b", role: "0" },
  get(k) { const v = localStorage.getItem("ezzy_" + k); return (v === null || v.trim() === "") ? this.DEFAULTS[k] : v.trim(); },
  set(k, v) { localStorage.setItem("ezzy_" + k, (v === null || v === undefined) ? "" : String(v).trim()); },
  clear() { Object.keys(this.DEFAULTS).forEach(k => localStorage.removeItem("ezzy_" + k)); }
};

/* ---------- Templates (exact port of Templates.java) ---------- */
const NAMES = ["Ezzy (general assistant)","Chief Financial Officer","Investment Researcher","DevOps & Security Monitor","Head of Recruiting","Customer Success Manager","Social Media Manager","Research Analyst","Finance & Business Analyst","Software Engineer","Growth & Competitive Intelligence","Inbox Manager","Sales Development Rep","Executive Personal Assistant"];
const TAGLINES = ["Everyday voice assistant and phone control.","Grows your wealth, builds bulge-bracket-grade financial models, and handles your books and taxes.","Tracks your watchlist, analyzes opportunities, and delivers honest briefings without spin.","Monitors uptime, catches security anomalies, and alerts you the moment something breaks.","Writes job descriptions, evaluates candidates, and keeps the hiring pipeline moving.","Spots churn signals early, drafts empathetic responses, and keeps every customer feeling heard.","Plans weekly content, writes in your voice, and tracks what's working.","Sources rigorously, cross-references claims, and delivers clear insights with citations.","Tracks key metrics daily, flags anomalies early, and delivers a clean weekly snapshot.","Reviews PRs, catches bugs early, and ships clean fixes without being asked.","Monitors competitors weekly, tracks market shifts, and delivers briefings you can act on.","Triages your inbox, drafts replies in your voice, and shows you only what actually needs you.","Researches real prospects, writes personalized outreach, and follows up until they reply.","Runs your morning briefing, captures every task, and drafts emails before you ask."];
const PROMPTS = ["",
"Act as a chief financial officer. Help with budgeting, cash flow, financial models, bookkeeping structure and tax planning. Walk through the assumptions behind every number and state the main risk of each recommendation. You are not a licensed accountant or tax adviser, so say when a decision should be checked by one.",
"Act as an investment researcher. Analyse the companies and assets the user names: the business, the numbers, the bull case, the bear case and what would change your mind. Be honest and free of hype, separate fact from opinion, and never promise returns. This is research, not personal financial advice, and the user makes the decision.",
"Act as a DevOps and security engineer. Help diagnose outages, read logs and error messages, spot suspicious activity, and plan fixes in order of urgency. Give exact commands or settings when asked, and warn before any step that could cause downtime or data loss.",
"Act as a head of recruiting. Write clear job descriptions, design interview questions and scorecards, and assess candidates only against the stated requirements. Judge skills and evidence, never age, gender, origin, religion or other personal characteristics.",
"Act as a customer success manager. Read customer messages for signs of frustration or churn risk, draft warm and specific replies, and suggest the next step that keeps the customer. Never promise refunds, discounts or features the user has not approved.",
"Act as a social media manager. Plan a week of content, write posts and captions in the user's voice, and suggest what to measure. Ask for the platform, audience and tone if they are unknown. Never invent testimonials, statistics or quotes.",
"Act as a research analyst. Answer with care: say what is well established, what is disputed and what you are unsure of. Use web_search to open sources for the user when facts need checking, and name the source for each important claim. Never invent a citation.",
"Act as a finance and business analyst. Work from the metrics the user gives you: calculate changes, compare periods, flag anything unusual and summarise the week in a few clear points. Show the arithmetic behind each figure and ask for missing numbers.",
"Act as a senior software engineer. Review code the user reads out, pastes or shows on screen: find bugs, security problems and unclear logic, and propose the smallest clean fix. Explain why each change is needed. Say when you would need to see more code.",
"Act as a growth and competitive intelligence analyst. Compare the user's product with the competitors they name on pricing, positioning, features and audience, and turn it into actions they can take this week. Mark clearly what is known and what is an assumption.",
"Act as an inbox manager. When messages are on screen or read out, sort them into urgent, needs a reply and can wait, then draft short replies in the user's voice. Nothing is sent without the user's confirmation.",
"Act as a sales development rep. Help define the ideal customer, research the prospects the user names, and write short personal outreach and follow-up messages. Use only real facts about a prospect; if you have none, ask. Never write misleading or spam messages.",
"Act as an executive personal assistant. Give short briefings, capture every task the user mentions and read the list back on request, set alarms, and draft emails and messages ready for the user to approve."];
const LIMITS = " You only know what the user tells you, what appears after the word SCREEN and what your actions return. You have no connection to email, bank, company, code or monitoring systems unless they are open on the screen, so never claim to have checked them and never invent figures, names or sources. Say what you would need instead.";
function rolePrompt() {
  const i = Math.max(0, Math.min(NAMES.length - 1, parseInt(Prefs.get("role"), 10) || 0));
  if (i === 0) return "";
  return " Your current role: " + NAMES[i] + ". " + PROMPTS[i] + LIMITS + " Keep spoken answers short; offer more detail if the user wants it.";
}
function systemPrompt(name) {
  return "You are Ezzy AI, a calm, concise voice assistant for " + name + ". You run in a WEB DEMO (not on their phone) and most phone actions are unavailable: open_app, tap, type, back, home always fail here — say so briefly and suggest an alternative instead of claiming you did them. Reply with ONE JSON object only, in this shape: " +
  '{"say":"short spoken sentence","action":"none","arg":"","done":true}. ' +
  "The say text is spoken aloud: one or two short sentences in plain words, no symbols or lists. It may be empty during the middle steps of a task. " +
  "Actions: none; open_app (arg is the app name); tap (arg is the visible label); type (arg is text); scroll (arg is up or down — this scrolls the web page and WORKS); back; home; web_search (arg is the query — WORKS, opens Google); youtube (arg is the query — WORKS); torch_on; torch_off (screen flash effect); battery; volume (arg 0-100); alarm (arg HH:MM 24-hour); wait. " +
  "Set done to false while a task needs more steps, true when finished or only answering. " +
  "Never claim to have checked email, bank, company, code or monitoring systems; never invent figures, names or sources. " +
  rolePrompt() + " Current time: " + new Date().toLocaleString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) + ".";
}

/* ---------- Brain (port of Brain.java; MAX_HISTORY 24) ---------- */
const Brain = {
  history: [],
  addUser(t) { this.history.push({ role: "user", content: t }); },
  async ask() {
    const key = Prefs.get("groq");
    if (!key) throw new Error("Add your Groq key in Settings (it starts with gsk_).");
    const model = Prefs.get("model") || Prefs.DEFAULTS.model;
    const msgs = [{ role: "system", content: systemPrompt(Prefs.get("name")) },
      ...this.history.slice(-24)];
    const body = { model, max_tokens: 900, response_format: { type: "json_object" }, messages: msgs };
    if (model.includes("gpt-oss")) body.reasoning_effort = "low";
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    let j; try { j = await res.json(); } catch { throw new Error("Brain error " + res.status); }
    if (!res.ok) throw new Error((j.error && j.error.message) || ("Brain error " + res.status));
    const content = (((j.choices || [])[0] || {}).message || {}).content || "";
    this.history.push({ role: "assistant", content });
    try { return JSON.parse(content); }
    catch { return { say: content, action: "none", done: true }; }
  }
};

/* ---------- Voice (port of Voice.java: Fish Audio -> speechSynthesis) ---------- */
const Voice = {
  speakBlocking(text) {
    return new Promise(async (resolve) => {
      stopSpeech();
      if (!text || !text.trim()) return resolve();
      // Try Fish Audio first
      const fish = Prefs.get("fish");
      if (fish) {
        try {
          const r = await fetch("https://api.fish.audio/v1/tts", {
            method: "POST",
            headers: { "Authorization": "Bearer " + fish, "Content-Type": "application/json", "model": localStorage.getItem("ezzy_fishmodel") || "s2.1-pro-free" },
            body: JSON.stringify({ text, reference_id: Prefs.get("voice"), format: "mp3" })
          });
          if (r.ok) {
            const buf = await r.arrayBuffer();
            if (buf.byteLength > 200) {
              const url = URL.createObjectURL(new Blob([buf], { type: "audio/mpeg" }));
              const a = new Audio(url);
              window._ezzyAudio = a;
              a.onended = a.onerror = () => { URL.revokeObjectURL(url); resolve(); };
              try { await a.play(); return; } catch { /* fall through */ }
            }
          }
        } catch { /* fall through to built-in voice */ }
      }
      try {
        const u = new SpeechSynthesisUtterance(text);
        const v = parseInt(Prefs.get("volume") || "100", 10);
        u.volume = isNaN(v) ? 1 : Math.max(0, Math.min(100, v)) / 100;
        u.onend = u.onerror = () => resolve();
        speechSynthesis.speak(u);
        // safety timeout in case events never fire
        setTimeout(resolve, Math.min(90000, 3000 + text.length * 120));
      } catch { resolve(); }
    });
  }
};
function stopSpeech() {
  try { speechSynthesis.cancel(); } catch {}
  try { if (window._ezzyAudio) { window._ezzyAudio.pause(); window._ezzyAudio = null; } } catch {}
}

/* ---------- Orb (port of OrbView.java -> canvas) ---------- */
const MODES = { IDLE: 0, LISTEN: 1, THINK: 2, SPEAK: 3 };
let orbMode = MODES.IDLE, orbT = 0;
function setupOrb() {
  const cv = document.getElementById("orb");
  const ctx = cv.getContext("2d");
  function frame() {
    const W = cv.width, H = cv.height, cx = W / 2, cy = H / 2;
    const r = Math.min(W, H) / 2 * 0.94;
    orbT += orbMode === MODES.IDLE ? 0.004 : orbMode === MODES.THINK ? 0.03 : 0.012;
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = "butt";
    const ring = (rad, alpha, w, dash, rot, a0, a1) => {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
      ctx.globalAlpha = alpha; ctx.strokeStyle = "#4FD8FF"; ctx.lineWidth = w;
      ctx.setLineDash(dash || []);
      ctx.beginPath(); ctx.arc(0, 0, rad, a0, a1); ctx.stroke(); ctx.restore();
    };
    ctx.setLineDash([]);
    ring(r, 0.27, r * 0.008, null, 0, 0, Math.PI * 2);                       // outer hairline
    ring(r * 0.9, 0.55, r * 0.04, [r * 0.012, r * 0.06], -orbT * 0.7, 0, Math.PI * 2); // tick ring
    ctx.lineCap = "round"; ctx.setLineDash([]);
    ring(r * 0.78, 1, r * 0.022, null, orbT * 1.6, 0, 2.27);                 // long arc 130°
    ring(r * 0.78, 1, r * 0.022, null, orbT * 1.6, 3.32, 4.01);              // +40°
    ring(r * 0.66, 0.31, r * 0.008, null, 0, 0, Math.PI * 2);
    ring(r * 0.58, 0.9, r * 0.016, null, -orbT * 2.8, 0, 1.05);              // fast arc
    // core
    const pulse = 1 + 0.04 * Math.sin(orbT * 20);
    const cr = r * 0.42 * pulse;
    ctx.globalAlpha = 0.14; ctx.fillStyle = "#4FD8FF";
    ctx.beginPath(); ctx.arc(cx, cy, cr * 1.22, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = "#0A1620";
    ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#4FD8FF"; ctx.lineWidth = r * 0.014;
    ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.stroke();
    // voice bars
    const active = orbMode === MODES.LISTEN || orbMode === MODES.SPEAK;
    const bars = 6, gap = cr * 0.2, sx = cx - gap * (bars - 1) / 2;
    ctx.lineWidth = cr * 0.09; ctx.lineCap = "round";
    for (let i = 0; i < bars; i++) {
      const amp = active ? 0.2 + 0.6 * Math.abs(Math.sin(orbT * 30 + i * 0.9))
                         : 0.12 + 0.05 * Math.abs(Math.sin(orbT * 8 + i));
      const half = cr * amp * 0.7, x = sx + i * gap;
      ctx.globalAlpha = 1; ctx.strokeStyle = "#4FD8FF";
      ctx.beginPath(); ctx.moveTo(x, cy - half); ctx.lineTo(x, cy + half); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.setLineDash([]);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* ---------- Agent (port of Agent.java; MAX_STEPS 6 on web) ---------- */
const MAX_STEPS = 6;
let busy = false, handsFree = false, sttActive = false;
const $ = (id) => document.getElementById(id);
const statusEl = () => $("status"), logEl = () => $("log"), scrollEl = () => $("scroll"),
      micEl = () => $("mic"), inputEl = () => $("input");

function setState(mode, label) {
  orbMode = mode;
  statusEl().textContent = label;
  const m = micEl();
  m.textContent = mode === MODES.LISTEN ? "STOP" : "MIC";
  m.classList.toggle("live", mode === MODES.LISTEN);
}
function line(who, text) {
  const p = document.createElement("p");
  const b = document.createElement("strong"); b.textContent = who + ": ";
  p.appendChild(b); p.appendChild(document.createTextNode(text));
  logEl().appendChild(p);
  scrollEl().scrollTop = scrollEl().scrollHeight;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function act(action, arg) {
  action = (action || "none").trim().toLowerCase();
  arg = (arg || "").trim();
  switch (action) {
    case "": case "none": return "";
    case "web_search":
      if (!arg) return "No query was given.";
      window.open("https://www.google.com/search?q=" + encodeURIComponent(arg), "_blank", "noopener");
      return "Opened Google for " + arg + ".";
    case "youtube":
      if (!arg) return "No query was given.";
      window.open("https://www.youtube.com/results?search_query=" + encodeURIComponent(arg), "_blank", "noopener");
      return "Opened YouTube for " + arg + ".";
    case "scroll": {
      const down = !arg.toLowerCase().includes("up");
      window.scrollBy({ top: down ? 500 : -500, behavior: "smooth" });
      return "Scrolled " + (down ? "down" : "up") + " the page.";
    }
    case "wait": await sleep(1500); return "Waited.";
    case "battery":
      try {
        if (navigator.getBattery) {
          const b = await navigator.getBattery();
          return "Battery is at " + Math.round(b.level * 100) + " percent" + (b.charging ? ", charging." : ".");
        }
        return "Battery level is not exposed by this browser.";
      } catch { return "Battery level is not exposed by this browser."; }
    case "volume": {
      const pct = Math.max(0, Math.min(100, Math.round(parseFloat(arg.replace("%", "")))));
      if (isNaN(pct)) return "Volume needs a number from 0 to 100.";
      Prefs.set("volume", String(pct));
      return "Demo speech volume set to " + pct + " percent.";
    }
    case "torch_on": case "torch_off": {
      const f = $("flash");
      f.hidden = false; f.style.opacity = action === "torch_on" ? "0.9" : "0";
      requestAnimationFrame(() => { f.style.opacity = "0"; });
      setTimeout(() => { f.hidden = true; }, 600);
      return action === "torch_on" ? "Screen flash on (phones use the camera torch)." : "Screen flash off.";
    }
    case "alarm": {
      const m = arg.match(/^(\d{1,2}):(\d{2})$/);
      if (!m) return "The alarm time was not understood (use HH:MM).";
      return "Alarm noted for " + arg + " — this demo can't set system alarms, so keep this tab open and I'll announce it.";
    }
    case "open_app": return "I can't open apps from a web page — that's Android-only (EzzyService). Try web_search for \"" + (arg || "it") + "\" instead.";
    case "tap": case "type": case "back": case "home":
      return "That needs the Android app's phone control (Accessibility service) — not available in this web demo.";
    default: return "Unknown action " + action + ". Use only the listed actions.";
  }
}

async function handle(text) {
  if (busy) return;
  busy = true; micEl().disabled = true;
  try {
    line("You", text);
    const low = text.toLowerCase();
    if (handsFree && (low.includes("goodbye") || low.includes("stop listening"))) toggleHandsfree(false);
    setState(MODES.THINK, "THINKING");
    Brain.addUser(text);
    for (let step = 0; step < MAX_STEPS; step++) {
      setState(MODES.THINK, "THINKING");
      let r;
      try { r = await Brain.ask(); }
      catch (e) { line("Ezzy", e.message || "Something went wrong."); await Voice.speakBlocking("Sorry, something went wrong."); break; }
      const action = String(r.action || "none").trim().toLowerCase();
      const arg = r.arg == null ? "" : String(r.arg).trim();
      const done = r.done !== false;
      let say = String(r.say || "").trim();
      let result;
      try { result = await act(action, arg); }
      catch (e) { result = "That failed: " + (e.message || e); }
      if (action === "battery") say = result;
      if (!say && result && (action === "none" || done)) say = result;
      if (say) { line("Ezzy", say); setState(MODES.SPEAK, "SPEAKING"); await Voice.speakBlocking(say); }
      if (done || action === "none" || !action) break;
      Brain.addUser("RESULT " + result + "\n\nSCREEN\n(web demo: a marketing page with hero, features, actions, roles, how-it-works, android, faq sections)");
      await sleep(600);
    }
  } finally {
    busy = false; micEl().disabled = false;
    setState(MODES.IDLE, "ONLINE");
    if (handsFree && !document.hidden) setTimeout(() => { if (handsFree && !busy) startListening(); }, 400);
  }
}

/* ---------- Speech input (Web Speech API; mirrors SpeechRecognizer) ---------- */
let recog = null;
function sttSupported() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }
function startListening() {
  if (busy || sttActive) return;
  if (!sttSupported()) { line("Ezzy", "Speech recognition isn't available in this browser. Type your request instead."); return; }
  stopSpeech();
  const C = window.SpeechRecognition || window.webkitSpeechRecognition;
  recog = new C(); recog.lang = "en-US"; recog.interimResults = true; recog.maxAlternatives = 1;
  sttActive = true; setState(MODES.LISTEN, "LISTENING");
  let finalText = "";
  recog.onresult = (e) => {
    let interim = "";
    for (const r of e.results) { if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript; }
    statusEl().textContent = finalText || interim || "LISTENING";
  };
  recog.onerror = recog.onend = () => {
    sttActive = false;
    if (finalText.trim()) handle(finalText.trim());
    else setState(MODES.IDLE, handsFree ? "HANDS-FREE…" : "TAP MIC TO SPEAK");
  };
  try { recog.start(); } catch { sttActive = false; setState(MODES.IDLE, "ONLINE"); }
}
function stopListening() {
  sttActive = false;
  try { if (recog) recog.stop(); } catch {}
  setState(MODES.IDLE, "ONLINE");
}

/* ---------- UI wiring ---------- */
function toggleHandsfree(force) {
  handsFree = force !== undefined ? force : !handsFree;
  const b = $("handsfree");
  b.textContent = handsFree ? "HANDS-FREE: ON" : "HANDS-FREE: OFF";
  b.classList.toggle("on", handsFree);
  b.setAttribute("aria-pressed", String(handsFree));
  if (handsFree && !busy) startListening();
  if (!handsFree && sttActive) stopListening();
}
function refreshRole() {
  const i = Math.max(0, Math.min(NAMES.length - 1, parseInt(Prefs.get("role"), 10) || 0));
  $("roleBtn").textContent = "ROLE: " + NAMES[i].toUpperCase();
  document.querySelectorAll(".role-opt").forEach(el => el.classList.toggle("active", +el.dataset.i === i));
  document.querySelectorAll("#roleGrid .card").forEach(el => el.classList.toggle("active", +el.dataset.i === i));
}
function openModal(bg, fill) { if (fill) fill(); $(bg).hidden = false; }
function closeModal(bg) { $(bg).hidden = true; }
function fillSettings() {
  $("fName").value = Prefs.get("name"); $("fGroq").value = Prefs.get("groq");
  $("fFish").value = Prefs.get("fish"); $("fVoice").value = Prefs.get("voice");
  $("fModel").value = Prefs.get("model");
}
function buildRoles() {
  const grid = $("roleGrid"), list = $("roleList");
  NAMES.forEach((n, i) => {
    const c = document.createElement("article");
    c.className = "card"; c.dataset.i = i;
    const h = document.createElement("h3"); h.textContent = (i === 0 ? "✨ " : "🎭 ") + n;
    const p = document.createElement("p"); p.textContent = TAGLINES[i];
    const b = document.createElement("button"); b.className = "btn ghost pick"; b.textContent = "Use this role";
    b.onclick = () => { Prefs.set("role", String(i)); refreshRole(); line("Ezzy", "Role set to " + n + "."); document.getElementById("demo").scrollIntoView({ behavior: "smooth" }); };
    c.append(h, p, b); grid.appendChild(c);
    const o = document.createElement("button");
    o.className = "role-opt"; o.dataset.i = i;
    o.innerHTML = "<strong></strong><small></small>";
    o.querySelector("strong").textContent = n; o.querySelector("small").textContent = TAGLINES[i];
    o.onclick = () => { Prefs.set("role", String(i)); refreshRole(); line("Ezzy", "Role set to " + n + "."); closeModal("roleBg"); };
    list.appendChild(o);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupOrb(); buildRoles(); refreshRole();
  if (!sttSupported()) $("sttSupport").textContent = "🎤 Voice input needs Chrome/Edge — typing always works.";
  // composer
  micEl().onclick = () => (orbMode === MODES.LISTEN ? stopListening() : startListening());
  $("heroMic").onclick = () => document.getElementById("demo").scrollIntoView({ behavior: "smooth" }) || startListening();
  inputEl().addEventListener("keydown", (e) => {
    if (e.key === "Enter") { const t = inputEl().value.trim(); if (t) { inputEl().value = ""; handle(t); } }
  });
  $("handsfree").onclick = () => toggleHandsfree();
  // settings modal
  const open = () => openModal("modalBg", fillSettings);
  $("settingsBtn").onclick = open; $("heroSettings").onclick = open; $("navSettings").onclick = open;
  $("mCancel").onclick = () => closeModal("modalBg");
  $("modalBg").addEventListener("click", (e) => { if (e.target.id === "modalBg") closeModal("modalBg"); });
  $("mSave").onclick = () => {
    Prefs.set("name", $("fName").value || Prefs.DEFAULTS.name);
    Prefs.set("groq", $("fGroq").value); Prefs.set("fish", $("fFish").value);
    Prefs.set("voice", $("fVoice").value || Prefs.DEFAULTS.voice);
    Prefs.set("model", $("fModel").value || Prefs.DEFAULTS.model);
    closeModal("modalBg"); line("Ezzy", Prefs.get("groq") ? "Settings saved — I'm listening." : "Settings saved. Add a Groq key to wake me up.");
  };
  $("mClear").onclick = () => { Prefs.clear(); Brain.history = []; fillSettings(); refreshRole(); line("Ezzy", "Cleared keys, settings and memory on this browser."); };
  // role modal
  $("roleBtn").onclick = () => openModal("roleBg");
  $("rCancel").onclick = () => closeModal("roleBg");
  $("roleBg").addEventListener("click", (e) => { if (e.target.id === "roleBg") closeModal("roleBg"); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeModal("modalBg"); closeModal("roleBg"); } });
  if (!Prefs.get("groq")) setTimeout(() => { if (!Prefs.get("groq")) openModal("modalBg", fillSettings); }, 1200);
});
