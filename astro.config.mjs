// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

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
		}),
	],
});
