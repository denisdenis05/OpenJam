# Spotify login and saved credentials

`SpotifyLoginSession` owns Authorization Code with PKCE, callback/state
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
`account_id` with `id` compatibility. A public client ID was supplied with the Android return-failure report.
Real OAuth admission to private Jam routes is still unverified;
desktop research credentials are not substituted when OAuth access fails.

## Independent Librespot provider

The Android app's primary browser/device login uses `LibrespotDeviceAuthorization`
and `LibrespotLoginSession`; password login is optional. Both are documented in
[LIBRESPOT_AUTH.md](LIBRESPOT_AUTH.md). It consumes an injected native session
authenticator and secure credential store, rather than the developer browser
flow. The remaining sections describe the optional OAuth provider and its callback
recovery. Successful authentication is separate from private Jam admission.

## Callback base comparison

`compareSpotifyAuthorizationRedirect` compares parsed protocol, authority and
path and reports the mismatched component. It compares an empty response path
and `/` equally only for the same custom scheme with a nonempty authority. Other
paths remain exact; network/file and opaque custom addresses do not gain this
rule. The function does not validate state, code, credentials, fragments or size;
login callers must continue those checks. Browser capture, startup recovery and
library code extraction use the same comparison to avoid accepting a return in
one layer only to reject it in another.

The configured redirect is sent unchanged in both authorization and code exchange
and remains unchanged in stored configuration. This response comparison does not
change Spotify's registration requirements. See the official
[authorization code parameters](https://developer.spotify.com/documentation/web-api/tutorials/code-flow)
for the exact configured redirect requirement. The phone's combined mismatch
status does not establish that a slash was added; new messages identify scheme,
host or path if a mismatch remains. No callback values are shown or logged.

## Pending browser authorization

Supply a separate secure `authorizationStore` for process-restart recovery.
It contains versioned public configuration, verifier/challenge/state and creation
time, saved before browser launch. Unlike the saved refresh grant, this short-lived
record contains proof material. Its lifetime is ten minutes. Neither store saves
an authorization code or callback URL. Use the same account ownership abstraction
with separate native service namespaces for these two record types.

`loadSpotifyAuthorizationConfiguration` returns only public configuration.
Create the provider with that configuration and call `resumeAuthorization` with
the current callback. Callback base/state validation and expiry checks precede
consumption; deletion must acknowledge before code exchange. Stale, foreign or
malformed callbacks preserve the pending record; actual consent denial erases it.
A consumed record cannot replay. Disposal preserves pending proof; logout clears
both stores. Exchange is not retried if its outcome is unknown.

Optional `onProgress` reports preparation, browser authorization, exchange,
verification, saving and completion. Observer failures cannot interrupt login.
Progress contains no callback or credential values.

Android now captures Linking events before opening the custom tab. After browser
dismissal it probes the current Activity intent during a bounded grace period.
MainActivity updates its intent before forwarding the framework callback. The
`onNewIntent` name and Intent parameter are Android framework requirements.
Cold startup waits for the StreamingService account, resumes the saved transaction
and opens the Jam screen once. The iOS adapter retains native openAuth behavior.
Public login verifies only the Spotify profile; private service discovery happens
when Jam operations need it. The screen preserves failed phases across remounts.

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
