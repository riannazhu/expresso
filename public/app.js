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
  clock:
    '<svg viewBox="0 0 24 24"><path d="M6 2h12M6 22h12M7 2v5l5 5-5 5v5M17 2v5l-5 5 5 5v5"/></svg>',
};
function icon(name) {
  return icons[name] || "";
}
function mugArt(index = 0) {
  return `<img class="mug-art mug-${index % 4}" src="./assets/${["mug", "mug-cloud", "mug-flower", "mug-gingham"][index % 4]}.webp" alt="" draggable="false">`;
}
function mugIdentity(name) {
  if (state.mode === "teams") return name === "Blue café" ? 0 : 2;
  return Math.max(
    0,
    state.players.findIndex((player) => player.name === name),
  );
}
function header(time = "") {
  return `<header class="topbar"><a class="brand" href="./" aria-label="expresso home">express<span class="logo-bean" aria-hidden="true"></span></a><nav class="glass utilities" aria-label="Game controls"><button data-ui="rules"><span class="halo">${icon("book")}</span>How to play</button><button data-ui="sound" aria-pressed="${sound}"><span class="halo">${icon("sound")}</span>Sound${sound ? " on" : ""}</button>${time ? `<span class="timer" role="timer" aria-label="Shift time remaining">${icon("clock")}<b>${time}</b></span>` : ""}</nav></header>`;
}
function shell(kind, body, time = "") {
  app.innerHTML = `<div class="scene ${kind}">${header(time)}<main>${body}</main></div>`;
}
function home() {
  shell(
    "landing",
    `<form id="entry" class="entry-scene"><div class="name-tag"><label for="name">HELLO MY NAME IS</label><input id="name" name="name" maxlength="20" placeholder="Your name" autocomplete="nickname" required><span class="edit-mark" aria-hidden="true">✎</span></div><button class="glazed create" type="submit" name="intent" value="create">☕ Start a café <span>→</span></button><div class="join-ticket"><label for="code">ROOM CODE</label><input id="code" name="code" maxlength="5" placeholder="ABCDE" autocomplete="off" class="code-input"></div><button class="glazed join" type="submit" name="intent" value="join">Join a room <span>→</span></button><div class="practice-cup">${mugArt(0)}</div><button class="glazed cream practice" type="submit" name="intent" value="practice">Practice shift <span>→</span></button></form>`,
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
    `<div class="room-sign"><small>ROOM</small><strong>${esc(state.code)}</strong><button class="glazed cream compact" data-ui="invite">Copy invite ▢</button></div><div class="player-gallery" style="--count:${state.players.length}">${state.players.map((p, i) => `<article class="barista ${p.ready && p.online ? "is-ready" : ""}"><div class="coaster">${mugArt(i)}</div><div class="employee-label"><b>${esc(p.name)}</b><small>${p.host ? "♛ HOST" : p.me ? "YOU" : state.mode === "teams" ? esc(p.team) + " café" : ""}</small></div><span class="readiness"><i></i>${!p.online ? "Offline" : p.ready ? "Ready" : "Not ready"}</span></article>`).join("")}</div><div class="mode-switch"><button class="menu-choice ${state.mode === "ffa" ? "chosen" : ""}" data-mode="ffa" ${!state.host ? "disabled" : ""}><span>☕</span><b>Everyone<br>vs everyone</b><i></i></button><button class="menu-choice ${state.mode === "teams" ? "chosen" : ""}" data-mode="teams" ${!state.host || state.practice ? "disabled" : ""}><span>☕ ☕</span><b>Teams<br><small>serve together</small></b><i></i></button></div><aside class="chalkboard"><b>5-minute<br>shift</b><hr><b>Most tips<br>wins!</b><span>✿</span></aside>${state.mode === "teams" ? `<div class="team-switch glass"><span>Your team</span><button data-team="blue" aria-pressed="${state.me.team === "blue"}">Blue café</button><button data-team="peach" aria-pressed="${state.me.team === "peach"}">Peach café</button></div>` : ""}<button class="glazed ready-button" data-action="ready">${state.me.ready ? "Ready ✓" : "I’m ready"}</button>${state.host ? `<button class="glazed cream open-button" data-action="start" ${canStart ? "" : "disabled"}>Open the café</button>` : '<p class="host-wait glass">Waiting for the host</p>'}<button class="leave-link" data-action="leave">Leave room</button>`,
  );
}
function recipeText(r) {
  return `${r.shots} shot${r.shots > 1 ? "s" : ""} · ${r.milk === "none" ? "no milk" : r.milkUnits + " " + r.milk} · ${r.syrup === "none" ? "no syrup" : r.pumps + " " + r.syrup}${r.ice ? " · ice" : ""}`;
}
function recipeRows(r) {
  return `<span><i class="recipe-icon shot">☕</i>${r.shots} shot${r.shots === 1 ? "" : "s"}</span><span><i class="recipe-icon milk ${r.milk === "oat" ? "oat" : ""}">▥</i>${r.milk === "none" ? "No milk" : r.milkUnits + " " + (r.milk === "whole" ? "milk" : "oat")}</span><span><i class="recipe-icon flavor">${r.syrup === "vanilla" ? "✿" : r.syrup === "caramel" ? "▰" : "—"}</i>${r.syrup === "none" ? "No syrup" : r.pumps + " " + r.syrup}</span><span><i class="recipe-icon cold">${r.ice ? "❄" : "♨"}</i>${r.cup === "hot" ? "Hot cup" : "Cold cup"}${r.cup === "iced" && !r.ice ? " · no ice" : ""}</span>`;
}
function ticket(o) {
  const patience = Math.max(0, (o.expires - state.now) / 90000);
  return `<button class="paper-ticket ${selected === o.id ? "selected" : ""}" data-order="${esc(o.id)}" aria-pressed="${selected === o.id}"><span class="brass-clip"></span><small>#${o.index + 1} · ${esc(o.customer)}</small><h3>${esc(o.recipe.name)}</h3><div class="recipe-rows">${recipeRows(o.recipe)}</div><div class="patience"><i style="width:${patience * 100}%"></i></div><small>${Math.ceil(patience * 90)}s · ${o.mine ? "Yours" : o.claimedBy ? esc(o.claimedBy) : "Claim order"}</small></button>`;
}
const outlines = {
  "hot-cup":
    "M22 6Q48 0 72 5L77 21Q100 14 95 44Q91 61 77 57L73 82Q60 100 35 92L24 73Q2 80 5 43Q8 26 23 28Z",
  "cold-cup": "M4 4Q50-3 96 4L86 91Q50 102 14 91Z",
  takeaway: "M17 3H83L90 14H97V25H89L80 96H21L11 25H3V14H11Z",
  "whole-pitcher":
    "M8 9Q40-3 72 8L76 20Q103 8 96 48Q94 69 77 75L75 93Q39 106 11 94L6 21Z",
  "oat-pitcher": "M8 8Q44 0 77 9L80 21Q104 17 94 59L82 72L76 94Q42 104 12 94Z",
  "vanilla-pump": "M12 2H93V10H55V29L83 34L96 82V97H6V45L32 29V10H12Z",
  "caramel-pump": "M12 2H93V10H55V29L83 34L96 82V97H6V45L32 29V10H12Z",
  "serve-bell": "M45 3H58V12Q85 14 92 62L98 74V96H2V77L8 66Q13 19 45 12Z",
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
  const elapsed = state.now - state.starts;
  const mood = elapsed < 100000 ? "day" : elapsed < 200000 ? "sunset" : "night";
  const time = Math.max(0, Math.ceil((state.ends - state.now) / 1000));
  shell(
    "playing " + mood,
    `<div class="order-rail">${c.orders.map(ticket).join("")}</div><aside class="glass live-board" aria-label="Live tip leaderboard"><h2>Live tips</h2>${state.leaders.map((l, i) => `<div class="live-row ${l.mine ? "mine" : ""}"><span>${i + 1}</span>${mugArt(mugIdentity(l.name))}<b>${esc(l.name)}</b><strong>${money(l.tips)}</strong></div>`).join("")}</aside><section class="physical-station" aria-label="Drink preparation">${hotspot("Hot cup", "hot-cup " + (d?.cup === "hot" ? "active" : ""), "cup", 'data-cup="hot"', locked || !!d)}${hotspot("Cold cup", "cold-cup " + (d?.cup === "iced" ? "active" : ""), "cup", 'data-cup="iced"', locked || !!d)}${hotspot("To go · cold cup", "takeaway", "cup", 'data-cup="iced"', locked || !!d)}${hotspot(d?.brewingUntil ? "Brewing…" : `Brew shot · ${d?.shots || 0}/2`, "brew-switch " + (d?.brewingUntil ? "brewing" : ""), "brew", "", locked || !d || !!d.brewingUntil || d.shots >= 2)}${hotspot("Whole milk", "whole-pitcher", "milk", 'data-milk="whole"', locked || !d || d.milkUnits >= 2)}${hotspot("Oat milk", "oat-pitcher", "milk", 'data-milk="oat"', locked || !d || d.milkUnits >= 2)}${hotspot("Vanilla pump", "vanilla-pump", "syrup", 'data-syrup="vanilla"', locked || !d || d.pumps >= 2)}${hotspot("Caramel pump", "caramel-pump", "syrup", 'data-syrup="caramel"', locked || !d || d.pumps >= 2)}${hotspot("Serve drink", "serve-bell", "serve", "", locked || !d?.shots || !!d?.brewingUntil)}<div class="cup-labels"><span>Hot</span><span>Cold</span><span>To go</span></div><div class="drink-overlay ${d?.cup === "iced" ? "iced" : ""} ${d?.brewingUntil ? "pouring" : ""}" style="--fill:${d ? Math.min(85, d.shots * 20 + d.milkUnits * 22) : 0}%;--drink:${d?.milkUnits ? "#cda87f" : "#694126"}" aria-hidden="true"><div class="liquid" style="opacity:${d?.shots || d?.milkUnits ? 0.8 : 0}"></div>${d?.ice ? '<span class="ice-bits">▧ ▧</span>' : ""}</div><span class="jar-total">${money(c.tips)}</span></section><div class="prep-dock glass"><b>${o ? esc(o.recipe.name) : "Select a ticket to begin"}</b>${d ? `<span class="drink-details">${esc(recipeText(d))}${d.ice ? "" : " · no ice"}</span>` : "<span>Choose a cup, then use the machine and ingredients.</span>"}<div class="dock-actions"><button data-drink="ice" ${locked || !d || d.cup !== "iced" || d.ice ? "disabled" : ""}>❄ Add ice</button><button data-drink="reset" ${locked || !d ? "disabled" : ""}>Clear cup ↺</button>${state.mode === "teams" ? `<button data-drink="handoff" ${locked ? "disabled" : ""}>Pass to teammate</button>` : ""}</div></div>`,
    `${Math.floor(time / 60)}:${String(time % 60).padStart(2, "0")}`,
  );
}
function results() {
  shell(
    "results",
    `<h1 class="wrap-heading">${state.practice ? "Practice complete." : "That’s a wrap."}</h1><div class="podium-gallery" style="--count:${state.leaders.length}">${state.leaders.map((l, i) => `<article class="podium ${state.winners.includes(l.name) ? "winner" : ""}"><div class="podium-cup">${mugArt(mugIdentity(l.name))}<b class="mug-name">${esc(l.name)}</b></div><div class="score-tag"><small>${state.winners.includes(l.name) ? "Winner" : i + 1 + " place"}</small><strong>${money(l.tips)}</strong><span>${l.served} drinks</span></div><div class="podium-base">${state.winners.includes(l.name) ? '<span class="laurel">❧ <i class="logo-bean"></i> ❧</span>' : ""}</div></article>`).join("")}</div>${state.winners.length > 1 && !state.practice ? '<p class="tie-note glass">Equal tips — shared win</p>' : ""}<div class="result-actions"><button class="glazed" data-action="leave">Clock out →</button>${state.host ? '<button class="glazed cream" data-action="rematch">↻ Play again</button>' : '<span class="glass">Waiting for host to play again</span>'}</div>`,
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
app.addEventListener("click", async (e) => {
  const el = e.target.closest("button");
  if (!el) return;
  if (el.dataset.ui === "rules") document.querySelector("#rules").showModal();
  else if (el.dataset.ui === "sound") {
    sound = !sound;
    chime();
    render();
  } else if (el.dataset.ui === "invite") {
    const link = new URL(location.href);
    link.searchParams.set("room", state.code);
    try {
      await navigator.clipboard.writeText(link.href);
      toast("Invite link copied!");
    } catch {
      toast("Room code: " + state.code);
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
    if (!o.claimedBy || o.mine) {
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
      render();
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
