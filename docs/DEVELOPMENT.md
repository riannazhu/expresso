# Development and hosting

Node.js 22+, no runtime dependencies or API keys.

```sh
npm start
npm run check
npm test
```

The server binds to `0.0.0.0` and uses `PORT` (default 3000). Serve the browser interface and `/api` from the same origin. Docker and Render configurations are included. Use one always-running instance: rooms are in memory and expire after six idle hours; restarts clear them. Static hosting needs a separately hosted server and additional API/origin configuration.

The approved screenshots act as artwork atlases: SVG viewBoxes isolate physical buttons and mugs. Edited scene plates remove sample names and scores. Player names, room codes, tickets, readiness and scores remain live HTML, with SVG icons instead of platform emoji. Decorative button lettering is part of the artwork; all controls have accessible labels. The three cup objects offer hot, cold, and cold takeaway presentation; cold and takeaway use the same iced recipe cup type. Pointer and keyboard controls share the same server actions. Portrait phones can scroll horizontally across the landscape counter; every preparation action remains available.

Fraunces, Nunito, Caprasimo and Patrick Hand are bundled under the SIL Open Font License; see `public/assets/fonts-LICENSE.txt`.
