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
  const app = {
    innerHTML: "",
    addEventListener() {},
    querySelectorAll() {
      return [];
    },
  };
  const fields = { "#name": { value: "" }, "#code": { value: "" } };
  const document = {
    activeElement: null,
    querySelector(selector) {
      return selector === "#app" ? app : fields[selector] || {};
    },
  };
  const context = vm.createContext({
    document,
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
