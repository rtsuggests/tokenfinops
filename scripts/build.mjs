process.env.ASTRO_TELEMETRY_DISABLED = '1';
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const isWin = process.platform === 'win32';
const cmd = isWin ? 'npx.cmd' : 'npx';
const child = spawn(cmd, ['astro', 'build', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
  shell: true,
});

child.on('exit', (code) => {
  if (code === 0) {
    try {
      const distIndex = resolve('dist', 'sitemap-index.xml');
      const distSitemap = resolve('dist', 'sitemap.xml');
      if (existsSync(distIndex)) {
        copyFileSync(distIndex, distSitemap);
        console.log('✓ Generated dist/sitemap.xml from sitemap-index.xml (GSC ready)');
      }
    } catch (err) {
      console.error('Error generating sitemap.xml copy:', err);
    }
  }
  process.exit(code ?? 0);
});
