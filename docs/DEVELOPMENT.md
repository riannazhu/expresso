# Development and hosting

Node.js 22+, no runtime dependencies or API keys.

```sh
npm start
npm run check
npm test
```

The server binds to `0.0.0.0` and uses `PORT` (default 3000). Serve the browser interface and `/api` from the same origin. Docker and Render configurations are included. Use one always-running instance: rooms are in memory and expire after six idle hours; restarts clear them. Static hosting needs a separately hosted server and additional API/origin configuration.

Scene artwork and mug sprite were generated from the approved design references. Interface text and controls remain live HTML. The three cup objects offer hot, cold, and cold takeaway presentation; cold and takeaway use the same iced recipe cup type. Pointer and keyboard controls share the same server actions. Mobile layouts preserve every preparation action.

Fraunces and Nunito are bundled under the SIL Open Font License; see `public/assets/fonts-LICENSE.txt`.
