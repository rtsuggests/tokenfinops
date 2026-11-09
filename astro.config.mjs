import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  site: 'https://tokenspendcalc.com',
  integrations: [
    react(),
    tailwind({
      applyBaseStyles: true,
    }),
    sitemap({
      serialize(item) {
        item.lastmod = new Date();
        item.changefreq = 'weekly';
        return item;
      },
    }),
  ],
  compressHTML: true,
});
