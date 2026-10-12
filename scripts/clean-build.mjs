import { rm } from 'node:fs/promises';

// TypeScript does not remove output for deleted sources. Start clean so releases
// cannot retain obsolete runtime modules from an earlier checkout or build.
await rm(new URL('../dist/', import.meta.url), { recursive: true, force: true });
