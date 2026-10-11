const app = document.querySelector("#app");
let session = null;
try {
  session = JSON.parse(sessionStorage.getItem("expresso-session") || "null");
} catch {
  sessionStorage.removeItem("expresso-session");
}
let state = null,
  selected = null,
  station = "brew",
  busy = false,
  errors = 0,
  sound = false,
  context = null,
  previousTips = 0;
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (n) => "$" + (n / 100).toFixed(2);
const toast = (message) => {
  const el = document.querySelector("#toast");
  el.textContent = message;
  el.classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("visible"), 3500);
};
function chime() {
  if (!sound) return;
  context ??= new AudioContext();
  context.resume();
  for (const [i, f] of [523, 659, 784].entries()) {
    const o = context.createOscillator(),
      g = context.createGain();
    o.type = "sine";
    o.frequency.value = f;
    g.gain.setValueAtTime(0, context.currentTime + i * 0.08);
    g.gain.linearRampToValueAtTime(0.06, context.currentTime + i * 0.08 + 0.02);
    g.gain.exponentialRampToValueAtTime(
      0.001,
      context.currentTime + i * 0.08 + 0.3,
    );
    o.connect(g);
    g.connect(context.destination);
    o.start(context.currentTime + i * 0.08);
    o.stop(context.currentTime + i * 0.08 + 0.3);
  }
}
async function api(path, data) {
  const r = await fetch("/api/" + path, {
    method: data ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: "Bearer " + session.token } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const body = await r.json();
  if (!r.ok) throw new Error(body.error || "Connection failed.");
  return body;
}
function save(value) {
  session = value;
  sessionStorage.setItem("expresso-session", JSON.stringify(value));
}

const icons = {
  book: '<svg viewBox="0 0 24 24"><path d="M12 5C8 2 4 3 2 4v16c4-2 7-2 10 0 3-2 6-2 10 0V4c-4-2-7-1-10 1Zm0 0v15"/></svg>',
  sound:
    '<svg viewBox="0 0 24 24"><path d="M9 17V5l11-2v12M9 9l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><path d="M9 5V2h6v3h4v17H7V5Zm0 0h6M7 7H3v13h4"/></svg>',
  crown:
    '<svg viewBox="0 0 24 24"><path d="m3 7 5 4 4-7 4 7 5-4-3 13H6Z"/></svg>',
  clock:
    '<svg viewBox="0 0 24 24"><path d="M6 2h12M6 22h12M7 2v5l5 5-5 5v5M17 2v5l-5 5 5 5v5"/></svg>',
};
function icon(name) {
  return icons[name] || "";
}
// The approved artwork is an atlas. SVG viewBoxes crop physical controls without
// resizing/redrawing the illustration; dynamic data is always live HTML.
function art(scene, x, y, width, height, cls = "", path = "") {
  const id = `cut-${scene}-${x}-${y}`;
  return `<svg class="reference-art ${cls}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true" focusable="false">${path ? `<defs><clipPath id="${id}"><path d="${path}"/></clipPath></defs>` : ""}<image href="./assets/${scene}.webp" x="${-x}" y="${-y}" width="1672" height="941" ${path ? `clip-path="url(#${id})"` : ""}/></svg>`;
}
function mugArt(index = 0) {
  const mugs = [
    [
      318,
      455,
      241,
      176,
      "M6 22Q7 0 94 3Q176-2 184 23L183 35Q223 24 237 62Q247 103 214 126L185 132Q176 169 107 170Q35 172 18 136Z",
    ],
    [
      599,
      456,
      245,
      178,
      "M8 22Q11 0 100 4Q174 0 182 25L183 37Q225 25 239 65Q251 105 214 131L187 133Q174 175 107 174Q29 170 19 132Z",
    ],
    [
      871,
      461,
      245,
      171,
      "M7 22Q10 0 97 4Q170 0 185 23L185 38Q223 26 240 63Q250 106 216 129L183 136Q165 171 105 169Q39 169 22 133Z",
    ],
    [
      1147,
      462,
      238,
      169,
      "M8 22Q8 0 98 3Q176 0 182 24L183 36Q224 24 234 66Q247 101 215 125L183 134Q163 169 106 166Q32 168 20 129Z",
    ],
  ];
  return art(
    "reference-lobby",
    ...mugs[index % 4].slice(0, 4),
    "mug-art",
    mugs[index % 4][4],
  );
}
function mugIdentity(name) {
  if (state.mode === "teams") return name === "Blue café" ? 0 : 2;
  return Math.max(
    0,
    state.players.findIndex((player) => player.name === name),
  );
}
function header(time = "") {
  return `<header class="topbar"><a class="brand" href="./" aria-label="expresso home"><svg class="logo-image" viewBox="15 180 2150 450" preserveAspectRatio="none" aria-hidden="true"><image href="./assets/logo.webp" width="2172" height="724"/></svg></a><nav class="glass utilities" aria-label="Game controls"><button data-ui="rules"><span class="halo">${icon("book")}</span>How to play</button><button data-ui="sound" aria-label="${sound ? "Mute sound" : "Enable sound"}" aria-pressed="${sound}"><span class="halo ${sound ? "" : "muted"}">${icon("sound")}${sound ? "" : '<svg class="mute-slash" viewBox="0 0 24 24"><path d="M3 3L21 21"/></svg>'}</span>Sound</button>${time ? `<span class="timer" role="timer" aria-label="Shift time remaining">${icon("clock")}<b>${time}</b></span>` : ""}</nav></header>`;
}
function shell(kind, body, time = "") {
  app.innerHTML = `<div class="scene ${kind}">${header(time)}<main>${body}</main></div>`;
}
function home() {
  shell(
    "landing",
    `<form id="entry" class="entry-scene"><label class="sr-only" for="name">Your barista name</label><input id="name" name="name" maxlength="20" placeholder="Your name" autocomplete="nickname" required><button class="art-button create" type="submit" name="intent" value="create" aria-label="Start a café"></button><label class="sr-only" for="code">Room code</label><input id="code" name="code" maxlength="5" placeholder="ABCDE" autocomplete="off" class="code-input"><button type="button" class="copy-entry" data-ui="copy-entry" aria-label="Copy room code"></button><button class="art-button join" type="submit" name="intent" value="join" aria-label="Join a room"></button><button class="art-button practice" type="submit" name="intent" value="practice" aria-label="Practice shift"></button></form>`,
  );
}
function lobby() {
  const ready = state.players.every((p) => p.ready && p.online);
  const blue = state.players.filter((p) => p.team === "blue").length;
  const canStart =
    ready &&
    (state.practice || state.players.length >= 2) &&
    (state.mode !== "teams" ||
      (blue > 0 && blue === state.players.length - blue));
  shell(
    "lobby",
    `<div class="room-sign"><small>ROOM</small><strong>${esc(state.code)}</strong><button class="glazed cream compact" data-ui="invite">Copy code ${icon("copy")}</button></div><div class="player-gallery" style="--count:${state.players.length}">${state.players.map((p, i) => `<article class="barista ${p.ready && p.online ? "is-ready" : ""}"><div class="coaster">${mugArt(i)}</div><div class="employee-label"><b>${esc(p.name)}</b><small>${p.host ? icon("crown") + " HOST" : p.me ? "YOU" : state.mode === "teams" ? esc(p.team) + " café" : ""}</small></div><span class="readiness"><i></i>${!p.online ? "Offline" : p.ready ? "Ready" : "Not ready"}</span></article>`).join("")}</div><div class="mode-switch"><button class="menu-choice ${state.mode === "ffa" ? "chosen" : ""}" data-mode="ffa" aria-pressed="${state.mode === "ffa"}" aria-label="Everyone vs everyone" ${!state.host ? "disabled" : ""}>${art("reference-lobby", 30, 727, 245, 190, "", "M39 5Q9 6 7 34L3 139Q1 175 37 182L203 178Q241 175 241 146L238 28Q237 5 206 5Z")}<i></i></button><button class="menu-choice ${state.mode === "teams" ? "chosen" : ""}" data-mode="teams" aria-pressed="${state.mode === "teams"}" aria-label="Teams serve together" ${!state.host || state.practice ? "disabled" : ""}>${art("reference-lobby", 276, 729, 250, 188, "", "M37 4Q8 6 5 31L2 143Q4 177 32 181L208 178Q245 172 245 144L243 26Q239 5 209 4Z")}<i></i></button></div><aside class="sr-only">5-minute shift. Most tips wins!</aside>${state.mode === "teams" ? `<div class="team-switch glass"><span>Your team</span><button data-team="blue" aria-pressed="${state.me.team === "blue"}">Blue café</button><button data-team="peach" aria-pressed="${state.me.team === "peach"}">Peach café</button></div>` : ""}<button class="sprite-button ready-button" data-action="ready" aria-pressed="${state.me.ready}" aria-label="${state.me.ready ? "Not ready" : "I'm ready"}">${art("reference-lobby", 543, 736, 610, 182, "", "M115 5C-22 3-22 168 115 168H490C643 169 643 5 490 5Z")}${state.me.ready ? '<span class="ready-tick" aria-hidden="true">✓</span>' : ""}</button>${state.host ? `<button class="sprite-button open-button" data-action="start" ${canStart ? "" : "disabled"} aria-label="Open the café">${art("reference-lobby", 1180, 776, 435, 126, "", "M74 6C-13 5-13 111 74 111H353C456 112 456 6 353 6Z")}</button>` : '<p class="host-wait glass">Waiting for the host</p>'}<button class="leave-link" data-action="leave">Leave room</button>`,
  );
}
function recipeText(r) {
  return `${r.shots} shot${r.shots > 1 ? "s" : ""} · ${r.milk === "none" ? "no milk" : r.milkUnits + " " + r.milk} · ${r.syrup === "none" ? "no syrup" : r.pumps + " " + r.syrup}${r.ice ? " · ice" : ""}`;
}
const ingredientIcons = {
  shot: '<svg viewBox="0 0 40 40"><path fill="#b77531" d="M8 10h21l-3 17H11Z"/><path d="M7 10q11-5 22 0M29 12q13-2 6 10h-8M5 31h29M8 10l3 17q7 6 15 0l3-17"/></svg>',
  milk: '<svg viewBox="0 0 40 40"><path fill="#c8e4ed" d="M9 11l6-8h12l5 8v24H9Z"/><path d="M9 11l6-8h12l5 8v24H9Zm0 0h23M15 3l5 8v24M24 17h5v8h-5"/></svg>',
  oat: '<svg viewBox="0 0 40 40"><path fill="#c5d393" d="M9 11l6-8h12l5 8v24H9Z"/><path d="M9 11l6-8h12l5 8v24H9Zm0 0h23M15 3l5 8v24M24 17v13m0-7 5-4m-5 8 5-4"/></svg>',
  vanilla:
    '<svg viewBox="0 0 40 40"><path fill="#ffd381" d="M20 17C1-2 0 18 16 20 0 31 16 42 20 25c7 18 24 0 4-4 23-11 0-26-4-4Z"/><circle cx="20" cy="21" r="5" fill="#c78a33"/></svg>',
  caramel:
    '<svg viewBox="0 0 40 40"><path fill="#d98437" d="m4 19 11-6 12 6v14l-11 5-12-6Zm14-11 9-5 11 6v13l-10 5-10-6Z"/><path d="m4 19 12 6 11-6M16 25v13m2-30 10 6 10-5M28 14v13"/></svg>',
  ice: '<svg viewBox="0 0 40 40"><path fill="#9dddf2" d="m5 11 15-7 15 7v20l-15 7-15-7Z"/><path d="m5 11 15 8 15-8M20 19v19M5 11l15-7 15 7v20l-15 7-15-7Z"/></svg>',
  cold: '<svg viewBox="0 0 40 40"><path fill="#e8c495" d="M11 16h20l-4 22H14Z"/><path d="m11 12 3 26h13l4-26M8 12q14-7 26 0M23 1l-4 25M8 12q14 8 26 0"/></svg>',
  none: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="14"/><path d="m10 10 20 20"/></svg>',
};
function ingredient(name) {
  return `<i class="recipe-icon">${ingredientIcons[name]}</i>`;
}
const cupLabel = cup => cup === "hot" ? "Hot" : cup === "togo" ? "To go" : "Cold";
function cupGraphic(cup) {
  if (cup === "iced") return '<svg viewBox="0 0 40 40"><path d="M9 6Q20 2 31 6L28 34Q20 39 12 34ZM9 6Q20 11 31 6M14 11L16 31M20 12V33M26 11L24 31"/></svg>';
  if (cup === "togo") return '<svg viewBox="0 0 40 40"><path d="M10 8L12 3H28L30 8M7 8H33V13H7ZM10 13L13 36H27L30 13M12 23H28"/></svg>';
  return ingredientIcons.shot;
}
function recipeRows(r) {
  return `<span>${ingredient("shot")}${r.shots} shot${r.shots === 1 ? "" : "s"}</span><span>${ingredient(r.milk === "oat" ? "oat" : r.milk === "none" ? "none" : "milk")}${r.milk === "none" ? "No milk" : r.milkUnits + " " + (r.milk === "whole" ? "milk" : "oat")}</span><span>${ingredient(r.syrup === "none" ? "none" : r.syrup)}${r.syrup === "none" ? "No syrup" : r.pumps + " " + r.syrup}</span>${r.ice ? `<span>${ingredient("ice")}Ice</span>` : ""}<span>${ingredient(r.cup === "iced" ? "cold" : "shot")}${r.cup === "iced" ? "Cold" : "Hot"}${r.cup === "iced" && !r.ice ? " · no ice" : ""}</span>`;
}
function ticket(o) {
  const patience = Math.max(0, (o.expires - state.now) / 90000);
  return `<div class="ticket-wrap"><span class="brass-clip" aria-hidden="true"></span><button class="paper-ticket ${selected === o.id ? "selected" : ""}" data-order="${esc(o.id)}" aria-pressed="${selected === o.id}" aria-label="${esc(o.recipe.name)}, ${o.mine ? "your order" : o.claimedBy ? "claimed by " + esc(o.claimedBy) : "claim order"}"><div class="ticket-cup">${cupGraphic(o.recipe.cup)}${cupLabel(o.recipe.cup)}</div><h3>${esc(o.recipe.name)}</h3><div class="recipe-rows">${recipeRows(o.recipe)}</div><div class="patience"><i style="width:${patience * 100}%"></i></div><small>${Math.ceil(patience * 90)}s · ${o.mine ? "Yours" : o.claimedBy ? esc(o.claimedBy) : "Claim"}</small></button></div>`;
}
function drinkProgress(d, order) {
  const brewed = !!d?.shots && !d?.brewingUntil && d.shots >= (order?.recipe.shots || 1);
  const finished = brewed && d.milkUnits >= (order?.recipe.milkUnits || 0);
  const current = !d ? 0 : !brewed ? 1 : !finished ? 2 : 3;
  const steps = [["Cup", cupGraphic(d?.cup || order?.recipe.cup)], ["Brew", ingredientIcons.shot], ["Milk", '<svg viewBox="0 0 40 40"><path d="M9 7Q18 4 28 7L26 12Q29 27 26 33Q18 37 10 33L11 13ZM28 12C39 9 38 25 28 27"/></svg>'], ["Serve", cupGraphic(d?.cup || order?.recipe.cup)]];
  return `<ol class="drink-progress" aria-label="Drink progress">${steps.map(([label, image], i) => `<li class="${i < current ? "complete" : i === current ? "current" : "pending"}" ${i === current ? 'aria-current="step"' : ""}><span class="step-icon">${image}</span><b>${label}</b></li>`).join("")}</ol>`;
}
function machineTool(label, cls, type, disabled) {
  const image = type === "ice" ? ingredientIcons.ice : '<svg viewBox="0 0 40 40"><path d="M10 12H30L28 34Q20 37 12 34ZM7 9H33M16 8V4H24V8M17 16V29M23 16V29"/></svg>';
  return `<button class="object-control machine-tool ${cls}" data-drink="${type}" ${disabled ? "disabled" : ""} aria-label="${label}" title="${label}"><i class="machine-tool-art" aria-hidden="true">${image}</i><span>${label}</span></button>`;
}
function centerCup(d) {
  const patch = '<svg class="empty-cup-patch" viewBox="0 0 295 190" preserveAspectRatio="none" aria-hidden="true"><image href="./assets/workstation-empty.webp" width="295" height="190"/></svg>';
  if (!d) return patch;
  const cuts = {
    hot: [667, 526, 276, 180, "M8 14Q90-8 194 12L202 48Q233 17 262 39Q290 72 264 118Q250 140 203 145Q181 181 100 177Q14 180 6 125Z"],
    iced: [230, 594, 129, 158, "M4 10Q62-7 126 10L117 142Q68 165 14 145Z"],
    togo: [365, 562, 145, 192, "M18 17Q70-3 131 18L132 35H142L140 54H130L118 181Q70 200 29 183L17 56H5V39H14Z"],
  };
  const [x,y,w,h,path] = cuts[d.cup] || cuts.hot;
  return patch + `<div class="center-cup-art cup-${d.cup}">${art("workstation", x,y,w,h,"",path)}</div>`;
}
function drinkSurface(d) {
  if (!d || (!d.shots && !d.milkUnits && !d.ice && !d.brewingUntil)) return "";
  return `<div class="drink-overlay cup-${d.cup} ${d.cup === "iced" ? "iced" : ""} ${d.brewingUntil ? "pouring" : ""}" aria-hidden="true"><div class="clay-liquid ${d.milkUnits ? "milky" : "espresso"}"><span class="crema"></span>${d.pumps ? '<span class="syrup-swirl"></span>' : ""}</div>${d.ice ? '<div class="clay-ice"><i></i><i></i><i></i></div>' : ""}</div>`;
}
const outlines = {
  "hot-cup":
    "M25 9C40 0 79 0 94 9Q99 14 98 23L94 62C90 85 79 96 60 97C42 97 31 90 26 77C10 81 1 68 2 47C3 28 11 20 25 23ZM25 33C14 29 9 36 9 48Q8 67 24 65Z",
  "cold-cup": "M4 4Q50-3 96 4L86 91Q50 102 14 91Z",
  takeaway: "M17 3H83L90 14H97V25H89L80 96H21L11 25H3V14H11Z",
  "whole-pitcher": "M6 9Q40-2 94 9L90 22L93 89Q89 103 50 96Q18 101 10 88Z",
  "oat-pitcher": "M8 8Q44 0 77 9L80 21Q104 17 94 59L82 72L76 94Q42 104 12 94Z",
  "vanilla-pump": "M8 4Q45-1 90 4Q94 8 90 12H57V25Q73 25 73 30V36Q89 42 92 52L94 88Q94 97 80 97H20Q6 97 6 88L8 52Q11 42 27 36V30Q27 25 43 25V12H8Q3 8 8 4Z",
  "caramel-pump": "M8 4Q45-1 90 4Q94 8 90 12H57V25Q73 25 73 30V36Q89 42 92 52L94 88Q94 97 80 97H20Q6 97 6 88L8 52Q11 42 27 36V30Q27 25 43 25V12H8Q3 8 8 4Z",
  "serve-bell": "M46 3Q50 0 55 3L55 14C77 17 88 33 91 58Q96 62 93 67Q91 72 84 73Q96 79 97 88Q98 96 88 97H12Q2 96 3 88Q4 79 16 73Q5 72 7 65Q8 61 10 58C13 34 25 17 46 14Z",
  "brew-switch": "M50 3A47 47 0 1 1 49.9 3Z",
};
function hotspot(label, cls, type, extra = "", disabled = false) {
  const shape = outlines[cls.split(" ")[0]];
  return `<button class="object-control ${cls}" data-drink="${type}" ${extra} ${disabled ? "disabled" : ""} aria-label="${label}" title="${label}"><svg class="object-outline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${shape}"/></svg><span>${label}</span></button>`;
}
function playing() {
  const c = state.cafe;
  const o = c.orders.find((x) => x.id === selected);
  if (!o) selected = null;
  const d = o?.drink;
  const locked = !o?.mine;
  const time = Math.max(0, Math.ceil((state.ends - state.now) / 1000));
  shell(
    "playing" + (time <= 10 ? " urgent" : ""),
    `<div class="order-rail">${c.orders.map(ticket).join("")}</div><aside class="glass live-board" aria-label="Live tip leaderboard"><h2>Live tips</h2>${state.leaders.map((l, i) => `<div class="live-row ${l.mine ? "mine" : ""}"><span>${i + 1}</span>${mugArt(mugIdentity(l.name))}<b>${esc(l.name)}</b><strong>${money(l.tips)}</strong></div>`).join("")}</aside><section class="physical-station" aria-label="Drink preparation">${hotspot("Hot cup", "hot-cup " + (d?.cup === "hot" ? "active" : ""), "cup", 'data-cup="hot"', locked || !!d)}${hotspot("Cold cup", "cold-cup " + (d?.cup === "iced" ? "active" : ""), "cup", 'data-cup="iced"', locked || !!d)}${hotspot("To go cup", "takeaway " + (d?.cup === "togo" ? "active" : ""), "cup", 'data-cup="togo"', locked || !!d)}${hotspot(d?.brewingUntil ? "Brewing…" : `Brew shot · ${d?.shots || 0}/2`, "brew-switch " + (d?.brewingUntil ? "brewing" : ""), "brew", "", locked || !d || !!d.brewingUntil || d.shots >= 2)}${machineTool("Add ice", "ice-switch", "ice", locked || !d || d.cup !== "iced" || d.ice)}${machineTool("Clear cup", "clear-switch", "reset", locked || !d)}${hotspot(`Whole milk · ${d?.milk === "whole" ? d.milkUnits : 0}/2`, "whole-pitcher", "milk", 'data-milk="whole"', locked || !d || d.milkUnits >= 2)}${hotspot(`Oat milk · ${d?.milk === "oat" ? d.milkUnits : 0}/2`, "oat-pitcher", "milk", 'data-milk="oat"', locked || !d || d.milkUnits >= 2)}${hotspot(`Vanilla pump · ${d?.syrup === "vanilla" ? d.pumps : 0}/2`, "vanilla-pump", "syrup", 'data-syrup="vanilla"', locked || !d || d.pumps >= 2)}${hotspot(`Caramel pump · ${d?.syrup === "caramel" ? d.pumps : 0}/2`, "caramel-pump", "syrup", 'data-syrup="caramel"', locked || !d || d.pumps >= 2)}${hotspot("Serve drink", "serve-bell", "serve", "", locked || !d?.shots || !!d?.brewingUntil)}<div class="cup-labels">${art("reference-gameplay", 25, 740, 510, 72)}</div>${centerCup(d)}${drinkSurface(d)}<div class="jar-label"><span>Tips</span><strong>${money(c.tips)}</strong></div></section>${state.mode === "teams" ? `<button class="handoff-tool" data-drink="handoff" ${locked ? "disabled" : ""}>Pass to teammate</button>` : ""}${drinkProgress(d, o)}`,
    `${Math.floor(time / 60)}:${String(time % 60).padStart(2, "0")}`,
  );
}
const podiumCuts = [
  [
    260,
    410,
    413,
    326,
    "M55 35Q60 2 198 5Q330 5 335 39L335 70Q389 64 410 123Q419 178 378 204L339 211 349 226Q387 234 388 266L388 299C365 326 27 338 3 300L3 247Q5 221 73 210Q54 183 55 35Z",
  ],
  [
    673,
    449,
    324,
    267,
    "M25 40Q24 5 145 5Q259 5 260 42L261 62Q308 53 318 98Q338 151 289 173L267 183 268 201Q309 210 310 231L309 252C285 274 33 277 3 252L3 221Q9 204 41 197Q25 171 25 40Z",
  ],
  [
    995,
    481,
    282,
    239,
    "M28 34Q29 5 134 5Q237 4 239 36L240 56Q271 59 279 97Q290 139 261 158L242 172 244 188Q268 196 271 211C244 235 22 245 1 218L0 192 38 178Q28 155 28 34Z",
  ],
  [
    1282,
    500,
    269,
    237,
    "M19 34Q20 5 118 5Q212 3 214 34L217 52Q256 48 265 93Q276 131 245 150L217 162 216 181Q254 190 252 213C232 236 24 241 5 214L5 185 27 176Q18 151 19 34Z",
  ],
];
function podiumArt(index) {
  const cut = podiumCuts[index % 4];
  return art("results-blank", ...cut.slice(0, 4), "podium-art", cut[4]);
}
function results() {
  shell(
    "results",
    `<h1 class="wrap-heading">${state.practice ? "Practice complete." : '<svg class="wrap-image" viewBox="20 170 2128 405" preserveAspectRatio="none" role="img" aria-label="That’s a wrap."><image href="./assets/wrap-title.webp" width="2148" height="732"/></svg>'}</h1><div class="podium-gallery" style="--count:${state.leaders.length}">${state.leaders.map((l, i) => `<article class="podium rank-${Math.min(i, 3)} ${state.winners.includes(l.name) ? "winner" : ""}">${podiumArt(i)}<b class="mug-name">${esc(l.name)}</b><div class="score-tag"><strong>${money(l.tips)}</strong><span>${l.served}<br>drinks</span></div><span class="sr-only">${state.winners.includes(l.name) ? "Winner" : i + 1 + " place"}</span></article>`).join("")}</div>${state.winners.length > 1 && !state.practice ? '<p class="tie-note glass">Equal tips — shared win</p>' : ""}<div class="result-actions"><button class="sprite-button clock-out" data-action="leave" aria-label="Clock out">${art("reference-results", 468, 740, 590, 149, "", "M97 5C-22 6-22 140 97 140H476C610 142 610 5 476 5Z")}</button>${state.host ? `<button class="sprite-button play-again" data-action="rematch" aria-label="Play again">${art("reference-results", 1070, 757, 326, 121, "", "M64 7C-11 6-11 113 64 113H262C340 113 340 7 262 7Z")}</button>` : '<span class="glass">Waiting for host to play again</span>'}</div>`,
  );
}
function render() {
  const focused = document.activeElement;
  const identity =
    focused?.tagName === "BUTTON"
      ? Array.from(focused.attributes)
          .filter((a) => a.name.startsWith("data-"))
          .map((a) => [a.name, a.value])
      : [];
  const draft = !state
    ? {
        name: document.querySelector("#name")?.value || "",
        code: document.querySelector("#code")?.value || "",
      }
    : null;
  if (!state) home();
  else if (state.phase === "lobby") lobby();
  else if (state.phase === "playing") playing();
  else results();
  if (draft) {
    document.querySelector("#name").value = draft.name;
    document.querySelector("#code").value = draft.code;
  }
  if (identity.length) {
    const match = Array.from(app.querySelectorAll("button")).find((b) =>
      identity.every(([key, value]) => b.getAttribute(key) === value),
    );
    match?.focus({ preventScroll: true });
  }
}
async function action(a) {
  if (busy) return;
  busy = true;
  try {
    const s = await api("action", { code: session.code, action: a });
    if (s.left) {
      save(null);
      state = null;
      selected = null;
      home();
    } else {
      state = s;
      render();
    }
  } catch (e) {
    toast(e.message);
  } finally {
    busy = false;
  }
}
app.addEventListener("submit", async (e) => {
  if (e.target.id !== "entry") return;
  e.preventDefault();
  if (busy) return;
  busy = true;
  const data = new FormData(e.target),
    intent = e.submitter?.value;
  try {
    const result = await api(intent === "join" ? "join" : "create", {
      name: data.get("name"),
      code: String(data.get("code")).trim().toUpperCase(),
      practice: intent === "practice",
    });
    save({ code: result.code, token: result.token });
    state = result.state;
    selected = null;
    previousTips = 0;
    render();
  } catch (e) {
    toast(e.message);
  } finally {
    busy = false;
  }
});
// Polling must not replace a button between pointerdown and click.
let pointerPressed = false;
app.addEventListener("pointerdown", () => { pointerPressed = true; });
app.addEventListener("pointerup", () => { pointerPressed = false; });
app.addEventListener("pointercancel", () => { pointerPressed = false; });
document.addEventListener?.("pointerup", () => { pointerPressed = false; });
app.addEventListener("click", async (e) => {
  pointerPressed = false;
  const el = e.target.closest("button");
  if (!el) return;
  if (el.dataset.ui === "rules") document.querySelector("#rules").showModal();
  else if (el.dataset.ui === "sound") {
    sound = !sound;
    chime();
    render();
  } else if (el.dataset.ui === "invite" || el.dataset.ui === "copy-entry") {
    const code =
      state?.code || document.querySelector("#code").value.trim().toUpperCase();
    if (!code) return toast("Enter a room code first.");
    try {
      await navigator.clipboard.writeText(code);
      toast("Room code copied!");
    } catch {
      toast("Room code: " + code);
    }
  } else if (el.dataset.mode) action({ type: "mode", mode: el.dataset.mode });
  else if (el.dataset.team) action({ type: "team", team: el.dataset.team });
  else if (el.dataset.action)
    action({
      type: el.dataset.action,
      ...(el.dataset.action === "ready" ? { ready: !state.me.ready } : {}),
    });
  else if (el.dataset.order) {
    selected = el.dataset.order;
    const o = state.cafe.orders.find((o) => o.id === selected);
    if (o.mine) {
      selected = null;
      await action({ type: "handoff", orderId: o.id });
    } else if (!o.claimedBy) {
      station = o.drink ? "finish" : "brew";
      await action({ type: "claim", orderId: selected });
    } else render();
  } else if (el.dataset.station) {
    station = el.dataset.station;
    render();
  } else if (el.dataset.drink) {
    const type = el.dataset.drink;
    await action({
      type,
      orderId: selected,
      ...(el.dataset.cup ? { cup: el.dataset.cup } : {}),
      ...(el.dataset.milk ? { milk: el.dataset.milk } : {}),
      ...(el.dataset.syrup ? { syrup: el.dataset.syrup } : {}),
    });
    if (
      type === "serve" &&
      state?.cafe &&
      !state.cafe.orders.some((o) => o.id === selected)
    ) {
      selected = null;
      station = "brew";
      chime();
    }
    render();
  }
});
document.querySelector("#rules .close").onclick = () =>
  document.querySelector("#rules").close();
document.querySelector(".close-rule").onclick = () =>
  document.querySelector("#rules").close();
let polling = false;
setInterval(async () => {
  if (!session || polling || busy) return;
  polling = true;
  try {
    const next = await api("state?code=" + encodeURIComponent(session.code));
    const tip = next.cafe?.tips || 0;
    if (tip > previousTips) {
      const h = next.cafe.history[0];
      if (h)
        toast(
          `${h.customer}: +${money(h.cents)} · ${h.accuracy}% recipe match`,
        );
      chime();
    }
    previousTips = tip;
    errors = 0;
    if (!state || next.version >= state.version) {
      state = next;
      if (!pointerPressed) render();
    }
  } catch (e) {
    errors++;
    if (errors === 3)
      toast("Connection interrupted. Reconnecting automatically…");
    if (e.message.includes("Room not found") || e.message.includes("session")) {
      save(null);
      state = null;
      home();
      toast(e.message);
    }
  } finally {
    polling = false;
  }
}, 700);
render();
if (!session) {
  const code = new URL(location.href).searchParams.get("room");
  if (code)
    document.querySelector("#code").value = code.toUpperCase().slice(0, 5);
} else
  api("state?code=" + encodeURIComponent(session.code))
    .then((s) => {
      state = s;
      previousTips = s.cafe?.tips || 0;
      render();
    })
    .catch((e) => {
      save(null);
      toast(e.message);
      home();
    });
