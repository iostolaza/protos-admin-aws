// src/polyfills.ts
// Polyfills for older browsers (empty by default). Add Node shims for Amplify/buffer.
// Reference: https://angular.dev/guide/polyfills

// Fix 'global is not defined' for Amplify Storage/buffer (Node global in browser)
(globalThis as any).global = globalThis;

(window as any).global = window;
(window as any).process = {
  env: { DEBUG: undefined },
};

// Optional: Process shim for Node env (e.g., crypto/debug in deps)
(globalThis as any).process = {
  env: { DEBUG: undefined },
  version: '',
};

// Existing Angular polyfills (zone.js for change detection)
import 'zone.js';  // Included with Angular CLI.