// Cloudflare Worker (Durable Object) — Global Leaderboard
// Routes:
//   GET  /api/top?limit=25
//   POST /api/submit   {id,name,score,mission,result,ts}

export class LeaderboardDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async _load() {
    const data = await this.state.storage.get("scores");
    return Array.isArray(data) ? data : [];
  }

  async _save(scores) {
    await this.state.storage.put("scores", scores);
  }

  _normalize(entry) {
    const name = (entry.name || "SEEKER").toString().trim().slice(0, 14).replace(/[^\w\s\-!?.]/g, "") || "SEEKER";
    const mission = (entry.mission || "").toString().trim().slice(0, 24);
    const result = (entry.result || "").toString().trim().slice(0, 12);
    const score = Math.max(0, Math.min(50_000_000, (entry.score | 0)));
    const ts = Number(entry.ts) || Date.now();
    const id = (entry.id || "").toString().trim().slice(0, 64);

    if (!id || id.length < 8) throw new Error("Missing id");
    return { id, name, mission, result, score, ts };
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/do/top") {
      const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit")) || 25));
      const scores = await this._load();
      const rows = scores.slice(0, limit).map((r, i) => ({ ...r, rank: i + 1 }));
      return new Response(JSON.stringify({ ok: true, total: scores.length, rows }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    if (request.method === "POST" && url.pathname === "/do/submit") {
      const body = await request.json().catch(() => ({}));
      const entry = this._normalize(body);

      const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
      const now = Date.now();

      // Simple rate limit per IP: 20 submits / hour
      const key = `rl:${ip}`;
      const rl = (await this.state.storage.get(key)) || { n: 0, reset: now + 3600_000 };
      if (now > rl.reset) { rl.n = 0; rl.reset = now + 3600_000; }
      rl.n += 1;
      await this.state.storage.put(key, rl);
      if (rl.n > 20) {
        return new Response(JSON.stringify({ ok: false, error: "Rate limited" }), {
          status: 429, headers: { "Content-Type": "application/json" }
        });
      }

      let scores = await this._load();

      // de-dupe by id
      if (!scores.some(s => s.id === entry.id)) {
        scores.push(entry);
      }

      // Sort desc by score, then newest
      scores.sort((a, b) => (b.score - a.score) || (b.ts - a.ts));

      // Keep only top 500 (permanent enough + fast)
      if (scores.length > 500) scores = scores.slice(0, 500);

      await this._save(scores);

      const rank = scores.findIndex(s => s.id === entry.id) + 1;
      return new Response(JSON.stringify({ ok: true, rank, total: scores.length }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response("Not found", { status: 404 });
  }
}

function corsHeaders(origin, allowedOrigins) {
  const ok =
    allowedOrigins.includes("*") ||
    allowedOrigins.includes(origin);

  return {
    "Access-Control-Allow-Origin": ok ? origin : allowedOrigins[0] || "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "*";
    const allowed = (env.ALLOWED_ORIGINS || "*").split(",").map(s => s.trim()).filter(Boolean);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin, allowed) });
    }

    if (!url.pathname.startsWith("/api/")) {
      return new Response("OK", { status: 200 });
    }

    // Route to single global DO instance
    const id = env.LEADERBOARD.idFromName("global");
    const stub = env.LEADERBOARD.get(id);

    if (request.method === "GET" && url.pathname === "/api/top") {
      const limit = url.searchParams.get("limit") || "25";
      const resp = await stub.fetch(`https://do/do/top?limit=${encodeURIComponent(limit)}`);
      const out = new Response(resp.body, resp);
      out.headers.set("Content-Type", "application/json");
      Object.entries(corsHeaders(origin, allowed)).forEach(([k, v]) => out.headers.set(k, v));
      return out;
    }

    if (request.method === "POST" && url.pathname === "/api/submit") {
      // restrict POST origins (basic spam reduction)
      if (!(allowed.includes("*") || allowed.includes(origin))) {
        return new Response(JSON.stringify({ ok: false, error: "Origin not allowed" }), {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin, allowed) }
        });
      }

      const body = await request.text();
      const resp = await stub.fetch("https://do/do/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": request.headers.get("CF-Connecting-IP") || ""
        },
        body
      });

      const out = new Response(resp.body, resp);
      out.headers.set("Content-Type", "application/json");
      Object.entries(corsHeaders(origin, allowed)).forEach(([k, v]) => out.headers.set(k, v));
      return out;
    }

    return new Response(JSON.stringify({ ok: false, error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin, allowed) }
    });
  }
};
