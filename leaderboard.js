/* leaderboard.js — Global + local fallback leaderboard for GitHub Pages
   - Adds:
     • Global Rankings overlay (press R)
     • Auto-submit on run end (called from game.js)
     • Date display
   - Requires a backend endpoint (Cloudflare Worker below) for global sharing.
*/

(() => {
  // ✅ After deploying the Worker, set this:
  // Example: "https://your-name.your-subdomain.workers.dev/api"
  const LEADERBOARD_API = "https://gamexangelsdoom.c9qk2jmq.workers.dev/api"; // <-- PUT YOUR /api URL HERE

  const LOCAL_KEY = "ASYLUM_LOCAL_LEADERBOARD_V1";
  const MAX_LOCAL = 80;

  const $ = (sel) => document.querySelector(sel);

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function fmtDate(ts) {
    try {
      const d = new Date(ts);
      return d.toLocaleString(undefined, {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit"
      });
    } catch { return String(ts); }
  }

  function safeStr(s, max = 14) {
    s = (s ?? "").toString().trim().slice(0, max);
    // keep it simple; avoid weird control chars
    return s.replace(/[^\w\s\-!?.]/g, "").trim() || "SEEKER";
  }

  function randId() {
    const a = new Uint8Array(12);
    crypto.getRandomValues(a);
    return [...a].map(x => x.toString(16).padStart(2, "0")).join("");
  }

  function loadLocal() {
    try {
      const arr = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }

  function saveLocal(list) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, MAX_LOCAL))); } catch {}
  }

  function addLocal(entry) {
    const list = loadLocal();
    list.push(entry);
    list.sort((a, b) => (b.score|0) - (a.score|0));
    saveLocal(list);
    return list;
  }

  async function apiFetch(path, opts = {}) {
    if (!LEADERBOARD_API) throw new Error("LEADERBOARD_API not set");
    const url = LEADERBOARD_API.replace(/\/+$/, "") + path;

    const res = await fetch(url, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(opts.headers || {})
      }
    });

    const txt = await res.text();
    let json = null;
    try { json = txt ? JSON.parse(txt) : null; } catch {}
    if (!res.ok) {
      const msg = (json && (json.error || json.message)) || txt || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return json;
  }

  async function fetchTop(limit = 25) {
    limit = clamp(limit|0, 1, 100);
    if (!LEADERBOARD_API) {
      const local = loadLocal().slice(0, limit);
      return { source: "local", total: local.length, rows: local };
    }
    const data = await apiFetch(`/top?limit=${limit}`, { method: "GET" });
    return { source: "global", total: data.total || 0, rows: data.rows || [] };
  }

  async function submitScore(entry) {
    // Always store locally as fallback/personal history
    addLocal(entry);

    if (!LEADERBOARD_API) {
      return { ok: true, source: "local", rank: null, total: null };
    }
    const data = await apiFetch(`/submit`, { method: "POST", body: JSON.stringify(entry) });
    return data;
  }

  function ensureStyles() {
    if ($("#lbStyles")) return;
    const st = document.createElement("style");
    st.id = "lbStyles";
    st.textContent = `
      .lbOverlay{position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.86);display:none;place-items:center}
      .lbPanel{width:min(980px,94vw);background:#0f0f14;border:1px solid #2b2b35;box-shadow:0 0 34px rgba(0,0,0,.65);padding:18px}
      .lbTitle{color:#e9e9f3;letter-spacing:3px;text-transform:uppercase;font-size:14px;margin:0 0 10px}
      .lbTiny{color:#8a8aa2;font-size:11px;line-height:1.6;margin:0 0 12px}
      .lbRow{display:flex;gap:10px;justify-content:space-between;align-items:center;margin-bottom:10px}
      .lbBtn{background:#000;border:1px solid #333;color:#e9e9f3;padding:8px 12px;font:inherit;cursor:pointer;text-transform:uppercase;letter-spacing:1px}
      .lbBtn:hover{border-color:#7d3cff;box-shadow:0 0 14px rgba(125,60,255,.25)}
      .lbTable{width:100%;border-collapse:collapse;font-size:12px}
      .lbTable th,.lbTable td{border-bottom:1px solid #222;padding:8px 6px;color:#d7d7e5;text-align:left}
      .lbTable th{color:#9a9ab6;font-size:11px;letter-spacing:1px;text-transform:uppercase}
      .lbHi{background:rgba(125,60,255,.10)}
      .lbErr{color:#ff3355;font-size:11px;margin-top:8px;white-space:pre-wrap}
      .lbDock{position:fixed;left:12px;bottom:12px;z-index:70}
    `;
    document.head.appendChild(st);
  }

  function ensureOverlay() {
    ensureStyles();
    if ($("#lbOverlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "lbOverlay";
    overlay.className = "lbOverlay";
    overlay.innerHTML = `
      <div class="lbPanel">
        <div class="lbRow">
          <h2 class="lbTitle">GLOBAL RANKINGS</h2>
          <div style="display:flex;gap:10px">
            <button class="lbBtn" id="lbRefresh">Refresh</button>
            <button class="lbBtn" id="lbClose">Close</button>
          </div>
        </div>
        <div class="lbTiny" id="lbMeta">
          Press <b>R</b> anytime to toggle this screen.
          ${LEADERBOARD_API ? "" : "\n\n(Global leaderboard disabled: set LEADERBOARD_API in leaderboard.js)"} 
        </div>
        <div id="lbTableWrap"></div>
        <div class="lbErr" id="lbErr"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    const dock = document.createElement("div");
    dock.className = "lbDock";
    dock.innerHTML = `<button class="lbBtn" id="lbDockBtn">Rankings (R)</button>`;
    document.body.appendChild(dock);

    $("#lbClose").onclick = () => closeOverlay();
    $("#lbDockBtn").onclick = () => openOverlay();
    $("#lbRefresh").onclick = () => refreshOverlay();

    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      if (e.code === "KeyR") {
        if ($("#lbOverlay").style.display === "grid") closeOverlay();
        else openOverlay();
      }
    });
  }

  function renderTable(rows, highlightId) {
    const wrap = $("#lbTableWrap");
    if (!wrap) return;

    const table = document.createElement("table");
    table.className = "lbTable";
    table.innerHTML = `
      <thead>
        <tr>
          <th style="width:60px">Rank</th>
          <th style="width:140px">Name</th>
          <th style="width:110px">Score</th>
          <th style="width:150px">Mission</th>
          <th style="width:110px">Result</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tb = table.querySelector("tbody");
    rows.forEach((r, i) => {
      const tr = document.createElement("tr");
      if (highlightId && r.id === highlightId) tr.className = "lbHi";
      const rank = (r.rank ?? (i + 1));
      tr.innerHTML = `
        <td>${rank}</td>
        <td></td>
        <td>${r.score|0}</td>
        <td>${(r.mission || "").toString()}</td>
        <td>${(r.result || "").toString()}</td>
        <td>${fmtDate(r.ts || Date.now())}</td>
      `;
      tr.children[1].textContent = (r.name || "SEEKER");
      tb.appendChild(tr);
    });

    wrap.innerHTML = "";
    wrap.appendChild(table);
  }

  async function refreshOverlay(highlightId = null) {
    ensureOverlay();
    $("#lbErr").textContent = "";
    $("#lbTableWrap").textContent = "Loading…";

    try {
      const top = await fetchTop(25);
      $("#lbMeta").textContent =
        `Source: ${top.source.toUpperCase()} · Showing Top ${top.rows.length}` +
        (top.total ? ` / ${top.total}` : "") +
        ` · Press R to toggle`;

      renderTable(top.rows, highlightId);
    } catch (e) {
      $("#lbTableWrap").textContent = "";
      $("#lbErr").textContent = `Leaderboard error:\n${e.message}`;
      // fallback: show local
      const local = loadLocal().slice(0, 25);
      renderTable(local, highlightId);
    }
  }

  function openOverlay() {
    ensureOverlay();
    $("#lbOverlay").style.display = "grid";
    refreshOverlay();
  }

  function closeOverlay() {
    const o = $("#lbOverlay");
    if (o) o.style.display = "none";
  }

  // End screen section injection (no HTML edits needed)
  function ensureEndSection() {
    const end = $("#end");
    if (!end) return null;
    let sec = $("#lbEndSection");
    if (sec) return sec;

    sec = document.createElement("div");
    sec.id = "lbEndSection";
    sec.style.marginTop = "12px";
    sec.style.textAlign = "left";
    sec.style.whiteSpace = "pre-wrap";

    const title = document.createElement("div");
    title.style.color = "#e9e9f3";
    title.style.letterSpacing = "2px";
    title.style.textTransform = "uppercase";
    title.style.fontSize = "12px";
    title.textContent = "Global Rankings";

    const body = document.createElement("div");
    body.id = "lbEndBody";
    body.style.marginTop = "8px";
    body.style.color = "#d7d7e5";
    body.textContent = "Submitting score…";

    const hint = document.createElement("div");
    hint.style.marginTop = "8px";
    hint.style.color = "#8a8aa2";
    hint.style.fontSize = "11px";
    hint.textContent = "Press R to open full rankings.";

    sec.appendChild(title);
    sec.appendChild(body);
    sec.appendChild(hint);

    // append near the end of the end overlay panel
    const panel = end.querySelector(".gPanel") || end.firstElementChild;
    if (panel) panel.appendChild(sec);

    return sec;
  }

  // This is what game.js will call
  async function onRunEnd(run) {
    ensureOverlay();

    const entry = {
      id: run.id || randId(),
      name: safeStr(run.name, 14),
      score: clamp(run.score|0, 0, 50_000_000),
      mission: safeStr(run.mission, 24),
      result: safeStr(run.result, 12),
      ts: run.ts || Date.now(),
    };

    const sec = ensureEndSection();
    const endBody = $("#lbEndBody");

    try {
      const res = await submitScore(entry); // global + local
      const rankLine =
        (res && typeof res.rank === "number")
          ? `Your Global Rank: #${res.rank} / ${res.total || "?"}`
          : (LEADERBOARD_API ? "Submitted." : "Saved locally (global disabled).");

      if (endBody) endBody.textContent = `${rankLine}\nLoading Top 10…`;

      const top = await fetchTop(10);
      const lines = top.rows.map((r, i) => {
        const rank = r.rank ?? (i + 1);
        const name = (r.name || "SEEKER").toString().padEnd(14).slice(0, 14);
        const score = String(r.score|0).padStart(7, " ");
        const when = fmtDate(r.ts || Date.now());
        return `${String(rank).padStart(2," ")}  ${name}  ${score}  ${r.mission || ""}  ${r.result || ""}  ${when}`;
      }).join("\n");

      if (endBody) endBody.textContent = `${rankLine}\n\n${lines}`;

      // keep overlay updated + highlight your id if present
      refreshOverlay(entry.id);
    } catch (e) {
      if (endBody) endBody.textContent =
        `Could not submit globally:\n${e.message}\n\nLocal Top 10:\n` +
        loadLocal().slice(0, 10).map((r, i) =>
          `${String(i + 1).padStart(2," ")}  ${(r.name||"SEEKER").padEnd(14).slice(0,14)}  ${(r.score|0)}  ${fmtDate(r.ts)}`
        ).join("\n");
    }
  }

  // Make available to game.js
  window.Leaderboard = {
    onRunEnd,
    open: openOverlay,
    refresh: refreshOverlay,
  };

  // Late-mount end section if end overlay appears later
  const mo = new MutationObserver(() => ensureEndSection());
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // Create overlay early
  document.addEventListener("DOMContentLoaded", () => ensureOverlay());
})();
