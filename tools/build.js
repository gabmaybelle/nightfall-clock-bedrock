#!/usr/bin/env node
// Builds the two packs and the .mcaddon.
//
//   node tools/build.js
//
// The pack files in packs/ are copied as they are, with the version from package.json written into
// the manifests. The resource pack's ui/hud_screen.json is written here, one label per place the
// clock can sit (src/hud.ts). The scripts in src/ (and the self-test in test/) are TypeScript,
// compiled here. Output:
//   build/packs/bp, build/packs/rp   the behaviour and resource packs
//   build/packs/bp-test              the self-test pack (test worlds only, never shipped)
//   dist/NightfallClock-<version>.mcaddon
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const { zip } = require('./zip.js');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const out = path.join(root, 'build', 'packs');
const writeFile = (p, data) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); };
const writeJson = (p, obj) => writeFile(p, JSON.stringify(obj, null, '\t') + '\n');
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const fail = (why) => { console.error('build failed: ' + why); process.exit(1); };

function manifest(file) {
	const m = readJson(file);
	const v = pkg.version.split('.').map(Number);
	m.header.version = v;
	for (const mod of m.modules) mod.version = v;
	for (const d of m.dependencies || []) {
		if (d.module_name) {
			d.version = pkg.devDependencies[d.module_name];
			if (!d.version) fail(`${file} asks for ${d.module_name}, which package.json doesn't pin`);
		} else if (d.uuid) d.version = v;
	}
	return m;
}

// Where each place sits: above the hotbar (where the held item's name shows) or a corner.
const PLACES = {
	// On PC the hearts and hunger sit above the hotbar, so the line clears them; on a phone or tablet
	// (touch) they sit at the top of the screen and only the XP bar is above the hotbar (Gabby, 2026-11-14).
	hb: { anchor: 'bottom_middle', offset: [0, -46], touchOffset: [0, -30] },
	tl: { anchor: 'top_left', offset: [4, 4] },
	tr: { anchor: 'top_right', offset: [-4, 4] },
	bl: { anchor: 'bottom_left', offset: [4, -4] },
	br: { anchor: 'bottom_right', offset: [-4, -4] },
};

// Each label keeps the last title that began with its key, after the title itself has gone (a
// panel whose #preserved_text copies the title text whenever it becomes visible, and it becomes
// visible only for a new title with this key). The centre title hides any title beginning "[nc:".
function hudScreen() {
	const ui = { namespace: 'hud' };
	ui.nc_label_base = { type: 'label', font_size: 'normal', shadow: true, localize: false, color: [1, 1, 1], text_alignment: 'center', layer: 41 };
	const boxes = [];
	for (const [k, p] of Object.entries(PLACES)) {
		const key = `[nc:${k}]`;
		ui[`nc_label_${k}@hud.nc_label_base`] = {
			anchor_from: 'center', anchor_to: 'center', offset: [0, 0], text: '#text',
			controls: [{ [`nc_${k}_data`]: {
				type: 'panel', size: [0, 0], property_bag: { '#preserved_text': '' },
				bindings: [
					{ binding_name: '#hud_title_text_string' },
					{ binding_name: '#hud_title_text_string', binding_name_override: '#preserved_text', binding_condition: 'visibility_changed' },
					{ binding_type: 'view', source_property_name: `(not (#hud_title_text_string = #preserved_text) and not ((#hud_title_text_string - '${key}') = #hud_title_text_string))`, target_property_name: '#visible' },
				],
			} }],
			bindings: [{ binding_type: 'view', source_control_name: `nc_${k}_data`, source_property_name: `(#preserved_text - '${key}')`, target_property_name: '#text' }],
		};
		ui[`nc_box_${k}`] = {
			...(p.touchOffset ? { '$nc_offset|default': p.offset, variables: [{ requires: '$touch', $variables: { '$nc_offset': p.touchOffset } }] } : {}),
			type: 'image', texture: 'textures/ui/hud_tip_text_background', alpha: 0.6,
			anchor_from: p.anchor, anchor_to: p.anchor, offset: p.touchOffset ? '$nc_offset' : p.offset, size: ['100%c', '100%c + 4px'], layer: 40,
			controls: [{ [`nc_text_${k}@hud.nc_label_${k}`]: {} }],
		};
		boxes.push({ [`nc_place_${k}@hud.nc_box_${k}`]: {} });
	}
	ui.nc_hud = { type: 'panel', size: ['100%', '100%'], layer: 40, controls: boxes };
	ui.root_panel = { modifications: [{ array_name: 'controls', operation: 'insert_back', value: { 'nc_hud@hud.nc_hud': {} } }] };
	ui['hud_title_text/title_frame/title'] = { modifications: [{ array_name: 'bindings', operation: 'insert_back',
		value: { binding_type: 'view', source_property_name: "((#text - '[nc:') = #text)", target_property_name: '#visible' } }] };
	return ui;
}

function build() {
	fs.rmSync(out, { recursive: true, force: true });
	const bp = path.join(out, 'bp'), rp = path.join(out, 'rp'), bpTest = path.join(out, 'bp-test');
	fs.cpSync(path.join(root, 'packs', 'bp'), bp, { recursive: true });
	fs.cpSync(path.join(root, 'packs', 'rp'), rp, { recursive: true });
	writeJson(path.join(bp, 'manifest.json'), manifest(path.join(root, 'packs', 'bp', 'manifest.json')));
	writeJson(path.join(rp, 'manifest.json'), manifest(path.join(root, 'packs', 'rp', 'manifest.json')));
	writeJson(path.join(bpTest, 'manifest.json'), manifest(path.join(root, 'test', 'manifest.json')));
	writeJson(path.join(rp, 'ui', 'hud_screen.json'), hudScreen());
	// The icon is the Java edition's gold clock.
	const icon = fs.readFileSync(path.join(root, 'packs', 'icon.png'));
	writeFile(path.join(bp, 'pack_icon.png'), icon);
	writeFile(path.join(rp, 'pack_icon.png'), icon);

	const main = fs.readFileSync(path.join(root, 'src', 'main.ts'), 'utf8');
	if (!main.includes(`VERSION = "${pkg.version}"`)) fail(`src/main.ts VERSION isn't ${pkg.version}`);

	const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
	if (!fs.existsSync(tsc)) fail('TypeScript is not installed: run npm install');
	fs.rmSync(path.join(root, 'build', 'js'), { recursive: true, force: true });
	cp.execFileSync(process.execPath, [tsc, '-p', path.join(root, 'tsconfig.json')], { stdio: 'inherit' });
	fs.cpSync(path.join(root, 'build', 'js', 'src'), path.join(bp, 'scripts', 'src'), { recursive: true });
	fs.cpSync(path.join(root, 'build', 'js', 'test'), path.join(bpTest, 'scripts', 'test'), { recursive: true });
	// The self-test checks the rules directly, so it carries its own copy of them.
	writeFile(path.join(bpTest, 'scripts', 'src', 'clock.js'), fs.readFileSync(path.join(root, 'build', 'js', 'src', 'clock.js')));

	const files = [];
	for (const [dir, prefix] of [[bp, 'NightfallClock_BP'], [rp, 'NightfallClock_RP']]) {
		(function walk(d) {
			for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((x, y) => (x.name < y.name ? -1 : 1))) {
				const p = path.join(d, e.name);
				if (e.isDirectory()) walk(p);
				else files.push({ name: prefix + '/' + path.relative(dir, p).split(path.sep).join('/'), data: fs.readFileSync(p) });
			}
		})(dir);
	}
	const addon = path.join(root, 'dist', `NightfallClock-${pkg.version}.mcaddon`);
	writeFile(addon, zip(files));
	console.log(`built: ${path.relative(root, addon)} (${files.length} files, ${Math.round(fs.statSync(addon).size / 1024)} KB)`);
}

build();
