const SCORE_KEY = "snake-leaderboard:top-20";
const MAX_RECORDS = 20;
const MODES = ["classic", "wrap", "rush", "feast"];

export async function onRequest({ request, env }) {
  try {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (request.method === "GET") {
      return json(await readLeaderboards(env));
    }

    if (request.method === "POST") {
      const record = normalizeRecord(await request.json().catch(() => null));
      if (!record) return json({ error: "Invalid score record" }, 400);

      const boards = await readLeaderboards(env);
      boards[record.mode].push(record);
      const ranked = rankBoards(boards);
      await getLeaderboardStore(env).put(SCORE_KEY, JSON.stringify(ranked));
      return json(ranked, 201);
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (error) {
    console.error("Leaderboard error", error);
    return json({ error: "Leaderboard unavailable" }, 500);
  }
}

async function readLeaderboards(env) {
  const raw = await getLeaderboardStore(env).get(SCORE_KEY);
  if (!raw) return createEmptyBoards();

  try {
    return normalizeBoards(JSON.parse(raw));
  } catch {
    return createEmptyBoards();
  }
}

function getLeaderboardStore(env) {
  const store = globalThis.LEADERBOARD || env?.LEADERBOARD;
  if (!store) {
    throw new Error("Missing EdgeOne KV binding: LEADERBOARD");
  }
  return store;
}

function normalizeRecord(payload) {
  if (!payload || typeof payload !== "object") return null;
  const name = sanitizeName(payload.name);
  const score = toBoundedNumber(payload.score, 0, 999999);
  const length = toBoundedNumber(payload.length, 1, 9999);
  const time = toBoundedNumber(payload.time, 0, 24 * 60 * 60 * 1000);
  const mode = sanitizeMode(payload.mode);

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

function normalizeStoredRecord(payload) {
  const record = normalizeRecord(payload);
  if (!record || !payload || typeof payload !== "object") return record;

  return {
    ...record,
    id: typeof payload.id === "string" ? payload.id : record.id,
    createdAt: typeof payload.createdAt === "string" ? payload.createdAt : record.createdAt,
  };
}

function normalizeBoards(payload) {
  const boards = createEmptyBoards();
  const append = (value) => {
    const record = normalizeStoredRecord(value);
    if (!record || isInternalTestRecord(record)) return;
    boards[record.mode].push(record);
  };

  if (Array.isArray(payload)) {
    payload.forEach(append);
  } else if (payload && typeof payload === "object") {
    MODES.forEach((mode) => {
      const records = payload[mode];
      if (Array.isArray(records)) records.forEach(append);
    });
  }

  return rankBoards(boards);
}

function createEmptyBoards() {
  return {
    classic: [],
    wrap: [],
    rush: [],
    feast: [],
  };
}

function rankBoards(boards) {
  return {
    classic: rankScores(boards.classic),
    wrap: rankScores(boards.wrap),
    rush: rankScores(boards.rush),
    feast: rankScores(boards.feast),
  };
}

function rankScores(scores) {
  return scores
    .filter(Boolean)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || Number(b.length || 0) - Number(a.length || 0) || Number(a.time || 0) - Number(b.time || 0))
    .slice(0, MAX_RECORDS);
}

function isInternalTestRecord(record) {
  return record.name === "CodexTest" && record.score === 1;
}

function sanitizeName(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, 12);
}

function sanitizeMode(value) {
  return value === "wrap" || value === "rush" || value === "feast" ? value : "classic";
}

function toBoundedNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(),
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=UTF-8",
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
