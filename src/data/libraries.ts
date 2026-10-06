// Build-time library data. `catalog.yaml` names the libraries and which ref of each
// port to read; everything else comes from the repos and registries themselves.
// Fetches are memoized per build. A missing required file fails the build rather
// than publishing a page that silently drifted from its source.

import { parse } from 'yaml';
import catalogText from './catalog.yaml?raw';

const RAW = 'https://raw.githubusercontent.com';

export type Language = 'zig' | 'julia' | 'nim' | 'swift' | 'go' | 'rust' | 'python' | 'kotlin';

interface CatalogPort {
	language: Language;
	repo: string;
	ref: string;
}

interface CatalogLibrary {
	id: string;
	name: string;
	spec: string;
	note?: string;
	ports: CatalogPort[];
}

export interface Benchmark {
	benchmark: string;
	reference: string;
	port: string;
	ratio: string;
}

export interface Example {
	id: string;
	title: string;
	code: Partial<Record<Language, string>>;
}

export interface Port {
	language: Language;
	label: string;
	repo: string;
	ref: string;
	released: boolean;
	packageName: string;
	status: string;
	claims: string[];
	specVersion?: string;
	listed: boolean;
	install: { lang: string; code: string }[];
	installNote?: string;
	benchmarks: Benchmark[];
}

export interface Library {
	id: string;
	name: string;
	summary: string;
	note?: string;
	spec: string;
	specVersion: string;
	implementsName: string;
	implementsUrl: string;
	cases: number;
	ports: Port[];
	examples: Example[];
}

export const LANGUAGES: Record<Language, { label: string; ext: string; highlight: string }> = {
	zig: { label: 'Zig', ext: 'zig', highlight: 'zig' },
	julia: { label: 'Julia', ext: 'jl', highlight: 'julia' },
	nim: { label: 'Nim', ext: 'nim', highlight: 'nim' },
	swift: { label: 'Swift', ext: 'swift', highlight: 'swift' },
	go: { label: 'Go', ext: 'go', highlight: 'go' },
	rust: { label: 'Rust', ext: 'rs', highlight: 'rust' },
	python: { label: 'Python', ext: 'py', highlight: 'python' },
	kotlin: { label: 'Kotlin', ext: 'kt', highlight: 'kotlin' },
};

const cache = new Map<string, Promise<string | undefined>>();

/** GET a URL as text; `undefined` on 404, throws on anything else. */
function fetchText(url: string): Promise<string | undefined> {
	let p = cache.get(url);
	if (!p) {
		p = fetch(url).then(async (res) => {
			if (res.status === 404) return undefined;
			if (!res.ok) throw new Error(`${res.status} ${res.statusText} fetching ${url}`);
			return res.text();
		});
		cache.set(url, p);
	}
	return p;
}

async function required(url: string): Promise<string> {
	const text = await fetchText(url);
	if (text === undefined) throw new Error(`Required file not found: ${url}`);
	return text;
}

/** Display order, the same on every page: libraries by name, ports by language name. */
const byName = (a: string, b: string) => a.localeCompare(b, 'en', { sensitivity: 'base' });

export function catalog(): CatalogLibrary[] {
	const libs = (parse(catalogText) as { libraries: CatalogLibrary[] }).libraries;
	return libs
		.map((l) => ({ ...l, ports: [...l.ports].sort((a, b) => byName(LANGUAGES[a.language].label, LANGUAGES[b.language].label)) }))
		.sort((a, b) => byName(a.name, b.name));
}

/** Rows of the markdown table under a README's `## Performance` heading. */
function parseBenchmarks(readme: string): Benchmark[] {
	const section = readme.split(/^## Performance\s*$/m)[1]?.split(/^## /m)[0] ?? '';
	return section
		.split('\n')
		.filter((l) => l.startsWith('|') && !/^\|\s*-/.test(l))
		.slice(1) // header row
		.map((l) => l.split('|').slice(1, -1).map((c) => c.trim().replace(/`/g, '')))
		.filter((cells) => cells.length >= 4 && cells[2] !== '—')
		.map(([benchmark, reference, port, ratio]) => ({ benchmark, reference, port, ratio }));
}

/** Whether a package is listed in its language's public registry. */
async function isListed(language: Language, name: string): Promise<boolean> {
	if (language === 'julia') {
		const url = `${RAW}/JuliaRegistries/General/master/${name[0].toUpperCase()}/${name}/Package.toml`;
		return (await fetchText(url)) !== undefined;
	}
	if (language === 'nim') {
		const pkgs = JSON.parse(await required(`${RAW}/nim-lang/packages/master/packages.json`)) as { name?: string; url?: string }[];
		return pkgs.some((p) => p.name?.toLowerCase() === name.toLowerCase());
	}
	return false; // registries without a listing step (Zig: git tags)
}

function installFor(p: { language: Language; repo: string; ref: string; packageName: string; listed: boolean; released: boolean }) {
	const url = `https://github.com/${p.repo}`;
	switch (p.language) {
		case 'zig':
			return {
				install: [
					{ lang: 'sh', code: `zig fetch --save git+${url}#${p.ref}` },
					{
						lang: 'zig',
						code: `// build.zig\nconst ${p.packageName} = b.dependency("${p.packageName}", .{ .target = target, .optimize = optimize });\nexe.root_module.addImport("${p.packageName}", ${p.packageName}.module("${p.packageName}"));`,
					},
				],
				installNote: p.released ? undefined : 'Not released yet: this installs the latest code from main.',
			};
		case 'julia':
			return p.listed
				? { install: [{ lang: 'julia', code: `using Pkg\nPkg.add("${p.packageName}")` }] }
				: {
						install: [{ lang: 'julia', code: `using Pkg\nPkg.add(url="${url}")` }],
						installNote: `Registration in Julia's General registry is pending; until then, install from the repository.`,
					};
		case 'nim':
			return p.listed
				? { install: [{ lang: 'sh', code: `nimble install ${p.packageName}` }] }
				: {
						install: [{ lang: 'sh', code: `nimble install ${url}@#${p.ref}` }],
						installNote: 'Listing in the Nimble directory is pending; until then, install by URL.',
					};
		default:
			return { install: [{ lang: 'sh', code: `# See ${url}#install` }] };
	}
}

let all: Promise<Library[]> | undefined;

export function libraries(): Promise<Library[]> {
	all ??= Promise.all(catalog().map(loadLibrary));
	return all;
}

export async function library(id: string): Promise<Library> {
	const lib = (await libraries()).find((l) => l.id === id);
	if (!lib) throw new Error(`Unknown library ${id}`);
	return lib;
}

async function loadLibrary(entry: CatalogLibrary): Promise<Library> {
	const specRaw = `${RAW}/${entry.spec}/main`;
	const cap = parse(await required(`${specRaw}/spec/capability.yaml`));
	const manifest = JSON.parse(await required(`${specRaw}/conformance/manifest.json`));

	const ports: Port[] = await Promise.all(
		entry.ports.map(async (cp) => {
			const meta = (cap.ports ?? []).find((p: { language: string }) => p.language === cp.language) ?? {};
			const packageName: string = meta.package ?? entry.id;
			const released = meta.status === 'released' || cp.ref.startsWith('v');
			const listed = await isListed(cp.language, packageName);
			const readme = await required(`${RAW}/${cp.repo}/${cp.ref}/README.md`);
			return {
				language: cp.language,
				label: LANGUAGES[cp.language].label,
				repo: cp.repo,
				ref: cp.ref,
				released,
				packageName,
				status: meta.status ?? 'planned',
				claims: meta.claims ?? [],
				specVersion: meta.implements_spec,
				listed,
				benchmarks: parseBenchmarks(readme),
				...installFor({ ...cp, packageName, listed, released }),
			};
		}),
	);

	const examples: Example[] = await Promise.all(
		(cap.examples ?? []).map(async (ex: { id: string; title: string }) => {
			const code: Example['code'] = {};
			await Promise.all(
				entry.ports.map(async (cp) => {
					const text = await fetchText(`${RAW}/${cp.repo}/${cp.ref}/examples/${ex.id}.${LANGUAGES[cp.language].ext}`);
					if (text !== undefined) code[cp.language] = text.trimEnd();
				}),
			);
			return { id: ex.id, title: ex.title, code };
		}),
	);

	return {
		id: entry.id,
		name: entry.name ?? cap.name,
		summary: cap.summary,
		note: entry.note,
		spec: entry.spec,
		specVersion: cap.spec_version,
		implementsName: cap.implements?.[0]?.name ?? '',
		implementsUrl: cap.implements?.[0]?.url ?? '',
		cases: manifest.cases.length,
		ports,
		examples,
	};
}
