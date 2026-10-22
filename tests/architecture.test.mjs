import { test } from 'node:test';
import { strict as assertion } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir as temporaryDirectory } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const SourceDirectory = 'src';
const SpecificationDirectory = 'specs';
const ContractDirectory = 'contracts';
const TestDirectory = 'tests';
const ToolDirectory = 'tools';
const FixtureFilename = 'fixture.ts';
const TemporaryFolderPrefix = 'spotify-jam-architecture-';
const CompilerModuleName = 'typescript';
const MobilePackageFilename = '../../StreamingServiceMobile/package.json';
const ProjectPackageFilename = '../package.json';
const CheckScriptFilename = 'tools/check-architecture.mjs';
const OutputEncoding = 'utf8';
const SuccessfulExitCode = 0;
const FailedExitCode = 1;
const NamedConstantSource = 'const MinimumQueueLength = 0; const queueLength = MinimumQueueLength;';
const MagicNumberSource = 'function queueLength() { return 123; }';
const MagicStringSource = 'function queueName() { return "unexplained"; }';
const CommentSource = '// explanatory comment\nconst queueLength = 0;';
const AbbreviatedLambdaSource = 'const queueValues = []; queueValues.map(x => x);';
const AbbreviatedParameterSource = 'function processQueue(ctx) { return ctx; }';
const NamedLambdaSource = 'const queueValues = []; queueValues.map(queueValue => queueValue);';
const EnumSource = 'enum RepeatMode { Off = "off", All = "all" }';
const TestNames = Object.freeze({
  namedValues: 'accepts named constants',
  number: 'rejects unexplained numeric literals',
  string: 'rejects unexplained string literals',
  comment: 'rejects code comments',
  lambda: 'rejects abbreviated lambda parameters',
  parameter: 'rejects abbreviated method parameters',
  descriptiveLambda: 'accepts descriptive lambda parameters',
  enumeration: 'accepts named protocol enumeration values',
});
const projectRequire = createRequire(new URL(ProjectPackageFilename, import.meta.url));
const mobileRequire = createRequire(new URL(MobilePackageFilename, import.meta.url));
let compilerFilename;
try { compilerFilename = projectRequire.resolve(CompilerModuleName); }
catch { compilerFilename = mobileRequire.resolve(CompilerModuleName); }

function inspectFixture(sourceText) {
  const fixtureDirectory = mkdtempSync(join(temporaryDirectory(), TemporaryFolderPrefix));
  try {
    for (const directoryName of [SourceDirectory, ContractDirectory, TestDirectory, ToolDirectory, SpecificationDirectory]) {
      mkdirSync(join(fixtureDirectory, directoryName));
    }
    writeFileSync(join(fixtureDirectory, SourceDirectory, FixtureFilename), sourceText);
    return spawnSync(process.execPath, [resolve(CheckScriptFilename), compilerFilename], {
      cwd: fixtureDirectory,
      encoding: OutputEncoding,
    });
  } finally {
    rmSync(fixtureDirectory, { recursive: true, force: true });
  }
}

test(TestNames.namedValues, () => assertion.equal(inspectFixture(NamedConstantSource).status, SuccessfulExitCode));
test(TestNames.number, () => assertion.equal(inspectFixture(MagicNumberSource).status, FailedExitCode));
test(TestNames.string, () => assertion.equal(inspectFixture(MagicStringSource).status, FailedExitCode));
test(TestNames.comment, () => assertion.equal(inspectFixture(CommentSource).status, FailedExitCode));
test(TestNames.lambda, () => assertion.equal(inspectFixture(AbbreviatedLambdaSource).status, FailedExitCode));
test(TestNames.parameter, () => assertion.equal(inspectFixture(AbbreviatedParameterSource).status, FailedExitCode));
test(TestNames.descriptiveLambda, () => assertion.equal(inspectFixture(NamedLambdaSource).status, SuccessfulExitCode));
test(TestNames.enumeration, () => assertion.equal(inspectFixture(EnumSource).status, SuccessfulExitCode));
