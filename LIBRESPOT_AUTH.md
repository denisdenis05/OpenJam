# Independent Spotify session authentication

`LibrespotLoginSession` implements `SpotifyLoginProvider` with the Librespot
method. Its injected `LibrespotAuthentication` performs native login and renewal;
the provider validates grants, owns cancellation and account fences, persists the
reusable credential and supplies tokens to the existing Jam runtime. It makes no
public profile request. The native canonical Spotify username is the account
identity for this provider.

The Android implementation uses only librespot-core and its protocol/OAuth
transitive dependencies. It does not compile librespot's audio, playback or
Connect-receiver components. StreamingServicePlayer remains the selected local
playback engine. There is no installed Spotify application or developer client
ID requirement for the Librespot login path.

## Browser-assisted email-code login

The primary Android flow is Librespot device authorization. The app requests a
pairing code with the supported desktop client identity, securely records its
private device credential, and opens Spotify's verification page. Spotify's page
handles email-code, password or other login methods available to the account.
The pairing code shown by our app is distinct from the email code Spotify sends.
The app does not receive the email code or read the user's inbox.

`LibrespotDeviceAuthorization` owns request/response validation and polling through
injected HTTP, clock, scheduler, secure pending store and native bootstrap. It
waits the server interval (five seconds if omitted), persists increased delay on
slow_down, checks expiry and sanitizes all failures. Browser addresses are limited
to HTTPS Spotify pairing pages and the matching public user code. Observers get
only code, verification address and expiry; the device credential stays private.

The pending record is stored before opening the browser. Transient polling/browser
failures preserve it. `resume` polls an existing transaction without requesting
another code or reopening the browser. Opening the Jam screen after process
restart attempts that recovery; there is no automatic cold-start navigation.
Account replacement, explicit cancel, Disconnect and Forget clear all four
namespaces. A denied or expired transaction is erased. Token success consumes the
pending record before native bootstrap, without saving the OAuth token. A crash
or failure after that consumption requires a new sign-in; no token is replayed.

Native bootstrap connects the approved token with its matching desktop client
identity, obtains canonical account/reusable access-point credentials and mints
the native session token. Restoration preserves that client/device binding.
Existing password sessions still restore with their platform identity. Arbitrary
client identities are rejected. Password network/bootstrap work retains the
sixty-second native deadline; interactive approval uses its own server expiry.

`LibrespotLoginSession` accepts optional authorize/resume strategies to share the
same grant validation, persistence, renewal and lifetime fences with this flow.
Each interactive login strategy is consumed once and retired on logout/disposal.
Native account identity continues to bypass the public /v1/me gate. Approval,
native bootstrap, storage and private Jam failures remain distinct stages.

The device-authorization HTTP initialization was checked live through the actual
broker using an in-memory pending store. Spotify returned valid pairing fields;
the observer canceled before browser opening, token polling, or native bootstrap.
No email was requested and no account was approved. This is initialization
verification only. Completed account authorization, native bootstrap and Jam
admission still require the reporting phone.

## Password option and renewal

1. For the optional password method, the user explicitly submits a Spotify email and password. The screen
   clears its password field immediately. The provider consumes its input once.
2. The Android native adapter acquires a client token and submits Login5 through
   upstream librespot. It connects to an access point using the resulting token,
   obtains the canonical account and reusable access-point credentials, then
   obtains the session's Login5 access token.
3. The native result contains account identity, token/expiry and an opaque
   reusable credential record. The library waits for secure persistence before
   accepting the grant.
4. The controller establishes the account from the native identity and makes a
   passive private Jam status request. A rejected Jam request preserves successful
   authentication and is shown as a Jam access error.
5. Renewal/restoration reconnects from the stored credential, verifies the same
   account and saves the rotated result. Passwords and access tokens are not part
   of the durable record. A new password is required after explicit forgetting.

The native record binds schema, account, client identity, device identity and
reusable credential type. Its client identity comes from pinned upstream
librespot for Android; the app does not accept arbitrary client identifiers for
this path. The library stores that record as an opaque string, separate from an
OAuth refresh grant. Both layers bound inputs and output; native stored input is
limited to 65,536 characters/bytes. The outer JSON record has its own larger
escaped-text bound. Access-token grants must have a valid future bounded expiry.

An account-owned `SpotifyLoginCredentialStore` is required. Mobile composition
uses the existing serialized ownership and native Keychain adapter with the
`StreamingService.SpotifyLibrespot.` namespace. Only revocation markers are put
in AsyncStorage. Account replacement, Disconnect and Forget attempt removal from
Librespot, OAuth, pending-browser and pending-device namespaces. Disposal preserves a saved
session for restoration. An invalid native record cannot silently switch to a
saved OAuth identity.

Renewal is shared; one canceled caller cannot cancel another caller's renewal.
Account disposal cancels the provider lifetime and retires late native/store
results. Transient failures retain reusable material; rejected/malformed reusable
credentials are erased. Storage failures expose typed errors rather than native
messages. The native request registry registers before worker dispatch, rejects
duplicates, bounds pending work and releases failed dispatches. Native operations
have a sixty-second deadline. Session shutdown runs when work succeeds, fails,
is canceled or times out.

## Native build and boundaries

Upstream is pinned to
[`99b6088bf3ea028f90192676ac1a337fa4b2ed12`](https://github.com/librespot-org/librespot/tree/99b6088bf3ea028f90192676ac1a337fa4b2ed12),
with Cargo.lock committed. Rustls and bundled trust roots avoid an OpenSSL runtime
dependency. Upstream logging and native panic output are disabled at the bridge;
errors crossing JNI/React Native contain only typed categories. No user credential
was supplied to development tools for this implementation.

The shipped Android implementation is ARM64, API 24 or later. The native build
uses the installed NDK, stripped release output, link-time optimization and
16 KB load-segment alignment. Gradle invokes the locked Cargo build before native
packaging. The mobile default architecture now matches this ARM64 implementation.
Other Android architectures and an iOS Librespot binary are not included. iOS can
still use the existing optional OAuth path; the new provider reports Unsupported
where its native module is absent.

Required boundary names include React Native methods/module names, JNI exported
symbols, Cargo environment variables, Rust ABI types, and serde camelCase field
mapping. These are framework/protocol requirements. Their external spelling is
retained; generated and dependency code is outside authored-source checks.
The upstream MIT license is included in the APK assets.

## Verification and open gates

Feature mappings are in FEATURES.md and the mobile progress file. Tests cover
provider persistence/renewal/lifetimes, storage/provider selection, native request
isolation, input/record validation, deadline behavior, UI password clearing and
error attribution. A real host JVM loads the compiled native library and checks
JNI string handling, cancellation, duplicate rejection, release and malformed
restore without authentication network traffic. This is a host boundary test,
not Android device execution.

The first physical test is account login, restart/restore, passive Jam status,
then explicit create/share/join/queue operations. No private endpoint accepts a
token merely because local validation passes. Live Librespot credential
admission, private Jam access, cross-account guest joining and shared playback
remain device/service gates. The existing guest/background/playback limitations
are not removed by adding authentication. Upstream Login5 does not implement all
verification challenges; those return an explicit Unsupported login message.
The project does not skip server verification or retry an unknown Jam mutation.

## Reproducing host and Android checks

Run `npm test` in the library repository. In the mobile repository,
`npm run test:spotify` runs provider composition, native-adapter and screen cases;
`npm run test:spotify-native` builds/tests the host Rust library and executes the
Java JNI fixture. That host command requires Cargo and a JDK on Linux.

Install Rust's `aarch64-linux-android` target before an Android build. The build
script accepts `CARGO` to select its compiler and `--ndk-directory`,
`--output-directory`, `--architectures` for standalone use. Gradle supplies these
arguments to `tools/build-spotify-librespot-android.py` during preBuild. The checked
build used Rust 1.99.1, NDK 27.1.12297006, API 24 and arm64-v8a. Cargo.lock is
required; generated targets stay outside authored sources. Cargo metadata with
`--locked --filter-platform aarch64-linux-android --format-version 1` supplies the
license inventory; the mobile assets retain its license texts and upstream MIT
notice. The inventory includes Cargo build/dev dependencies as well as libraries.

The generated dependency license inventory preserves upstream text, including
its trailing whitespace. A file-specific Git attribute excludes only that asset
from whitespace checks; authored sources keep the normal checks.
