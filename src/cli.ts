#!/usr/bin/env node
import { runCli } from './run-cli.js';
runCli().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Server failed.');
  process.exitCode = 1;
});
