# expresso

A multiplayer café game for 2–8 players. Prepare drinks during a five-minute shift; the biggest tip jar wins. Play everyone vs everyone, or work together in equal-sized teams. Solo practice is also available.

## How to play

### 1. Start or join

Enter your barista name, start a café, or enter a friend's room code. Choose **Practice shift** to learn on your own.

![Landing design reference: start, join, or practice](docs/screenshots/landing.webp)

### 2. Get ready

Click **Copy code** and share the five-character code. The host picks a mode; in Teams, choose Blue or Peach. Ready players' coasters light up. Once everyone is ready and teams are balanced, the host opens the café.

![Lobby design reference: ready coasters and game modes](docs/screenshots/lobby.webp)

### 3. Make drinks

Claim a clipped ticket. Its ingredient pictures show the recipe. Select a cup, press the machine's brew button, then click the milk pitcher and syrup pump you need. Each click adds one portion; each espresso shot takes 2.5 seconds. Open **Drink details & tools** to add ice for iced recipes or clear the cup, then ring the bell to serve.

A new ticket arrives immediately after serving. Customers wait 90 seconds. Accurate, fast drinks earn higher tips; expired tickets earn nothing. The live leaderboard tracks every café. In Teams, **Pass to teammate** keeps the unfinished drink intact.

![Gameplay design reference: torn tickets, physical controls, and live tips](docs/screenshots/gameplay.webp)

### 4. Clock out

The highest tips win; equal tips share the win. Review the mug podium, clock out, or let the host reopen the lobby for another shift.

![Results design reference: mug podium and final tips](docs/screenshots/results.webp)

The images above are the approved visual design references, not captured browser screenshots. The playable interface recreates the scene with live names, tickets, readiness lights, scores, and controls.

## Hosting

Public hosting is still pending. Multiplayer needs the included Node server; static GitHub hosting alone cannot run it. Rooms currently live in one server's memory and reset on restart. See [deployment and development](docs/DEVELOPMENT.md) for setup and checks.
