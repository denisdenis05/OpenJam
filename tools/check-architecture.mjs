import { createRequire } from 'node:module';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const CompilerArgumentIndex = 2;
const FirstPosition = 0;
const HumanLineOffset = 1;
const FailureExitCode = 1;
const EmptyText = '';
const IdentifierComponentSeparator = /(?=[A-Z])|_/;
const ProhibitedIdentifierComponents = new Set(Object.values({ context: 'ctx', request: 'req', response: 'res', parameters: 'params', configuration: 'config', milliseconds: 'ms', identifier: 'id', identifiers: 'ids', function: 'fn', arguments: 'args', callback: 'cb', temporary: 'tmp', index: 'idx', authentication: 'auth', dataTransferObject: 'dto', applicationProgrammingInterface: 'api', randomNumberGenerator: 'rng' }));
const CheckedDirectories = Object.values({ implementation: 'src', contracts: 'contracts', unitTests: 'tests', tools: 'tools' });
const IntegrationSources = Object.values({
  mobileSecureStorage: '../StreamingServiceMobile/src/services/spotify/SpotifySecureCredentialStorage.ts',
  mobileSecureComposition: '../StreamingServiceMobile/src/services/SpotifySecureLoginStorage.ts',
  mobileSecureTests: '../StreamingServiceMobile/tools/spotify-secure-storage.test.cjs',
  mobileSecurePlatformTests: '../StreamingServiceMobile/tools/spotify-secure-platform.test.ts',
  mobileObservationStore: '../StreamingServiceMobile/src/services/spotify/SpotifyObservationStore.ts',
  mobileMembershipStore: '../StreamingServiceMobile/src/services/spotify/SpotifyMembershipStore.ts',
  mobileMembershipScreen: '../StreamingServiceMobile/src/pages/SpotifyJam/SpotifyJamMembership.render.tsx',
  mobileMembershipTests: '../StreamingServiceMobile/tools/spotify-membership-mobile.test.cjs',
  mobileMembershipScreenTests: '../StreamingServiceMobile/tools/spotify-membership-screen.test.tsx',
  mobileHostedStore: '../StreamingServiceMobile/src/services/spotify/SpotifyHostedQueueStore.ts',
  mobileHostedScreen: '../StreamingServiceMobile/src/pages/SpotifyJam/SpotifyHostedQueue.render.tsx',
  mobileHostedTests: '../StreamingServiceMobile/tools/spotify-hosted-queue.test.cjs',
  mobileHostedScreenTests: '../StreamingServiceMobile/tools/spotify-hosted-screen.test.tsx',
  mobileRecordingTests: '../StreamingServiceMobile/tools/spotify-recording-queue.test.cjs',
  mobileRecordingScreenTests: '../StreamingServiceMobile/tools/spotify-recording-screen.test.tsx',
  mobileRecordingStore: '../StreamingServiceMobile/src/services/spotify/SpotifyRecordingQueueStore.ts',
  mobileSongSelection: '../StreamingServiceMobile/src/services/spotify/SpotifySongSelection.ts',
  mobileSongMenuAction: '../StreamingServiceMobile/src/services/SpotifyJamMenuAction.ts',
  mobileRecordingScreen: '../StreamingServiceMobile/src/pages/SpotifyJam/SpotifyRecordingQueue.render.tsx',
  mobileLoginBrowser: '../StreamingServiceMobile/src/services/spotify/SpotifyLoginBrowser.ts',
  mobileLoginPlatform: '../StreamingServiceMobile/src/services/SpotifyLoginPlatform.ts',
  mobileQueueTrack: '../StreamingServiceMobile/src/services/spotify/SpotifyQueueTrack.ts',
  mobileLoginTests: '../StreamingServiceMobile/tools/spotify-login-mobile.test.cjs',
  mobileConnection: '../StreamingServiceMobile/src/services/spotify/SpotifyIntegrationConnection.ts',
  mobileComposition: '../StreamingServiceMobile/src/services/SpotifyIntegration.ts',
  mobileTests: '../StreamingServiceMobile/tools/spotify-integration.test.cjs',
  mobileController: '../StreamingServiceMobile/src/services/spotify/SpotifyMobileController.ts',
  mobileGateway: '../StreamingServiceMobile/src/services/spotify/SpotifyMobileGateway.ts',
  mobileInvitation: '../StreamingServiceMobile/src/services/spotify/SpotifyInvitation.ts',
  mobileInvitationResolver: '../StreamingServiceMobile/src/services/spotify/SpotifyInvitationResolver.ts',
  mobilePolicy: '../StreamingServiceMobile/src/services/spotify/SpotifyMobilePolicy.ts',
  mobileService: '../StreamingServiceMobile/src/services/SpotifyMobileService.ts',
  mobileScreen: '../StreamingServiceMobile/src/pages/SpotifyJam/SpotifyJam.render.tsx',
  mobileScreenCopy: '../StreamingServiceMobile/src/pages/SpotifyJam/SpotifyJam.copy.ts',
  mobileScreenStyle: '../StreamingServiceMobile/src/pages/SpotifyJam/SpotifyJam.style.ts',
  mobileFeatureTests: '../StreamingServiceMobile/tools/spotify-mobile.test.cjs',
  mobileScreenTests: '../StreamingServiceMobile/tools/spotify-screen.test.tsx',
});
const TypeScriptSuffix = '.ts';
const JavaScriptSuffix = '.mjs';
const CommentViolation = 'Code comments are prohibited';
const LiteralViolation = 'Numeric and string values must have descriptive names';
const NamingViolation = 'Variable and method names must not be abbreviated';
const DiagnosticSeparator = ': ';
const SourceEncoding = 'utf8';
const CompilerArgumentMissing = 'Pass the installed TypeScript module path.';
const typeScriptFilename = process.argv[CompilerArgumentIndex];
if (!typeScriptFilename) throw new Error(CompilerArgumentMissing);
const requireCompiler = createRequire(import.meta.url);
const typeScript = requireCompiler(typeScriptFilename);
const violations = [];

function collectFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(directoryEntry => {
    const filename = join(directory, directoryEntry.name);
    if (directoryEntry.isDirectory()) return collectFiles(filename);
    return filename.endsWith(TypeScriptSuffix) || filename.endsWith(JavaScriptSuffix) ? [filename] : [];
  });
}

function isNamedLiteral(syntaxNode) {
  let parent = syntaxNode.parent;
  if (typeScript.isPrefixUnaryExpression(parent)) parent = parent.parent;
  if (typeScript.isVariableDeclaration(parent) || typeScript.isPropertyAssignment(parent)
    || typeScript.isPropertyDeclaration(parent) || typeScript.isEnumMember(parent)) return true;
  if (typeScript.isImportDeclaration(parent) || typeScript.isExportDeclaration(parent)) return true;
  return false;
}

function report(filename, sourceFile, position, message) {
  const location = sourceFile.getLineAndCharacterOfPosition(position);
  violations.push(filename + DiagnosticSeparator + (location.line + HumanLineOffset) + DiagnosticSeparator + message);
}

function inspectFile(filename) {
  const sourceText = readFileSync(filename, SourceEncoding);
  const sourceFile = typeScript.createSourceFile(filename, sourceText, typeScript.ScriptTarget.Latest, true);
  const scanner = typeScript.createScanner(typeScript.ScriptTarget.Latest, false, typeScript.LanguageVariant.Standard, sourceText);
  let token = scanner.scan();
  while (token !== typeScript.SyntaxKind.EndOfFileToken) {
    if (token === typeScript.SyntaxKind.SingleLineCommentTrivia || token === typeScript.SyntaxKind.MultiLineCommentTrivia) {
      report(filename, sourceFile, scanner.getTokenPos(), CommentViolation);
    }
    token = scanner.scan();
  }
  function inspectNode(syntaxNode) {
    if ((typeScript.isNumericLiteral(syntaxNode) || typeScript.isStringLiteral(syntaxNode)
      || typeScript.isNoSubstitutionTemplateLiteral(syntaxNode)) && !isNamedLiteral(syntaxNode)) {
      report(filename, sourceFile, syntaxNode.getStart(), LiteralViolation);
    }
    if ((typeScript.isVariableDeclaration(syntaxNode) || typeScript.isParameter(syntaxNode)
      || typeScript.isFunctionDeclaration(syntaxNode) || typeScript.isMethodDeclaration(syntaxNode))
      && syntaxNode.name && typeScript.isIdentifier(syntaxNode.name)) {
      const identifier = syntaxNode.name.text;
      const components = identifier.split(IdentifierComponentSeparator).filter(component => component !== EmptyText);
      if (identifier.length <= HumanLineOffset || components.some(component => ProhibitedIdentifierComponents.has(component.toLowerCase()))) {
        report(filename, sourceFile, syntaxNode.getStart(), NamingViolation);
      }
    }
    typeScript.forEachChild(syntaxNode, inspectNode);
  }
  inspectNode(sourceFile);
}

for (const directory of CheckedDirectories) {
  for (const filename of collectFiles(directory)) inspectFile(filename);
}
for (const filename of IntegrationSources) {
  if (existsSync(filename)) inspectFile(filename);
}
if (violations.length > FirstPosition) {
  for (const violation of violations) console.error(violation);
  process.exit(FailureExitCode);
}
const SuccessMessage = 'Architecture source checks passed.';
console.log(SuccessMessage);
