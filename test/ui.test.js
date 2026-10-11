import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { Game } from "../server/game.js";
import { createServer } from "../server/index.js";

const source = await readFile(
  new URL("../public/app.js", import.meta.url),
  "utf8",
);
function renderer() {
  const handlers = {};
  let copied = "";
  const app = {
    innerHTML: "",
    addEventListener(type, handler) {
      handlers[type] = handler;
    },
    querySelectorAll() {
      return [];
    },
  };
  const fields = {
    "#name": { value: "" },
    "#code": { value: "" },
    "#toast": { textContent: "", classList: { add() {}, remove() {} } },
  };
  const document = {
    activeElement: null,
    querySelector(selector) {
      return selector === "#app" ? app : fields[selector] || {};
    },
  };
  const context = vm.createContext({
    document,
    navigator: {
      clipboard: {
        async writeText(value) {
          copied = value;
        },
      },
    },
    URL,
    location: { href: "http://localhost/" },
    sessionStorage: { getItem() {}, removeItem() {}, setItem() {} },
    setInterval() {},
    setTimeout() {},
    clearTimeout() {},
  });
  vm.runInContext(source, context);
  return {
    app,
    fields,
    context,
    handlers,
    copied: () => copied,
    show(state) {
      context.snapshot = state;
      vm.runInContext("state=snapshot;render()", context);
      return app.innerHTML;
    },
  };
}

test("scene renderer safely displays player names across lobby, gameplay and results", () => {
  let now = 1000;
  const game = new Game({ now: () => now });
  const host = game.create("<img src=x>");
  const guest = game.join(host.code, "Alex");
  const ui = renderer();
  const lobby = ui.show(game.state(host.code, host.token));
  assert.ok(lobby.includes("&lt;img src=x&gt;"));
  assert.ok(!lobby.includes("<img src=x>"));
  assert.match(lobby, /data-action="start" disabled/);
  game.action(host.code, guest.token, { type: "ready", ready: true });
  game.action(host.code, host.token, { type: "ready", ready: true });
  const ready = ui.show(game.state(host.code, host.token));
  assert.match(ready, /barista is-ready/);
  assert.ok(!ready.includes('data-action="start" disabled'));
  const playing = game.action(host.code, host.token, { type: "start" });
  const html = ui.show(playing);
  assert.match(html, /paper-ticket/);
  assert.match(html, /Live tips/);
  assert.match(html, /data-drink="serve"/);
  assert.ok(html.includes("Alex"));
  now += 300001;
  const results = ui.show(game.state(host.code, host.token));
  assert.match(results, /podium-gallery/);
  assert.match(results, /shared win/);
  assert.ok(!results.includes("<img src=x>"));
});

test("home utilities preserve typed name and invite code", () => {
  const ui = renderer();
  ui.fields["#name"].value = "Rianna";
  ui.fields["#code"].value = "BREW2";
  ui.show(null);
  assert.equal(ui.fields["#name"].value, "Rianna");
  assert.equal(ui.fields["#code"].value, "BREW2");
});

test("all scene assets, fonts and mug identities are available from the server", async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const path of [
      "cafe-day.webp",
      "landing-blank.webp",
      "lobby-plate.webp",
      "results-blank.webp",
      "reference-landing.webp",
      "reference-lobby.webp",
      "reference-gameplay.webp",
      "reference-results.webp",
      "logo.webp",
      "wrap-title.webp",
      "caprasimo.ttf",
      "patrick-hand.ttf",
      "workstation.webp",
      "cafe-sunset.webp",
      "mug.webp",
      "mug-cloud.webp",
      "mug-flower.webp",
      "mug-gingham.webp",
      "fraunces.ttf",
      "nunito.ttf",
      "nunito-400.ttf",
      "nunito-700.ttf",
    ]) {
      const response = await fetch(`${origin}/assets/${path}`);
      assert.equal(response.status, 200, path);
      assert.equal(
        response.headers.get("content-type"),
        path.endsWith(".ttf") ? "font/ttf" : "image/webp",
      );
      assert.ok((await response.arrayBuffer()).byteLength > 1000, path);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("copy control copies only the room code and Sound label remains unchanged", async () => {
  const game = new Game();
  const host = game.create("Rianna");
  const ui = renderer();
  ui.show(host.state);
  await ui.handlers.click({
    target: { closest: () => ({ dataset: { ui: "invite" } }) },
  });
  assert.equal(ui.copied(), host.code);
  assert.match(ui.app.innerHTML, /Copy code <svg/);
  assert.match(ui.app.innerHTML, /class="mute-slash"/);
  assert.ok(!ui.app.innerHTML.includes("Sound off"));
  vm.runInContext("sound=true;render()", ui.context);
  assert.ok(!ui.app.innerHTML.includes("mute-slash"));
  assert.ok(!ui.app.innerHTML.includes("Sound on"));
  assert.match(ui.app.innerHTML, />Sound<\/button>/);
});

test("ticket clicks claim then release an intact drink, and show preparation progress", async () => {
  const game = new Game();
  const host = game.create("Rianna", true);
  game.action(host.code, host.token, { type: "ready", ready: true });
  const playing = game.action(host.code, host.token, { type: "start" });
  const order = playing.cafe.orders[0];
  const ui = renderer();
  ui.context.hostSession = host;
  vm.runInContext("session=hostSession", ui.context);
  ui.context.fetch = async (url, options) => {
    const { action } = JSON.parse(options.body);
    return { ok: true, json: async () => game.action(host.code, host.token, action) };
  };
  ui.show(playing);
  const click = dataset => ui.handlers.click({ target: { closest: () => ({ dataset }) } });
  await click({ order: order.id });
  assert.equal(game.state(host.code, host.token).cafe.orders[0].mine, true);
  await click({ drink: "cup", cup: "hot" });
  assert.match(ui.app.innerHTML, /drink-progress/);
  assert.match(ui.app.innerHTML, /aria-current="step"/);
  assert.ok(!ui.app.innerHTML.includes('class="prep-dock'));
  await click({ order: order.id });
  const released = game.state(host.code, host.token).cafe.orders[0];
  assert.equal(released.claimedBy, null);
  assert.equal(released.drink.cup, "hot");
  await click({ order: order.id });
  assert.equal(game.state(host.code, host.token).cafe.orders[0].mine, true);
});
