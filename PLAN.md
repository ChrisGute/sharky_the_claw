Sharky the Claw — Technical Implementation Plan

Implementation review — 2026-08-15

The August release review found that Phases 1–4 were substantially present, but the build still exposed Phase 3 placeholder circles instead of the authored character catalog. Several Phase 5–6 release gates were also missing or too weak to catch that disconnect. This pass corrects the ship-blocking integration gaps:

- Original shark and fish SVGs are loaded through the Vite-safe asset catalog and rendered as animated Phaser images with circular physics bodies.
- Both waters now include layered depth, caustics, bubbles, coral, character bob/turn animation, tier warnings, bump feedback, score popups, and reduced-effects behavior.
- The semantic HUD now tracks score, catch count, time, level, sound, pause, and boost without rebuilding the DOM every frame or resetting displayed state.
- Title, level select, ready guidance, shop, pause, results, progression, replay, portrait recovery, and safe-area layouts received a production UI pass.
- Web Audio now supplies original layered cues and quiet procedural music after user activation, with pause, mute persistence, concurrency limiting, and cleanup. No external audio files or provenance are required.
- Oversized-fish collisions now apply a clearly signposted one-second stun that blocks steering and boost, while pointer steering rotates the shark's head toward its destination across the full 360-degree movement range.
- Round replay explicitly resumes the shared audio context before restarting music, closing the scene-shutdown race that previously silenced later rounds.
- Playwright now asserts real character textures, live score behavior, mute/HUD stability, replay state, lifecycle soak, accessibility, nested deployment, and cross-browser startup. Screenshot byte counts are retained only as an additional render-health signal.

The GitHub Pages workflow now performs a bounded post-deploy browser check against the emitted public URL, exercises title → level → gameplay boot, rejects failed or external asset requests and incorrect MIME types, and verifies the exact deployed build SHA.

Remaining release acceptance outside automation: physical iOS/Android audio, touch, orientation, and performance checks and supervised child usability testing. These stay explicit release gates and must not be inferred from desktop emulation.

1. Technical Direction
   Build a static, client-only browser game with:
   phaser@4.2.1, pinned exactly for the initial release. Phaser 4.2.1 is the current stable Phaser release as of this review. Phaser releases
   Vite with browser-native JavaScript modules.
   Node.js 24 LTS and npm with a committed package-lock.json. Node.js release status
   JavaScript with JSDoc types, // @ts-check, and TypeScript’s checker in allowJs/checkJs mode.
   Phaser Arcade Physics with gravity disabled, circular bodies, fixed-step physics, and Phaser.AUTO rendering.
   Vitest for pure logic, Playwright for browser testing, ESLint for code quality, and Prettier in check mode.
   A GitHub Actions deployment that publishes only dist/ to GitHub Pages.
   Use Vite’s relative base: './' so the production build works at the repository subpath, including https://chrisgute.github.io/sharky_the_claw/. Vite supports relative asset URLs for subpath deployments. Vite base configuration
   The application remains one HTML route, avoiding GitHub Pages SPA fallback problems. V1 has no backend, service worker, accounts, analytics, online leaderboard, advertising, or external runtime dependency.
2. Product and Gameplay Specification
   Round flow
   The state flow is:
   BOOT → PRELOAD → TITLE → LEVEL_SELECT → READY → ACTIVE → SETTLING → RESULTS → SHOP/RETRY
   Show a pictorial 3-2-1 countdown before play.
   Give the player exactly 20,000 milliseconds of active gameplay.
   Pause gameplay, physics, AI, boost timers, and audio when the page becomes hidden, focus is lost, or orientation becomes invalid.
   Returning to the page presents a Resume button; gameplay never resumes automatically.
   At zero time, synchronously disable spawning, collisions, and input before settling rewards.
   Settlement is idempotent: a round can bank rewards only once.
   Reloading or closing during a round abandons that unsettled round without rewards or penalties.
   The active timer uses Phaser’s gameplay delta. Timer delta is not clamped, so dropped frames cannot create extra playing time; movement delta may be clamped separately to prevent physics jumps.
   Playfield and controls
   Use a fixed 1280×720 logical landscape arena with Phaser.Scale.FIT and centered letterboxing.
   Menus work in portrait, but active gameplay pauses and displays a child-friendly rotate-device illustration.
   Reserve a top HUD band and bottom-right boost-control zone; fish may not spawn beneath either.
   The shark follows the latest pointer destination. Mouse movement continuously updates the target, and the shark rotates/flips so its head points along the complete target vector rather than remaining horizontal.
   Touch-down or drag updates the target; releasing retains that destination.
   No pointer input leaves the shark stationary.

WASD/arrow keys are secondary movement controls; keyboard input temporarily overrides pointer steering.
Space triggers boost.
Configure two active touch pointers so steering and the boost button work simultaneously.
UI pointer events must not also retarget the shark.
Apply touch-action: none only to the game surface and controls.
Starting shark values:
Size tier: 1
Move speed: 280 px/s
Acceleration: 1,600 px/s²
Arrival radius: 24 px
Collider radius: 24 px

Growth never reduces speed. Scenery is non-colliding in the first two levels.
Eating and collision rules
A fish is edible when shark.sizeTier >= fish.sizeTier.
Disable a consumed fish’s physics body before emitting score events.
Every spawn receives a unique runtime ID and consumed flag, preventing duplicate awards.
Oversized fish: Award no points.
Apply a gentle separation/knockback and stun the shark for exactly 1,000 ms of active gameplay time.
While stunned, steering and boost input are disabled and visible wobble/tint plus a semantic HUD status communicate the state.
Trigger one audiovisual bump cue per fish every 600 ms.
Never remove coins, points, or time.

Use approach cues that do not depend only on color:Edible fish receive a brief mouth/ring cue.
Oversized fish receive a size warning and playful bump expression.

At round end, all collision callbacks become inert before results are computed.
Economy and upgrades
Round score is the sum of eaten-fish point values. V1 awards the same numeric amount as spendable coins, while keeping the concepts separate:
roundScore: current-run performance.
coins: spendable balance.
lifetimeScore: permanent record that spending cannot reduce.
lifetimeFishEaten: permanent unlock progress.
bestScoreByLevel: permanent per-level records.
Initial permanent upgrade tracks:
Upgrade Cost Effect
Boost I 25 Enables a 1.0-second burst at 1.6× speed with a 5-second cooldown
Growth I 50 Raises the shark to tier 2, scale 1.25, collider radius 34 px
Boost II 90 Improves boost to 1.2 seconds at 1.9× speed with a 4-second cooldown
Growth II 120 Raises the shark to tier 3, scale 1.5, collider radius 44 px

Higher ranks require the preceding rank in the same track.
There are no cross-track prerequisites.
Upgrades are permanent and automatically equipped.
Purchases occur only outside rounds and are atomic.
Double-clicking Buy can produce only one purchase.
Growth applies when the next round is constructed, never to an active physics body.
Boost state is LOCKED → READY → ACTIVE → COOLDOWN → READY.
Held or repeated input cannot stack boosts.
Initial levels
Level 1: Sunny Lagoon
Available immediately.
Shallow palette, gentle caustics, low-density coral decoration.
15 initial fish, 18 active maximum.
Replace consumed/despawned fish every 650 ms.
Spawn at least 240 px from the shark.
Fish Tier Points/coins Speed and behavior Base weight
Minnow 1 1 100 px/s, wander 55%
Sardine 1 2 165 px/s, flee 35%
Pufferfish 2 6 90 px/s, wander 10%

Pufferfish show why growth is useful without punishing the starting player.
Level 2: Coral Reef
Unlocks permanently after 100 lifetime fish eaten.
Evaluated after a completed round and announced on Results.
Previously unlocked levels remain replayable.
17 initial fish, 20 active maximum.
Replace fish every 550 ms.
Darker water, denser coral, faster movement, and higher-value targets.
Fish Tier Points/coins Speed and behavior Base weight
Anchovy 1 2 145 px/s, school 45%
Parrotfish 2 5 205 px/s, flee 30%
Golden Fish 2 12 300 px/s cruise, 360 px/s dash 15%
Grouper 3 20 105 px/s, wander 10%

Golden Fish dash for 600 ms when the shark approaches within approximately 170 px, then observe a 1,800 ms dash cooldown. An unboosted shark cannot reliably close on one; Boost I can.
The spawn director adjusts weights to keep at least 60% of active fish edible at the player’s current size while retaining aspirational oversized fish. 3. Architecture
Module boundaries
src/
main.js
app/ Application context, navigation, build metadata
scenes/ Boot, Preload, Title, LevelSelect, Play, Results, Shop, Error
domain/
round/ Round state, timer, settlement, scoring
progression/ Eating, purchases, unlocks, stat compilation
save/ Defaults, validation, migrations, profile transactions
random/ Seeded PRNG
content/ Fish, level, upgrade, and asset catalogs
runtime/
input/
player/
fish/
collision/
effects/
audio/
ui/ Semantic DOM menus, HUD, dialogs, and controls
tests/
unit/
integration/
e2e/
visual/
Pure domain modules may not import Phaser.
Phaser scenes translate domain state into sprites, physics, sound, and input.
Menus, shop, results, pause, mute, and boost controls use semantic HTML over the canvas.
PlayScene is a composition root, not a rules engine.
Each runtime system exposes the applicable subset of update, pause, resume, and destroy.
Use one run-scoped emitter rather than a global gameplay event bus.
Tear down listeners, timers, colliders, pools, DOM views, and emitter subscriptions on scene shutdown.
Runtime lifecycle
main.js creates AppContext, the UI shell, and Phaser.
BootScene validates content, loads/migrates the profile, and registers visibility/error handling.
PreloadScene loads the small V1 asset set and reports individual asset failures.
Starting a level snapshots:Level definition.
Compiled player stats.
Injected random seed.
20-second round configuration.

PlayScene constructs water, player, fish pool, input, boost, spawn, collision, and round systems.
Gameplay updates normalized input, player movement, fish AI, boost state, physics, and active-time state.
Eating disables the fish before scoring and returns it to its pool after its effect completes.
RoundController.finish() disables gameplay and creates one immutable RunSummary.
ProfileService banks that summary in one transaction.
Results displays records, unlocks, and upgrade affordability.
Public data contracts
All catalogs are frozen and validated at build time and boot.
FishDefinition = {
id,
displayName,
textureKey,
sizeTier,
collisionRadius,
scoreValue,
coinValue,
baseSpeed,
turnRate,
behaviorId,
behaviorParams
}

LevelDefinition = {
id,
displayName,
order,
durationMs,
unlock,
palette,
musicKey,
initialFish,
maxAlive,
replacementIntervalMs,
minEdibleRatio,
spawnEntries
}

UpgradeDefinition = {
id,
displayName,
track,
effectId,
maxRank,
ranks,
prerequisiteIds
}

PlayerStats = {
sizeTier,
visualScale,
collisionRadius,
moveSpeed,
acceleration,
arrivalRadius,
boostMultiplier,
boostDurationMs,
boostCooldownMs
}

RunSummary = {
levelId,
seed,
durationMs,
score,
coinsEarned,
fishEaten,
fishCountsById,
boostUses,
endedReason
}
Catalogs contain stable behavior/effect IDs, never Phaser callbacks.
Registries map behavior IDs and upgrade effect IDs to implementations.
compilePlayerStats(profile, upgradeCatalog) is pure and idempotent.
Scenes contain no conditions for particular upgrade IDs.
Production seeds come from crypto.getRandomValues; tests inject known seeds.
Seeded selection is deterministic, but cross-browser Phaser physics is not promised to be bit-for-bit replayable.
Extension rules:
Existing-behavior fish: add assets, one catalog entry, and a level spawn entry.
New fish behavior: add one registry handler and its tests.
Existing-effect upgrade: catalog-only addition.
New upgrade effect: add one pure reducer and its tests.
New level: add assets and a level definition; scene changes should not be required. 4. Persistence and Failure Handling
Use localStorage key sharkyTheClaw.profile:
{
schemaVersion: 1,
revision: 0,
coins: 0,
lifetimeScore: 0,
lifetimeFishEaten: 0,
bestScoreByLevel: {},
unlockedLevelIds: ["sunny-lagoon"],
upgradeRanks: {
growth: 0,
boost: 0
},
settings: {
muted: false,
reducedEffects: "auto"
},
tutorial: {
movementSeen: false,
bumpSeen: false,
boostSeen: false,
shopSeen: false
}
}
ProfileService.transact(reducer) is the only save mutation path:
Clone the current profile.
Apply a pure reducer.
Validate and normalize.
Increment revision.
Write once to storage.
Publish the updated profile.
Persist only after completed rounds, purchases, settings changes, and confirmed reset actions. Web Storage is synchronous, so it must never be used per frame. Web Storage API
Load pipeline:
read → parse → inspect version → migrate → normalize → reconcile unlocks → validate
Failure behavior:
Preserve the last raw value under sharkyTheClaw.profile.backup before migration.
Corrupt saves load defaults and display a non-blocking recovery notice.
Storage read/write failure switches to an in-memory profile with a visible “progress lasts for this session” notice.
A schema newer than the running game is never overwritten; show reload/reset options.
Unknown level and upgrade IDs are preserved but ignored by the current catalog.
Unlock reconciliation is monotonic: thresholds may add unlocks but never remove one.
A newer revision arriving through another tab’s storage event pauses the game and requests a reload instead of trying to merge currencies.
Reset removes only the game’s namespaced keys and requires confirmation. 5. Rendering, Assets, Audio, and Performance
Visual system
Create original SVG shark, fish, coral, UI, and environment assets.
Load SVGs through the asset manifest so Vite resolves Pages-safe URLs.
Animate characters with rotation, squash/stretch, bobbing, short texture swaps, and tweens.
Use two scrolling water texture layers, translucent caustics, capped bubbles, and small particles.
Do not require a custom shader in V1; Canvas fallback must remain usable.
Clamp render resolution to device-pixel ratio 2.
Pool fish, bubbles, particles, and score popups.
Avoid per-frame array creation and repeated weighted-table construction.
Reduced-effects mode disables caustics and reduces particles without changing gameplay.
Auto-select reduced effects when prefers-reduced-motion is set; retain a manual preference.
Audio
Include looping procedural music, eating pops, bump cues, boost sounds, countdown cues, results sounds, and mute control.
Resume Web Audio only from a click/tap; browsers commonly block audio before user activation. Web Audio autoplay guidance
Pause music and effects when gameplay pauses.
Cap simultaneous eating effects to prevent clipping.
Persist mute state.
Generate the original V1 audio locally with Web Audio oscillators so the game has no media download, codec, or third-party provenance dependency.
Budgets
Initial release gates:
Compressed production JavaScript including Phaser: ≤500 KiB.
Title/menu critical transfer: ≤1.5 MiB.
Lagoon first-playable transfer: ≤4 MiB.
Entire V1 asset set: ≤12 MiB.
Game-ready mark: ≤3 seconds desktop and ≤5 seconds on a representative phone/Fast 4G.
Desktop gameplay: average ≥58 FPS, p95 active frame ≤20 ms.
Representative mobile: average ≥50 FPS, p95 active frame ≤33 ms.
Input-to-visible response: <100 ms.
No sustained gameplay below 30 FPS.
No horizontal browser overflow.
After ten consecutive rounds, listeners/entities return to baseline and retained heap growth is below 10 MiB or 10%, whichever is larger. 6. Implementation Phases
Phase 1 — Foundation and GitHub Pages Spike
Implementation:
Create plan.md from this approved plan.
Scaffold the Vite/Phaser JavaScript project and commit the lockfile.
Add scripts for development, linting, formatting checks, type checking, content validation, unit tests, coverage, E2E, build, and preview.
Add the application shell, empty Phaser boot scene, semantic loading/error UI, one placeholder asset, build SHA, and readiness marker.
Configure Vite with base: './'.
Add CI and GitHub Pages workflows using least-privilege permissions and full-SHA-pinned official actions.
Add Dependabot configuration for npm and GitHub Actions.
Document the required GitHub remote and Settings → Pages → GitHub Actions setup.
Automated validation:
Clean npm ci.
ESLint, Prettier check, and JavaScript type checking.
Production build.
Serve dist beneath a simulated /sharky_the_claw/ nested path.
Browser smoke tests in Chromium, Firefox, and WebKit.
Fail on console errors, failed asset requests, external requests, or missing readiness signal.
Confirm the production bundle contains no E2E mutation bridge.
Manual validation:
Load the built page from desktop and mobile browsers.
Confirm canvas sizing, loading UI, error UI, and repository-subpath assets.
Exit gate:
A Pages deployment displays the placeholder scene with zero asset 404s.
CI is required before deployment.
The deployed build SHA matches the tested commit.
Phase 2 — Domain, Catalog, and Save Foundations
Implementation:
Add JSDoc contracts and frozen fish, level, upgrade, and asset catalogs.
Implement boot/build-time catalog validation.
Implement seeded PRNG, eating rules, score calculation, stat compilation, purchasing, unlock reconciliation, and round state machine.
Implement versioned profile loading, transactional writes, backup, migrations, and in-memory fallback.
Add fish behavior and upgrade-effect registries.
Automated validation:
Duplicate IDs, missing assets, unknown references, invalid weights, illegal tiers, negative costs, unreachable prerequisites, and levels without edible fish all fail validation.
Test exact-cost, insufficient-funds, duplicate-click, maximum-rank, and prerequisite purchase paths.
Test size boundaries and stat compilation idempotency.
Verify Reef is locked at 99 fish, unlocks at exactly 100, and remains unlocked after spending.
Test known seeded PRNG sequences.
Test missing, corrupt, future-version, and storage-exception save fixtures.
Verify pure domain modules import no Phaser symbols.
Require 95% line/function/statement and 90% branch coverage for domain modules.
Manual validation:
Inspect generated catalog diagnostics and recovery notices.
Confirm default save values and reset behavior.
Exit gate:
All domain behavior is testable without a canvas.
Every supported save fixture produces a valid result without silently destroying newer data.
Phase 3 — Playable Lagoon Vertical Slice
Implementation:
Add Title, Level Select, Play, Results, Pause, and Error scenes/views.
Add pointer, touch, and keyboard input normalization.
Add shark acceleration, destination arrival, world bounds, and circular Arcade body.
Add fish pooling, spawning, wander/flee behavior, collisions, eating, bumping, score UI, and the 20-second timer.
Add page-visibility, blur, and orientation pause handling.
Build Lagoon with placeholder artwork and all three fish types.
Add an E2E-only bridge for seed, profile, fish spawning, state reads, and time advancement; tree-shake it from production builds.
Automated validation:
Start → steer → eat → bump oversized fish → pause → resume → finish → results.
Timer finishes once under 30, 60, and 120 FPS-style delta sequences and one large delta.
Pause excludes hidden time.
Collision on the final frame cannot award after settlement.
Multiple overlaps cannot double-award a fish.
Pooled fish reset body, velocity, AI state, cooldowns, tint, and consumed status.
Canvas coordinates map correctly under scale, letterboxing, and device-pixel ratio.
Run five consecutive rounds and verify listener/entity counts return to baseline.
Manual validation:
Mouse and touch steering feel predictable.
Shark does not oscillate near the destination.
Oversized collisions are understandable and non-punitive.
Portrait rotation pauses safely.
No fish spawn beneath controls or on the shark.
Exit gate:
A complete Lagoon round can be played repeatedly without stale state, timer drift, duplicate rewards, or console errors.
Phase 4 — Shop and Persistent Progression
Implementation:
Add coin banking, lifetime score, fish count, best scores, shop UI, and upgrade cards.
Implement Growth I/II and Boost I/II through the upgrade registry.
Add boost button, meter, active/cooldown feedback, and Space control.
Add tutorial cues for movement, oversized fish, boost, and first purchase.
Add Results progress toward Reef and an unlock celebration.
Persist purchases, results, settings, and tutorial completion.
Automated validation:
Exercise every boost transition and pause point.
Repeated boost input cannot stack or skip cooldown.
Growth produces the configured size/collider exactly once.
Spending never changes lifetime records or unlock progress.
E2E journey: earn → buy Boost I → reload → replay → verify boost.
E2E journey: buy Growth I → replay → consume a tier-2 fish.
E2E journey: reach 100 fish → unlock Reef → spend coins → reload → Reef remains unlocked.
Storage failure completes the same flow in session-only mode.
Manual validation:
Upgrade cards clearly explain price and benefit with minimal reading.
Locked, affordable, purchased, and maximum-rank states are visually distinct.
A child cannot accidentally purchase twice from one interaction.
Exit gate:
The full title-to-round-to-results-to-shop-to-replay loop survives reload and degraded storage.
Phase 5 — Coral Reef and Final Content
Implementation:
Add Anchovy schooling, Parrotfish fleeing, Golden Fish dash behavior, and Grouper wandering.
Implement edible-ratio spawn adjustment.
Add Reef level data and unlock flow.
Replace placeholder characters and environments with original SVG cartoons.
Add water layers, bubbles, score popups, particles, and growth visuals.
Add final music and sound effects with mute support.
Automated validation:
Seeded tests cover every fish behavior and boundary interaction.
Golden Fish remains faster than the unboosted shark and slower than Boost I.
Spawn tests maintain caps, minimum distances, weights, and at least 60% edible fish.
Asset validation checks exact case-sensitive filenames and every catalog reference.
Deterministic screenshots cover both levels, shark tiers, boost states, pause, results, and shop.
Audio tests assert no playback before user activation, proper mute gain, and cleanup during scene changes.
Manual validation:
Water loops without visible seams or flashes.
Fish remain distinguishable by shape and size without relying on color.
Collision bodies align with artwork.
Depth ordering keeps HUD, fish, particles, and scenery readable.
Test audio on iOS Safari and Android Chrome.
Exit gate:
Both levels contain final assets and audio with no missing resources, unreachable controls, or gameplay differences between quality settings.
Phase 6 — Balance, Accessibility, and Performance
Implementation:
Add development-only run metrics and a read-only ?debug=1 overlay.
Record seed, renderer, viewport, DPR, FPS, frame time, active/pool counts, shark stats, audio state, build SHA, and save version.
Add a deterministic balance harness with automated chase agents.
Add reduced-effects behavior and responsive safe-area treatment.
Ensure menus, pause, shop, mute, and boost are semantic HTML controls.
Automated validation:
Run at least 1,000 Lagoon seeds for each upgrade state.
Target starting Lagoon medians:10–16 fish.
14–24 points.
First purchase by the median third round.
Growth I by the median fifth round when saving for it.
Reef unlock in approximately 6–10 completed rounds.

Run maximum-fish/effects stress tests.
Run ten-round scene and memory soak.
Run axe-core and Lighthouse against DOM UI.
Require Lighthouse medians of accessibility ≥95, performance ≥85, and best practices ≥95.
Confirm production makes no requests beyond same-origin static assets.
Manual validation:
Current Chrome, Edge, Firefox, and Safari on desktop.
Physical mid-range Android phone.
Physical small/older and current iPhones.
iPad Safari if tablets remain a release target.
Touch targets at least 44 CSS pixels.
Visible keyboard focus, no Space-key page scrolling, adequate contrast, and color-independent status cues.
Reduced motion removes unnecessary animation without changing rules.
Child playtest gates:
At least 80% can move and eat a small fish within 30 seconds without spoken instructions.
At least 80% understand oversized fish after one bump.
No player remains trapped at a boundary or fish for over one second.
Median first-run catch count is at least eight.
Exit gate:
Balance, performance, accessibility, and supervised usability targets pass without code changes to scene rules; final tuning occurs in catalogs.
Phase 7 — Release Hardening and Deployment
Implementation:
Finalize README instructions for development, builds, Pages, content extensions, debugging, saves, and reset behavior.
Add a no-PII diagnostics export containing build, seed, renderer, viewport, and recent bounded events.
Add friendly handling for asset failures, uncaught errors, and rejected promises.
Configure the github-pages environment, deployment concurrency, and default-branch protection.
Keep Pages build artifacts hashed and upload only dist/.
CI release sequence:
Install from lockfile on Node 24 LTS.
Format check, lint, and type-check.
Validate catalogs and assets.
Run domain coverage suite.
Build E2E mode and run Chromium critical suite.
Run Firefox and WebKit smoke tests.
Build production mode.
Assert no test bridge, source secrets, unexpected source maps, analytics, or external URLs.
Upload the Pages artifact.
Deploy using the official Pages workflow with contents: read, pages: write, and id-token: write. GitHub Pages custom workflows
Poll the emitted Pages URL with bounded retries.
Verify HTML and asset status/MIME types, readiness, and deployed build SHA.
Release acceptance:
Zero uncaught exceptions, missing assets, or unexpected external requests.
All critical journeys pass against the production build at a nested path.
Physical-device audio, touch, orientation, and performance checks pass.
Ten consecutive rounds show no listener, entity, or material memory growth.
Coins, records, unlocks, upgrades, mute, and recovery behavior persist correctly.
Earlier levels remain replayable after Reef unlock. 7. Assumptions and Explicit Non-Goals
Gameplay is landscape-only in V1; portrait supports menus and a rotate prompt.
Local progress belongs to the current browser origin and does not transfer between devices or domains.
Only completed rounds bank rewards.
There is no fail state, score penalty, participation reward, consumable upgrade, or in-round purchase.
Size tier is the sole eating-eligibility rule.
Coral and environment art are non-colliding.
V1 contains two levels and two ranks each for Growth and Boost.
No online leaderboard, player names, authentication, cloud save, telemetry, advertisements, purchases, or personal-data collection.
Playwright emulation is useful but does not replace physical iOS and Android testing. Playwright device emulation
