# Spotify login and saved credentials

`SpotifyLoginSession` owns Authorization Code with PKCE, exact callback/state
validation, code exchange, account verification, refresh renewal and restoration.
It implements `SpotifyLoginProvider`. The runtime consumes its credential-provider
interface; disposing a runtime does not end a remote Jam or forget a saved login.

Inject a registered public client ID, exact callback, requested scopes, secure
proof-key generator, browser, HTTP executor, clock and account resolver. No client
secret or password collection belongs in the app. The Android/iOS proof boundary
uses separate 256-bit entropy for verifier/state, SHA-256 of the encoded verifier
and unpadded URL-safe Base64. The library validates the supplied proof shape.

The mobile callback is `streamingservicespotify://callback`, registered in both
Android and iOS. Spotify must also accept it in the developer application's
redirect allowlist. Public profile verification uses `/v1/me`, preferring
`account_id` with `id` compatibility. A registered client ID was not supplied for
this work. Real OAuth admission to private Jam routes is still unverified;
desktop research credentials are not substituted when OAuth access fails.

## Durable login

Supply an account-owned `SpotifyLoginCredentialStore` to enable persistence.
The versioned saved record contains the requested client/callback/scopes,
verified Spotify account identifier and refresh token. Access tokens, authorization
codes, proof verifiers, invitations and app authentication tokens are not saved.
`loadSpotifyLoginConfiguration` exposes only immutable public configuration.

`restore` exchanges the saved refresh token and verifies the same Spotify account
before installing credentials. A rotated refresh token is persisted before that
profile request so a transient profile failure does not discard renewal material.
Invalid records, incompatible configuration and rejected grants are erased.
Transient failures retain usable renewal material for a later attempt.

`SpotifyCredentialOwnership` serializes storage across account-bound provider
leases. A retired provider cannot overwrite a newer login or erase it with an old
logout. An accepted forget operation runs after preceding storage work, and later
saves run after it. Forgetting another account does not retire the current lease.
The native boundary must implement secure storage; the library does not turn an
ordinary file or database into an encrypted store.

The mobile app pins react-native-keychain 10.0.0. Android uses its AES-GCM Keystore
storage; iOS uses Keychain after-first-unlock, device-only accessibility and no
cloud synchronization. A separate nonsecret revocation marker prevents automatic
restoration if physical credential deletion fails. Only that marker goes into
AsyncStorage. A successful new sign-in removes its marker after secure persistence.
No Spotify token or serialized grant is stored in AsyncStorage/MMKV.

Opening the Jam screen attempts saved restoration for the authenticated app
account. No saved record leaves the normal login form available. Disconnect or
Forget removes saved login and shows pending removal until storage acknowledges
completion. Storage failure is explicit. App logout/account replacement forgets
the former account, including when Spotify was not opened in that process.
Cold restoration of the app account does not erase its saved Spotify login.

`dispose` retires in-memory login work and preserves the saved grant for restart
or hot reload. `logout` retires memory immediately and returns the storage-clear
promise. Consumers should await it before claiming durable removal. Storage and
network errors expose typed failures rather than private error messages.

Refresh exchanges are shared, handle token rotation and retain an omitted refresh
token. A canceled renewal caller does not cancel another caller's work. Neither
code exchange nor refresh is automatically retried. Late account/browser/storage
results cannot establish a retired login.

## Platform and validation boundaries

Android uses the existing in-app browser and secure native proof-key module.
iOS now includes the matching module and callback registration. External
`openAuth`/`closeAuth` names are mapped to the project's unabbreviated browser
adapter contract. Swift/Objective-C module names and generated selectors are
required React Native/framework boundaries.

Dedicated suites are `tests/spotify-login.test.mjs`, `tests/saved-login.test.mjs`
and the form-body case in `tests/network.test.mjs`. Mobile tests cover secure
storage policy, logical revocation, provider ownership, cold restoration,
disconnection acknowledgement and stale results. Native proof tests and SDK
compilation are additional evidence, not physical Keychain/Keystore execution.

References: [Spotify PKCE](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow),
[redirect requirements](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri),
[custom-scheme guidance](https://developer.spotify.com/blog/2025-02-12-increasing-the-security-requirements-for-integrating-with-spotify),
[keychain package](https://github.com/oblador/react-native-keychain/releases/tag/v10.0.0).
