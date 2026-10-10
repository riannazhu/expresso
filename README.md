# Expresso

**Brew. Serve. Out-tip your friends.**

A competitive multiplayer café game set at Berkeley's Caffè Strada, with a tactile clay-style kitchen and patio: blossom pink, buttery cream, sage green, and warm peach. Built from the CalScape concept; the original README, PRD, and scene screenshots are retained under `docs/reference/`. Glade and Marina are not playable scenes.

## Run

Requires Node.js 22 or newer. There are no third-party dependencies and no API keys.

```sh
npm start
# Open http://localhost:3000
```

For another device on the same Wi-Fi, open `http://YOUR_COMPUTER_LAN_IP:3000`. For remote friends, deploy this server to a publicly reachable Node host. A frontend-only host such as GitHub Pages is insufficient.

## Play

1. Enter a name and start a café. Share the room code or copied invite link.
2. Friends join from their own browsers/devices. The host chooses **Everyone vs everyone** or **Teams**.
3. Everyone marks ready. Teams must be equal in size; 2–8 players are supported. Two players can play 1v1 in team mode; larger teams collaborate.
4. The host opens a five-minute shift. Every café receives the same recipe sequence and starts with two orders.
5. Claim an order, choose a hot or cold cup, brew the espresso, add milk, syrup, and ice, then serve.
6. Each espresso shot takes 2.5 seconds. Each milk/syrup button adds one portion. Tickets specify the exact quantities.
7. Tips depend on recipe accuracy and remaining patience. The highest individual tip jar or team tip jar wins. Exact ties share the win.

### Scoring

Each drink has seven scored details: cup, shot count, milk type, milk quantity, syrup type, syrup quantity, and ice. Accuracy is the fraction matching the ticket.

`tip in cents = round(500 × accuracy × (0.4 + 0.6 × remaining patience fraction))`

Patience lasts 90 seconds from ticket creation. Expired orders earn zero and are replaced. Serving replaces the ticket with the next order. Recipes advance in the same deterministic sequence for every café; faster cafés can serve more orders. The server owns clocks, ingredients, and scoring. Clients cannot submit tip amounts.

### Teams and reconnection

Teammates share the order rail, drinks, and tips. Claiming an order locks it to one barista to prevent simultaneous changes. **Pass to teammate** releases the claim without erasing the drink. Inactive claims release after 30 seconds. A reload reconnects using a tab-local session token. Opponents cannot edit another café.

The shift moves through afternoon, sunset, and night, each lasting 100 seconds. Solo practice uses the same preparation and scoring mechanics without competitive rankings.

## Deployment

Run a single Node process with `npm start`. The server listens on `0.0.0.0` and uses the host's `PORT` environment variable (default 3000). `/health` returns a health check. `Dockerfile` and `render.yaml` are included as deployment starting points. Deploying may involve host-specific accounts and billing; this project does not create those automatically.

**Current limitation:** rooms are held in server memory and expire after six hours without actions. A server restart clears rooms. Use one always-running instance for the demo; horizontal scaling and restart persistence require shared storage. Polling synchronizes room state about every 700 ms. There is no paid API or external database dependency.

## Development and validation

```sh
npm run dev
npm run check
npm test
```

The test suite verifies separate players, matching recipes, isolated cafés, team handoffs and locks, server-owned brewing/scoring, late joins, unauthorized sessions, expiration, ties, rematches, and complete games through real HTTP requests. Browser visual QA and a public deployment must still be completed before contest submission.

## Project layout

- `server/game.js`: room lifecycle, player sessions, recipes, preparation, scoring, teams.
- `server/index.js`: HTTP API and static serving; same-origin write protection.
- `public/app.js`: lobby, preparation stations, client synchronization, results, optional sound.
- `public/style.css`: responsive non-pixel café interface and dimensional drink objects.
- `public/cafe.webp`: original AI-generated clay café illustration.
- `test/game.test.js`: game and HTTP integration tests.
- `docs/PRD.md`: current rules and acceptance criteria.
- `docs/reference/`: original CalScape documentation and screenshots for internal reference.

## Contest handoff

The game supports separate devices, provides in-game rules, and has a runnable multiplayer server. Before submitting, publish it at a public URL and test with two real devices. Submit the title, cover image, description, and playable URL through Handshake's **Create a Multiplayer Game** mission. The supplied official rules give the deadline as **October 30, 2026 at 11:59 PM Pacific**.

Original CalScape reference audio attribution is preserved in its archived README. Those sound recordings are not shipped in Expresso's playable interface. The new kitchen artwork was generated for this project; interface/drink shapes are drawn with CSS and optional serve chimes are synthesized locally.
