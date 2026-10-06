// @ts-check
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { parse } from 'yaml';

const { libraries } = parse(readFileSync(new URL('./src/data/catalog.yaml', import.meta.url), 'utf8'));

// https://astro.build/config
export default defineConfig({
	site: 'https://docs.xenoglyphiq.dev',
	integrations: [
		starlight({
			title: 'Xenoglyphiq',
			// Brand assets come from the Xenoglyphiq brand kit (generated there; don't edit here).
			// Compact lockup (mark + wordmark) for the nav bar, outlined so it needs no font.
			logo: {
				light: './src/assets/lockup-light.svg',
				dark: './src/assets/lockup-dark.svg',
				replacesTitle: true,
			},
			favicon: '/favicon.svg',
			head: [
				{ tag: 'link', attrs: { rel: 'icon', href: '/favicon.ico', sizes: '48x48' } },
				{ tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' } },
				{ tag: 'link', attrs: { rel: 'manifest', href: '/site.webmanifest' } },
				{ tag: 'meta', attrs: { name: 'theme-color', content: '#FAF7F5', media: '(prefers-color-scheme: light)' } },
				{ tag: 'meta', attrs: { name: 'theme-color', content: '#1C1117', media: '(prefers-color-scheme: dark)' } },
				{ tag: 'meta', attrs: { property: 'og:image', content: 'https://docs.xenoglyphiq.dev/social-preview-dark.png' } },
				{ tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
			],
			description: 'Libraries that behave the same in every language: one spec, many ports.',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/Xenoglyphiq' }],
			editLink: { baseUrl: 'https://github.com/Xenoglyphiq/docs/edit/main/' },
			lastUpdated: true,
			customCss: ['./src/styles/custom.css'],
			sidebar: [
				{
					label: 'Libraries',
					// Same order as the site's pages: libraries by name.
					items: [...libraries]
						.sort((/** @type {{ name: string }} */ a, /** @type {{ name: string }} */ b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
						.map((/** @type {{ id: string; name: string }} */ l) => ({ label: l.name, link: `/${l.id}/` })),
				},
				{ label: 'How these libraries work', slug: 'about' },
			],
		}),
	],
});
