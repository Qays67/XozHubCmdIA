#!/usr/bin/env node
import { main } from '../src/app.js';

main().catch((err) => {
  process.stderr.write(`${err && err.stack ? err.stack : String(err)}\n`);
  process.exit(1);
});
