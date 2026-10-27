process.env.ASTRO_TELEMETRY_DISABLED = '1';
import { spawn } from 'node:child_process';

const isWin = process.platform === 'win32';
const cmd = isWin ? 'npx.cmd' : 'npx';
const child = spawn(cmd, ['astro', 'build', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
  shell: true,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
