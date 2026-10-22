---
name: streaming-service-quality
description: Apply the user's code quality, testing, documentation and collaboration requirements when implementing or reviewing StreamingServicePlayer, or when explicitly applying these standards elsewhere in StreamingService.
---

# StreamingService quality and workflow

Use this skill for StreamingServicePlayer implementation, fixes, reviews and implementation planning. Apply its coding standards to another project when the user explicitly requests them there. Preserve the current task and platform scope; a quality rule does not authorize unrelated changes or app migration.

## Mandatory code standards

These requirements apply to every authored implementation, public contract, example and test in StreamingServicePlayer, across TypeScript, Kotlin, Swift and native bridge code.

1. **Absolutely zero tolerance for magic numbers or magic strings.** Represent values with behavioral, protocol, configuration, storage or test meaning using descriptive named constants, typed enumerations, value objects or validated configuration. Include units in names for time, size and limits. Keep values with the component that owns their meaning. Do not disguise unnamed values behind generic constants or scatter duplicate literals.
2. **Absolutely no authored code comments.** No inline, block, documentation, TODO or explanatory comments. Explain intent through variable, method, type and test names and cohesive functions. Put design rationale and usage guidance in Markdown.
3. **Never abbreviate variable or method names.** Use full descriptive words in every scope, including lambda parameters, callbacks, tests and public adapters. Names such as `ctx`, `req`, `res`, `params`, `config`, `ms` and single-letter parameters violate this requirement. Prefer `commandContext`, `response`, `configuration`, `positionMilliseconds` and `queueEntry`.
4. **Code must comply with SOLID.** Separate responsibilities, extend behavior through strategies/adapters, preserve substitution contracts, keep interfaces focused on consumers and inject dependencies. Domain logic must depend on abstractions for audio engines, clocks, randomness, networking, credentials, storage and events. Compose concrete platform implementations at the boundary.
5. **Each functionality needs its own unit tests.** Give every independently observable behavior named deterministic tests for expected behavior, boundaries and relevant failures. Each bug fix needs a reproducing regression test. Test asynchronous ordering, cancellation, duplicate commands and stale completions where applicable. Inject collaborators rather than relying on actual time, random values, devices or external services. Maintain a feature-to-test mapping so future improvements preserve behavior.

Aggregate coverage, another feature's tests, manual checks and integration tests do not replace dedicated functionality tests. A feature remains incomplete until its required unit tests pass and all five standards are satisfied.

Keep generated third-party output outside authored sources and distinguish it in checks. When a compiler or framework requires a conflicting literal, identifier or directive, identify the exact requirement and document the boundary; do not silently weaken an absolute rule or invent an exception. Preserve an exception already accepted in the project's instructions. Source checkers are evidence of selected violations; they do not prove semantic naming, complete absence of magic values or SOLID compliance.

## Working behavior

- Write plainly, as a developer talking to a colleague. The user explicitly rejects AI-like language. Use concrete names, actions, results and limitations; avoid filler and promotional claims in messages, Markdown and commit descriptions.
- Start with the existing progress notes, working tree and recent commits. Continue from completed work rather than restarting it. Preserve unrelated changes and keep the replacement player separate from the currently selected app engine until migration is authorized.
- Follow the latest platform instruction. Android was first and iOS was initially deferred; later authorization to implement iOS supersedes that deferral. Do not preserve stale delivery status as a restriction after the user changes it.
- Before spawning agents, explain their plan and responsibilities to the user. Spawn only when delegation is authorized. Respect the actual concurrency limit; use waves if the requested agent count exceeds available slots. Give each agent file ownership and the same skill, contracts and standards. Coordinate interfaces before dependent implementations diverge.
- When the user steers or interrupts work, incorporate the instruction before continuing dependent work. If a prerequisite must be created first, pause implementation agents while creating it, then give them the completed prerequisite before resuming.

## Progress and commits

Maintain a Markdown progress file that another session can use to resume. For the player, use `StreamingServicePlayer/PROGRESS.md`. At each chapter boundary record implemented functionality, feature-specific tests, exact commands/results, current build/device gaps and concrete next steps. Distinguish completed, failing, unverified and deferred work.

Commit once or twice per completed chapter, as requested by the user; avoid a commit for every small edit. Use plain descriptions, stage only the relevant repository's changes and inspect the staged diff. A commit does not authorize a push, deployment or switching the mobile app's playback engine.

## Testing and truthful completion

Separate source review, host compilation, deterministic unit tests, native packaging, actual React Native integration, physical-device scenarios and measured performance. Record what ran and what passed. Never present compilation, installation, launch acknowledgement or aggregate test counts as proof of playback correctness, native lifecycle behavior or a performance gain.

For iOS/xtool work, read [the project workflow notes](references/player-workflow.md) and the linked current project documents. Check installed tools and SDKs rather than assuming the environment is missing or ready. Use unsigned builds for compilation when signing is unavailable; actual iPhone execution requires a validated signing/device path. Keep runtime assertions and exported results explicit.

For reporting work, audio controls must not wait for Last.fm or history HTTP requests. Capture session identity before asynchronous work, update local accounting synchronously, and ensure delayed responses cannot replace a newer tracker or mutate a new track. Keep required report ordering in a background queue rather than blocking native playback.

For security, performance or concurrency reviews, include the mobile frontend when it belongs to the requested project scope. Record findings and concrete evidence in Markdown; distinguish measured bottlenecks from hypotheses.
