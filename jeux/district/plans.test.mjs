// Les plans des cinq quartiers à plan propre, chacun vérifié dans son propre processus (voir plans.check.mjs).
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const check = fileURLToPath(new URL('./plans.check.mjs', import.meta.url));
for (const q of ['moderne', 'cotier', 'europe', 'futur', 'med']) execFileSync(process.execPath, [check, q], { stdio: 'inherit' });
