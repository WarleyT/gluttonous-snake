const MAX_RECORDS = 20;
const MODES = ["classic", "wrap", "rush", "feast"] as const;

type LeaderboardMode = (typeof MODES)[number];

type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
};

type ScoreRecord = {
  id: string;
  name: string;
  score: number;
  length: number;
  mode: LeaderboardMode;
  time: number;
  createdAt: string;
};

type LeaderboardsByMode = Record<LeaderboardMode, ScoreRecord[]>;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/leaderboard") {
      return handleLeaderboard(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleLeaderboard(request: Request, env: Env) {
  try {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (request.method === "GET") {
      return json(await getScoresByMode(env));
    }

    if (request.method === "POST") {
      const payload = await request.json().catch(() => null);
      const record = normalizeRecord(payload);

      if (!record) {
        return json({ error: "Invalid score record" }, 400);
      }

      await env.DB.prepare(
        `INSERT INTO leaderboard (id, name, score, length, mode, time, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(record.id, record.name, record.score, record.length, record.mode, record.time, record.createdAt)
        .run();

      return json(await getScoresByMode(env), 201);
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (error) {
    console.error("Leaderboard error", error);
    return json({ error: "Leaderboard unavailable" }, 500);
  }
}

async function getScoresByMode(env: Env) {
  const boards = createEmptyLeaderboards();

  await Promise.all(
    MODES.map(async (mode) => {
      const result = await env.DB.prepare(
        `SELECT id, name, score, length, mode, time, created_at AS createdAt
         FROM leaderboard
         WHERE mode = ?
         ORDER BY score DESC, length DESC, time ASC, created_at ASC
         LIMIT ?`,
      )
        .bind(mode, MAX_RECORDS)
        .all<ScoreRecord>();

      boards[mode] = (result.results || []).filter((record) => !isInternalTestRecord(record));
    }),
  );

  return boards;
}

function normalizeRecord(payload: unknown): ScoreRecord | null {
  if (!payload || typeof payload !== "object") return null;
  const raw = payload as Record<string, unknown>;
  const name = sanitizeName(raw.name);
  const score = toBoundedNumber(raw.score, 0, 999999);
  const length = toBoundedNumber(raw.length, 1, 9999);
  const time = toBoundedNumber(raw.time, 0, 24 * 60 * 60 * 1000);
  const mode = sanitizeMode(raw.mode);

  if (!name || score === null || length === null || time === null) return null;

  return {
    id: crypto.randomUUID(),
    name,
    score,
    length,
    mode,
    time,
    createdAt: new Date().toISOString(),
  };
}

function createEmptyLeaderboards(): LeaderboardsByMode {
  return {
    classic: [],
    wrap: [],
    rush: [],
    feast: [],
  };
}

function isInternalTestRecord(record: ScoreRecord) {
  return record.name === "CodexTest" && record.score === 1;
}

function sanitizeName(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, 12);
}

function sanitizeMode(value: unknown): LeaderboardMode {
  return value === "wrap" || value === "rush" || value === "feast" ? value : "classic";
}

function toBoundedNumber(value: unknown, min: number, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      ...corsHeaders(),
      "Cache-Control": "no-store",
    },
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
