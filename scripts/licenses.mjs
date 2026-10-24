import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {execFileSync} from 'node:child_process';

const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const allowed = new Set(['MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', '0BSD', 'Unlicense', 'CC0-1.0']);
const inventory = [];
let notices = 'SYMATH — THIRD-PARTY NOTICES\n\nDependencies are used under the licenses reproduced below.\nRuntime code, bundled components, fonts, and installed development dependencies are included.\nSyMath itself is licensed under the Apache License 2.0 (see LICENSE).\n\n';

for (const path of Object.keys(lock.packages).sort()) {
  if (!path || !existsSync(join(path, 'package.json'))) continue;
  const pkg = JSON.parse(readFileSync(join(path, 'package.json'), 'utf8'));
  if (!allowed.has(pkg.license)) throw new Error(`Unapproved license: ${pkg.name}@${pkg.version}: ${pkg.license}`);
  const files = readdirSync(path).filter(f => /^(license|licence|notice|copying)(\.|$)/i.test(f));
  let body = files.map(file => readFileSync(join(path, file), 'utf8')).join('\n\n');
  if (!body && pkg.name.startsWith('@esbuild/')) body = readFileSync('node_modules/esbuild/LICENSE.md', 'utf8');
  if (!body && pkg.name.startsWith('@rollup/')) {
    const parent = Object.keys(lock.packages).find(p => p.endsWith('/rollup') && existsSync(join(p,'LICENSE.md')));
    if (parent) body = readFileSync(join(parent, 'LICENSE.md'), 'utf8');
  }
  if (!body) throw new Error(`License text missing for ${pkg.name}@${pkg.version}. Review before distribution.`);
  inventory.push({ name: pkg.name, version: pkg.version, license: pkg.license, development: !!lock.packages[path].dev });
  notices += `\n${'='.repeat(72)}\n${pkg.name} ${pkg.version} | ${pkg.license}${lock.packages[path].dev ? ' | development' : ' | runtime'}\n${'='.repeat(72)}\n\n${body}\n`;
}
for (const [label, file] of [
  ['KaTeX fonts — distributed with MathLive — MIT', 'KaTeX-MIT.txt'],
]) notices += `\n${'='.repeat(72)}\n${label}\n${'='.repeat(72)}\n\n${readFileSync(join('licenses/upstream', file), 'utf8')}\n`;
const python=JSON.parse(execFileSync(process.platform==='win32'?'.venv/Scripts/python.exe':'.venv/bin/python',['scripts/python-licenses.py'],{encoding:'utf8'}));
for(const {text,...item}of python){inventory.push({...item,development:false});notices+=`\n${'='.repeat(72)}\n${item.name} ${item.version} | ${item.license} | Python runtime\n${'='.repeat(72)}\n\n${text}\n`;}
if(existsSync('licenses/legacy-v1-notices.txt'))notices+='\n\nRETAINED V1 ASSET LICENSES\n'+readFileSync('licenses/legacy-v1-notices.txt','utf8');
mkdirSync('public', { recursive:true }); mkdirSync('licenses', { recursive:true });
writeFileSync('public/THIRD_PARTY_NOTICES.txt', notices);
writeFileSync('licenses/dependencies.json', JSON.stringify(inventory, null, 2)+'\n');
console.log(`License check passed: ${inventory.length} installed packages + embedded components; permissive licenses only.`);
