import assert from 'node:assert/strict';
import test from 'node:test';
import { library } from './fixtures.mjs';

const Fixture = Object.freeze({ customProtocol: 'streamingservicespotify:', otherProtocol: 'other:',
  secureProtocol: 'https:', insecureProtocol: 'http:', fileProtocol: 'file:',
  host: 'callback', otherHost: 'other', explicitPortHost: 'callback:443', rootPath: '/', emptyPath: '',
  callbackPath: '/login', otherPath: '/other', nestedPath: '/login/', encodedPath: '/%2F', doubleRoot: '//',
  names: Object.freeze({ exact: 'An exact callback base matches without modifying its values',
    root: 'Custom scheme empty and root paths compare equally in both directions',
    network: 'Network and file callback paths do not gain custom scheme root equivalence',
    opaque: 'A custom callback without an authority does not gain root path equivalence',
    scheme: 'A different scheme is classified before host and path',
    host: 'A different host or explicit port cannot match the callback authority',
    path: 'Nonroot custom callback paths remain exact including trailing and encoded slashes' }) });

function address(overrides = {}) { return Object.freeze({ protocol: Fixture.customProtocol, host: Fixture.host,
  pathname: Fixture.emptyPath, ...overrides }); }
const Comparison = library.SpotifyAuthorizationRedirectComparison;

test(Fixture.names.exact, () => { const expected = address();
  assert.equal(library.compareSpotifyAuthorizationRedirect(address(), expected), Comparison.Matched);
  assert.equal(expected.pathname, Fixture.emptyPath); });
test(Fixture.names.root, () => { const empty = address(); const root = address({ pathname: Fixture.rootPath });
  assert.equal(library.compareSpotifyAuthorizationRedirect(root, empty), Comparison.Matched);
  assert.equal(library.compareSpotifyAuthorizationRedirect(empty, root), Comparison.Matched); });
test(Fixture.names.network, () => { for (const protocol of [Fixture.secureProtocol, Fixture.insecureProtocol, Fixture.fileProtocol]) {
  assert.equal(library.compareSpotifyAuthorizationRedirect(address({ protocol, pathname: Fixture.rootPath }), address({ protocol })), Comparison.PathMismatch);
} });
test(Fixture.names.opaque, () => {
  assert.equal(library.compareSpotifyAuthorizationRedirect(address({ host: Fixture.emptyPath, pathname: Fixture.rootPath }),
    address({ host: Fixture.emptyPath })), Comparison.PathMismatch);
});
test(Fixture.names.scheme, () => { assert.equal(library.compareSpotifyAuthorizationRedirect(
  address({ protocol: Fixture.otherProtocol, host: Fixture.otherHost, pathname: Fixture.otherPath }), address()), Comparison.SchemeMismatch); });
test(Fixture.names.host, () => { for (const host of [Fixture.otherHost, Fixture.explicitPortHost]) {
  assert.equal(library.compareSpotifyAuthorizationRedirect(address({ host }), address()), Comparison.HostMismatch);
} });
test(Fixture.names.path, () => { for (const pathname of [Fixture.callbackPath, Fixture.otherPath, Fixture.nestedPath, Fixture.encodedPath, Fixture.doubleRoot]) {
  assert.equal(library.compareSpotifyAuthorizationRedirect(address({ pathname }), address()), Comparison.PathMismatch);
}
  assert.equal(library.compareSpotifyAuthorizationRedirect(address({ pathname: Fixture.callbackPath }), address({ pathname: Fixture.callbackPath })), Comparison.Matched);
  assert.equal(library.compareSpotifyAuthorizationRedirect(address({ pathname: Fixture.nestedPath }), address({ pathname: Fixture.callbackPath })), Comparison.PathMismatch);
});
