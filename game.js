const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.querySelector("#score");
const scoreLabel = document.querySelector("#scoreLabel");
const personalBestEl = document.querySelector("#personalBest");
const bestScoreEl = document.querySelector("#bestScore");
const lengthEl = document.querySelector("#length");
const speedEl = document.querySelector("#speed");
const timerEl = document.querySelector("#timer");
const overlay = document.querySelector("#overlay");
const overlayLabel = document.querySelector("#overlayLabel");
const overlayTitle = document.querySelector("#overlayTitle");
const primaryAction = document.querySelector("#primaryAction");
const scoreForm = document.querySelector("#scoreForm");
const playerNameInput = document.querySelector("#playerName");
const scoreFeedback = document.querySelector("#scoreFeedback");
const medalReward = document.querySelector("#medalReward");
const pauseBtn = document.querySelector("#pauseBtn");
const pauseIcon = document.querySelector("#pauseIcon");
const restartBtn = document.querySelector("#restartBtn");
const soundBtn = document.querySelector("#soundBtn");
const modeSelect = document.querySelector("#modeSelect");
const themeSelect = document.querySelector("#themeSelect");
const leaderboardList = document.querySelector("#leaderboardList");
const leaderboardTabs = document.querySelectorAll("[data-leaderboard-mode]");
const playArea = document.querySelector(".play-area");
const limitedThemeOption = document.querySelector("[data-limited-theme]");
let medalFxFrame = 0;

const gridSize = 22;
const cellSize = canvas.width / gridSize;
const leaderboardEndpoint = "/api/leaderboard";
const specialScoreThreshold = 200;
const defaultMode = "wrap";
const defaultModeVersion = "wrap-default-2026-05";
const normalBaseTick = 125;
const rushBaseTick = 88;
const normalMinTick = 58;
const rushMinTick = 44;
const maxDirectionQueue = 2;
const swipeThreshold = 8;
const boostHoldDelay = 160;
const boostTickFactor = 0.55;
const boostRampDuration = 520;
const speedUpStep = 1.25;
const blueAppleSlowStep = 12;
const blueAppleSlowLimit = 16;
const bonusScoreStep = 250;
const bonusDuration = 10000;
const bonusRecoverDuration = 2400;
const bonusFoodTarget = 100;
const modeIds = ["classic", "wrap", "rush", "feast"];
const modeNames = { classic: "经典", wrap: "穿墙", rush: "极速", feast: "狂吃" };
const modeReadyTitles = {
  classic: "经典模式，童年永存",
  wrap: "穿墙模式，游刃有余",
  rush: "极速模式，电光火石",
  feast: "狂吃模式，满盘开席",
};
const specialAppleTypes = ["green", "blue", "gold", "red"];
const appleColors = {
  green: "#75f58c",
  blue: "#5ab7ff",
  gold: "#ffd166",
  red: "#ff5470",
};
const valentineMessages = [
  { score: 100, text: "爱你多一点" },
  { score: 200, text: "心跳为你加速" },
  { score: 300, text: "今天也很想你" },
  { score: 400, text: "甜到满格" },
  { score: 500, text: "偏爱只给你" },
  { score: 700, text: "把温柔都给你" },
  { score: 900, text: "一万次心动" },
  { score: 1200, text: "余生都偏向你" },
];
const arcadeTracks = [
  {
    lead: [392, 0, 392, 523, 659, 0, 523, 392, 330, 0, 330, 392, 494, 0, 392, 330],
    bass: [98, 98, 131, 98],
  },
  {
    lead: [440, 554, 659, 0, 740, 659, 554, 440, 370, 0, 440, 554, 659, 740, 880, 0],
    bass: [110, 147, 110, 165],
  },
  {
    lead: [523, 659, 784, 1047, 0, 784, 659, 523, 587, 740, 880, 1175, 0, 880, 740, 587],
    bass: [131, 196, 147, 220],
  },
  {
    lead: [659, 784, 988, 1319, 1175, 988, 784, 659, 740, 880, 1109, 1480, 1319, 1109, 880, 740],
    bass: [165, 247, 196, 294],
  },
];
const directions = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

let snake;
let foods = [];
let maxFoodCount = 1;
let specialApples = [];
let nextSpecialSpawns = [];
let magnetUntil = 0;
let direction;
let nextDirection;
let directionQueue = [];
let score;
let personalBest = Number(localStorage.getItem("snakeBestScore") || 0);
let bestScore = 0;
let status = "ready";
let tickInterval = 125;
let lastTick = 0;
let startTime = 0;
let elapsedBeforePause = 0;
let particles = [];
let magnetPulls = [];
let loveNotes = [];
let nextLoveScore = 100;
let heldDirections = new Set();
let boostTimer = 0;
let boardBoostTimer = 0;
let boardBoostActive = false;
let speedBoostActive = false;
let boostStartedAt = 0;
let nextBonusScore = bonusScoreStep;
let bonusActiveUntil = 0;
let bonusFlashUntil = 0;
let bonusSavedTickInterval = 0;
let speedRecovery = null;
let muted = localStorage.getItem("snakeMuted") === "true";
let activeMode = localStorage.getItem("snakeMode") || defaultMode;
let activeTheme = getInitialTheme();
let leaderboardMode = activeMode;
let leaderboardByMode = loadLeaderboard();

if (localStorage.getItem("snakeDefaultModeVersion") !== defaultModeVersion) {
  activeMode = defaultMode;
  localStorage.setItem("snakeMode", defaultMode);
  localStorage.setItem("snakeDefaultModeVersion", defaultModeVersion);
}
if (!modeIds.includes(activeMode)) activeMode = defaultMode;
leaderboardMode = activeMode;

const audio = {
  context: null,
  musicTimer: null,
  musicStep: 0,
  ensure() {
    const BrowserAudioContext = window.AudioContext || window.webkitAudioContext;
    this.context ||= new BrowserAudioContext();
    if (this.context.state === "suspended") this.context.resume();
    return this.context;
  },
  tone(frequency, duration, gainValue, type = "sine", delay = 0) {
    if (muted) return;
    const context = this.ensure();
    const now = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.type = type;
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.start(now);
    oscillator.stop(now + duration);
  },
  play(type) {
    if (muted) return;
    const patterns = {
      key: [
        [260, 0.035, 0.018, "triangle", 0],
      ],
      eat: [
        [620, 0.05, 0.045, "sine", 0],
        [880, 0.06, 0.035, "sine", 0.045],
      ],
      bubble: [
        [820, 0.045, 0.035, "sine", 0],
        [1180, 0.05, 0.027, "triangle", 0.035],
        [1560, 0.06, 0.018, "sine", 0.075],
      ],
      power: [
        [440, 0.07, 0.05, "triangle", 0],
        [660, 0.07, 0.045, "triangle", 0.055],
        [990, 0.08, 0.04, "triangle", 0.11],
      ],
      fail: [
        [150, 0.12, 0.06, "sawtooth", 0],
        [95, 0.18, 0.045, "sawtooth", 0.08],
      ],
      start: [
        [360, 0.07, 0.04, "sine", 0],
        [540, 0.08, 0.035, "sine", 0.07],
      ],
    }[type];

    patterns?.forEach(([frequency, duration, gainValue, toneType, delay]) => {
      this.tone(frequency, duration, gainValue, toneType, delay);
    });
  },
  startMusic() {
    if (muted || this.musicTimer) return;
    this.musicStep = 0;
    this.scheduleMusic();
  },
  scheduleMusic() {
    if (muted || status !== "playing") {
      this.stopMusic();
      return;
    }

    const trackIndex = Math.floor(score / 100) % arcadeTracks.length;
    const track = arcadeTracks[trackIndex];
    const leadNote = track.lead[this.musicStep % track.lead.length];
    const bassNote = track.bass[Math.floor(this.musicStep / 4) % track.bass.length];

    if (leadNote) this.tone(leadNote, 0.055, 0.017, "square");
    if (this.musicStep % 4 === 0) this.tone(bassNote, 0.075, 0.018, "triangle");
    if (this.musicStep % 8 === 6) this.tone(1320 + trackIndex * 90, 0.025, 0.008, "sawtooth");

    this.musicStep += 1;
    const speedRatio = getBaseTickInterval() / getEffectiveTickInterval();
    const beat = Math.max(68, Math.min(260, 205 / Math.max(0.72, speedRatio)));
    this.musicTimer = setTimeout(() => {
      this.musicTimer = null;
      this.scheduleMusic();
    }, beat);
  },
  stopMusic() {
    if (this.musicTimer) clearTimeout(this.musicTimer);
    this.musicTimer = null;
  },
  resyncTempo() {
    if (muted || status !== "playing" || !this.musicTimer) return;
    clearTimeout(this.musicTimer);
    this.musicTimer = null;
    this.scheduleMusic();
  },
};

function getBaseTickInterval() {
  return activeMode === "rush" ? rushBaseTick : normalBaseTick;
}

function getMinTickInterval() {
  return activeMode === "rush" ? rushMinTick : normalMinTick;
}

function getInitialFoodCount() {
  return activeMode === "feast" ? 5 : 1;
}

function getSpecialAppleSlotCount() {
  return activeMode === "feast" ? 2 : 1;
}

function getSpecialAppleThreshold() {
  return activeMode === "feast" ? 0 : specialScoreThreshold;
}

function getSpecialAppleDelay() {
  const base = 7000 + Math.random() * 5500;
  return activeMode === "feast" ? base / 3 : base;
}

function getSpeedUpStep() {
  return activeMode === "feast" ? speedUpStep / 3 : speedUpStep;
}

function getGoldFoodBonus() {
  return activeMode === "feast" ? 3 : 1;
}

function getRedAppleDuration(remainingSeconds) {
  return activeMode === "feast" ? remainingSeconds * 1.8 : remainingSeconds;
}

function getEffectiveTickInterval() {
  const baseTick = isBonusActive() ? getBaseTickInterval() : tickInterval;
  if (!speedBoostActive || status !== "playing" || isBonusActive()) return baseTick;
  return Math.max(getMinTickInterval(), baseTick * getBoostTickFactor());
}

function getBoostTickFactor() {
  if (!boostStartedAt) return boostTickFactor;
  const progress = Math.min(1, Math.max(0, (performance.now() - boostStartedAt) / boostRampDuration));
  const eased = 1 - Math.pow(1 - progress, 3);
  return 1 - (1 - boostTickFactor) * eased;
}

function canWrapEdges() {
  return activeMode === "wrap" || activeMode === "feast";
}

function getReadyTitle() {
  return modeReadyTitles[activeMode] || modeReadyTitles.classic;
}

function showReadyOverlay() {
  showOverlay("准备开始", getReadyTitle(), "开始游戏", false);
}

function isValentineWindow(date = new Date()) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return day === 14 || (month === 5 && (day === 20 || day === 21));
}

function getInitialTheme() {
  const storedTheme = localStorage.getItem("snakeTheme");
  if (isValentineWindow()) return "valentine";
  return storedTheme || "neon";
}

function isValentineTheme() {
  return activeTheme === "valentine";
}

function isBonusActive(now = performance.now()) {
  return bonusActiveUntil > now;
}

function resetGame() {
  const center = Math.floor(gridSize / 2);
  snake = [
    { x: center + 1, y: center },
    { x: center, y: center },
    { x: center - 1, y: center },
  ];
  direction = directions.right;
  nextDirection = directions.right;
  directionQueue = [];
  score = 0;
  tickInterval = getBaseTickInterval();
  foods = [];
  maxFoodCount = getInitialFoodCount();
  specialApples = [];
  nextSpecialSpawns = Array.from({ length: getSpecialAppleSlotCount() }, (_, slot) => {
    return performance.now() + (activeMode === "feast" ? slot * 700 : 5000);
  });
  magnetUntil = 0;
  ensureFoodCount();
  particles = [];
  magnetPulls = [];
  loveNotes = [];
  nextLoveScore = 100;
  heldDirections.clear();
  clearBoostTimers();
  speedBoostActive = false;
  boostStartedAt = 0;
  nextBonusScore = bonusScoreStep;
  bonusActiveUntil = 0;
  bonusFlashUntil = 0;
  bonusSavedTickInterval = 0;
  speedRecovery = null;
  elapsedBeforePause = 0;
  startTime = performance.now();
  updateHud();
}

function startGame() {
  resetGame();
  status = "playing";
  lastTick = performance.now();
  hideOverlay();
  audio.stopMusic();
  audio.play("start");
  audio.startMusic();
}

function pauseGame() {
  if (status !== "playing") return;
  status = "paused";
  clearBoostTimers();
  speedBoostActive = false;
  boostStartedAt = 0;
  elapsedBeforePause += performance.now() - startTime;
  audio.stopMusic();
  showOverlay("已暂停", "休息一下，节奏还在", "继续游戏", false);
  updateHud();
}

function resumeGame() {
  if (status !== "paused") return;
  status = "playing";
  startTime = performance.now();
  lastTick = performance.now();
  hideOverlay();
  audio.startMusic();
  updateHud();
}

function endGame() {
  if (status === "playing") {
    elapsedBeforePause += performance.now() - startTime;
  }
  status = "gameover";
  clearBoostTimers();
  speedBoostActive = false;
  boostStartedAt = 0;
  audio.stopMusic();
  personalBest = Math.max(personalBest, score);
  localStorage.setItem("snakeBestScore", String(personalBest));
  document.body.classList.add("is-hit");
  setTimeout(() => document.body.classList.remove("is-hit"), 260);
  audio.play("fail");
  showOverlay("游戏结束", `得分 ${score} · 长度 ${snake.length} · ${formatTime(getElapsedMs())}`, "再来一局", true);
  updateHud();
}

function createFood() {
  const cells = getAvailableCells();
  if (!cells.length) return null;
  return cells[Math.floor(Math.random() * cells.length)];
}

function ensureFoodCount() {
  while (foods.length < maxFoodCount) {
    const food = createFood();
    if (!food) break;
    foods.push(food);
  }
}

function isOccupied(position) {
  return (
    snake.some((part) => part.x === position.x && part.y === position.y) ||
    foods.some((bean) => bean.x === position.x && bean.y === position.y) ||
    specialApples.some((apple) => apple.x === position.x && apple.y === position.y)
  );
}

function getAvailableCells() {
  const occupied = new Set([
    ...snake.map((part) => `${part.x},${part.y}`),
    ...foods.map((bean) => `${bean.x},${bean.y}`),
    ...specialApples.map((apple) => `${apple.x},${apple.y}`),
  ]);
  const cells = [];
  for (let y = 0; y < gridSize; y += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      if (!occupied.has(`${x},${y}`)) cells.push({ x, y });
    }
  }
  return cells;
}

function setDirection(name) {
  const candidate = directions[name];
  if (!candidate || status === "gameover") return;
  audio.play("key");
  if (status === "ready") startGame();
  queueDirection(candidate);
}

function handleDirectionPress(name) {
  const candidate = directions[name];
  if (!candidate) return;
  setDirection(name);
  startDirectionBoost(name);
}

function queueDirection(candidate) {
  const reference = directionQueue.at(-1) || nextDirection || direction;
  const duplicate = candidate.x === reference.x && candidate.y === reference.y;
  const reversing = candidate.x + reference.x === 0 && candidate.y + reference.y === 0;
  if (duplicate || reversing) return;

  directionQueue.push(candidate);
  directionQueue = directionQueue.slice(-maxDirectionQueue);
  nextDirection = candidate;
}

function startDirectionBoost(name) {
  stopBoardBoost(false);
  clearTimeout(boostTimer);
  boostTimer = setTimeout(() => {
    const candidate = directions[name];
    const reference = directionQueue.at(-1) || nextDirection || direction;
    if (status === "playing" && candidate && candidate.x === reference.x && candidate.y === reference.y) {
      speedBoostActive = true;
      boostStartedAt = performance.now();
    }
  }, boostHoldDelay);
}

function stopDirectionBoost() {
  clearTimeout(boostTimer);
  boostTimer = 0;
  speedBoostActive = boardBoostActive;
  if (!speedBoostActive) boostStartedAt = 0;
}

function startBoardBoost() {
  clearTimeout(boardBoostTimer);
  boardBoostTimer = setTimeout(() => {
    if (status === "playing") {
      boardBoostActive = true;
      speedBoostActive = true;
      boostStartedAt = performance.now();
    }
  }, boostHoldDelay);
}

function stopBoardBoost(updateSpeed = true) {
  clearTimeout(boardBoostTimer);
  boardBoostTimer = 0;
  boardBoostActive = false;
  if (updateSpeed) {
    speedBoostActive = false;
    boostStartedAt = 0;
  }
}

function clearBoostTimers() {
  clearTimeout(boostTimer);
  clearTimeout(boardBoostTimer);
  boostTimer = 0;
  boardBoostTimer = 0;
  boardBoostActive = false;
  boostStartedAt = 0;
}

function updateGame() {
  updateSpeedRecovery();
  updateBonusRound();
  updateSpecialApple();
  direction = consumeDirection();
  const head = snake[0];
  let nextHead = {
    x: head.x + direction.x,
    y: head.y + direction.y,
  };

  if (canWrapEdges()) {
    nextHead = {
      x: (nextHead.x + gridSize) % gridSize,
      y: (nextHead.y + gridSize) % gridSize,
    };
  } else if (isOutOfBounds(nextHead)) {
    endGame();
    return;
  }

  let eatenFoodIndexes = getEatenFoodIndexes(nextHead);
  const willEat = eatenFoodIndexes.length > 0;
  const bodyToCheck = willEat ? snake : snake.slice(0, -1);
  const hitSelf = bodyToCheck.some((part) => part.x === nextHead.x && part.y === nextHead.y);
  if (hitSelf) {
    endGame();
    return;
  }

  snake.unshift(nextHead);
  let pendingTrim = 0;
  const eatenAppleIndexes = getEatenAppleIndexes(nextHead);
  if (eatenAppleIndexes.length) {
    const eatenApples = removeSpecialApples(eatenAppleIndexes);
    eatenApples.forEach((apple) => {
      if (isMagnetHit(apple, nextHead) && (apple.x !== nextHead.x || apple.y !== nextHead.y)) addMagnetPull(apple, nextHead, getAppleRenderColor(apple.type), "apple");
      pendingTrim += applySpecialApple(apple);
      nextSpecialSpawns[apple.slot] = performance.now() + getSpecialAppleDelay();
    });
  }

  if (isMagnetActive()) {
    const pulledAppleIndexes = getEatenAppleIndexes(nextHead);
    const pulledApples = removeSpecialApples(pulledAppleIndexes);
    pulledApples.forEach((apple) => {
      if (apple.x !== nextHead.x || apple.y !== nextHead.y) addMagnetPull(apple, nextHead, getAppleRenderColor(apple.type), "apple");
      pendingTrim += applySpecialApple(apple);
      nextSpecialSpawns[apple.slot] = performance.now() + getSpecialAppleDelay();
    });
    eatenFoodIndexes = getEatenFoodIndexes(nextHead);
  }

  if (eatenFoodIndexes.length) {
    const eatenFoods = removeFoods(eatenFoodIndexes);
    const bonusActive = isBonusActive();
    const normalFoodScore = activeMode === "rush" ? 15 : 10;
    score += eatenFoods.reduce((total) => total + (bonusActive ? 2 : normalFoodScore), 0);
    if (!bonusActive) tickInterval = Math.max(getMinTickInterval(), tickInterval - getSpeedUpStep() * eatenFoods.length);
    eatenFoods.forEach((bean) => {
      if (isMagnetHit(bean, nextHead) && (bean.x !== nextHead.x || bean.y !== nextHead.y)) addMagnetPull(bean, nextHead, getCssValue("--food"), "food");
      burst(bean.x, bean.y);
    });
    if (bonusActive) {
      snake.pop();
    } else {
      for (let i = 1; i < eatenFoods.length; i += 1) {
        snake.push({ ...snake[snake.length - 1] });
      }
    }
    audio.play(isValentineTheme() ? "bubble" : "eat");
    maybeShowLoveNote();
    maybeStartBonusRound();
  } else {
    snake.pop();
  }

  if (pendingTrim) trimSnake(pendingTrim);
  ensureFoodCount();
  updateHud();
}

function getEatenFoodIndexes(head) {
  return foods
    .map((bean, index) => ({ bean, index }))
    .filter(({ bean }) => {
      const exactHit = bean.x === head.x && bean.y === head.y;
      const magnetHit = isMagnetHit(bean, head);
      return exactHit || magnetHit;
    })
    .map(({ index }) => index);
}

function getEatenAppleIndexes(head) {
  return specialApples
    .map((apple, index) => ({ apple, index }))
    .filter(({ apple }) => {
      const exactHit = apple.x === head.x && apple.y === head.y;
      const magnetHit = isMagnetHit(apple, head);
      return exactHit || magnetHit;
    })
    .map(({ index }) => index);
}

function isMagnetHit(target, head) {
  if (magnetUntil <= performance.now()) return false;
  return Math.abs(target.x - head.x) <= 2 && Math.abs(target.y - head.y) <= 2;
}

function removeFoods(indexes) {
  const indexSet = new Set(indexes);
  const removed = foods.filter((_, index) => indexSet.has(index));
  foods = foods.filter((_, index) => !indexSet.has(index));
  return removed;
}

function removeSpecialApples(indexes) {
  const indexSet = new Set(indexes);
  const removed = specialApples.filter((_, index) => indexSet.has(index));
  specialApples = specialApples.filter((_, index) => !indexSet.has(index));
  return removed;
}

function maybeStartBonusRound() {
  if (activeMode === "feast") return;
  while (score >= nextBonusScore) {
    if (isBonusActive()) extendBonusRound();
    else startBonusRound();
    nextBonusScore += bonusScoreStep;
  }
}

function startBonusRound() {
  const now = performance.now();
  bonusSavedTickInterval = tickInterval;
  tickInterval = getBaseTickInterval();
  speedRecovery = null;
  bonusActiveUntil = now + bonusDuration;
  bonusFlashUntil = now + 1600;
  foods = foods.filter((bean) => !bean.bonus);
  addBonusPatternFoods();
}

function extendBonusRound() {
  bonusActiveUntil += bonusDuration;
  bonusFlashUntil = performance.now() + 1200;
  addBonusPatternFoods();
}

function updateBonusRound() {
  const now = performance.now();
  if (bonusActiveUntil && bonusActiveUntil <= now) endBonusRound();
}

function endBonusRound() {
  const now = performance.now();
  bonusActiveUntil = 0;
  foods = foods.filter((bean) => !bean.bonus);
  speedRecovery = {
    from: getBaseTickInterval(),
    to: bonusSavedTickInterval || tickInterval,
    startedAt: now,
    endsAt: now + bonusRecoverDuration,
  };
  tickInterval = getBaseTickInterval();
  bonusSavedTickInterval = 0;
  ensureFoodCount();
}

function updateSpeedRecovery() {
  if (!speedRecovery) return;
  const now = performance.now();
  const progress = Math.min(1, Math.max(0, (now - speedRecovery.startedAt) / (speedRecovery.endsAt - speedRecovery.startedAt)));
  const eased = 1 - Math.pow(1 - progress, 3);
  tickInterval = speedRecovery.from + (speedRecovery.to - speedRecovery.from) * eased;
  if (progress >= 1) {
    tickInterval = speedRecovery.to;
    speedRecovery = null;
  }
}

function addBonusPatternFoods() {
  const occupied = new Set([
    ...snake.map((part) => `${part.x},${part.y}`),
    ...foods.map((bean) => `${bean.x},${bean.y}`),
    ...specialApples.map((apple) => `${apple.x},${apple.y}`),
  ]);
  const pattern = getBonusPatternCells().filter((cell) => !occupied.has(`${cell.x},${cell.y}`));
  shuffle(pattern);
  const cells = pattern.slice(0, bonusFoodTarget);
  const allCells = getAvailableCells();
  shuffle(allCells);
  for (const cell of allCells) {
    if (cells.length >= bonusFoodTarget) break;
    if (!cells.some((item) => item.x === cell.x && item.y === cell.y)) cells.push(cell);
  }
  foods.push(...cells.map((cell) => ({ ...cell, bonus: true })));
}

function getBonusPatternCells() {
  const type = ["heart", "diamond", "spiral", "star"][Math.floor(Math.random() * 4)];
  const cells = [];
  const center = (gridSize - 1) / 2;
  for (let y = 1; y < gridSize - 1; y += 1) {
    for (let x = 1; x < gridSize - 1; x += 1) {
      const dx = x - center;
      const dy = y - center;
      const nx = dx / 9;
      const ny = dy / 9;
      const distance = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const inShape = {
        heart: Math.pow(nx * nx + ny * ny - 0.62, 3) - nx * nx * ny * ny * ny <= 0,
        diamond: Math.abs(dx) + Math.abs(dy) <= 11 || (Math.abs(dx) + Math.abs(dy)) % 3 === 0,
        spiral: Math.abs(((angle + distance * 0.55) % (Math.PI * 0.72))) < 0.18 || distance < 3,
        star: Math.abs(Math.sin(angle * 5)) * 9 + distance < 13,
      }[type];
      if (inShape) cells.push({ x, y });
    }
  }
  return cells;
}

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function updateSpecialApple() {
  const now = performance.now();
  const expiredSlots = [];
  specialApples = specialApples.filter((apple) => {
    if (apple.expiresAt > now) return true;
    expiredSlots.push(apple.slot);
    return false;
  });
  expiredSlots.forEach((slot) => {
    nextSpecialSpawns[slot] = now + getSpecialAppleDelay();
  });

  const slotCount = getSpecialAppleSlotCount();
  while (nextSpecialSpawns.length < slotCount) nextSpecialSpawns.push(now + getSpecialAppleDelay());
  if (nextSpecialSpawns.length > slotCount) nextSpecialSpawns = nextSpecialSpawns.slice(0, slotCount);

  for (let slot = 0; slot < slotCount; slot += 1) {
    const hasApple = specialApples.some((apple) => apple.slot === slot);
    if (hasApple || score < getSpecialAppleThreshold() || now < nextSpecialSpawns[slot]) continue;
    const position = createFood();
    if (!position) {
      nextSpecialSpawns[slot] = now + 1000;
      continue;
    }
    specialApples.push({
      ...position,
      slot,
      type: specialAppleTypes[Math.floor(Math.random() * specialAppleTypes.length)],
      expiresAt: now + 6500 + Math.random() * 5500,
    });
  }
}

function applySpecialApple(apple) {
  const remainingSeconds = Math.max(1, Math.ceil((apple.expiresAt - performance.now()) / 1000));
  audio.play("power");
  burst(apple.x, apple.y);

  if (apple.type === "green") {
    return remainingSeconds;
  }

  if (apple.type === "blue") {
    tickInterval = Math.min(getBaseTickInterval() + blueAppleSlowLimit, tickInterval + blueAppleSlowStep);
    audio.resyncTempo();
  }

  if (apple.type === "gold") {
    maxFoodCount = Math.min(gridSize * gridSize, maxFoodCount + getGoldFoodBonus());
  }

  if (apple.type === "red") {
    magnetUntil = performance.now() + getRedAppleDuration(remainingSeconds) * 1000;
  }

  return 0;
}

function trimSnake(amount) {
  const trim = Math.min(amount, Math.max(0, snake.length - 3));
  if (trim > 0) snake.splice(-trim, trim);
}

function consumeDirection() {
  while (directionQueue.length) {
    const candidate = directionQueue.shift();
    const reversing = candidate.x + direction.x === 0 && candidate.y + direction.y === 0;
    if (!reversing) return candidate;
  }

  return direction;
}

function isOutOfBounds(position) {
  return position.x < 0 || position.x >= gridSize || position.y < 0 || position.y >= gridSize;
}

function burst(x, y) {
  for (let i = 0; i < 12; i += 1) {
    particles.push({
      x: (x + 0.5) * cellSize,
      y: (y + 0.5) * cellSize,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 6,
      life: 1,
    });
  }
}

function addMagnetPull(item, head, color, kind) {
  magnetPulls.push({
    fromX: (item.x + 0.5) * cellSize,
    fromY: (item.y + 0.5) * cellSize,
    toX: (head.x + 0.5) * cellSize,
    toY: (head.y + 0.5) * cellSize,
    color,
    kind,
    age: 0,
    duration: 14,
  });
}

function maybeShowLoveNote() {
  if (!isValentineTheme()) return;
  while (score >= nextLoveScore) {
    const message = getLoveMessage(nextLoveScore);
    loveNotes.push({
      text: message,
      x: canvas.width * (0.22 + Math.random() * 0.56),
      y: canvas.height * (0.24 + Math.random() * 0.42),
      vy: -0.38 - Math.random() * 0.28,
      age: 0,
      duration: 150,
    });
    nextLoveScore += 100;
  }
}

function getLoveMessage(scoreMark) {
  return valentineMessages
    .filter((message) => scoreMark >= message.score)
    .at(-1)?.text || valentineMessages[0].text;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBoard();
  drawFoods();
  drawSpecialApple();
  drawSnake();
  drawMagnetPulse();
  drawMagnetPulls();
  drawBonusOverlay();
  drawParticles();
  drawLoveNotes();
}

function drawBoard() {
  ctx.fillStyle = getCssValue("--surface");
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = getCssValue("--grid");
  ctx.lineWidth = 1;

  for (let i = 1; i < gridSize; i += 1) {
    const position = i * cellSize;
    ctx.beginPath();
    ctx.moveTo(position, 0);
    ctx.lineTo(position, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, position);
    ctx.lineTo(canvas.width, position);
    ctx.stroke();
  }
}

function drawSnake() {
  snake.forEach((part, index) => {
    const inset = index === 0 ? 4 : 6;
    const x = part.x * cellSize + inset;
    const y = part.y * cellSize + inset;
    const size = cellSize - inset * 2;

    ctx.fillStyle = index === 0 ? getCssValue("--snake-head") : getCssValue("--snake");
    roundedRect(x, y, size, size, index === 0 ? 10 : 8);
    ctx.fill();

    if (index === 0) drawEyes(part);
  });
}

function drawEyes(head) {
  const centerX = (head.x + 0.5) * cellSize;
  const centerY = (head.y + 0.5) * cellSize;
  const offsetX = direction.x * 5;
  const offsetY = direction.y * 5;
  const sideX = direction.y * 5;
  const sideY = -direction.x * 5;

  ctx.fillStyle = "#07110d";
  ctx.beginPath();
  ctx.arc(centerX + offsetX + sideX, centerY + offsetY + sideY, 2.7, 0, Math.PI * 2);
  ctx.arc(centerX + offsetX - sideX, centerY + offsetY - sideY, 2.7, 0, Math.PI * 2);
  ctx.fill();
}

function drawMagnetField() {
  if (!isMagnetActive()) return;
  const head = snake[0];
  const pulse = 0.5 + Math.sin(performance.now() / 95) * 0.25;

  ctx.save();
  ctx.strokeStyle = `rgba(255, 84, 112, ${0.32 + pulse * 0.18})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 6]);

  for (let y = head.y - 2; y <= head.y + 2; y += 1) {
    for (let x = head.x - 2; x <= head.x + 2; x += 1) {
      if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) continue;
      const inset = 4;
      roundedRect(x * cellSize + inset, y * cellSize + inset, cellSize - inset * 2, cellSize - inset * 2, 8);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawMagnetPulse() {
  if (!isMagnetActive()) return;
  const head = snake[0];
  const x = (head.x + 0.5) * cellSize;
  const y = (head.y + 0.5) * cellSize;
  const wave = Math.sin(performance.now() / 130);

  ctx.save();
  ctx.strokeStyle = "rgba(255, 84, 112, 0.72)";
  ctx.fillStyle = "rgba(255, 84, 112, 0.14)";
  ctx.lineWidth = 3;
  ctx.shadowColor = appleColors.red;
  ctx.shadowBlur = 18;

  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.arc(x, y, cellSize * (0.8 + i * 0.34) + wave * 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(x, y, cellSize * 1.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMagnetPulls() {
  if (!magnetPulls.length) return;
  magnetPulls = magnetPulls.filter((pull) => pull.age < pull.duration);
  ctx.save();
  for (const pull of magnetPulls) {
    pull.age += 1;
    const progress = Math.min(1, pull.age / pull.duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const x = pull.fromX + (pull.toX - pull.fromX) * eased;
    const y = pull.fromY + (pull.toY - pull.fromY) * eased;
    const size = pull.kind === "apple" ? 12 * (1 - progress * 0.35) : 8 * (1 - progress * 0.28);
    ctx.globalAlpha = Math.max(0, 1 - progress * 0.15);
    ctx.shadowColor = pull.color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = pull.color;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(3, size), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawBonusOverlay() {
  const now = performance.now();
  if (bonusFlashUntil > now) {
    const progress = 1 - (bonusFlashUntil - now) / 1600;
    const alpha = Math.max(0, Math.min(0.72, 1 - progress));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 30px sans-serif";
    ctx.fillStyle = "rgba(255, 235, 246, 0.92)";
    ctx.shadowColor = "rgba(255, 154, 197, 0.85)";
    ctx.shadowBlur = 16;
    ctx.fillText("奖励关卡", canvas.width / 2, cellSize * 2.2);
    ctx.restore();
  }

  if (isBonusActive(now)) {
    const seconds = Math.max(0, Math.ceil((bonusActiveUntil - now) / 1000));
    ctx.save();
    ctx.globalAlpha = 0.24;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 118px sans-serif";
    ctx.fillStyle = "rgba(255, 235, 246, 0.72)";
    ctx.fillText(String(seconds), canvas.width / 2, canvas.height / 2);
    ctx.restore();
  }
}

function isMagnetActive() {
  return magnetUntil > performance.now() && snake?.length;
}

function drawFoods() {
  const pulse = Math.sin(performance.now() / 150) * 2;

  foods.forEach((bean) => {
    const x = (bean.x + 0.5) * cellSize;
    const y = (bean.y + 0.5) * cellSize;
    ctx.shadowColor = getCssValue("--food");
    ctx.shadowBlur = 18;
    ctx.fillStyle = getCssValue("--food");
    if (isValentineTheme()) {
      drawHeart(x, y, 20 + pulse * 0.6, getCssValue("--food"));
    } else {
      ctx.beginPath();
      ctx.arc(x, y, 9 + pulse, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  });
}

function drawSpecialApple() {
  specialApples.forEach((apple) => {
    const x = (apple.x + 0.5) * cellSize;
    const y = (apple.y + 0.5) * cellSize;
    const remaining = Math.max(0, Math.ceil((apple.expiresAt - performance.now()) / 1000));
    const pulse = Math.sin(performance.now() / 120 + apple.slot) * 2.5;

    const appleColor = getAppleRenderColor(apple.type);
    ctx.shadowColor = appleColor;
    ctx.shadowBlur = 22;
    ctx.fillStyle = appleColor;
    if (isValentineTheme()) {
      drawRose(x, y, 12 + pulse * 0.35, appleColor);
    } else {
      ctx.beginPath();
      ctx.arc(x, y, 12 + pulse, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#07110d";
    ctx.font = "900 12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(remaining), x, y + 0.5);
  });
}

function drawHeart(x, y, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.bezierCurveTo(-15, -4, -7, -17, 0, -7);
  ctx.bezierCurveTo(7, -17, 15, -4, 0, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawRose(x, y, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "rgba(93, 50, 58, 0.58)";
  ctx.lineWidth = 1.6;
  ctx.fillStyle = color;
  for (let i = 0; i < 6; i += 1) {
    ctx.save();
    ctx.rotate((Math.PI * 2 * i) / 6);
    ctx.beginPath();
    ctx.ellipse(0, -size * 0.35, size * 0.34, size * 0.56, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = "rgba(255, 255, 255, 0.32)";
  ctx.beginPath();
  ctx.arc(-size * 0.12, -size * 0.12, size * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.36, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function getRoseColor(type) {
  return {
    green: "#ff8abd",
    blue: "#d595ff",
    gold: "#ffc75f",
    red: "#ff5d88",
  }[type] || "#ff7aa8";
}

function getAppleRenderColor(type) {
  return isValentineTheme() ? getRoseColor(type) : appleColors[type];
}

function drawParticles() {
  particles = particles.filter((particle) => particle.life > 0);
  for (const particle of particles) {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.life -= 0.035;
    ctx.globalAlpha = Math.max(particle.life, 0);
    ctx.fillStyle = getCssValue("--accent");
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawLoveNotes() {
  if (!loveNotes.length) return;
  loveNotes = loveNotes.filter((note) => note.age < note.duration);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 22px sans-serif";
  for (const note of loveNotes) {
    note.age += 1;
    note.y += note.vy;
    const progress = note.age / note.duration;
    const fadeIn = Math.min(1, progress / 0.14);
    const fadeOut = Math.min(1, (1 - progress) / 0.28);
    const alpha = Math.max(0, Math.min(0.72, fadeIn * fadeOut * 0.72));
    if (alpha <= 0.01) continue;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(255, 128, 178, 0.18)";
    roundedRect(note.x - 92, note.y - 24, 184, 48, 24);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 235, 246, 0.92)";
    ctx.shadowColor = "rgba(255, 92, 148, 0.75)";
    ctx.shadowBlur = 14;
    ctx.fillText(note.text, note.x, note.y);
    ctx.shadowBlur = 0;
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function roundedRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function loop(timestamp) {
  updateSpeedRecovery();
  const effectiveTick = getEffectiveTickInterval();
  if (status === "playing" && timestamp - lastTick >= effectiveTick) {
    updateGame();
    lastTick = timestamp;
  }
  draw();
  if (status === "playing") updateHud();
  requestAnimationFrame(loop);
}

function updateHud() {
  scoreEl.textContent = score;
  personalBestEl.textContent = personalBest;
  bestScoreEl.textContent = bestScore;
  lengthEl.textContent = snake.length;
  speedEl.textContent = `${(getBaseTickInterval() / getEffectiveTickInterval()).toFixed(1)}x`;
  timerEl.textContent = formatTime(getElapsedMs());
  pauseIcon.textContent = status === "paused" ? "▶" : "Ⅱ";
  soundBtn.classList.toggle("is-muted", muted);
}

function getElapsedMs() {
  if (status === "playing") return elapsedBeforePause + performance.now() - startTime;
  return elapsedBeforePause;
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function showOverlay(label, title, action, allowScoreEntry = false) {
  overlayLabel.textContent = label;
  overlayTitle.textContent = title;
  primaryAction.textContent = action;
  scoreForm.classList.toggle("is-visible", allowScoreEntry);
  scoreFeedback.classList.remove("is-visible");
  scoreFeedback.textContent = "";
  hideMedalReward();
  if (allowScoreEntry) {
    playerNameInput.value = localStorage.getItem("snakePlayerName") || "";
    playerNameInput.disabled = false;
    const submitButton = scoreForm.querySelector("button");
    submitButton.disabled = false;
    submitButton.textContent = "录入分数";
  }
  overlay.classList.add("is-visible");
}

function hideOverlay() {
  overlay.classList.remove("is-visible");
}

function hideMedalReward() {
  if (medalFxFrame) {
    cancelAnimationFrame(medalFxFrame);
    medalFxFrame = 0;
  }
  medalReward.classList.remove("is-visible");
  medalReward.innerHTML = "";
}

function startMedalSpotlightFx() {
  if (medalFxFrame) {
    cancelAnimationFrame(medalFxFrame);
    medalFxFrame = 0;
  }
  const fxCanvas = medalReward.querySelector(".medal-fx");
  if (!fxCanvas) return;
  const fx = fxCanvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const start = performance.now();

  function render(now) {
    if (!medalReward.classList.contains("is-visible")) return;
    const rect = medalReward.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);
    if (fxCanvas.width !== pixelWidth || fxCanvas.height !== pixelHeight) {
      fxCanvas.width = pixelWidth;
      fxCanvas.height = pixelHeight;
    }
    fx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawMedalSpotlight(fx, width, height, (now - start) / 1000, reduceMotion);
    medalFxFrame = reduceMotion ? 0 : requestAnimationFrame(render);
  }

  medalFxFrame = requestAnimationFrame(render);
}

function medalEaseOutCubic(value) {
  const x = Math.min(1, Math.max(0, value));
  return 1 - Math.pow(1 - x, 3);
}

function drawMedalSpotlight(fx, width, height, seconds, reduceMotion) {
  fx.clearRect(0, 0, width, height);
  const cx = width / 2;
  const cy = height / 2 - Math.min(68, height * 0.08);
  const open = reduceMotion ? 1 : medalEaseOutCubic((seconds - 0.08) / 0.95);
  const pulse = reduceMotion ? 1 : 0.86 + Math.sin(seconds * 4.8) * 0.08;
  const strength = open * pulse;
  const maxLen = Math.max(width, height) * 0.72;

  fx.save();
  fx.globalCompositeOperation = "screen";
  for (let i = 0; i < 19; i += 1) {
    const middle = Math.abs(i - 9) / 10;
    const angle = (-158 + i * 8.4 + Math.sin(seconds * 0.9 + i) * 1.8) * (Math.PI / 180);
    const spread = (4.2 + (i % 3) * 1.7) * (Math.PI / 180);
    const length = maxLen * (0.54 + ((i * 37) % 36) / 100);
    const alpha = Math.max(0, (0.2 - middle * 0.11) * strength);
    if (alpha <= 0) continue;
    fx.beginPath();
    fx.moveTo(cx, cy + 8);
    fx.lineTo(cx + Math.cos(angle - spread) * length, cy + Math.sin(angle - spread) * length);
    fx.lineTo(cx + Math.cos(angle + spread) * length, cy + Math.sin(angle + spread) * length);
    fx.closePath();
    fx.fillStyle = `rgba(255, 198, 66, ${alpha})`;
    fx.fill();
  }

  for (let i = 0; i < 3; i += 1) {
    const radius = Math.min(width, height) * (0.16 + i * 0.11);
    const glow = fx.createRadialGradient(cx, cy, radius * 0.1, cx, cy, radius);
    glow.addColorStop(0, `rgba(255, 203, 80, ${0.12 * strength})`);
    glow.addColorStop(1, "rgba(255, 203, 80, 0)");
    fx.fillStyle = glow;
    fx.beginPath();
    fx.ellipse(cx, cy, radius * 1.22, radius * 0.58, 0, 0, Math.PI * 2);
    fx.fill();
  }

  for (let i = 0; i < 95; i += 1) {
    const seed = i * 97;
    const baseX = width * 0.16 + ((seed * 37) % Math.max(220, width * 0.68));
    const baseY = height * 0.19 + ((seed * 53) % Math.max(160, height * 0.38));
    const phase = (seed % 100) / 100;
    const appear = reduceMotion ? 1 : medalEaseOutCubic((seconds - 0.22 - phase * 0.75) / 1.1);
    const fade = seconds > 3.8 ? Math.max(0, 1 - (seconds - 3.8) / 0.85) : 1;
    const alpha = appear * fade * (0.42 + Math.sin(seconds * 5.4 + i) * 0.16);
    if (alpha <= 0.02) continue;
    const x = baseX + Math.sin(seconds * 1.5 + phase * 8) * 28;
    const y = baseY + Math.sin(seconds * 1.1 + phase * 7) * 10 - seconds * (4 + (i % 4));
    const size = 1.1 + (seed % 7) * 0.35;
    fx.strokeStyle = `rgba(255, 214, 82, ${Math.min(0.92, alpha)})`;
    fx.fillStyle = `rgba(255, 214, 82, ${Math.min(0.9, alpha)})`;
    if (i % 11 === 0) {
      fx.lineWidth = 1.4;
      fx.beginPath();
      fx.moveTo(x - size * 2.4, y);
      fx.lineTo(x + size * 2.4, y);
      fx.moveTo(x, y - size * 2.4);
      fx.lineTo(x, y + size * 2.4);
      fx.stroke();
    } else {
      fx.beginPath();
      fx.arc(x, y, size, 0, Math.PI * 2);
      fx.fill();
    }
  }
  fx.restore();
}

function getCssValue(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

function applyTheme(theme) {
  if (theme === "valentine" && !isValentineWindow()) theme = "neon";
  activeTheme = theme;
  document.body.classList.remove("theme-mint", "theme-ember", "theme-valentine");
  if (theme !== "neon") document.body.classList.add(`theme-${theme}`);
  scoreLabel.textContent = isValentineTheme() ? "甜蜜指数" : "分数";
  localStorage.setItem("snakeTheme", theme);
}

function syncThemeAvailability() {
  const available = isValentineWindow();
  if (limitedThemeOption) limitedThemeOption.hidden = !available;
  if (!available && activeTheme === "valentine") activeTheme = "neon";
}

function applyMode(mode) {
  activeMode = mode;
  leaderboardMode = mode;
  localStorage.setItem("snakeMode", mode);
  audio.stopMusic();
  status = "ready";
  resetGame();
  syncBestScoreWithLeaderboard();
  renderLeaderboard();
  showReadyOverlay();
}

function loadLeaderboard() {
  return {
    classic: [],
    wrap: [],
    rush: [],
    feast: [],
  };
}

function getLeaderboardTopScore() {
  const board = getModeLeaderboard(activeMode);
  return board.length ? Number(board[0].score || 0) : 0;
}

function syncBestScoreWithLeaderboard() {
  bestScore = getLeaderboardTopScore();
  updateHud();
}

function getModeLeaderboard(mode = leaderboardMode) {
  return leaderboardByMode[mode] || [];
}

function normalizeLeaderboards(payload) {
  const boards = loadLeaderboard();
  const append = (record) => {
    const mode = modeIds.includes(record?.mode) ? record.mode : "classic";
    boards[mode].push(record);
  };

  if (Array.isArray(payload)) {
    payload.forEach(append);
  } else if (payload && typeof payload === "object") {
    Object.keys(boards).forEach((mode) => {
      const records = payload[mode];
      if (Array.isArray(records)) records.forEach(append);
    });
  }

  Object.keys(boards).forEach((mode) => {
    boards[mode] = boards[mode]
      .filter(Boolean)
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || Number(b.length || 0) - Number(a.length || 0) || Number(a.time || 0) - Number(b.time || 0))
      .slice(0, 20);
  });

  return boards;
}

async function fetchLeaderboard() {
  leaderboardList.innerHTML = '<li class="empty-board">排行榜加载中</li>';
  try {
    const response = await fetch(leaderboardEndpoint, { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to load leaderboard");
    const records = await response.json();
    leaderboardByMode = normalizeLeaderboards(records);
    syncBestScoreWithLeaderboard();
    renderLeaderboard();
  } catch {
    leaderboardList.innerHTML = '<li class="empty-board">排行榜暂时不可用</li>';
  }
}

async function addScoreRecord(name) {
  const cleanName = sanitizeName(name);
  if (!cleanName) {
    playerNameInput.focus();
    return false;
  }

  localStorage.setItem("snakePlayerName", cleanName);
  const response = await fetch(leaderboardEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: cleanName,
      score,
      length: snake.length,
      mode: activeMode,
      time: getElapsedMs(),
    }),
  });

  if (!response.ok) throw new Error("Unable to save score");

  const records = await response.json();
  leaderboardByMode = normalizeLeaderboards(records);
  leaderboardMode = activeMode;
  syncBestScoreWithLeaderboard();
  renderLeaderboard();
  showScoreResult(cleanName);
  return true;
}

function sanitizeName(name) {
  return name.trim().replace(/\s+/g, " ").slice(0, 12);
}

function renderLeaderboard() {
  syncBestScoreWithLeaderboard();
  leaderboardTabs.forEach((button) => {
    const isActive = button.dataset.leaderboardMode === leaderboardMode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  const board = getModeLeaderboard();
  const modeName = modeNames[leaderboardMode] || modeNames.classic;
  if (!board.length) {
    leaderboardList.innerHTML = `<li class="empty-board">${modeName}模式暂无记录</li>`;
    return;
  }

  leaderboardList.innerHTML = board
    .map((record, index) => {
      return `
        <li>
          <span class="rank">#${index + 1}</span>
          <span class="player">${escapeHtml(record.name)} <small class="record-meta">长度 ${record.length} · ${formatTime(record.time)}</small></span>
          <strong class="record-score">${record.score}</strong>
        </li>
      `;
    })
    .join("");
}

function showScoreResult(playerName) {
  const board = getModeLeaderboard(activeMode);
  const rank = board.findIndex((record) => {
    return record.name === playerName && Number(record.score) === score && Number(record.length) === snake.length;
  });
  const scoreGap = getLeaderboardScoreGap(board);
  scoreFeedback.textContent = rank >= 0 ? `已录入排行榜，当前排名 #${rank + 1}` : scoreGap > 0 ? `已上传分数，未能上榜，还差 ${scoreGap} 分上榜` : "已上传分数";
  scoreFeedback.classList.add("is-visible");

  if (rank >= 0 && rank < 3) {
    const rewards = [
      { label: "GOLD", title: "冠军入榜", copy: "新的榜首高光已点亮", className: "medal-1" },
      { label: "SILVER", title: "亚军入榜", copy: "离第一名只差一次神走位", className: "medal-2" },
      { label: "BRONZE", title: "季军入榜", copy: "前三席位已经写上你的名字", className: "medal-3" },
    ];
    const reward = rewards[rank];
    medalReward.innerHTML = `
      <canvas class="medal-fx" aria-hidden="true"></canvas>
      <div class="medal-card ${reward.className}">
        <button class="medal-close" type="button" aria-label="关闭奖牌界面" data-medal-close>×</button>
        <span class="medal-rank">#${rank + 1}</span>
        <strong>${reward.title}</strong>
        <small>${reward.copy}</small>
        <span class="medal-label">${reward.label}</span>
      </div>
    `;
    medalReward.classList.add("is-visible");
    startMedalSpotlightFx();
  }
}

function getLeaderboardScoreGap(board) {
  if (!Array.isArray(board) || board.length < 20) return 0;
  const threshold = Number(board[board.length - 1]?.score || 0);
  return Math.max(0, threshold - score + 1);
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[char];
  });
}

window.addEventListener("keydown", (event) => {
  const map = {
    ArrowUp: "up",
    KeyW: "up",
    ArrowDown: "down",
    KeyS: "down",
    ArrowLeft: "left",
    KeyA: "left",
    ArrowRight: "right",
    KeyD: "right",
  };

  const directionName = map[event.code];
  if (directionName) {
    event.preventDefault();
    if (!event.repeat || !heldDirections.has(directionName)) {
      heldDirections.add(directionName);
      handleDirectionPress(directionName);
    }
  }

  if (event.code === "Space") {
    event.preventDefault();
    status === "playing" ? pauseGame() : resumeGame();
  }
});

window.addEventListener("keyup", (event) => {
  const map = {
    ArrowUp: "up",
    KeyW: "up",
    ArrowDown: "down",
    KeyS: "down",
    ArrowLeft: "left",
    KeyA: "left",
    ArrowRight: "right",
    KeyD: "right",
  };
  const directionName = map[event.code];
  if (directionName) {
    heldDirections.delete(directionName);
    stopDirectionBoost();
  }
});

document.querySelectorAll("[data-dir]").forEach((button) => {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    handleDirectionPress(button.dataset.dir);
  });
  button.addEventListener("pointerup", stopDirectionBoost);
  button.addEventListener("pointercancel", stopDirectionBoost);
  button.addEventListener("pointerleave", stopDirectionBoost);
  button.addEventListener("contextmenu", preventGameGestureMenu);
  button.addEventListener("selectstart", preventGameGestureMenu);
  button.addEventListener("dragstart", preventGameGestureMenu);
  button.addEventListener("click", (event) => event.preventDefault());
});

["contextmenu", "selectstart", "dragstart"].forEach((eventName) => {
  document.addEventListener(
    eventName,
    (event) => {
      if (event.target.closest(".play-area, .touch-pad")) preventGameGestureMenu(event);
    },
    { capture: true },
  );
});

function preventGameGestureMenu(event) {
  event.preventDefault();
}

let touchStart = null;
function applySwipeDirection(touch) {
  if (!touchStart) return false;
  const dx = touch.clientX - touchStart.x;
  const dy = touch.clientY - touchStart.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < swipeThreshold) return false;
  setDirection(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  touchStart = { x: touch.clientX, y: touch.clientY };
  return true;
}

playArea.addEventListener(
  "touchstart",
  (event) => {
    if (isInteractiveTarget(event.target)) return;
    const touch = event.changedTouches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
    startBoardBoost();
  },
  { passive: false },
);

playArea.addEventListener(
  "touchmove",
  (event) => {
    if (isInteractiveTarget(event.target)) return;
    event.preventDefault();
    if (applySwipeDirection(event.changedTouches[0])) stopBoardBoost();
  },
  { passive: false },
);

playArea.addEventListener(
  "touchend",
  (event) => {
    if (isInteractiveTarget(event.target)) return;
    if (!touchStart) return;
    event.preventDefault();
    const touch = event.changedTouches[0];
    applySwipeDirection(touch);
    touchStart = null;
    stopBoardBoost();
  },
  { passive: false },
);

playArea.addEventListener(
  "touchcancel",
  (event) => {
    if (isInteractiveTarget(event.target)) return;
    event.preventDefault();
    touchStart = null;
    stopBoardBoost();
  },
  { passive: false },
);

playArea.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "touch" || isInteractiveTarget(event.target)) return;
  startBoardBoost();
});
playArea.addEventListener("pointerup", stopBoardBoost);
playArea.addEventListener("pointercancel", stopBoardBoost);
playArea.addEventListener("pointerleave", stopBoardBoost);

function isInteractiveTarget(target) {
  return target.closest("button, input, select, option, label, textarea, a");
}

primaryAction.addEventListener("click", () => {
  if (status === "paused") resumeGame();
  else startGame();
});

pauseBtn.addEventListener("click", () => {
  audio.play("key");
  if (status === "playing") pauseGame();
  else if (status === "paused") resumeGame();
});

restartBtn.addEventListener("click", () => {
  audio.play("key");
  startGame();
});

soundBtn.addEventListener("click", () => {
  muted = !muted;
  localStorage.setItem("snakeMuted", String(muted));
  if (muted) audio.stopMusic();
  else if (status === "playing") audio.startMusic();
  updateHud();
});

medalReward.addEventListener("click", (event) => {
  if (event.target === medalReward || event.target.closest("[data-medal-close]")) hideMedalReward();
});

window.addEventListener("keydown", (event) => {
  if (event.code === "Escape" && medalReward.classList.contains("is-visible")) hideMedalReward();
});

scoreForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = scoreForm.querySelector("button");
  submitButton.disabled = true;
  submitButton.textContent = "录入中";

  try {
    const saved = await addScoreRecord(playerNameInput.value);
    if (!saved) {
      submitButton.disabled = false;
      submitButton.textContent = "录入分数";
      return;
    }
    playerNameInput.disabled = true;
    submitButton.textContent = "已录入";
  } catch {
    submitButton.disabled = false;
    submitButton.textContent = "重试录入";
  }
});

modeSelect.addEventListener("change", () => applyMode(modeSelect.value));
themeSelect.addEventListener("change", () => {
  activeTheme = themeSelect.value;
  applyTheme(activeTheme);
});

leaderboardTabs.forEach((button) => {
  button.addEventListener("click", () => {
    leaderboardMode = button.dataset.leaderboardMode || activeMode;
    renderLeaderboard();
  });
});

syncThemeAvailability();
modeSelect.value = activeMode;
themeSelect.value = activeTheme;
applyTheme(activeTheme);
resetGame();
renderLeaderboard();
fetchLeaderboard();
showReadyOverlay();
requestAnimationFrame(loop);
