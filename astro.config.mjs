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
			description: 'Libraries that behave the same in every language: one spec, many ports.',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/Xenoglyphiq' }],
			editLink: { baseUrl: 'https://github.com/Xenoglyphiq/docs/edit/main/' },
			lastUpdated: true,
			customCss: ['./src/styles/custom.css'],
			sidebar: [
				{
					label: 'Libraries',
					items: libraries.map((/** @type {{ id: string; name: string }} */ l) => ({ label: l.name, link: `/${l.id}/` })),
				},
				{ label: 'How these libraries work', slug: 'about' },
			],
		}),
	],
});
