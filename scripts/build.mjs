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
      const distSitemap0 = resolve('dist', 'sitemap-0.xml');
      const distSitemap = resolve('dist', 'sitemap.xml');
      if (existsSync(distSitemap0)) {
        copyFileSync(distSitemap0, distSitemap);
        console.log('✓ Generated dist/sitemap.xml directly with all URLs for instant GSC discovery');
      }
    } catch (err) {
      console.error('Error generating sitemap.xml copy:', err);
    }
  }
  process.exit(code ?? 0);
});
