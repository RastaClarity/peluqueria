import { BACKGROUND_PLAYLIST, PENTA, NOTE_FREQ, REGGAE_LOFI_TRACKS, GAME_MUSIC } from "../data/musicData.js";

let audioCtx = null;
let musicPlaying = false;
let globalMuted = true;
let masterVolume = 0.72;

let backgroundAudio = null;
let backgroundAudioAvailable = true;
let backgroundTrackIndex = 0;
let backgroundSourceTry = 0;
let backgroundDuckedForGame = false;
let backgroundFirstStartDone = false;
let backgroundShuffleQueue = [];
let backgroundWatchdogTimer = null;
let backgroundFailedTracks = 0;
let backgroundLastProgress = 0;

let gameMusicInterval = null;
let resumeMainAfterGame = false;

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function resolveFreq(value) {
  return typeof value === "number" ? value : (NOTE_FREQ?.[value] || PENTA?.[0] || 440);
}

function safeWave(type = "sine") {
  if (type === "square" || type === "sawtooth") return "triangle";
  return type || "sine";
}

function playTone(freq, type = "sine", dur = 0.12, vol = 0.12, delay = 0) {
  if (globalMuted) return;

  try {
    const ctx = getCtx();
    if (ctx.state === "suspended") ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const start = ctx.currentTime + delay;
    const cleanVol = Math.min(Math.max(vol, 0), 0.045) * Math.max(0, Math.min(1.2, masterVolume));

    osc.type = safeWave(type);
    osc.frequency.setValueAtTime(resolveFreq(freq), start);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1450, start);
    filter.Q.setValueAtTime(0.45, start);

    osc.connect(filter);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1450, start);
    filter.Q.setValueAtTime(0.45 filter.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(cleanVol, start + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur + 0.16);

    osc.start(start);
    osc.stop(start + dur + 0.2);
  } catch (e) {}
}

function playNoise(dur = 0.05, vol = 0.01, delay = 0) {
  if (globalMuted) return;

  try {
    const ctx = getCtx();
    if (ctx.state === "suspended") ctx.resume();

    const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) * 0.25;
    }

    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const start = ctx.currentTime + delay;

    src.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.value = 1200;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(Math.min(vol, 0.008), start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur + 0.08);

    src.start(start);
    src.stop(start + dur + 0.1);
  } catch (e) {}
}

function playUiSound(kind = "tap") {
  if (globalMuted) return;

  const patterns = {
    tap: [[520, 0.025, 0.008, 0]],
    tab: [[620, 0.030, 0.009, 0]],
    page: [[392, 0.045, 0.013, 0], [523, 0.050, 0.010, 0.045]],
    back: [[392, 0.040, 0.012, 0], [294, 0.052, 0.009, 0.05]],
    action: [[560, 0.040, 0.012, 0], [720, 0.045, 0.009, 0.045]],
    jump: [[440, 0.035, 0.010, 0], [660, 0.030, 0.006, 0.035]],
    collect: [[720, 0.040, 0.014, 0], [980, 0.044, 0.010, 0.045]],
    hit: [[210, 0.070, 0.014, 0]],
    shop: [[660, 0.045, 0.014, 0], [880, 0.050, 0.010, 0.048]],
    game: [[330, 0.045, 0.011, 0], [494, 0.052, 0.008, 0.045]],
    social: [[440, 0.040, 0.010, 0], [587, 0.046, 0.007, 0.045]],
    admin: [[220, 0.048, 0.010, 0], [330, 0.055, 0.007, 0.058]],
    profile: [[523, 0.040, 0.010, 0], [698, 0.046, 0.007, 0.055]],
    money: [[784, 0.045, 0.014, 0], [988, 0.050, 0.010, 0.044]],
    notify: [[880, 0.040, 0.011, 0], [1175, 0.046, 0.007, 0.06]],
    success: [[523, 0.052, 0.014, 0], [659, 0.058, 0.010, 0.060], [784, 0.064, 0.007, 0.120]],
    error: [[246, 0.085, 0.012, 0], [196, 0.095, 0.008, 0.075]]
  };

  (patterns[kind] || patterns.tap).forEach(([f, d, v, delay], i) => {
    playTone(f, i % 2 ? "triangle" : "sine", d, v, delay);
  });
}

const SFX = {
  nav: () => playUiSound("page"),
  navBack: () => playUiSound("back"),
  tab: () => playUiSound("tab"),
  click: () => playUiSound("tap"),
  action: () => playUiSound("action"),
  jump: () => playUiSound("jump"),
  collect: () => playUiSound("collect"),
  hit: () => playUiSound("hit"),
  coins: () => playUiSound("money"),
  success: () => playUiSound("success"),
  error: () => playUiSound("error"),
  notify: () => playUiSound("notify")
};

function playRastaVoice(kind = "talk") {
  if (globalMuted) return;

  const voices = {
    open: [[523, 0.050, 0.012, 0], [659, 0.055, 0.014, 0.055], [784, 0.070, 0.010, 0.115]],
    close: [[659, 0.045, 0.010, 0], [523, 0.052, 0.009, 0.055], [392, 0.070, 0.007, 0.115]],
    tip: [[587, 0.050, 0.012, 0], [740, 0.060, 0.012, 0.060], [880, 0.045, 0.010, 0.135]],
    help: [[392, 0.050, 0.010, 0], [523, 0.055, 0.012, 0.050], [659, 0.070, 0.010, 0.175]],
    context: [[440, 0.040, 0.010, 0], [660, 0.052, 0.012, 0.052], [880, 0.054, 0.010, 0.116]],
    happy: [[523, 0.045, 0.012, 0], [659, 0.045, 0.012, 0.045], [784, 0.055, 0.013, 0.095], [988, 0.070, 0.009, 0.155]]
  };

  (voices[kind] || voices.open).forEach(([f, d, v, delay], i) => {
    playTone(f, i % 2 ? "triangle" : "sine", d, v, delay);
  });

  if (kind === "open" || kind === "tip" || kind === "happy") {
    playNoise(0.035, 0.004, 0.075);
  }
}

function navSoundKind(id) {
  if (["dashboard"].includes(id)) return "back";
  if (["tienda", "cupones", "caja"].includes(id)) return "shop";
  if (["juegos", "tops", "retos", "ranking"].includes(id)) return "game";
  if (["feed", "foro", "comunidad", "noticias", "musica", "buzon", "chat", "reviews"].includes(id)) return "social";
  if (["gestion", "clientes", "inventario", "usuarios", "galeria"].includes(id)) return "admin";
  if (id === "perfil") return "profile";
  return "page";
}

function playNavSound(id) {
  playUiSound(navSoundKind(id));
}

function getBackgroundTrack() {
  const list = Array.isArray(BACKGROUND_PLAYLIST) ? BACKGROUND_PLAYLIST : [];
  return list[backgroundTrackIndex % Math.max(1, list.length)] || list[0] || null;
}

function getBackgroundName() {
  return getBackgroundTrack()?.name || getBackgroundTrack()?.title || "Rasta Cuts Lounge";
}

function cleanAudioSrc(src) {
  const s = String(src || "").trim();
  if (!s) return "";
  return s.replace(/ /g, "%20");
}

function slugAudioName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[()]+/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueList(list) {
  const out = [];

  list.forEach((item) => {
    const src = cleanAudioSrc(item);
    if (src && !out.includes(src)) out.push(src);
  });

  return out;
}

function getTrackSrcs(track = getBackgroundTrack()) {
  const title = track?.title || track?.name || "Glass Lounge Loop";
  const base = String(title).trim();
  const raw = Array.isArray(track?.srcs) ? [...track.srcs] : [];

  if (base) {
    raw.push(`/audio/${base}.mp3`);
    raw.push(`/audio/${base.replace(/ /g, "%20")}.mp3`);
    raw.push(`/audio/${base.toLowerCase()}.mp3`);
    raw.push(`/audio/${slugAudioName(base)}.mp3`);
    raw.push(`/audio/${slugAudioName(base).replace(/-/g, "_")}.mp3`);

    if (/\s[124]$/.test(base)) {
      const n = base.match(/\s([124])$/)?.[1];
      const alt = base.replace(/\s[124]$/, ` (${n})`);
      raw.push(`/audio/${alt}.mp3`);
      raw.push(`/audio/${alt.replace(/ /g, "%20")}.mp3`);
    }

    if (/\s\([124]\)$/.test(base)) {
      const n = base.match(/\s\(([124])\)$/)?.[1];
      const alt = base.replace(/\s\([124]\)$/, ` ${n}`);
      raw.push(`/audio/${alt}.mp3`);
      raw.push(`/audio/${alt.replace(/ /g, "%20")}.mp3`);
    }
  }

  return uniqueList(raw.length ? raw : ["/audio/Glass%20Lounge%20Loop.mp3"]);
}

function getBackgroundSrc() {
  const srcs = getTrackSrcs();
  return srcs[backgroundSourceTry % Math.max(1, srcs.length)] || "/audio/Glass%20Lounge%20Loop.mp3";
}

function pickRandomBackgroundIndex() {
  const len = Array.isArray(BACKGROUND_PLAYLIST) ? BACKGROUND_PLAYLIST.length : 0;
  if (len <= 1) return 0;

  if (!backgroundShuffleQueue.length) {
    backgroundShuffleQueue = Array.from({ length: len }, (_, i) => i)
      .filter((i) => i !== backgroundTrackIndex)
      .sort(() => Math.random() - 0.5);
  }

  return backgroundShuffleQueue.shift() ?? ((backgroundTrackIndex + 1) % len);
}

function backgroundTargetVolume() {
  if (globalMuted || backgroundDuckedForGame) return 0;

  const gain = Number(getBackgroundTrack()?.gain) || 1;
  const base = Number.isFinite(masterVolume) ? masterVolume : 0.72;

  return Math.max(0.28, Math.min(0.78, base * 0.58 * gain));
}

function applyBackgroundAudioState() {
  try {
    if (!backgroundAudio) return;

    backgroundAudio.loop = false;
    backgroundAudio.muted = Boolean(globalMuted || backgroundDuckedForGame);
    backgroundAudio.volume = backgroundTargetVolume();
  } catch (e) {}
}

function clearBackgroundWatchdog() {
  if (backgroundWatchdogTimer) {
    clearTimeout(backgroundWatchdogTimer);
    backgroundWatchdogTimer = null;
  }
}

function resetBackgroundAudio(keepAvailability = true) {
  clearBackgroundWatchdog();

  try {
    if (backgroundAudio) {
      backgroundAudio.pause();
      backgroundAudio.removeAttribute?.("src");
      backgroundAudio.load?.();
    }
  } catch (e) {}

  backgroundAudio = null;

  if (keepAvailability) {
    backgroundAudioAvailable = true;
  }
}

function tryNextSourceOrTrack() {
  const listLen = Math.max(1, Array.isArray(BACKGROUND_PLAYLIST) ? BACKGROUND_PLAYLIST.length : 1);
  const srcs = getTrackSrcs(getBackgroundTrack());

  if (backgroundSourceTry < srcs.length - 1) {
    backgroundSourceTry += 1;
  } else {
    backgroundSourceTry = 0;
    backgroundTrackIndex = pickRandomBackgroundIndex();
    backgroundFailedTracks += 1;
  }

  if (backgroundFailedTracks > listLen * 2) {
    backgroundAudioAvailable = false;
    resetBackgroundAudio(false);
    return false;
  }

  return true;
}

function recoverBackgroundPlayback() {
  if (!musicPlaying || globalMuted || backgroundDuckedForGame) return;

  if (!tryNextSourceOrTrack()) return;

  resetBackgroundAudio(true);
  playBackgroundWithRecovery(true);
}

function scheduleBackgroundWatchdog(audioRef) {
  clearBackgroundWatchdog();

  if (!audioRef) return;

  const startAt = Number(audioRef.currentTime) || 0;

  backgroundWatchdogTimer = setTimeout(() => {
    try {
      if (!musicPlaying || globalMuted || backgroundDuckedForGame) return;
      if (audioRef !== backgroundAudio) return;

      const now = Number(audioRef.currentTime) || 0;
      const durationOk = Number.isFinite(audioRef.duration) && audioRef.duration > 0.8;
      const dataOk = audioRef.readyState >= 2;
      const progressOk = now > startAt + 0.08 || now > backgroundLastProgress + 0.08;

      if (audioRef.paused || !durationOk || !dataOk || !progressOk) {
        recoverBackgroundPlayback();
      }
    } catch (e) {
      recoverBackgroundPlayback();
    }
  }, 2600);
}

function createBackgroundAudio() {
  if (typeof Audio === "undefined") return null;

  const a = new Audio();

  a.src = getBackgroundSrc();
  a.loop = false;
  a.preload = "auto";
  a.volume = backgroundTargetVolume();
  a.muted = Boolean(globalMuted || backgroundDuckedForGame);
  a.dataset.trackName = getBackgroundName();

  const markProgress = () => {
    backgroundLastProgress = Number(a.currentTime) || 0;

    if (a.readyState >= 2 && Number.isFinite(a.duration) && a.duration > 0.8) {
      clearBackgroundWatchdog();
    }
  };

  a.addEventListener("playing", markProgress);
  a.addEventListener("timeupdate", markProgress);
  a.addEventListener("canplay", markProgress);

  a.addEventListener("loadedmetadata", () => {
    try {
      if (!Number.isFinite(a.duration) || a.duration <= 0.8) {
        recoverBackgroundPlayback();
      }
    } catch (e) {}
  });

  a.addEventListener("ended", () => {
    clearBackgroundWatchdog();

    if (musicPlaying) {
      nextMusicTrack(true);
    }
  });

  a.addEventListener("error", recoverBackgroundPlayback);
  a.addEventListener("stalled", () => scheduleBackgroundWatchdog(a));
  a.addEventListener("waiting", () => scheduleBackgroundWatchdog(a));

  return a;
}

function getBackgroundAudio() {
  if (typeof Audio === "undefined") return null;

  if (!backgroundAudio) {
    backgroundAudio = createBackgroundAudio();
  }

  return backgroundAudio;
}

function playCurrentBackgroundTrack(forceRestart = false) {
  backgroundAudioAvailable = true;

  const a = getBackgroundAudio();

  if (!a) {
    return Promise.reject(new Error("Audio no disponible"));
  }

  if (forceRestart) {
    try {
      a.currentTime = 0;
    } catch (e) {}
  }

  applyBackgroundAudioState();
  scheduleBackgroundWatchdog(a);

  return a.play().then(() => {
    backgroundFailedTracks = 0;
    scheduleBackgroundWatchdog(a);
    applyBackgroundAudioState();

    return true;
  });
}

function playBackgroundWithRecovery(forceRestart = false) {
  return playCurrentBackgroundTrack(forceRestart).catch(() => {
    recoverBackgroundPlayback();
    return false;
  });
}

function startMusic() {
  musicPlaying = true;
  globalMuted = false;
  backgroundDuckedForGame = false;
  backgroundAudioAvailable = true;

  if (!backgroundFirstStartDone) {
    backgroundTrackIndex = pickRandomBackgroundIndex();
    backgroundSourceTry = 0;
    backgroundFailedTracks = 0;
    backgroundFirstStartDone = true;
    resetBackgroundAudio(true);
  }

  playBackgroundWithRecovery(false);
}

function stopMusic() {
  musicPlaying = false;

  clearBackgroundWatchdog();

  try {
    if (backgroundAudio && !backgroundAudio.paused) {
      backgroundAudio.pause();
    }
  } catch (e) {}
}

function muteMusicKeepTime(muted = true) {
  globalMuted = Boolean(muted);

  applyBackgroundAudioState();

  if (musicPlaying && backgroundAudioAvailable) {
    const a = getBackgroundAudio();

    if (a && a.paused && !globalMuted && !backgroundDuckedForGame) {
      a.play()
        .then(() => scheduleBackgroundWatchdog(a))
        .catch(() => recoverBackgroundPlayback());
    } else if (a && !globalMuted && !backgroundDuckedForGame) {
      scheduleBackgroundWatchdog(a);
    }
  }
}

function nextMusicTrack(auto = false) {
  backgroundTrackIndex = pickRandomBackgroundIndex();
  backgroundSourceTry = 0;
  backgroundFailedTracks = 0;

  const shouldPlay = musicPlaying || auto;
  const wasDucked = backgroundDuckedForGame;

  resetBackgroundAudio(true);

  if (shouldPlay) {
    musicPlaying = true;

    if (!wasDucked) {
      globalMuted = false;
    }

    backgroundDuckedForGame = wasDucked;

    playBackgroundWithRecovery(true);
  }
}

function setBackgroundVolume() {
  applyBackgroundAudioState();
}

function startGameMusic(gameId) {
  if (globalMuted) return;

  stopGameMusic(false);

  resumeMainAfterGame = musicPlaying;
  backgroundDuckedForGame = true;

  applyBackgroundAudioState();

  const cfg = GAME_MUSIC?.[gameId] || GAME_MUSIC?.sopa || {
    notes: [440, 494, 523, 587],
    tempo: 420,
    wave: "sine",
    bass: 0.5
  };

  const notes = Array.isArray(cfg.notes) && cfg.notes.length ? cfg.notes : [440, 494, 523, 587];

  let i = 0;

  gameMusicInterval = setInterval(() => {
    if (globalMuted) {
      stopGameMusic(false);
      return;
    }

    const n = notes[i % notes.length];
    const next = notes[(i + 2) % notes.length];

    if (gameId === "gacha") {
      if (i % 2 === 0) playTone(n, "triangle", 0.050, 0.016, 0);
      if (i % 4 === 3) playTone(resolveFreq(next) * 2, "triangle", 0.060, 0.009, 0.045);
    } else if (gameId === "runner") {
      if (i % 2 === 0) playTone(n, "triangle", 0.055, 0.013, 0);
      if (i % 4 === 0) playTone(resolveFreq(n) * (cfg.bass || 0.5), "sine", 0.080, 0.010, 0.02);
    } else if (gameId === "stitch") {
      playTone(n, "triangle", 0.060, 0.012, 0);

      if (i % 3 === 0) {
        playTone(next, "sine", 0.070, 0.008, 0.07);
      }
    } else {
      playTone(n, cfg.wave || "sine", 0.075, 0.011, 0);

      if (i % 4 === 1) {
        playTone(next, "triangle", 0.090, 0.007, 0.08);
      }
    }

    i += 1;
  }, cfg.tempo || 420);
}

function stopGameMusic(restoreMain = true) {
  if (gameMusicInterval) {
    clearInterval(gameMusicInterval);
    gameMusicInterval = null;
  }

  backgroundDuckedForGame = false;

  applyBackgroundAudioState();

  if (restoreMain && resumeMainAfterGame && !globalMuted) {
    resumeMainAfterGame = false;
    musicPlaying = true;
    startMusic();
  } else if (!restoreMain) {
    resumeMainAfterGame = false;
  }
}

function isMuted() {
  return Boolean(globalMuted);
}

function isMusicPlaying() {
  return Boolean(musicPlaying);
}

function isBackgroundAudioAvailable() {
  return Boolean(backgroundAudioAvailable);
}

function setMuted(value) {
  globalMuted = Boolean(value);
  applyBackgroundAudioState();
}

function setMusicPlaying(value) {
  musicPlaying = Boolean(value);
}

function setBackgroundDuckedForGame(value) {
  backgroundDuckedForGame = Boolean(value);
  applyBackgroundAudioState();
}

function setMasterVolume(value) {
  masterVolume = Number.isFinite(value) ? Math.max(0, Math.min(1.2, value)) : 0.72;
  setBackgroundVolume();
}

export {
  SFX,
  getBackgroundName,
  isBackgroundAudioAvailable,
  isMusicPlaying,
  isMuted,
  muteMusicKeepTime,
  nextMusicTrack,
  playNavSound,
  playRastaVoice,
  playUiSound,
  setBackgroundDuckedForGame,
  setBackgroundVolume,
  setMasterVolume,
  setMuted,
  setMusicPlaying,
  startGameMusic,
  startMusic,
  stopGameMusic
};
