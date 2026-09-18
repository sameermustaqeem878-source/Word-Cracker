import { useState, useEffect, useRef, useCallback } from "react";
import { KeyRound, Trophy, Clock, Feather, Zap, Flame, X, Sparkles, Lock, Delete, CornerDownLeft, Volume2, VolumeX, HelpCircle, ArrowRight, Skull, BarChart3 } from "lucide-react";
import * as Tone from "tone";

// Outside Claude.ai, window.storage doesn't exist — fall back to plain
// localStorage so the leaderboard and saved name still work when this
// is run as a normal React app (e.g. via `npm start`).
if (typeof window !== "undefined" && !window.storage) {
  window.storage = {
    async get(key) {
      const raw = window.localStorage.getItem("vc_" + key);
      return raw === null ? null : { key, value: raw, shared: false };
    },
    async set(key, value) {
      window.localStorage.setItem("vc_" + key, value);
      return { key, value, shared: false };
    },
    async delete(key) {
      window.localStorage.removeItem("vc_" + key);
      return { key, deleted: true, shared: false };
    },
    async list(prefix = "") {
      const keys = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith("vc_" + prefix)) keys.push(k.slice(3));
      }
      return { keys, shared: false };
    }
  };
}

const MAX_GUESSES = 5;

const DIFFICULTY_META = {
  easy:   { label: "Casual",   sub: "4-letter word",  rule: "exactly 4 letters, a simple everyday word a child would know", minLen: 4, maxLen: 4,  icon: Feather, color: "#3FA66B" },
  medium: { label: "Moderate", sub: "5–6 letters",     rule: "5 or 6 letters, a common word most adults would recognize",     minLen: 5, maxLen: 6,  icon: Zap,     color: "#4FA8C9" },
  hard:   { label: "Complex",  sub: "7+ letters",      rule: "7 or more letters, a more advanced but still real, well-known word", minLen: 7, maxLen: 99, icon: Flame,   color: "#D9584F" },
  impossible: { label: "Unthinkable", sub: "16+ letters", rule: "more than 15 letters long (16 or more), a real word even if obscure or technical", minLen: 16, maxLen: 99, icon: Skull, color: "#A855F7" }
};

const FALLBACK_POOLS = {
  easy: [
    { word: "CAKE", hint: "A sweet baked dessert, often served on birthdays." },
    { word: "FISH", hint: "An animal that swims and breathes through gills." },
    { word: "LAMP", hint: "A device you switch on to light a room." },
    { word: "BOOK", hint: "Pages bound together, filled with stories or facts." },
    { word: "DOOR", hint: "You open this to walk into a room." },
    { word: "STAR", hint: "A glowing point of light seen in the night sky." },
    { word: "RAIN", hint: "Water that falls from clouds." },
    { word: "SHOE", hint: "You wear this on your foot." },
    { word: "MOON", hint: "The object that orbits Earth and lights up the night." },
    { word: "TREE", hint: "A tall plant with a trunk, branches, and leaves." },
    { word: "SNOW", hint: "Soft white flakes that fall in winter." },
    { word: "BALL", hint: "A round object used in many sports." },
    { word: "GOLD", hint: "A shiny yellow precious metal." },
    { word: "CLAP", hint: "What you do with your hands to applaud." },
    { word: "DESK", hint: "A piece of furniture you sit at to write or work." },
    { word: "FROG", hint: "A small hopping amphibian that lives near water." },
    { word: "GATE", hint: "A hinged barrier you open to enter a yard." },
    { word: "HONK", hint: "The sound a car horn makes." },
    { word: "JUMP", hint: "To push yourself off the ground into the air." },
    { word: "KITE", hint: "A toy you fly in the wind on a string." },
    { word: "LEAF", hint: "A flat green part of a plant that grows on a stem." },
    { word: "MILK", hint: "A white drink that comes from cows." },
    { word: "NEST", hint: "A bird builds this to lay its eggs in." },
    { word: "OVEN", hint: "An appliance used to bake or roast food." },
    { word: "PARK", hint: "An open public space with grass and trees to play in." },
    { word: "QUIZ", hint: "A short test of knowledge, often for fun." },
    { word: "RING", hint: "A circular piece of jewelry worn on a finger." },
    { word: "SOCK", hint: "A soft covering worn on your foot, under a shoe." },
    { word: "TENT", hint: "A portable shelter you sleep in while camping." },
    { word: "WAVE", hint: "A moving ridge of water in the sea." }
  ],
  medium: [
    { word: "GARDEN", hint: "A patch of land where flowers or vegetables grow." },
    { word: "PLANET", hint: "A large body that orbits a star." },
    { word: "BRIDGE", hint: "A structure built to cross a river or valley." },
    { word: "CANDLE", hint: "Wax with a wick, lit for light." },
    { word: "WINTER", hint: "The coldest season of the year." },
    { word: "PENCIL", hint: "A tool used for writing or drawing, often with an eraser." },
    { word: "JACKET", hint: "An outer garment worn for warmth." },
    { word: "MARKET", hint: "A place where goods are bought and sold." },
    { word: "PUZZLE", hint: "A game or problem designed to test cleverness." },
    { word: "RABBIT", hint: "A small furry animal known for hopping and long ears." },
    { word: "SILVER", hint: "A shiny grey-white precious metal." },
    { word: "TUNNEL", hint: "An underground passage, often for trains or cars." },
    { word: "BASKET", hint: "A container woven from thin strips of material." },
    { word: "CIRCLE", hint: "A round shape with every point the same distance from the center." },
    { word: "YELLOW", hint: "The color of a ripe banana or the sun." },
    { word: "ISLAND", hint: "A piece of land completely surrounded by water." },
    { word: "KETTLE", hint: "A container used to boil water, often for tea." },
    { word: "LADDER", hint: "A structure of rungs used to climb up or down." },
    { word: "MIRROR", hint: "A surface that reflects your image." },
    { word: "NEEDLE", hint: "A thin, sharp tool used for sewing." },
    { word: "ORANGE", hint: "A citrus fruit that shares its name with a color." },
    { word: "PILLOW", hint: "A soft cushion you rest your head on to sleep." },
    { word: "RIBBON", hint: "A thin strip of fabric used for tying or decoration." },
    { word: "SPIDER", hint: "An eight-legged creature known for spinning webs." },
    { word: "TICKET", hint: "A small piece of paper granting entry to an event." },
    { word: "DRAGON", hint: "A mythical fire-breathing creature, often with wings." },
    { word: "VIOLIN", hint: "A stringed musical instrument played with a bow." },
    { word: "WINDOW", hint: "An opening in a wall, usually covered in glass." },
    { word: "ZIPPER", hint: "A fastening device with two rows of teeth pulled by a slider." },
    { word: "ANCHOR", hint: "A heavy object dropped to keep a ship from drifting." }
  ],
  hard: [
    { word: "ALGEBRA", hint: "A branch of math that uses letters to represent numbers." },
    { word: "ORCHESTRA", hint: "A large group of musicians playing together." },
    { word: "PARADOX", hint: "A statement that seems to contradict itself, yet may be true." },
    { word: "QUARANTINE", hint: "A period of isolation to stop an illness from spreading." },
    { word: "LABYRINTH", hint: "A complicated network of paths, hard to find your way through." },
    { word: "AVALANCHE", hint: "A sudden, fast fall of snow down a mountainside." },
    { word: "BINOCULARS", hint: "A handheld device used to see distant objects up close." },
    { word: "CHANDELIER", hint: "A large decorative light fixture that hangs from a ceiling." },
    { word: "DIALOGUE", hint: "A conversation between two or more characters or people." },
    { word: "ECLIPSE", hint: "When one celestial body blocks the light of another." },
    { word: "FORTRESS", hint: "A large, heavily defended building or stronghold." },
    { word: "ASTEROID", hint: "A large rocky object orbiting the sun, smaller than a planet." },
    { word: "HARMONY", hint: "A pleasing combination of musical notes played together." },
    { word: "IRONWORK", hint: "Decorative or structural items made from wrought or cast iron." },
    { word: "JOURNEY", hint: "A long trip from one place to another." },
    { word: "KNOWLEDGE", hint: "Facts, information, and understanding gained through experience." },
    { word: "LANTERN", hint: "A portable light source, often with a handle and glass sides." },
    { word: "MYSTERY", hint: "Something that is difficult or impossible to explain." },
    { word: "NOSTALGIA", hint: "A sentimental longing for a time in the past." },
    { word: "OBSTACLE", hint: "Something that blocks your path or progress." },
    { word: "PENGUIN", hint: "A flightless bird that swims well and lives in cold climates." },
    { word: "QUICKSAND", hint: "Loose, wet sand that sucks in anything that steps on it." },
    { word: "RAINFOREST", hint: "A dense, tropical forest with very heavy rainfall." },
    { word: "SYMPHONY", hint: "A long musical composition for a full orchestra." },
    { word: "TELESCOPE", hint: "An instrument used to view distant objects, like stars." },
    { word: "UNIVERSE", hint: "All of space, time, matter, and energy that exists." },
    { word: "JOURNALIST", hint: "A person who writes or reports the news for a living." },
    { word: "WHIRLWIND", hint: "A rapidly rotating column of air." },
    { word: "XYLOPHONE", hint: "A musical instrument played by striking wooden bars." },
    { word: "ZOOLOGY", hint: "The scientific study of animals." },
    { word: "VOLCANO", hint: "A mountain that can erupt with lava and ash." },
    { word: "WHISPER", hint: "To speak very softly and quietly." },
    { word: "UMBRELLA", hint: "A folding device you hold above you to stay dry in the rain." }
  ],
  impossible: [
    { word: "MISUNDERSTANDING", hint: "A failure to correctly interpret what someone meant." },
    { word: "RESPONSIBILITIES", hint: "Duties a person is expected to take care of." },
    { word: "UNCHARACTERISTIC", hint: "Not typical of how someone usually behaves." },
    { word: "INCOMPREHENSIBLE", hint: "Impossible to make sense of." },
    { word: "DISPROPORTIONATE", hint: "Too large or too small compared to something else." },
    { word: "ENVIRONMENTALIST", hint: "Someone who advocates for protecting the natural world." },
    { word: "MULTIDIMENSIONAL", hint: "Having many different aspects, layers, or sides." },
    { word: "UNPREDICTABILITY", hint: "The quality of being impossible to foresee." },
    { word: "TRANSCONTINENTAL", hint: "Crossing or spanning an entire continent." },
    { word: "CHARACTERISTICALLY", hint: "In a way that's typical of a particular person or thing." },
    { word: "OVERGENERALIZATION", hint: "A broad conclusion drawn from far too little evidence." },
    { word: "INTERCONNECTEDNESS", hint: "The state of being linked to everything else around it." },
    { word: "DISPROPORTIONATELY", hint: "In a way that's out of proportion compared to something else." },
    { word: "UNCONSTITUTIONALLY", hint: "In a manner that violates a country's founding legal document." },
    { word: "INSTITUTIONALIZATION", hint: "The process of establishing something as a standard practice." },
    { word: "INCOMPREHENSIBILITY", hint: "The state of being impossible to understand." },
    { word: "ANTIDISESTABLISHMENTARIANISM", hint: "Historically, opposition to removing a church's official state status — often cited as one of the longest words in English." }
  ]
};

const THEMES = [
  "food and drink", "animals", "nature and weather", "household objects",
  "sports and games", "clothing and fashion", "music and instruments",
  "travel and places", "emotions and feelings", "technology", "the human body",
  "tools and hardware", "colors and shapes", "school and learning",
  "space and astronomy", "the ocean and sea life", "jobs and professions",
  "buildings and architecture", "time and calendar", "vehicles and transport"
];

const KB_ROWS = [
  ["Q","W","E","R","T","Y","U","I","O","P"],
  ["A","S","D","F","G","H","J","K","L"],
  ["ENTER","Z","X","C","V","B","N","M","BACK"]
];

function evaluateGuess(guess, target) {
  const result = new Array(guess.length).fill("absent");
  const freq = {};
  for (const ch of target) freq[ch] = (freq[ch] || 0) + 1;
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === target[i]) { result[i] = "correct"; freq[guess[i]]--; }
  }
  for (let i = 0; i < guess.length; i++) {
    if (result[i] === "correct") continue;
    const ch = guess[i];
    if (freq[ch] > 0) { result[i] = "present"; freq[ch]--; }
  }
  return result;
}

function priority(status) {
  return status === "correct" ? 3 : status === "present" ? 2 : 1;
}

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

async function fetchWordFromAI(diff, avoidWords, theme) {
  const response = await fetch("/api/generate-word", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ difficulty: diff, avoidWords, theme })
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Backend error " + response.status);
  }
  const parsed = await response.json();
  const word = (parsed.word || "").toUpperCase().replace(/[^A-Z]/g, "");
  const hint = (parsed.hint || "").trim();
  if (!word || !hint) throw new Error("empty word or hint");
  return { word, hint };
}

async function fetchWithRetry(diff, attempts, avoidWords, theme) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try { return await fetchWordFromAI(diff, avoidWords, theme); } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw lastErr;
}

function escapeText(str) {
  return String(str ?? "");
}

function Rivets() {
  const pos = [
    { top: 10, left: 10 }, { top: 10, right: 10 },
    { bottom: 10, left: 10 }, { bottom: 10, right: 10 }
  ];
  return pos.map((p, i) => <span key={i} className="rivet" style={p} />);
}

function Dial({ label }) {
  return (
    <div className="dial-wrap">
      <div className="dial-ring" />
      <div className="dial-center"><Lock size={26} color="#E8B65C" /></div>
      <p className="dial-label">{label}</p>
    </div>
  );
}

function Splash({ logoSrc, onFinish, onTap }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const autoTimer = setTimeout(() => finish(), 2800);
    return () => clearTimeout(autoTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function finish() {
    if (onTap) onTap();
    setLeaving(true);
    setTimeout(onFinish, 350); // let the fade-out play before switching screens
  }

  return (
    <div className={"splash" + (leaving ? " leaving" : "")} onClick={finish}>
      <div className="splash-ring" />
      <img src={logoSrc} alt="Vault Cracker" className="splash-logo" />
      <h1 className="splash-title">Vault Cracker</h1>
      <p className="splash-sub">Unlocking the vault…</p>
      <p className="splash-skip">Tap anywhere to enter</p>
    </div>
  );
}

export default function VaultCracker() {
  const [screen, setScreen] = useState("splash");
  const [nameInput, setNameInput] = useState("");
  const [playerName, setPlayerName] = useState("");

  const [difficulty, setDifficulty] = useState(null);
  const [target, setTarget] = useState("");
  const [wordLen, setWordLen] = useState(5);
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(false);

  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const emptyDiffStats = () => ({ played: 0, won: 0, totalTimeMs: 0, guessDist: [0, 0, 0, 0, 0] });
  const [diffStats, setDiffStats] = useState({
    easy: emptyDiffStats(), medium: emptyDiffStats(), hard: emptyDiffStats(), impossible: emptyDiffStats()
  });
  const statsLoaded = useRef(false);

  const [rows, setRows] = useState([]); // {guess, statuses, revealedCount}
  const [currentGuess, setCurrentGuess] = useState("");
  const [currentRow, setCurrentRow] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [keyStatus, setKeyStatus] = useState({});
  const [feedback, setFeedback] = useState({ msg: "", type: "" });
  const [shakeActive, setShakeActive] = useState(false);

  const [elapsedMs, setElapsedMs] = useState(0);
  const startTimeRef = useRef(null);
  const timerRef = useRef(null);

  const [showResult, setShowResult] = useState(false);
  const [showRecords, setShowRecords] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [statsTab, setStatsTab] = useState("easy");
  const [recordsTab, setRecordsTab] = useState("easy");
  const [recordsList, setRecordsList] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);

  const usedWordsHistory = useRef({ easy: [], medium: [], hard: [] });
  const lastTheme = useRef(null);

  // ---------- sound ----------
  const [soundOn, setSoundOn] = useState(true);
  const synthRef = useRef(null);
  const musicSynthRef = useRef(null);
  const audioReadyRef = useRef(false);

  const ensureAudio = useCallback(async () => {
    if (audioReadyRef.current) return;
    try {
      await Tone.start();
      const synth = new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.07, release: 0.02 },
        harmonicity: 4.5,
        modulationIndex: 16,
        resonance: 1400,
        octaves: 0.5
      }).toDestination();
      synth.volume.value = -20;
      synthRef.current = synth;

      const musicSynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.01, decay: 0.15, sustain: 0.15, release: 0.3 }
      }).toDestination();
      musicSynth.volume.value = -12;
      musicSynthRef.current = musicSynth;

      audioReadyRef.current = true;
    } catch (e) { /* audio unavailable, game still works silently */ }
  }, []);

  const playKeySound = useCallback((kind) => {
    if (!soundOn) return;
    ensureAudio().then(() => {
      if (!synthRef.current) return;
      const note = kind === "enter" ? "C5" : kind === "back" ? "A3" : "C6";
      synthRef.current.triggerAttackRelease(note, 0.03);
    });
  }, [soundOn, ensureAudio]);

  const playWinSound = useCallback(() => {
    if (!soundOn) return;
    ensureAudio().then(() => {
      const synth = musicSynthRef.current;
      if (!synth) return;
      const now = Tone.now();
      // Bright ascending arpeggio — a little triumphant chime.
      const notes = [
        ["C5", 0], ["E5", 0.1], ["G5", 0.2], ["C6", 0.32]
      ];
      notes.forEach(([note, offset]) => synth.triggerAttackRelease(note, 0.35, now + offset));
    });
  }, [soundOn, ensureAudio]);

  const playLoseSound = useCallback(() => {
    if (!soundOn) return;
    ensureAudio().then(() => {
      const synth = musicSynthRef.current;
      if (!synth) return;
      const now = Tone.now();
      // Descending minor-ish tones — a gentle "vault stays shut" thud, not harsh.
      const notes = [
        ["A3", 0], ["G3", 0.15], ["E3", 0.3], ["D3", 0.48]
      ];
      notes.forEach(([note, offset]) => synth.triggerAttackRelease(note, 0.4, now + offset));
    });
  }, [soundOn, ensureAudio]);

  // ---------- storage helpers ----------
  const saveRecord = useCallback(async (diff, entry) => {
    const key = "records-" + diff;
    let list = [];
    try {
      const res = await window.storage.get(key, true);
      if (res && res.value) list = JSON.parse(res.value);
    } catch (e) { list = []; }
    list.push(entry);
    list.sort((a, b) => a.timeMs - b.timeMs);
    list = list.slice(0, 50);
    try { await window.storage.set(key, JSON.stringify(list), true); } catch (e) {}
  }, []);

  const loadRecords = useCallback(async (diff) => {
    try {
      const res = await window.storage.get("records-" + diff, true);
      return res && res.value ? JSON.parse(res.value) : [];
    } catch (e) { return []; }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const saved = await window.storage.get("last-player-name", false);
        if (saved && saved.value) setNameInput(saved.value);
      } catch (e) {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const saved = await window.storage.get("vc-stats", false);
        if (saved && saved.value) {
          const parsed = JSON.parse(saved.value);
          if (typeof parsed.streak === "number") setStreak(parsed.streak);
          if (typeof parsed.bestStreak === "number") setBestStreak(parsed.bestStreak);

          if (parsed.diffStats) {
            setDiffStats((d) => ({ ...d, ...parsed.diffStats }));
          } else if (parsed.totals) {
            // Migrating from the older version that only tracked win counts.
            setDiffStats((d) => {
              const next = { ...d };
              for (const key of Object.keys(next)) {
                const won = parsed.totals[key] || 0;
                if (won > 0) {
                  next[key] = {
                    played: won, won, totalTimeMs: 0,
                    guessDist: [0, 0, 0, 0, won] // unknown distribution — bucket into "5 guesses" as a safe default
                  };
                }
              }
              return next;
            });
          }
        }
      } catch (e) {
        // no saved stats yet — that's fine, stay at defaults
      }
      statsLoaded.current = true;
    })();
  }, []);

  useEffect(() => {
    if (!statsLoaded.current) return; // don't overwrite saved stats with defaults before they've loaded
    window.storage
      .set("vc-stats", JSON.stringify({ streak, bestStreak, diffStats }), false)
      .catch(() => {});
  }, [streak, bestStreak, diffStats]);

  // ---------- timer ----------
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    startTimeRef.current = Date.now();
    setElapsedMs(0);
    timerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 1000);
  }, []);
  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);
  useEffect(() => () => stopTimer(), [stopTimer]);

  // ---------- name screen ----------
  function handleNameSubmit(e) {
    e.preventDefault();
    playKeySound("enter");
    const val = nameInput.trim();
    if (!val) return;
    const clipped = val.slice(0, 24);
    setPlayerName(clipped);
    window.storage.set("last-player-name", clipped, false).catch(() => {});
    setScreen("difficulty");

    window.storage.get("vc-tutorial-seen", false)
      .then((res) => {
        if (!res || !res.value) {
          setShowTutorial(true);
          window.storage.set("vc-tutorial-seen", "true", false).catch(() => {});
        }
      })
      .catch(() => setShowTutorial(true)); // if storage is unavailable, err on the side of showing it
  }

  // ---------- puzzle loading ----------
  function pickFallback(diff) {
    const pool = FALLBACK_POOLS[diff];
    const recentWords = usedWordsHistory.current[diff] || [];
    const unseen = pool.filter((entry) => !recentWords.includes(entry.word));
    const candidates = unseen.length > 0 ? unseen : pool;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  const loadNewWord = useCallback(async (diff) => {
    stopTimer();
    setShowResult(false);
    setLoading(true);
    setFeedback({ msg: "", type: "" });

    const recentWords = usedWordsHistory.current[diff] || [];

    let theme = THEMES[Math.floor(Math.random() * THEMES.length)];
    if (THEMES.length > 1) {
      while (theme === lastTheme.current) theme = THEMES[Math.floor(Math.random() * THEMES.length)];
    }
    lastTheme.current = theme;

    let result;
    try {
      result = await fetchWithRetry(diff, 3, recentWords, theme);
    } catch (err) {
      result = pickFallback(diff);
      setFeedback({ msg: "Couldn't fetch a fresh word right now, so we used an offline one instead.", type: "" });
    }

    const history = usedWordsHistory.current[diff] || [];
    history.push(result.word);
    usedWordsHistory.current[diff] = history.slice(-15);

    setTarget(result.word);
    setWordLen(result.word.length);
    setHint(result.hint);
    setRows([]);
    setCurrentGuess("");
    setCurrentRow(0);
    setGameOver(false);
    setWon(false);
    setKeyStatus({});
    setLoading(false);
    startTimer();
  }, [startTimer, stopTimer]);

  function chooseDifficulty(diff) {
    setDifficulty(diff);
    setScreen("game");
    loadNewWord(diff);
  }

  // ---------- guessing ----------
  function triggerShake() {
    setShakeActive(true);
    setTimeout(() => setShakeActive(false), 400);
  }

  function finishGame(didWin, rowIndex) {
    setGameOver(true);
    setWon(didWin);
    stopTimer();
    const elapsed = Date.now() - startTimeRef.current;
    setElapsedMs(elapsed);
    setShowResult(true);
    if (didWin) {
      setFeedback({ msg: "Winner!", type: "success" });
      playWinSound();
      setStreak((s) => {
        const next = s + 1;
        setBestStreak((b) => Math.max(b, next));
        return next;
      });
      setDiffStats((d) => {
        const cur = d[difficulty] || emptyDiffStats();
        const guessDist = [...cur.guessDist];
        guessDist[rowIndex] = (guessDist[rowIndex] || 0) + 1;
        return {
          ...d,
          [difficulty]: {
            played: cur.played + 1,
            won: cur.won + 1,
            totalTimeMs: cur.totalTimeMs + elapsed,
            guessDist
          }
        };
      });
      saveRecord(difficulty, {
        name: playerName || "Anonymous",
        word: target,
        timeMs: elapsed,
        timeStr: formatTime(elapsed),
        guesses: rowIndex + 1,
        date: new Date().toLocaleString()
      });
    } else {
      playLoseSound();
      setStreak(0);
      setDiffStats((d) => {
        const cur = d[difficulty] || emptyDiffStats();
        return { ...d, [difficulty]: { ...cur, played: cur.played + 1 } };
      });
    }
  }

  function submitGuess() {
    if (gameOver || loading) return;
    if (currentGuess.length !== wordLen) {
      setFeedback({ msg: `Enter all ${wordLen} letters first.`, type: "error" });
      triggerShake();
      return;
    }
    const statuses = evaluateGuess(currentGuess, target);
    const rowIndex = currentRow;
    const guessSnapshot = currentGuess;

    setRows((prev) => [...prev, { guess: guessSnapshot, statuses, revealedCount: 0 }]);

    for (let c = 0; c < wordLen; c++) {
      setTimeout(() => {
        setRows((prev) => prev.map((r, i) => (i === rowIndex ? { ...r, revealedCount: c + 1 } : r)));
        setKeyStatus((prev) => {
          const letter = guessSnapshot[c];
          const status = statuses[c];
          const existing = prev[letter];
          if (!existing || priority(status) > priority(existing)) {
            return { ...prev, [letter]: status };
          }
          return prev;
        });
      }, c * 260);
    }

    const wonNow = guessSnapshot === target;
    const totalDelay = wordLen * 260 + 550;

    setTimeout(() => {
      if (wonNow) {
        finishGame(true, rowIndex);
      } else if (rowIndex + 1 >= MAX_GUESSES) {
        finishGame(false, rowIndex);
      } else {
        setCurrentRow(rowIndex + 1);
        setCurrentGuess("");
        setFeedback({ msg: "", type: "" });
      }
    }, totalDelay);
  }

  function handleKey(k) {
    if (gameOver || loading) return;
    if (k === "ENTER") { playKeySound("enter"); submitGuess(); return; }
    if (k === "BACK") { playKeySound("back"); setCurrentGuess((g) => g.slice(0, -1)); return; }
    if (/^[A-Z]$/.test(k)) {
      playKeySound("letter");
      setCurrentGuess((g) => (g.length < wordLen ? g + k : g));
    }
  }

  useEffect(() => {
    function onKeyDown(e) {
      if (screen !== "game" || showRecords) return;
      const key = e.key.toUpperCase();
      if (key === "ENTER") handleKey("ENTER");
      else if (key === "BACKSPACE") handleKey("BACK");
      else if (/^[A-Z]$/.test(key)) handleKey(key);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  // ---------- records modal ----------
  async function openRecords() {
    setShowRecords(true);
    const tab = difficulty || "easy";
    setRecordsTab(tab);
    setRecordsLoading(true);
    const list = await loadRecords(tab);
    setRecordsList(list);
    setRecordsLoading(false);
  }

  async function switchRecordsTab(diff) {
    setRecordsTab(diff);
    setRecordsLoading(true);
    const list = await loadRecords(diff);
    setRecordsList(list);
    setRecordsLoading(false);
  }

  function openStats() {
    setStatsTab(difficulty || "easy");
    setShowStats(true);
  }

  // ---------- render helpers ----------
  function renderTile(row, col, kind) {
    if (kind === "submitted") {
      const revealed = col < row.revealedCount;
      const status = row.statuses[col];
      const style = revealed
        ? { background: statusColor(status), borderColor: statusColor(status), color: "#0d1117" }
        : {};
      return (
        <div key={col} className={"tile" + (revealed ? " flip" : "")} style={style}>
          {row.guess[col]}
        </div>
      );
    }
    if (kind === "active") {
      const letter = currentGuess[col];
      return (
        <div key={col} className={"tile" + (letter ? " filled" : "")}>
          {letter || ""}
        </div>
      );
    }
    return <div key={col} className="tile dim">·</div>;
  }

  function statusColor(status) {
    if (status === "correct") return "#3FA66B";
    if (status === "present") return "#4FA8C9";
    return "#3A4152";
  }

  const meta = difficulty ? DIFFICULTY_META[difficulty] : null;

  return (
    <div className="vc-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800&family=Space+Mono:wght@400;700&display=swap');

        .vc-root{
          --bg:#0E1116; --bg-2:#0a0c10; --steel:#232B39; --steel-2:#1A202C;
          --brass:#B8863E; --brass-bright:#E8B65C; --edge:#333c4d;
          --emerald:#3FA66B; --cyan:#4FA8C9; --absent:#3A4152; --error:#D9584F;
          --text:#EDEFF5; --muted:#8B92A6;
          min-height:100vh; width:100%;
          background: radial-gradient(ellipse at 50% -10%, #1c2436 0%, var(--bg) 55%), var(--bg-2);
          color:var(--text); font-family:'Space Mono', monospace;
          display:flex; justify-content:center; padding:28px 14px 60px; box-sizing:border-box;
        }
        .vc-root *{ box-sizing:border-box; }
        .stage{ width:100%; max-width:440px; }

        .brand{ text-align:center; margin-bottom:18px; }
        .brand h1{
          font-family:'Big Shoulders Display', sans-serif; font-weight:800;
          font-size:2.6rem; letter-spacing:.02em; margin:0; color:var(--brass-bright);
          text-shadow:0 2px 0 rgba(0,0,0,.5);
        }
        .brand p{ color:var(--muted); font-size:.85rem; margin:6px 0 0; }

        .vault-panel{
          position:relative;
          background:linear-gradient(150deg, var(--steel), var(--steel-2));
          border:1px solid var(--edge);
          border-radius:16px;
          padding:28px 24px;
          box-shadow: inset 1px 1px 2px rgba(255,255,255,.05), inset -2px -2px 6px rgba(0,0,0,.55), 0 14px 32px rgba(0,0,0,.45);
        }
        .rivet{
          position:absolute; width:9px; height:9px; border-radius:50%;
          background: radial-gradient(circle at 35% 30%, #F2CB80, #7f591c 75%);
          box-shadow: 0 1px 2px rgba(0,0,0,.6), inset 0 0 1px rgba(255,255,255,.5);
        }

        .vault-panel h2{
          font-family:'Big Shoulders Display', sans-serif; font-weight:800; font-size:1.5rem;
          letter-spacing:.02em; margin:0 0 6px; color:var(--text); text-align:center;
        }
        .vault-panel .sub{ color:var(--muted); font-size:.85rem; text-align:center; margin:0 0 22px; }

        .name-form{ display:flex; gap:8px; }
        .name-form input{
          flex:1; background:var(--bg-2); border:1px solid var(--edge); color:var(--text);
          padding:12px 14px; border-radius:8px; font-family:'Space Mono', monospace; font-size:.95rem;
        }
        .name-form input:focus{ outline:2px solid var(--brass); outline-offset:1px; }

        .btn-brass{
          background:linear-gradient(160deg, var(--brass-bright), var(--brass));
          color:#241705; border:none; padding:0 20px; height:44px; border-radius:8px;
          font-weight:700; cursor:pointer; font-family:'Space Mono', monospace;
          display:inline-flex; align-items:center; gap:6px; transition:transform .12s ease, filter .12s ease;
        }
        .btn-brass:hover{ filter:brightness(1.08); transform:translateY(-1px); }
        .btn-brass:active{ transform:translateY(0); }

        .btn-ghost{
          background:transparent; color:var(--text); border:1px solid var(--edge);
          padding:0 18px; height:44px; border-radius:8px; cursor:pointer; font-family:'Space Mono', monospace;
          display:inline-flex; align-items:center; gap:6px;
        }
        .btn-ghost:hover{ border-color:var(--brass); color:var(--brass-bright); }

        .greeting{ text-align:center; color:var(--muted); font-size:.8rem; margin:-6px 0 14px; }
        .greeting b{ color:var(--brass-bright); }

        .diff-grid{ display:flex; flex-direction:column; gap:10px; }
        .diff-card{
          display:flex; align-items:center; gap:14px;
          background:var(--bg-2); border:1px solid var(--edge);
          border-radius:12px; padding:14px 16px; text-align:left; cursor:pointer;
          transition: border-color .15s ease, transform .12s ease;
        }
        .diff-card:hover{ transform:translateX(3px); }
        .diff-card .diff-icon{
          width:40px; height:40px; border-radius:10px; flex-shrink:0;
          display:flex; align-items:center; justify-content:center;
          background:rgba(255,255,255,.04);
        }
        .diff-card .diff-text{ display:flex; flex-direction:column; }
        .diff-card strong{
          font-family:'Big Shoulders Display', sans-serif; font-weight:800;
          font-size:1.15rem; letter-spacing:.02em; line-height:1.2;
        }
        .diff-card span{ font-size:.72rem; color:var(--muted); }

        .tutorial-link{
          display:flex; align-items:center; justify-content:center; gap:6px;
          background:transparent; border:none; color:var(--muted); font-size:.78rem;
          margin:18px auto 0; cursor:pointer; font-family:'Space Mono', monospace;
        }
        .tutorial-link:hover{ color:var(--brass-bright); }

        .tut-step{ text-align:left; font-size:.86rem; line-height:1.5; margin:0 0 10px; }
        .tut-step b{ color:var(--brass-bright); }

        .tut-example{ display:flex; gap:8px; justify-content:center; margin:12px 0 14px; }
        .tut-tile{
          width:44px; height:44px; border-radius:7px; display:flex; align-items:center;
          justify-content:center; font-weight:700; font-size:1.2rem; font-family:'Space Mono', monospace;
        }

        .tut-legend{ list-style:none; padding:0; margin:0 0 16px; text-align:left; }
        .tut-legend li{ display:flex; align-items:center; gap:8px; font-size:.82rem; margin-bottom:6px; color:var(--text); }
        .tut-legend .dot{ width:12px; height:12px; border-radius:3px; flex-shrink:0; }

        .diff-status-row{ display:flex; align-items:center; justify-content:center; gap:10px; flex-wrap:wrap; margin-bottom:12px; }
        .diff-badge{
          display:inline-flex; align-items:center; gap:6px; border:1px solid; border-radius:20px;
          padding:5px 12px; font-size:.78rem; font-weight:700; background:var(--steel);
        }
        .status-link{
          display:inline-flex; align-items:center; background:var(--steel); border:1px solid var(--edge);
          color:var(--muted); font-size:.76rem; border-radius:20px; padding:5px 12px;
          cursor:pointer; font-family:'Space Mono', monospace;
        }
        .status-link:hover{ border-color:var(--brass); color:var(--brass-bright); }

        .top-bar{ display:flex; flex-wrap:wrap; justify-content:center; align-items:center; margin:10px 0 14px; gap:8px; }
        .pill{
          background:var(--steel); border:1px solid var(--edge); padding:6px 11px; border-radius:8px;
          font-size:.78rem; color:var(--muted); display:inline-flex; align-items:center; gap:6px;
        }
        .pill.timer{ color:var(--brass-bright); font-weight:700; font-family:'Space Mono', monospace; }
        .pill.streak{
          color:#FF8C42; border-color:#FF8C42; font-weight:700;
          display:inline-flex; align-items:center; gap:5px;
        }

        .stats-summary{ margin:0 0 18px; display:flex; flex-direction:column; gap:8px; align-items:center; }
        .stats-row{ display:flex; gap:6px; flex-wrap:wrap; justify-content:center; }
        .stats-chip{
          background:var(--bg-2); border:1px solid var(--edge); border-radius:20px;
          padding:4px 10px; font-size:.72rem; color:var(--muted);
          display:inline-flex; align-items:center; gap:4px;
        }
        .stats-chip.streak{ color:#FF8C42; border-color:#FF8C42; font-weight:700; }
        .pill.link{ cursor:pointer; color:var(--brass-bright); }
        .pill.link:hover{ border-color:var(--brass); }

        .hint-banner{
          display:flex; gap:12px; align-items:flex-start; background:var(--steel);
          border-left:3px solid var(--brass); padding:14px 16px; border-radius:8px;
          margin-bottom:18px; box-shadow:0 6px 16px rgba(0,0,0,.3); min-height:48px;
        }
        .hint-banner .lbl{ display:block; color:var(--brass-bright); font-size:.7rem; letter-spacing:.04em; margin-bottom:4px; }
        .hint-banner p{ margin:0; font-size:.9rem; line-height:1.5; }

        .dial-wrap{ display:flex; flex-direction:column; align-items:center; gap:14px; padding:34px 0; }
        .dial-ring{
          width:84px; height:84px; border-radius:50%;
          background: repeating-conic-gradient(var(--brass) 0deg 4deg, #6b4d24 4deg 10deg);
          animation: dialspin 2.1s linear infinite;
          box-shadow: 0 6px 16px rgba(0,0,0,.5);
        }
        .dial-center{
          position:relative; margin-top:-70px; width:56px; height:56px; border-radius:50%;
          background:var(--steel-2); display:flex; align-items:center; justify-content:center;
          box-shadow: inset 0 2px 5px rgba(0,0,0,.6);
        }
        .dial-label{ color:var(--muted); font-size:.82rem; margin:0; }
        @keyframes dialspin{ to{ transform:rotate(360deg); } }

        .splash{
          position:fixed; inset:0; z-index:50; cursor:pointer;
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          gap:16px; text-align:center; padding:24px;
          background: radial-gradient(ellipse at 50% 40%, #1c2436 0%, var(--bg) 60%), var(--bg-2);
          animation: splashIn .6s ease both;
        }
        .splash.leaving{ animation: splashOut .35s ease both; }
        @keyframes splashIn{ from{ opacity:0; } to{ opacity:1; } }
        @keyframes splashOut{ from{ opacity:1; } to{ opacity:0; } }

        .splash-ring{
          position:absolute; width:260px; height:260px; border-radius:50%;
          border:2px solid var(--brass); opacity:.35;
          animation: ringPulse 2.2s ease-out infinite;
        }
        @keyframes ringPulse{
          0%{ transform:scale(.7); opacity:.5; }
          100%{ transform:scale(1.15); opacity:0; }
        }

        .splash-logo{
          width:148px; height:148px; border-radius:50%;
          box-shadow: 0 0 0 3px var(--brass), 0 14px 40px rgba(0,0,0,.6);
          animation: logoIn .8s cubic-bezier(.2,.9,.3,1.2) both;
          position:relative; z-index:1;
        }
        @keyframes logoIn{
          0%{ transform:scale(.4) rotate(-25deg); opacity:0; }
          100%{ transform:scale(1) rotate(0deg); opacity:1; }
        }

        .splash-title{
          font-family:'Big Shoulders Display', sans-serif; font-weight:800;
          font-size:2.4rem; letter-spacing:.03em; color:var(--brass-bright); margin:6px 0 0;
          animation: fadeUp .6s ease .3s both;
        }
        .splash-sub{
          color:var(--muted); font-size:.9rem; margin:0;
          animation: fadeUp .6s ease .5s both;
        }
        .splash-skip{
          color:var(--muted); font-size:.72rem; margin:22px 0 0; opacity:.6;
          animation: fadeUp .6s ease .9s both;
        }
        @keyframes fadeUp{
          from{ opacity:0; transform:translateY(8px); }
          to{ opacity:1; transform:translateY(0); }
        }

        @media (prefers-reduced-motion: reduce){
          .splash, .splash-logo, .splash-title, .splash-sub, .splash-skip, .splash-ring{ animation-duration:.01s; }
        }

        .grid-scene{ perspective:900px; display:flex; justify-content:center; margin-bottom:16px; }
        .grid{ display:flex; flex-direction:column; gap:7px; }
        .row{ display:flex; gap:7px; justify-content:center; }
        .row.shake{ animation: shakeX .4s ease; }

        .tile{
          width:48px; height:48px; border:2px solid var(--edge); background:var(--bg-2);
          border-radius:7px; display:flex; align-items:center; justify-content:center;
          font-weight:700; font-size:1.3rem; color:var(--text); transform-style:preserve-3d;
        }
        .tile.dim{ opacity:.35; border-style:dashed; color:transparent; }
        .tile.filled{ border-color:#57607a; }
        .tile.flip{ animation: flipTile .5s ease forwards; }
        @keyframes flipTile{
          0%{ transform:rotateX(0deg); }
          50%{ transform:rotateX(90deg); }
          100%{ transform:rotateX(0deg); }
        }

        .keyboard{ display:flex; flex-direction:column; gap:6px; align-items:center; margin-top:8px; }
        .krow{ display:flex; gap:5px; }
        .key{
          min-width:27px; height:42px; padding:0 7px; border-radius:6px; border:none;
          background:var(--steel); color:var(--text); font-family:'Space Mono', monospace;
          font-weight:700; font-size:.8rem; cursor:pointer; transition:transform .1s ease, background .2s ease;
          display:flex; align-items:center; justify-content:center;
        }
        .key:active{ transform:translateY(1px); }
        .key.wide{ min-width:50px; }
        .key.correct{ background:var(--emerald); color:#0c1c12; }
        .key.present{ background:var(--cyan); color:#062028; }
        .key.absent{ background:var(--absent); color:#c5cadb; }

        .feedback{ min-height:1.4em; text-align:center; margin-top:12px; font-size:.86rem; }
        .feedback.error{ color:var(--error); }
        .feedback.success{ color:var(--emerald); }

        @keyframes shakeX{
          10%,90%{ transform:translateX(-3px); } 20%,80%{ transform:translateX(4px); }
          30%,50%,70%{ transform:translateX(-6px); } 40%,60%{ transform:translateX(6px); }
        }

        .overlay{
          position:fixed; inset:0; background:rgba(6,7,11,.75); display:flex; align-items:center;
          justify-content:center; z-index:30; padding:20px; overflow:hidden;
        }
        .overlay-card{
          position:relative; z-index:2; max-width:400px; width:100%; max-height:85vh; overflow-y:auto;
          text-align:center;
        }
        .overlay-card h2{
          font-family:'Big Shoulders Display', sans-serif; font-weight:800; font-size:1.9rem;
          margin:6px 0 8px; color:var(--brass-bright); display:flex; align-items:center; justify-content:center; gap:8px;
        }
        .overlay-card p.msg{ margin:0 0 10px; font-size:.92rem; line-height:1.5; }
        .overlay-card .stat{ color:var(--muted); font-size:.85rem; margin-bottom:20px; }
        .overlay-card .stat b{ color:var(--brass-bright); }
        .overlay-actions{ display:flex; gap:10px; justify-content:center; flex-wrap:wrap; }

        .close-x{
          position:absolute; top:14px; right:14px; background:transparent; border:none;
          color:var(--muted); cursor:pointer; padding:4px;
        }
        .close-x:hover{ color:var(--brass-bright); }

        .records-tabs{ display:flex; gap:6px; justify-content:center; margin-bottom:16px; }
        .records-tab{
          background:var(--bg-2); border:1px solid var(--edge); color:var(--muted);
          padding:7px 16px; border-radius:20px; font-size:.78rem; cursor:pointer; font-family:'Space Mono', monospace;
        }
        .records-tab.active{ border-color:var(--brass); color:var(--brass-bright); }

        .records-table{ width:100%; border-collapse:collapse; text-align:left; font-size:.82rem; }
        .records-table th{ color:var(--muted); font-weight:400; font-size:.68rem; letter-spacing:.03em; padding:0 6px 8px; border-bottom:1px solid var(--edge); }
        .records-table td{ padding:8px 6px; border-bottom:1px solid #262c40; }
        .records-table tr.rank-1 td{ color:var(--brass-bright); }
        .records-table tr.rank-2 td{ color:#C7CDD9; }
        .records-table tr.rank-3 td{ color:#C08B5A; }
        .records-table td.time{ color:var(--emerald); font-weight:700; white-space:nowrap; }
        .records-empty{ color:var(--muted); font-size:.85rem; padding:24px 0; }

        .stat-grid{ display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:4px 0 20px; }
        .stat-box{
          background:var(--bg-2); border:1px solid var(--edge); border-radius:10px;
          padding:12px 10px; text-align:center;
        }
        .stat-box strong{ display:block; font-family:'Big Shoulders Display', sans-serif; font-weight:800; font-size:1.6rem; }
        .stat-box span{ font-size:.7rem; color:var(--muted); }

        .dist-label{ font-size:.75rem; color:var(--muted); text-align:left; margin:0 0 8px; }
        .dist-chart{ display:flex; flex-direction:column; gap:6px; }
        .dist-row{ display:flex; align-items:center; gap:8px; }
        .dist-num{ width:14px; font-size:.78rem; color:var(--muted); flex-shrink:0; }
        .dist-bar-track{ flex:1; background:var(--bg-2); border-radius:5px; overflow:hidden; height:22px; }
        .dist-bar-fill{
          height:100%; display:flex; align-items:center; justify-content:flex-end;
          padding-right:6px; border-radius:5px; transition:width .4s ease; min-width:0;
        }
        .dist-count{ font-size:.72rem; font-weight:700; color:#0d1117; }

        .confetti-cube{
          position:absolute; top:-30px; width:9px; height:9px; border-radius:2px;
          animation-name:drop; animation-timing-function:ease-in; animation-fill-mode:forwards; z-index:1;
        }
        @keyframes drop{
          0%{ transform:translateY(0) rotateX(0) rotateY(0); opacity:1; }
          100%{ transform:translateY(110vh) rotateX(400deg) rotateY(220deg); opacity:.9; }
        }

        @media (prefers-reduced-motion: reduce){
          .tile.flip, .confetti-cube, .dial-ring{ animation-duration:.01s; }
        }
        @media (max-width:420px){
          .tile{ width:38px; height:38px; font-size:1.05rem; }
          .key{ min-width:21px; height:38px; font-size:.7rem; }
          .brand h1{ font-size:2.1rem; }
        }
      `}</style>

      {screen === "splash" ? (
        <Splash logoSrc="/logo.jpg" onFinish={() => setScreen("name")} onTap={() => playKeySound("letter")} />
      ) : (
      <div className="stage">
        <div className="brand">
          <h1>Vault Cracker</h1>
          <p>Guess the hidden word — 5 tries to crack it, new word every round</p>
        </div>

        {screen === "name" && (
          <div className="vault-panel">
            <Rivets />
            <h2>Who's cracking the vault?</h2>
            <p className="sub">Enter your name — it'll be saved on the leaderboard with your time.</p>
            <form className="name-form" onSubmit={handleNameSubmit}>
              <input
                type="text"
                maxLength={24}
                autoComplete="off"
                placeholder="Your name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
              />
              <button type="submit" className="btn-brass"><KeyRound size={16} />Continue</button>
            </form>
          </div>
        )}

        {screen === "difficulty" && (
          <div className="vault-panel">
            <Rivets />
            <p className="greeting">Playing as <b>{escapeText(playerName)}</b></p>
            <h2>Pick a difficulty</h2>
            <p className="sub">A fresh word and clue is generated for you, every single game.</p>

            {(bestStreak > 0 || Object.values(diffStats).some((s) => s.won > 0)) && (
              <div className="stats-summary">
                <div className="stats-row">
                  <span className="stats-chip streak">
                    <Flame size={13} />{streak} streak
                  </span>
                  <span className="stats-chip">Best: {bestStreak}</span>
                </div>
                <div className="stats-row totals-row">
                  {Object.entries(DIFFICULTY_META).map(([key, m]) => (
                    <span key={key} className="stats-chip" style={{ color: m.color }}>
                      {diffStats[key]?.won || 0} {m.label}
                    </span>
                  ))}
                </div>
                <button className="tutorial-link" onClick={() => { playKeySound("letter"); openStats(); }}>
                  <BarChart3 size={14} />Full stats
                </button>
              </div>
            )}

            <div className="diff-grid">
              {Object.entries(DIFFICULTY_META).map(([key, m]) => {
                const Icon = m.icon;
                return (
                  <div key={key} className="diff-card" onClick={() => { playKeySound("letter"); chooseDifficulty(key); }}>
                    <span className="diff-icon" style={{ boxShadow: `inset 0 0 0 1px ${m.color}55` }}>
                      <Icon size={20} color={m.color} />
                    </span>
                    <span className="diff-text">
                      <strong style={{ color: m.color }}>{m.label}</strong>
                      <span>{m.sub}</span>
                    </span>
                  </div>
                );
              })}
            </div>
            <button className="tutorial-link" onClick={() => { playKeySound("letter"); setShowTutorial(true); }}>
              <HelpCircle size={14} />How to play
            </button>
          </div>
        )}

        {screen === "game" && (
          <div>
            <div className="diff-status-row">
              {meta && (
                <span className="diff-badge" style={{ color: meta.color, borderColor: meta.color }}>
                  <meta.icon size={14} />{meta.label}
                </span>
              )}
              <button className="status-link" onClick={() => { playKeySound("letter"); loadNewWord(difficulty); }}>New word</button>
              <button
                className="status-link"
                onClick={() => { playKeySound("letter"); setScreen("difficulty"); stopTimer(); }}
              >
                Change difficulty
              </button>
            </div>

            <div className="top-bar">
              <span className="pill">Attempt {Math.min(currentRow + 1, MAX_GUESSES)} of {MAX_GUESSES}</span>
              {streak > 0 && (
                <span className="pill streak" title={`Best streak: ${bestStreak}`}>
                  <Flame size={14} />{streak}
                </span>
              )}
              <span className="pill link" onClick={() => { playKeySound("letter"); setShowTutorial(true); }} title="How to play"><HelpCircle size={14} /></span>
              <span className="pill link" onClick={() => { playKeySound("letter"); openStats(); }} title="Your stats"><BarChart3 size={14} /></span>
              <span className="pill link" onClick={() => { playKeySound("letter"); openRecords(); }}><Trophy size={14} />Records</span>
              <span
                className="pill link"
                onClick={() => setSoundOn((s) => !s)}
                title={soundOn ? "Mute key sounds" : "Unmute key sounds"}
              >
                {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
              </span>
              <span className="pill timer"><Clock size={14} />{formatTime(elapsedMs)}</span>
            </div>

            <div className="hint-banner">
              <KeyRound size={20} color="#E8B65C" />
              <p><span className="lbl">Clue</span>{loading ? "…" : hint}</p>
            </div>

            {loading ? (
              <Dial label="Cracking a new combination…" />
            ) : (
              <div>
                <div className="grid-scene">
                  <div className="grid">
                    {Array.from({ length: MAX_GUESSES }).map((_, r) => {
                      const isShaking = shakeActive && r === currentRow;
                      return (
                        <div key={r} className={"row" + (isShaking ? " shake" : "")}>
                          {Array.from({ length: wordLen }).map((_, c) => {
                            if (r < rows.length) return renderTile(rows[r], c, "submitted");
                            if (r === currentRow) return renderTile(null, c, "active");
                            return renderTile(null, c, "empty");
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <p className={"feedback" + (feedback.type ? " " + feedback.type : "")}>{feedback.msg}</p>

                <div className="keyboard">
                  {KB_ROWS.map((krow, i) => (
                    <div key={i} className="krow">
                      {krow.map((k) => (
                        <button
                          key={k}
                          className={"key" + (k === "ENTER" || k === "BACK" ? " wide" : "") + (keyStatus[k] ? " " + keyStatus[k] : "")}
                          onClick={() => handleKey(k)}
                          type="button"
                        >
                          {k === "BACK" ? <Delete size={16} /> : k === "ENTER" ? <CornerDownLeft size={16} /> : k}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {showResult && (
        <div className="overlay">
          <div className="vault-panel overlay-card">
            <Rivets />
            <button className="close-x" onClick={() => { playKeySound("back"); setShowResult(false); }}><X size={18} /></button>
            <h2>{won ? <><Sparkles size={22} />Cracked it!</> : "Vault sealed"}</h2>
            <p className="msg">{won ? `The word was ${target}.` : `Out of attempts — the word was ${target}.`}</p>
            <p className="stat">
              {won
                ? <>Solved in <b>{Math.min(currentRow + 1, MAX_GUESSES)} of {MAX_GUESSES}</b> attempts, total time <b>{formatTime(elapsedMs)}</b>.</>
                : <>Time on the clock: <b>{formatTime(elapsedMs)}</b>.</>}
            </p>
            <div className="overlay-actions">
              <button className="btn-brass" onClick={() => { playKeySound("enter"); loadNewWord(difficulty); }}>New word</button>
              <button className="btn-ghost" onClick={() => { playKeySound("back"); setShowResult(false); setScreen("difficulty"); stopTimer(); }}>Change difficulty</button>
            </div>
            {won && <Confetti />}
          </div>
        </div>
      )}

      {showRecords && (
        <div className="overlay">
          <div className="vault-panel overlay-card">
            <Rivets />
            <button className="close-x" onClick={() => { playKeySound("back"); setShowRecords(false); }}><X size={18} /></button>
            <h2><Trophy size={20} />Leaderboard</h2>
            <p className="sub" style={{ marginTop: -8 }}>Shared with everyone who plays this page.</p>
            <div className="records-tabs">
              {Object.keys(DIFFICULTY_META).map((key) => (
                <button
                  key={key}
                  className={"records-tab" + (key === recordsTab ? " active" : "")}
                  onClick={() => { playKeySound("letter"); switchRecordsTab(key); }}
                >
                  {DIFFICULTY_META[key].label}
                </button>
              ))}
            </div>
            {recordsLoading ? (
              <p className="records-empty">Loading…</p>
            ) : recordsList.length === 0 ? (
              <p className="records-empty">No completed rounds yet on {DIFFICULTY_META[recordsTab].label.toLowerCase()} — be the first to crack one!</p>
            ) : (
              <table className="records-table">
                <thead>
                  <tr><th></th><th>Name</th><th>Word</th><th>Time</th></tr>
                </thead>
                <tbody>
                  {recordsList.map((r, i) => (
                    <tr key={i} className={i === 0 ? "rank-1" : i === 1 ? "rank-2" : i === 2 ? "rank-3" : ""}>
                      <td>{i + 1}</td>
                      <td>{escapeText(r.name || "Anonymous")}</td>
                      <td>{escapeText(r.word || "")}</td>
                      <td className="time">{escapeText(r.timeStr || "")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {showStats && (() => {
        const cur = diffStats[statsTab] || emptyDiffStats();
        const winPct = cur.played ? Math.round((cur.won / cur.played) * 100) : 0;
        const totalGuessesUsed = cur.guessDist.reduce((sum, count, i) => sum + count * (i + 1), 0);
        const avgGuesses = cur.won ? (totalGuessesUsed / cur.won).toFixed(1) : "–";
        const avgTimeStr = cur.won ? formatTime(cur.totalTimeMs / cur.won) : "–:–";
        const maxBar = Math.max(1, ...cur.guessDist);
        const tabMeta = DIFFICULTY_META[statsTab];

        return (
          <div className="overlay">
            <div className="vault-panel overlay-card">
              <Rivets />
              <button className="close-x" onClick={() => { playKeySound("back"); setShowStats(false); }}><X size={18} /></button>
              <h2><BarChart3 size={20} />Your stats</h2>
              <p className="sub" style={{ marginTop: -8 }}>Saved on this device only.</p>

              <div className="records-tabs">
                {Object.keys(DIFFICULTY_META).map((key) => (
                  <button
                    key={key}
                    className={"records-tab" + (key === statsTab ? " active" : "")}
                    onClick={() => { playKeySound("letter"); setStatsTab(key); }}
                  >
                    {DIFFICULTY_META[key].label}
                  </button>
                ))}
              </div>

              {cur.played === 0 ? (
                <p className="records-empty">No {tabMeta.label.toLowerCase()} rounds played yet — go crack one!</p>
              ) : (
                <>
                  <div className="stat-grid">
                    <div className="stat-box">
                      <strong style={{ color: tabMeta.color }}>{cur.played}</strong>
                      <span>Played</span>
                    </div>
                    <div className="stat-box">
                      <strong style={{ color: tabMeta.color }}>{winPct}%</strong>
                      <span>Win rate</span>
                    </div>
                    <div className="stat-box">
                      <strong style={{ color: tabMeta.color }}>{avgGuesses}</strong>
                      <span>Avg guesses</span>
                    </div>
                    <div className="stat-box">
                      <strong style={{ color: tabMeta.color }}>{avgTimeStr}</strong>
                      <span>Avg time</span>
                    </div>
                  </div>

                  <p className="dist-label">Guess distribution</p>
                  <div className="dist-chart">
                    {cur.guessDist.map((count, i) => (
                      <div key={i} className="dist-row">
                        <span className="dist-num">{i + 1}</span>
                        <div className="dist-bar-track">
                          <div
                            className="dist-bar-fill"
                            style={{
                              width: `${Math.max(count > 0 ? 10 : 0, (count / maxBar) * 100)}%`,
                              background: count > 0 ? tabMeta.color : "transparent"
                            }}
                          >
                            {count > 0 && <span className="dist-count">{count}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {showTutorial && (
        <div className="overlay">
          <div className="vault-panel overlay-card">
            <Rivets />
            <button className="close-x" onClick={() => { playKeySound("back"); setShowTutorial(false); }}><X size={18} /></button>
            <h2><HelpCircle size={20} />How to play</h2>

            <p className="tut-step"><b>1. Read the clue.</b> A hint for the hidden word is always shown at the top of the screen.</p>

            <p className="tut-step"><b>2. Type a guess.</b> Enter a word matching the tile count, then hit Enter or tap the on-screen keyboard's Enter key.</p>

            <p className="tut-step"><b>3. Read the colors.</b> After each guess, every tile changes color:</p>

            <div className="tut-example">
              <div className="tut-tile" style={{ background: "#3FA66B", color: "#0d1117" }}>W</div>
              <div className="tut-tile" style={{ background: "#4FA8C9", color: "#062028" }}>O</div>
              <div className="tut-tile" style={{ background: "#3A4152" }}>R</div>
              <div className="tut-tile" style={{ background: "#3A4152" }}>D</div>
            </div>
            <ul className="tut-legend">
              <li><span className="dot" style={{ background: "#3FA66B" }} /> Green — right letter, right spot</li>
              <li><span className="dot" style={{ background: "#4FA8C9" }} /> Cyan — right letter, wrong spot</li>
              <li><span className="dot" style={{ background: "#3A4152" }} /> Grey — letter isn't in the word</li>
            </ul>

            <p className="tut-step"><b>4. You get 5 attempts.</b> Crack the word before you run out to win.</p>
            <p className="tut-step"><b>5. Speed counts.</b> Your time is saved to the leaderboard for that difficulty when you win — try to beat your best.</p>

            <div className="overlay-actions">
              <button className="btn-brass" onClick={() => { playKeySound("enter"); setShowTutorial(false); }}>Got it<ArrowRight size={16} /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Confetti() {
  const palette = ["#B8863E", "#E8B65C", "#3FA66B", "#4FA8C9"];
  const pieces = Array.from({ length: 22 }).map((_, i) => {
    const left = Math.random() * 100;
    const bg = palette[Math.floor(Math.random() * palette.length)];
    const dur = 1.6 + Math.random() * 1.2;
    const delay = Math.random() * 0.4;
    return (
      <div
        key={i}
        className="confetti-cube"
        style={{ left: left + "%", background: bg, animationDuration: dur + "s", animationDelay: delay + "s" }}
      />
    );
  });
  return <>{pieces}</>;
}