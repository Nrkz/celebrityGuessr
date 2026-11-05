"use strict";
/* Blurrio — devine le perso. Voir README.md pour le fonctionnement. */

// ---------- Configuration ----------
const SB_URL = "https://qqmqiaspmxijjnmkarew.supabase.co/rest/v1/scores";
const SB_KEY = "sb_publishable_PB596PGqbPs7aROwWmoP8g_3B_lFqKE";   // clé publique, faite pour être visible
const DD = "https://ddragon.leagueoflegends.com";
const ROUNDS = 10, STEP_MS = 450, STEPS = 40;                       // ~18 s pour tout dévoiler
const MAX_BLUR = { lol: 14, pokemon: 10, nintendo: 8 };
const RESET_HOUR = 8;                                               // le défi du jour change à 8h (Paris)
const ROLES = { Fighter: "Combattant", Tank: "Tank", Mage: "Mage", Assassin: "Assassin", Marksman: "Tireur", Support: "Support" };
const NINTENDO_ALL = ["Super Mario","Animal Crossing","The Legend of Zelda","Fire Emblem","Splatoon","Metroid","Kirby",
  "Kid Icarus","Star Fox","Pikmin","Donkey Kong","Classic Nintendo","F-Zero","Earthbound","Xenoblade","ARMS","Punch Out",
  "Yoshi's Woolly World","Mario Sports Superstars"];
const SERIES_LABEL = { "The Legend of Zelda": "Zelda", "Classic Nintendo": "Nintendo classique" };

const GAMES = [
  { id: "lol",            label: "League of Legends", group: "Riot Games", sub: "173 champions" },
  { id: "pokemon",        label: "Pokémon",           group: "Nintendo",   sub: "par génération" },
  { id: "mario",          label: "Super Mario",       group: "Nintendo",   series: ["Super Mario"] },
  { id: "animalcrossing", label: "Animal Crossing",   group: "Nintendo",   series: ["Animal Crossing"] },
  { id: "zelda",          label: "Zelda",             group: "Nintendo",   series: ["The Legend of Zelda"] },
  { id: "fireemblem",     label: "Fire Emblem",       group: "Nintendo",   series: ["Fire Emblem"] },
  { id: "splatoon",       label: "Splatoon",          group: "Nintendo",   series: ["Splatoon"] },
  { id: "nintendo",       label: "Nintendo mélange",  group: "Nintendo",   series: NINTENDO_ALL, sub: "toutes les séries" },
  { id: "melange",        label: "Mélange",           group: "Tous les jeux", sub: "LoL + Pokémon + Nintendo" },
];
const game = id => GAMES.find(g => g.id === id);

// ---------- Utilitaires ----------
const $ = id => document.getElementById(id);
const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const compact = s => norm(s).replace(/ /g, "");
const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
function toast(t) { const el = $("toast"); el.textContent = t; el.classList.remove("hide"); setTimeout(() => el.classList.add("hide"), 2200); }
function lev(a, b) {
  const m = [...Array(a.length + 1)].map((_, i) => [i]);
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    m[i][j] = Math.min(m[i-1][j] + 1, m[i][j-1] + 1, m[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
  return m[a.length][b.length];
}

// Générateur aléatoire à graine : même graine => mêmes tirages chez tout le monde (défi du jour).
function seeded(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = (Math.imul(h ^ (h >>> 16), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rng) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// Jour du défi : heure de Paris, la journée change à 8h.
function dayKey(now = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const g = t => +p.find(x => x.type === t).value;
  const t = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute")) - RESET_HOUR * 3600e3;
  return new Date(t).toISOString().slice(0, 10);
}

// ---------- Réponses acceptées ----------
function matchOne(input, name) {
  const x = compact(input), n = compact(name);
  if (!x || !n) return false;
  if (x === n) return true;
  if (n.length >= 6 && lev(x, n) <= Math.floor(n.length / 6)) return true;     // petite faute de frappe
  const w = norm(name).split(" ");
  if (w.length > 1 && w[0].length >= 4 && x === w[0]) return true;             // "nunu", "renata"
  return false;
}
const isMatch = (input, e) => [e.name, ...(e.alt || [])].some(n => matchOne(input, n));

// ---------- Données : trois sources ----------
let LOL = null;
async function loadLol() {
  if (LOL) return LOL;
  const version = (await (await fetch(DD + "/api/versions.json")).json())[0];
  const [fr, en] = await Promise.all([
    fetch(`${DD}/cdn/${version}/data/fr_FR/champion.json`).then(r => r.json()),
    fetch(`${DD}/cdn/${version}/data/en_US/champion.json`).then(r => r.json()),
  ]);
  LOL = Object.values(fr.data).sort((a, b) => (a.id < b.id ? -1 : 1)).map(c => ({
    key: "lol:" + c.id, game: "lol", name: c.name, alt: [en.data[c.id]?.name || c.name, c.id],
    tag: ROLES[c.tags[0]] || c.tags[0], tl: "Rôle", imgs: [`${DD}/cdn/img/champion/splash/${c.id}_0.jpg`],     // skin de base
  }));
  return LOL;
}
const pokemonPool = gens => POKEMON.filter(p => gens.includes(p.gen)).map(p => ({
  key: "pk:" + p.id, game: "pokemon", name: p.fr, alt: [p.en], tag: "Génération " + p.gen, tl: "Indice",
  imgs: [`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${p.id}.png`],
}));
const nintendoPool = series => NINTENDO.filter(c => series.includes(c.series)).map(c => ({
  key: "nt:" + c.series + ":" + c.name, game: "nintendo", name: c.name, alt: [], tag: SERIES_LABEL[c.series] || c.series, tl: "Série", imgs: c.images,
}));

async function subPools(gameId, gens) {
  const g = game(gameId);
  if (gameId === "lol") return [await loadLol()];
  if (gameId === "pokemon") return [pokemonPool(gens)];
  if (gameId === "melange") return [await loadLol(), pokemonPool([1]), nintendoPool(NINTENDO_ALL)];
  return [nintendoPool(g.series)];
}

// 10 manches, entièrement déterminées par le générateur aléatoire fourni.
function buildRounds(pools, rng) {
  const order = pools.map(p => shuffle(p, rng)), used = pools.map(() => 0), rounds = [];
  for (let r = 0; r < ROUNDS; r++) {
    let pi = pools.length === 1 ? 0 : Math.floor(rng() * pools.length);
    for (let k = 0; k < pools.length && used[pi] >= order[pi].length; k++) pi = (pi + 1) % pools.length;
    if (used[pi] >= order[pi].length) break;
    const e = order[pi][used[pi]++];
    const img = e.imgs[Math.floor(rng() * e.imgs.length)];
    const same = shuffle(pools[pi].filter(x => x.key !== e.key && x.tag === e.tag), rng);
    const rest = shuffle(pools[pi].filter(x => x.key !== e.key && x.tag !== e.tag), rng);
    rounds.push({ e, img, choices: shuffle([e, ...[...same, ...rest].slice(0, 3)], rng) });
  }
  return rounds;
}

// ---------- Supabase ----------
const sb = (qs = "", opt = {}) => fetch(SB_URL + qs, { ...opt, headers: { apikey: SB_KEY, "Content-Type": "application/json", ...(opt.headers || {}) } });
async function alreadyPlayed(pseudo, gameId, day) {
  const r = await sb(`?select=score&pseudo=eq.${encodeURIComponent(pseudo)}&game=eq.${gameId}&day=eq.${day}&limit=1`);
  if (!r.ok) throw new Error("lecture " + r.status);
  return (await r.json())[0] || null;
}
async function submitScore(pseudo, gameId, day, score, correct) {
  const r = await sb("", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ pseudo, game: gameId, day, score, correct }) });
  if (r.status === 201) return "ok";
  if (r.status === 409) return "deja";
  throw new Error("envoi " + r.status);
}

// ---------- Navigation ----------
const VIEWS = ["home", "lobby", "game", "end", "board"];
function show(v) { VIEWS.forEach(x => $(x).classList.toggle("hide", x !== v)); }
const pseudo = () => $("pseudo").value.trim();
const pseudoOk = () => pseudo().length >= 2 && pseudo().length <= 20;
$("pseudo").value = store.get("blurrio-pseudo", "");
$("pseudo").addEventListener("input", () => store.set("blurrio-pseudo", pseudo()));

function renderHome() {
  const box = $("homeGames"); box.innerHTML = "";
  [...new Set(GAMES.map(g => g.group))].forEach(grp => {
    const h = document.createElement("h2"); h.textContent = grp; box.appendChild(h);
    const grid = document.createElement("div"); grid.className = "grid";
    GAMES.filter(g => g.group === grp).forEach(g => {
      const b = document.createElement("button"); b.className = "game";
      b.innerHTML = `${g.label}${g.sub ? `<small>${g.sub}</small>` : ""}`;
      b.onclick = () => openLobby(g.id); grid.appendChild(b);
    });
    box.appendChild(grid);
  });
}
$("toBoard").onclick = () => openBoard("lol");

// ---------- Salle d'un jeu ----------
let S = {};
const GEN_KEY = "blurrio-gens";
function selectedGens() {
  const g = [...document.querySelectorAll("#gens input:checked")].map(i => +i.value);
  return g.length ? g : [1];
}
async function openLobby(id) {
  S.gameId = id; const g = game(id); show("lobby");
  $("lobbyTitle").textContent = g.label;
  $("lobbyMsg").textContent = ""; $("lobbyMsg").className = "msg";
  const day = dayKey();
  $("lobbyInfo").textContent = `Défi du jour : ${day} (change à ${RESET_HOUR}h, heure de Paris) — la première partie du jour compte au classement.`;
  $("gensBox").classList.toggle("hide", id !== "pokemon");
  if (id === "pokemon" && !$("gens").children.length) {
    const saved = JSON.parse(store.get(GEN_KEY, "[1]"));
    for (let n = 1; n <= 9; n++) {
      const l = document.createElement("label");
      l.innerHTML = `<input type="checkbox" value="${n}" ${saved.includes(n) ? "checked" : ""}> Gen ${n}`;
      l.querySelector("input").onchange = () => store.set(GEN_KEY, JSON.stringify(selectedGens()));
      $("gens").appendChild(l);
    }
  }
  $("playDaily").disabled = false; $("playFree").disabled = false;
  await refreshDailyStatus();
}
// Vérifie (si un pseudo est saisi) que le défi du jour n'a pas déjà été joué. Ne bloque jamais sans pseudo.
async function refreshDailyStatus() {
  $("lobbyMsg").textContent = ""; $("lobbyMsg").className = "msg";
  $("playDaily").disabled = false;
  if (!pseudoOk()) return;
  try {
    const row = await alreadyPlayed(pseudo(), S.gameId, dayKey());
    if (row) { $("lobbyMsg").textContent = `Défi du jour déjà joué : ${row.score} pts. Reviens demain à ${RESET_HOUR}h !`; $("lobbyMsg").className = "msg ok"; $("playDaily").disabled = true; }
  } catch { $("lobbyMsg").textContent = "Classement indisponible pour l'instant (réseau). Tu peux jouer en partie libre."; $("lobbyMsg").className = "msg bad"; }
}
$("pseudo").addEventListener("change", refreshDailyStatus);
$("lobbyBack").onclick = () => show("home");
$("lobbyBoard").onclick = () => openBoard(S.gameId);
$("playDaily").onclick = async () => {
  if (!pseudoOk()) {                       // le pseudo se demande ici, au moment de lancer le défi
    $("lobbyMsg").textContent = "Saisis ton pseudo (2 à 20 caractères) pour jouer le défi du jour."; $("lobbyMsg").className = "msg bad";
    $("pseudo").focus(); return;
  }
  await refreshDailyStatus();
  if (!$("playDaily").disabled) startGame("daily");
};
$("playFree").onclick = () => startGame("free");

// ---------- Partie ----------
let T = null;
const mult = () => Math.min(3, 1 + S.streak * 0.25);
const clarity = () => 1 - S.step / STEPS;
const freePts = () => Math.round(20 + 80 * clarity());
const choicePts = () => 10;

async function startGame(mode) {
  S.mode = mode; S.day = dayKey();
  $("playDaily").disabled = true; $("playFree").disabled = true;
  try {
    const rng = mode === "daily" ? seeded(S.day + "|" + S.gameId) : Math.random;
    const pools = await subPools(S.gameId, mode === "daily" ? [1] : selectedGens());
    S.rounds = buildRounds(pools, rng);
  } catch { $("lobbyMsg").textContent = "Impossible de charger les données (réseau ?)."; $("lobbyMsg").className = "msg bad"; $("playFree").disabled = false; $("playDaily").disabled = false; return; }
  $("playFree").disabled = false;
  if (!S.rounds.length) { $("lobbyMsg").textContent = "Pas assez de personnages pour jouer."; return; }
  Object.assign(S, { idx: -1, score: 0, streak: 0, correct: 0, results: [], phase: "idle" });
  $("modeTag").textContent = (mode === "daily" ? "📅 Défi " + S.day : "🎲 Libre") + " · " + game(S.gameId).label;
  show("game"); nextRound();
}
function updateHud() {
  $("round").textContent = Math.min(S.idx + 1, ROUNDS); $("streak").textContent = S.streak;
  $("mult").textContent = mult().toFixed(2).replace(/\.?0+$/, ""); $("score").textContent = S.score;
}
function loadImg(url) { return new Promise(res => { const i = new Image(); i.onload = () => res(true); i.onerror = () => res(false); i.referrerPolicy = "no-referrer"; i.src = url; }); }

async function nextRound() {
  clearInterval(T); S.idx++; S.phase = "loading";
  if (S.idx >= S.rounds.length) return finish();
  updateHud();
  $("msg").textContent = ""; $("msg").className = "msg";
  $("choices").classList.add("hide"); $("form").classList.remove("hide");
  $("next").classList.add("hide"); $("skip").classList.remove("hide");
  $("answer").value = ""; $("pic").style.visibility = "hidden"; $("loading").textContent = "Chargement…"; $("loading").classList.remove("hide");
  const r = S.rounds[S.idx];
  if (!(await loadImg(r.img))) { $("loading").textContent = "Image indisponible, on passe…"; S.results.push({ name: r.e.name, ok: false, pts: 0, skipped: true }); return setTimeout(nextRound, 800); }
  S.cur = r; S.step = 0; S.phase = "blur"; S.max = MAX_BLUR[r.e.game];
  const pic = $("pic"); pic.style.transition = "none"; pic.style.filter = `blur(${S.max}px)`; pic.src = r.img; pic.style.visibility = "visible";
  $("loading").classList.add("hide"); $("tagLabel").textContent = r.e.tl; $("cat").textContent = r.e.tag;
  requestAnimationFrame(() => { pic.style.transition = ""; });
  tick(); $("answer").focus();
  T = setInterval(() => { S.step++; if (S.step >= STEPS) { clearInterval(T); sharp(); } tick(); }, STEP_MS);
}
function tick() {
  const c = clarity();
  $("pic").style.filter = `blur(${(S.max * c).toFixed(1)}px)`;
  $("bar").style.width = (c * 100) + "%";
  $("pts").textContent = S.phase === "blur" ? Math.round(freePts() * mult()) : Math.round(choicePts() * mult());
}
function sharp() {
  S.phase = "choice"; S.step = STEPS; tick(); $("form").classList.add("hide");
  const box = $("choices"); box.innerHTML = ""; box.classList.remove("hide");
  S.cur.choices.forEach(o => { const b = document.createElement("button"); b.textContent = o.name; b.onclick = () => pickChoice(b, o); box.appendChild(b); });
  $("msg").textContent = "Image nette ! Choisis le bon nom (points réduits)."; $("msg").className = "msg";
}
function endRound(ok, pts) {
  S.phase = "done"; clearInterval(T);
  $("pic").style.filter = "blur(0)"; $("bar").style.width = "0%";
  $("form").classList.add("hide"); $("skip").classList.add("hide"); $("next").classList.remove("hide");
  $("next").textContent = S.idx >= S.rounds.length - 1 ? "Résultat →" : "Suivant →";
  const name = S.cur.e.name;
  $("choices").querySelectorAll("button").forEach(b => { b.disabled = true; if (b.textContent === name) b.classList.add("good"); });
  if (ok) { S.streak++; S.correct++; S.score += pts; $("msg").textContent = `✅ ${name} ! +${pts} pts` + (S.streak >= 2 ? ` (série ×${mult()})` : ""); $("msg").className = "msg ok"; }
  else { S.streak = 0; $("msg").textContent = `❌ C'était ${name}`; $("msg").className = "msg bad"; }
  S.results.push({ name, ok, pts }); updateHud(); $("next").focus();
}
function pickChoice(btn, o) {
  if (S.phase !== "choice") return;
  const ok = o.key === S.cur.e.key; if (!ok) btn.classList.add("wrong");
  endRound(ok, Math.round(choicePts() * mult()));
}
$("form").addEventListener("submit", e => {
  e.preventDefault(); if (S.phase !== "blur") return;
  if (isMatch($("answer").value, S.cur.e)) endRound(true, Math.round(freePts() * mult()));
  else { $("msg").textContent = "Non, continue de chercher…"; $("msg").className = "msg bad"; $("answer").select(); }
});
$("skip").onclick = () => { if (S.phase === "blur") { clearInterval(T); sharp(); } else if (S.phase === "choice") endRound(false, 0); };
$("next").onclick = nextRound;

async function finish() {
  clearInterval(T); show("end");
  const g = game(S.gameId);
  $("endMode").textContent = (S.mode === "daily" ? `Défi du jour ${S.day}` : "Partie libre") + " · " + g.label;
  $("final").textContent = S.score;
  const bk = "blurrio-best:" + S.gameId, best = +store.get(bk, 0);
  $("record").textContent = S.score > best ? "🏆 Nouveau record perso !" : `Record perso : ${best}`;
  if (S.score > best) store.set(bk, S.score);
  $("recap").innerHTML = S.results.map(r => `<li><span>${r.ok ? "✅" : "❌"} ${r.name}</span><b>${r.pts ? "+" + r.pts : "0"}</b></li>`).join("");
  $("submitMsg").textContent = ""; $("submitMsg").className = "msg";
  if (S.mode === "free") { $("submitMsg").textContent = "Partie libre : ce score ne compte pas au classement. Joue le Défi du jour !"; }
  if (S.mode === "daily") {
    $("submitMsg").textContent = "Envoi de ton score…";
    try {
      const res = await submitScore(pseudo(), S.gameId, S.day, S.score, S.correct);
      $("submitMsg").textContent = res === "ok" ? "✅ Score enregistré au classement du jour !" : "Tu avais déjà joué ce défi : ce score ne compte pas.";
      $("submitMsg").className = "msg " + (res === "ok" ? "ok" : "bad");
    } catch { $("submitMsg").textContent = "❌ Score non envoyé (réseau). Il n'a pas été enregistré."; $("submitMsg").className = "msg bad"; }
  }
}
$("again").onclick = () => openLobby(S.gameId);
$("endHome").onclick = () => show("home");
$("endBoard").onclick = () => openBoard(S.gameId);
$("share").onclick = async () => {
  const g = game(S.gameId), url = location.origin === "null" || location.protocol === "file:" ? location.href.split("?")[0] : location.origin + location.pathname;
  const text = `🌫️ Blurrio — ${g.label} : ${S.score} pts (${S.correct}/${S.results.length})${S.mode === "daily" ? " · défi du " + S.day : ""}\nÀ toi de jouer : ${url}?jeu=${S.gameId}`;
  try { if (navigator.share) { await navigator.share({ text }); return; } } catch { return; }
  try { await navigator.clipboard.writeText(text); toast("Score copié !"); } catch { prompt("Copie ce message :", text); }
};

// ---------- Classements ----------
let period = "day";
function openBoard(id) {
  show("board");
  const sel = $("boardGame");
  if (!sel.children.length) GAMES.forEach(g => { const o = document.createElement("option"); o.value = g.id; o.textContent = g.label; sel.appendChild(o); });
  sel.value = id || "lol"; loadBoard();
}
$("boardGame").onchange = loadBoard;
$("boardBack").onclick = () => show("home");
$("tabs").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  period = b.dataset.p; [...$("tabs").children].forEach(x => x.classList.toggle("on", x === b)); loadBoard();
});
async function loadBoard() {
  const gameId = $("boardGame").value, day = dayKey(), table = $("boardTable");
  table.innerHTML = "<tr><td>Chargement…</td></tr>";
  const [y, m] = day.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  let filt = "", info = "";
  if (period === "day") { filt = `&day=eq.${day}`; info = `Défi du ${day}`; }
  else if (period === "month") { filt = `&day=gte.${day.slice(0, 7)}-01&day=lt.${next}`; info = "Meilleur score de chaque joueur ce mois-ci"; }
  else info = "Meilleur score de chaque joueur, tous les temps";
  $("boardInfo").textContent = info;
  try {
    const r = await sb(`?select=pseudo,score,correct&game=eq.${gameId}${filt}&order=score.desc,created_at.asc&limit=1000`);
    if (!r.ok) throw 0;
    const best = new Map();
    (await r.json()).forEach(x => { if (!best.has(x.pseudo) || best.get(x.pseudo).score < x.score) best.set(x.pseudo, x); });
    const rows = [...best.values()].sort((a, b) => b.score - a.score).slice(0, 20);
    if (!rows.length) { table.innerHTML = "<tr><td>Personne n'a encore joué ici. Sois le premier !</td></tr>"; return; }
    const me = pseudo(), esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    table.innerHTML = rows.map((x, i) => `<tr class="${x.pseudo === me ? "me" : ""}"><td>${i + 1}</td><td>${esc(x.pseudo)} <small>${x.correct}/10</small></td><td>${x.score}</td></tr>`).join("");
  } catch { table.innerHTML = "<tr><td>Classement indisponible (réseau).</td></tr>"; }
}

// ---------- Démarrage ----------
renderHome(); show("home");
const wanted = new URLSearchParams(location.search).get("jeu");
if (wanted && game(wanted)) openLobby(wanted);
