# Expresso product requirements

## Objective
Turn CalScape's Caffè Strada setting into an approachable competitive drink-making game. Use the approved non-pixel clay miniature style, cozy café atmosphere, and direct preparation controls. The patio is visible from the kitchen. Glade and Marina remain internal references only.

## Approved modes
- Everyone vs everyone: each player operates a separate café and competes on total tips.
- Teams: equal-sized teams share a café, drinks and tips; teams compete on total tips.
- Rooms support 2–8 players. Solo practice is separate from competitive play.

## Flow
Home → create/join room → choose mode/team → ready → five-minute shift → ranked results → rematch or leave.

During the shift: claim order → choose cup → brew shots → add milk/syrup/ice → serve. Orders remain visible at all preparation stations. Optional handoff releases the teammate lock and preserves the unfinished drink. Mistakes can be cleared and restarted.

## Rules
Two active tickets per café. Every café starts with the same recipe sequence. Each ticket lasts 90 seconds. Seven recipe fields determine accuracy; speed multiplies tips. No client-submitted scores. Five-minute shift with day/sunset/night transitions. Highest cents total wins; exact ties share the win. Readiness, equal teams and online players are required to start.

## Presentation and accessibility
Tactile kitchen artwork, warm cream/teal/peach palette, readable order cards, visible tips and timer. Separate preparation tabs reduce crowding. Phone layout stacks kitchen and shift stats. Controls use native buttons, readable labels and focus outlines. Sound is opt-in. Respect reduced-motion preferences. Rules are available from every screen.

## Acceptance checks
- Two independent sessions join the same room from separate devices through the shared server.
- FFA sessions receive matching recipes but cannot change each other's workspace.
- Team members see the same unfinished drink; only its claimant can edit it.
- Handoff, timed claim release, refresh reconnection and duplicate-serving protection work.
- Brew completion, expiration and shift end use server time.
- Tips are awarded once, show accuracy feedback, and produce final rankings.
- Rematch resets readiness, order state and scoring.
- Invalid room/session/action errors are readable; connection interruptions trigger automatic retries.
- Verify mobile and desktop in actual browsers before public submission.

## Deployment limit
Current build uses one Node server and in-memory rooms. Public server deployment is required for remote play. Browser QA, persistent storage, horizontal scaling and production rate limiting are not yet complete.
