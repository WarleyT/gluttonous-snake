import type { Config, Context } from "@netlify/functions";
import { getDeployStore, getStore } from "@netlify/blobs";

const STORE_NAME = "snake-leaderboard";
const SCORE_KEY = "top-20";
const MAX_RECORDS = 20;
const MODES = ["classic", "wrap", "rush", "feast"] as const;

type LeaderboardMode = (typeof MODES)[number];

declare const Netlify: {
  context?: {
    deploy?: {
      context?: string;
    };
  };
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

export default async (req: Request, context: Context) => {
  try {
    if (req.method === "GET") {
      return json(await getScoresByMode());
    }

    if (req.method === "POST") {
      const payload = await req.json().catch(() => null);
      const record = normalizeRecord(payload);

      if (!record) {
        return json({ error: "Invalid score record" }, 400);
      }

      const scores = await getScoresByMode();
      scores[record.mode].push(record);
      const ranked = rankScoresByMode(scores);
      await getLeaderboardStore().setJSON(SCORE_KEY, ranked);

      return json(ranked, 201);
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (error) {
    console.error("Leaderboard error", error, context.requestId);
    return json({ error: "Leaderboard unavailable" }, 500);
  }
};

export const config: Config = {
  path: "/api/leaderboard",
};

function getLeaderboardStore() {
  if (Netlify.context?.deploy?.context === "production") {
    return getStore({ name: STORE_NAME, consistency: "strong" });
  }

  return getDeployStore({ name: STORE_NAME });
}

async function getScoresByMode() {
  const scores = await getLeaderboardStore().get(SCORE_KEY, { type: "json" });
  return normalizeStoredLeaderboards(scores);
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

function normalizeStoredRecord(payload: unknown): ScoreRecord | null {
  const record = normalizeRecord(payload);
  if (!record || !payload || typeof payload !== "object") return record;

  const raw = payload as Record<string, unknown>;
  return {
    ...record,
    id: typeof raw.id === "string" ? raw.id : record.id,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : record.createdAt,
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

function normalizeStoredLeaderboards(payload: unknown): LeaderboardsByMode {
  const boards = createEmptyLeaderboards();
  const appendRecord = (value: unknown) => {
    const record = normalizeStoredRecord(value);
    if (!record || isInternalTestRecord(record)) return;
    boards[record.mode].push(record);
  };

  if (Array.isArray(payload)) {
    payload.forEach(appendRecord);
  } else if (payload && typeof payload === "object") {
    const raw = payload as Partial<Record<LeaderboardMode, unknown>>;
    MODES.forEach((mode) => {
      const records = raw[mode];
      if (Array.isArray(records)) records.forEach(appendRecord);
    });
  }

  return rankScoresByMode(boards);
}

function rankScoresByMode(boards: LeaderboardsByMode): LeaderboardsByMode {
  return {
    classic: rankScores(boards.classic),
    wrap: rankScores(boards.wrap),
    rush: rankScores(boards.rush),
    feast: rankScores(boards.feast),
  };
}

function rankScores(scores: ScoreRecord[]) {
  return scores
    .sort((a, b) => b.score - a.score || b.length - a.length || a.time - b.time || a.createdAt.localeCompare(b.createdAt))
    .slice(0, MAX_RECORDS);
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
      "Cache-Control": "no-store",
    },
  });
}
