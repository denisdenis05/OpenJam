import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const BuildCommand = 'build';
const CheckCommand = 'check';
const TestCommand = 'test';
const PackageFilename = 'package.json';
const TypeScriptCompilerModule = 'typescript/bin/tsc';
const TypeScriptPackageModule = 'typescript';
const MobileProjectFolder = '../StreamingServiceMobile';
const ToolsFolder = 'tools';
const ArchitectureCheckFilename = 'check-architecture.mjs';
const TestsFolder = 'tests';
const TestFilenameSuffix = '.test.mjs';
const InheritedOutput = 'inherit';
const ProjectArgument = '--project';
const ProjectFilename = 'tsconfig.json';
const NoEmitArgument = '--noEmit';
const SuccessfulExitCode = 0;
const FailedExitCode = 1;
const CommandArgumentIndex = 2;
const UnknownCommandMessage = 'Expected build, check, or test.';
const MissingCompilerMessage = 'Install development dependencies here or in StreamingServiceMobile.';
const projectDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const projectRequire = createRequire(join(projectDirectory, PackageFilename));
const mobileRequire = createRequire(join(projectDirectory, MobileProjectFolder, PackageFilename));
let compilerFilename;
let typeScriptFilename;
for (const dependencyRequire of [projectRequire, mobileRequire]) {
  try {
    compilerFilename = dependencyRequire.resolve(TypeScriptCompilerModule);
    typeScriptFilename = dependencyRequire.resolve(TypeScriptPackageModule);
    break;
  } catch {}
}
if (!compilerFilename) {
  throw new Error(MissingCompilerMessage);
}
const command = process.argv[CommandArgumentIndex];
if (![BuildCommand, CheckCommand, TestCommand].includes(command)) {
  throw new Error(UnknownCommandMessage);
}
function executeNode(argumentsList) {
  const result = spawnSync(process.execPath, argumentsList, {
    cwd: projectDirectory,
    stdio: InheritedOutput,
  });
  if (result.error) throw result.error;
  if (result.status !== SuccessfulExitCode) process.exit(result.status ?? FailedExitCode);
}
executeNode([join(ToolsFolder, ArchitectureCheckFilename), typeScriptFilename]);
const compilerArguments = [compilerFilename, ProjectArgument, ProjectFilename];
if (command === CheckCommand) compilerArguments.push(NoEmitArgument);
executeNode(compilerArguments);
if (command === TestCommand) {
  const testFilenames = readdirSync(join(projectDirectory, TestsFolder))
    .filter(filename => filename.endsWith(TestFilenameSuffix))
    .sort()
    .map(filename => join(TestsFolder, filename));
  for (const testFilename of testFilenames) executeNode([testFilename]);
}
