"use strict";
/* Blurrio — devine le perso. Voir README.md pour le fonctionnement. */

// ---------- Configuration ----------
const SB_URL = "https://qqmqiaspmxijjnmkarew.supabase.co/rest/v1/scores";
const SB_KEY = "sb_publishable_PB596PGqbPs7aROwWmoP8g_3B_lFqKE";   // clé publique, faite pour être visible
const DD = "https://ddragon.leagueoflegends.com";
const ROUNDS = 10, STEP_MS = 450, STEPS = 40;                       // ~18 s pour tout dévoiler
const MAX_BLUR = { lol: 14, pokemon: 10, nintendo: 8, brawl: 5 };   // par type d'image (les petites images supportent moins de flou)
const RESET_HOUR = 8;                                               // le défi du jour change à 8h (Paris)
const ROLES = { Fighter: "Combattant", Tank: "Tank", Mage: "Mage", Assassin: "Assassin", Marksman: "Tireur", Support: "Support" };
const NINTENDO_ALL = ["Super Mario","Animal Crossing","The Legend of Zelda","Fire Emblem","Splatoon","Metroid","Kirby",
  "Kid Icarus","Star Fox","Pikmin","Donkey Kong","Classic Nintendo","F-Zero","Earthbound","Xenoblade","ARMS","Punch Out",
  "Yoshi's Woolly World","Mario Sports Superstars"];
const SERIES_LABEL = { "The Legend of Zelda": "Zelda", "Classic Nintendo": "Nintendo classique", "Pokemon": "Pokémon", "Megaman": "Mega Man",
  "Pac-man": "Pac-Man", "Banjo Kazooie": "Banjo-Kazooie", "Earthbound": "EarthBound", "Punch Out": "Punch-Out!!", "Kid Icarus": "Kid Icarus" };
const CLASS_FR = { "Damage Dealer": "Dégâts", "Tank": "Tank", "Marksman": "Tireur", "Artillery": "Artillerie", "Controller": "Contrôle", "Assassin": "Assassin", "Support": "Soutien" };
const VARIANTS = new Set(["Ratha V", "Razewing Ratha"]);        // variantes écartées (trop proches d'un autre nom)

const GAMES = [
  { id: "lol",            label: "League of Legends", group: "Riot Games", sub: "173 champions" },
  { id: "pokemon",        label: "Pokémon",           group: "Nintendo",   sub: "par génération" },
  { id: "mario",          label: "Super Mario",       group: "Nintendo",   series: ["Super Mario"] },
  { id: "animalcrossing", label: "Animal Crossing",   group: "Nintendo",   series: ["Animal Crossing"] },
  { id: "zelda",          label: "Zelda",             group: "Nintendo",   series: ["The Legend of Zelda"] },
  { id: "fireemblem",     label: "Fire Emblem",       group: "Nintendo",   series: ["Fire Emblem"] },
  { id: "splatoon",       label: "Splatoon",          group: "Nintendo",   series: ["Splatoon"] },
  { id: "smash",          label: "Super Smash Bros",  group: "Nintendo",   sub: "83 combattants, tous univers" },
  { id: "nintendo",       label: "Nintendo mélange",  group: "Nintendo",   series: NINTENDO_ALL, sub: "toutes les séries" },
  { id: "monsterhunter",  label: "Monster Hunter",    group: "Capcom",     sub: "monstres et compagnons" },
  { id: "brawl",          label: "Brawl Stars",       group: "Supercell",  sub: "tous les brawlers" },
  { id: "melange",        label: "Mélange total",     group: "Tous les jeux", sub: "tous les jeux ci-dessus" },
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
// Orthographe indulgente : on compare aussi "au son" (ph=f, c/q=k, h muet, lettres doublées…)
// et on tolère quelques fautes selon la longueur. Seul le nom attendu est comparé, donc pas de faux positifs entre personnages.
const phon = s => compact(s).replace(/ph/g, "f").replace(/h/g, "").replace(/[cq]/g, "k").replace(/y/g, "i")
  .replace(/z/g, "s").replace(/w/g, "v").replace(/(.)\1+/g, "$1");
const tolerance = len => (len >= 11 ? 3 : len >= 8 ? 2 : len >= 4 ? 1 : 0);
function close(x, n, px, pn) { const t = tolerance(n.length); return lev(x, n) <= t || lev(px, pn) <= t; }
function matchOne(input, name) {
  const x = compact(input), n = compact(name);
  if (!x || !n) return false;
  if (x === n) return true;
  const px = phon(input), pn = phon(name);
  if (px === pn || close(x, n, px, pn)) return true;
  // un seul mot du nom suffit : "nunu", "renata", "willump"
  const words = norm(name).split(" ");
  return words.length > 1 && words.some(w => w.length >= 4 && close(x, compact(w), px, phon(w)));
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

const lab = s => SERIES_LABEL[s] || s;
const smashPool = () => SMASH.map(c => ({ key: "sm:" + c.name, game: "nintendo", name: c.name, alt: [], tag: lab(c.series), tl: "Univers", imgs: c.images }));
const extraPool = series => EXTRA.filter(c => series.includes(c.series) && !VARIANTS.has(c.name))
  .map(c => ({ key: "ex:" + c.series + ":" + c.name, game: "nintendo", name: c.name, alt: [], tag: lab(c.series), tl: "Série", imgs: c.images }));

// Brawl Stars : liste des brawlers en direct (Brawlify), icône sans bordure.
let BRAWL = null;
async function loadBrawl() {
  if (BRAWL) return BRAWL;
  const d = await (await fetch("https://api.brawlapi.com/v1/brawlers")).json();
  BRAWL = d.list.filter(b => b.released !== false && b.imageUrl2).sort((a, b) => a.id - b.id).map(b => ({
    key: "bs:" + b.id, game: "brawl", name: b.name, alt: [], tag: CLASS_FR[b.class?.name] || b.class?.name || "Brawler", tl: "Classe", imgs: [b.imageUrl2],
  }));
  return BRAWL;
}

async function subPools(gameId, gens) {
  const g = game(gameId);
  if (gameId === "lol") return [await loadLol()];
  if (gameId === "pokemon") return [pokemonPool(gens)];
  if (gameId === "smash") return [smashPool()];
  if (gameId === "monsterhunter") return [extraPool(["Monster Hunter"])];
  if (gameId === "brawl") return [await loadBrawl()];
  if (gameId === "melange") {                       // un jeu en panne ne bloque pas le mélange
    const pools = [await loadLol(), pokemonPool([1]), nintendoPool(NINTENDO_ALL), smashPool(), extraPool(["Monster Hunter"])];
    try { pools.push(await loadBrawl()); } catch {}
    return pools;
  }
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
// Le pseudo est demandé à la fin d'un défi du jour, puis retenu sur l'appareil.
const pseudo = () => store.get("blurrio-pseudo", "").trim();
const validPseudo = s => s.length >= 2 && s.length <= 20;
const pseudoOk = () => validPseudo(pseudo());
const dailyKey = (g, d) => `blurrio-daily:${g}:${d}`;   // verrou par appareil : valeur "started" puis le score

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
// Le défi du jour est verrouillé sur cet appareil dès qu'il est lancé (la première partie compte seule).
async function refreshDailyStatus() {
  $("lobbyMsg").textContent = ""; $("lobbyMsg").className = "msg";
  $("playDaily").disabled = false;
  const v = store.get(dailyKey(S.gameId, dayKey()));
  if (v !== null) {
    $("lobbyMsg").textContent = v === "started" ? `Défi du jour déjà lancé sur cet appareil. Reviens demain à ${RESET_HOUR}h !`
      : `Défi du jour déjà joué : ${v} pts. Reviens demain à ${RESET_HOUR}h !`;
    $("lobbyMsg").className = "msg ok"; $("playDaily").disabled = true; return;
  }
  if (!pseudoOk()) return;
  try {
    const row = await alreadyPlayed(pseudo(), S.gameId, dayKey());
    if (row) { $("lobbyMsg").textContent = `Défi du jour déjà joué : ${row.score} pts. Reviens demain à ${RESET_HOUR}h !`; $("lobbyMsg").className = "msg ok"; $("playDaily").disabled = true; }
  } catch { $("lobbyMsg").textContent = "Classement indisponible pour l'instant (réseau). Tu peux jouer en partie libre."; $("lobbyMsg").className = "msg bad"; }
}
$("lobbyBack").onclick = () => show("home");
$("lobbyBoard").onclick = () => openBoard(S.gameId);
$("playDaily").onclick = async () => {
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
  if (mode === "daily") store.set(dailyKey(S.gameId, S.day), "started");     // verrou : une seule tentative par jour
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
  $("submitBox").classList.add("hide");
  if (S.mode === "daily") {                  // le pseudo se demande ici, après le quiz
    store.set(dailyKey(S.gameId, S.day), String(S.score));
    $("pseudoEnd").value = pseudo(); $("submitBtn").disabled = false; $("submitBox").classList.remove("hide");
  }
}
$("submitForm").addEventListener("submit", async e => {
  e.preventDefault();
  const p = $("pseudoEnd").value.trim();
  if (!validPseudo(p)) { $("submitMsg").textContent = "Le pseudo doit faire 2 à 20 caractères."; $("submitMsg").className = "msg bad"; return; }
  $("submitBtn").disabled = true; $("submitMsg").textContent = "Envoi de ton score…"; $("submitMsg").className = "msg";
  try {
    const res = await submitScore(p, S.gameId, S.day, S.score, S.correct);
    if (res === "ok") { store.set("blurrio-pseudo", p); $("submitBox").classList.add("hide"); $("submitMsg").textContent = "✅ Score enregistré au classement du jour !"; $("submitMsg").className = "msg ok"; }
    else { $("submitBtn").disabled = false; $("submitMsg").textContent = "Ce pseudo a déjà un score pour ce défi aujourd'hui. Choisis-en un autre."; $("submitMsg").className = "msg bad"; }
  } catch { $("submitBtn").disabled = false; $("submitMsg").textContent = "❌ Envoi impossible (réseau). Réessaie."; $("submitMsg").className = "msg bad"; }
});
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
