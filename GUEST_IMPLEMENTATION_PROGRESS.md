# Verified guest observation — 2026-10-31

The runtime accepts an injected JamGuestObservationVerifier for read-only guest
playback and queue observation. Default construction retains owner-only guards.
Guest reads require the bound account in the current participant projection and
fresh verifier success before and after the source read. Account, Jam, host,
participant removal and cancellation retire old work. An uncooperative verifier
cannot prevent cancellation. Native occurrence identifiers and queue revisions
remain supplied by the existing readers.

The mobile implementation binds the verifier only with native Connect transport.
Its bridge reads actual connectMembership data, checks the bound handle and
generation, and verifies account, Jam, host, active membership and unique bounded
participants. This verifier grants observation only; it does not establish guest
control permission. Guest mutation and Web API safeguards remain closed.

Feature mapping: tests/guest-observation.test.mjs covers successful bracketed
queue reads, final verification failure, absent projected participants and
membership retirement during verification. tests/hosted-playback.test.mjs adds
bracketed admitted guest playback, final denial and prompt verification
cancellation. Existing guest public-route denial tests remain passing.

Validation: npm test passed 626 deterministic cases across the complete library suite. Architecture source checking and
strict TypeScript build run inside that command. No device, live guest, audible
synchronization or second-account result is claimed. Dedicated guest mutations
still need actual permission evidence and accepted cross-account protocol results.

Suggested chapter: Verify guest membership around native shared observations.
