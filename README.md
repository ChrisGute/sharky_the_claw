# Sharky the Claw

Play the published game at <https://chrisgute.github.io/sharky_the_claw/>.

## Development

Use Node.js 24 LTS. Run `npm ci`, then `npm run dev`. The production build is `npm run build`; use `npm run preview` to inspect it locally.

Run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run validate:content`, `npm test`, and `npm run test:e2e` before release. E2E requires Playwright browsers (`npx playwright install --with-deps`).

Audio is synthesized locally after a click, tap, or key press: it never fetches third-party media or starts before browser activation. Mute is saved with local progress. The game automatically pauses audio and gameplay when hidden; Resume always requires an explicit button press. Use `?debug=1` for development diagnostics when that overlay is enabled. To reset local progress, use **Reset progress** from the title screen and confirm the displayed phrase.

The development-only debug overlay reports build SHA, renderer, viewport, DPR, active fish, shark tier, boost state, and save revision. Its bounded, no-PII diagnostic JSON is available from `window.__sharkyDiagnostics()` in development only. Content extensions belong in frozen catalogs under `src/content/`: add an original SVG asset, a fish/level/upgrade entry, then run `npm run validate:content`.

Production safety checks run with `npm run build && npm run check:production`; they reject E2E bridge code, source maps, analytics, and external URLs. All art is original SVG in `src/assets`; no third-party runtime assets are used.

## GitHub Pages

Add a GitHub remote, push the default branch as `main`, then set **Settings → Pages → Source** to **GitHub Actions**. The Pages workflow uploads only `dist/`; Vite uses relative URLs so it works at the repository subpath. Its displayed build SHA is the commit that CI built.
