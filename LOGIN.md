# Spotify browser login

`SpotifyLoginSession` owns Authorization Code with PKCE, callback validation,
code exchange, in-memory credentials and refresh-token renewal. It implements
`SpotifyCredentialProvider`, so the same login instance can supply a
`SpotifyJamRuntime`. Login does not create a Jam automatically.

The host injects a registered public client identifier, exact callback address,
scopes, secure proof-key generator, browser authorization adapter, HTTP executor,
clock and authenticated account resolver. There is no client secret in a mobile
application. The browser opens Spotify's own authorization page; the library never
collects the user's password. The proof generator must use cryptographic entropy
and SHA-256 with unpadded URL-safe Base64. The library validates proof shapes;
the injected generator owns cryptographic correctness.

The mobile Android boundary provides SecureRandom/SHA-256 proof generation and
uses the existing in-app browser's authorization session. Its external native
`openAuth`/`closeAuth` method names are mapped at the platform boundary to the
project's `openAuthorization`/`closeAuthorization` adapter contract. Its registered callback
is `streamingservicespotify://callback`. The personal-test screen accepts the
public client ID, then calls the library login flow. Register that exact callback
in the Spotify application dashboard. No registered client ID was supplied for
this implementation, and the build does not borrow an official Spotify client's
identifier. A successful real browser callback and private Jam credential access
remain unverified.

The mobile flow requests `user-read-private`, `user-read-playback-state` and
`user-modify-playback-state`. OAuth account verification uses the official
`/v1/me` profile and prefers `account_id` when present, with `id` compatibility.
Desktop-session credentials previously used for private-protocol research do not
prove that a registered third-party OAuth token can call private Jam routes.
After login the app performs a passive current-Jam read; failed authorization or
an unexpected response prevents mutations. It does not substitute a desktop
credential when OAuth access fails.

State and callback destination must match before code exchange. Duplicate state
or code parameters are rejected. Codes and proof verifiers travel only to
Spotify's fixed HTTPS token endpoint through an injected executor that rejects
redirects. Access and refresh tokens remain in memory; there is no persistent
login storage in this chapter. App restart requires sign-in again.

Renewal shares a single exchange, handles refresh-token rotation and retains the
previous refresh token when omitted. Rejected grants remove credentials. Logout
aborts the login lifetime and rejects late browser, transport and account lookup
results. A canceled renewal caller rejects promptly without canceling another
caller's shared renewal. Token exchange is not automatically retried.

Dedicated tests are `tests/spotify-login.test.mjs` and the form-body transport case
in `tests/network.test.mjs`. Mobile tests cover browser completion/cancellation,
controller account boundaries, profile verification, screen submission and
Android proof generation. These deterministic tests and native packaging do not
establish live OAuth admission, cross-account joining or shared queue propagation.

Protocol references: [Spotify PKCE flow](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow),
[redirect requirements](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri),
[Spotify's custom-scheme guidance](https://developer.spotify.com/blog/2025-02-12-increasing-the-security-requirements-for-integrating-with-spotify).
HTTPS callbacks are preferred. The Android test build uses its dedicated custom
scheme and still requires Spotify to accept the configured registered callback.
There is no iOS proof-key boundary in this chapter; it reports Unsupported rather
than generating weak proof material.
