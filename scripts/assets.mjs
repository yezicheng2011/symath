import { cpSync, mkdirSync } from 'node:fs';
mkdirSync('public', { recursive: true });
cpSync('node_modules/mathlive/fonts', 'public/fonts', { recursive: true });
console.log('MathLive fonts copied locally; no CDN required.');
