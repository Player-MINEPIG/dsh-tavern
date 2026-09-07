// Recompose real screenshots without changing UI text or generated dialogue.
// Usage: node docs/assets/market/render.mjs [path-to-sharp-module]
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const sharp = require(process.argv[2] || 'sharp');
const root = path.dirname(fileURLToPath(import.meta.url));
const W = 1800;
const H = 1200;
const escape = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const text = (x, y, s, size = 28, color = '#b3becd', weight = 400) =>
  `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}">${escape(s)}</text>`;
const rect = (x, y, w, h, color = '#141414', radius = 22) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${color}" stroke="#2b3442"/>`;
const svg = (body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${body}</svg>`);
const legend = (y, icon, title, detail) => text(1360, y, icon, 40, '#79d4e7') +
  text(1440, y, title, 28, '#f7f9fc', 700) + text(1360, y + 42, detail, 21);

async function crop(name, region, left, top, width, radius = 0) {
  let input = sharp(path.join(root, 'sources', `${name}.jpg`));
  if (region) input = input.extract({ left: region[0], top: region[1], width: region[2], height: region[3] });
  let bytes = await input.resize({ width }).png().toBuffer();
  if (radius) {
    const { height } = await sharp(bytes).metadata();
    const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${radius}" fill="white"/></svg>`);
    bytes = await sharp(bytes).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  }
  return { input: bytes, left, top };
}

async function card(number, name, title, subtitle, body, captures) {
  const base = `<rect width="1800" height="1200" fill="#0d131e"/>` +
    `<path d="M0 0H1800V190H0Z" fill="#111b29"/>` +
    text(60, 48, 'DSH TAVERN  /  ROLEPLAY', 22, '#79d4e7', 700) +
    text(1740, 48, String(number).padStart(2, '0'), 22, '#79d4e7', 700) +
    text(60, 116, title, 59, '#f7f9fc', 700) +
    text(60, 165, subtitle, 27) + body +
    `<path d="M60 1130H1740" stroke="#2b3442"/>` +
    text(60, 1170, 'Real UI captures · Chinese roleplay demo', 22, '#8393a7') +
    text(1480, 1170, 'dsh-tavern', 24, '#b3becd', 700);
  await sharp(svg(base)).composite(await Promise.all(captures)).png().toFile(path.join(root, `${name}.png`));
}

await card(1, '01-roleplay', 'Character-driven roleplay in DSH.',
  'Copy, swipe, branch, rewind, or edit the display — directly below each reply.',
  rect(55, 229, 1260, 855) +
  text(1360, 270, 'BUTTON LEGEND', 23, '#79d4e7', 700) +
  legend(342, '⧉', 'Copy', 'Copy the displayed reply.') +
  legend(460, '‹ ›', 'Swipe', 'Switch saved replies and paths.') +
  legend(578, '›', 'Try another', 'At the last candidate: generate.') +
  legend(696, '⑂', 'Branch', 'Continue in a new playthrough.') +
  legend(814, '↩', 'Rewind', 'Continue here in this playthrough.') +
  legend(932, '✎', 'Edit display', 'Original context stays unchanged.') +
  text(1360, 1055, 'Available when the Agent is idle.', 21),
  [crop('01-roleplay', null, 65, 250, 1240)]);

await card(3, '02-three-routes', 'Keep your Agent. Add roleplay.',
  'Tavern provides RP compatibility, while DSH supplies the Agent and its tools.',
  rect(55, 255, 790, 810) + rect(900, 255, 845, 810) +
  text(85, 303, 'ONE EXAMPLE: THREE SUBAGENTS', 23, '#79d4e7', 700) +
  text(930, 303, 'THE ROLEPLAY CONTINUES', 23, '#79d4e7', 700) +
  text(100, 755, 'Delegate to subagents.', 31, '#f7f9fc', 700) +
  text(100, 818, 'Read local workspace lore.', 31, '#f7f9fc', 700) +
  text(100, 881, 'Compose your DSH Agent preset.', 31, '#f7f9fc', 700) +
  text(100, 982, 'Within DSH permissions and RP safety rules.', 25) +
  text(100, 1020, 'Three routes are a demo, not a fixed limit.', 25),
  [crop('02-three-routes', [486, 47, 334, 156], 90, 368, 715, 40),
   crop('01-roleplay', null, 925, 410, 790)]);

await card(4, '03-session-resources', 'Keep your cast close.',
  'A character card and preset, bound to the current session and one click away.',
  rect(55, 235, 670, 858) +
  text(805, 286, 'SESSION RESOURCES → ROLEPLAY', 25, '#79d4e7', 700) +
  text(810, 858, 'Character + preset', 36, '#f7f9fc', 700) +
  text(810, 912, 'Open the floating panel to inspect or change either.', 26),
  [crop('03-session-resources', [8, 8, 377, 472], 65, 245, 650),
   crop('01-roleplay', [0, 263, 825, 277], 795, 405, 950)]);

await card(5, '04-preset', 'Give the story a direction.',
  'Reusable preset prompts shape the roleplay without extra instructions in every message.',
  rect(810, 212, 930, 896) +
  text(70, 340, 'Set the tone.', 42, '#f7f9fc', 700) +
  text(70, 405, 'Keep the character’s voice in focus.', 28) +
  text(70, 595, 'Define the flow.', 42, '#f7f9fc', 700) +
  text(70, 660, 'Here: explore three narrative routes,', 28) +
  text(70, 703, 'then return one coherent scene.', 28) +
  text(70, 922, 'Configured once. Applied by the preset.', 27, '#79d4e7'),
  [crop('04-preset', [1190, 315, 520, 510], 825, 220, 900)]);

await card(6, '05-display-regex', 'Show the story, not the process.',
  'Display-only regex filters the RP view. Original messages remain unchanged.',
  rect(55, 260, 770, 830) + rect(865, 260, 880, 830) +
  text(80, 238, 'DISPLAY RULES', 24, '#79d4e7', 700) +
  text(895, 238, 'FILTERED RP VIEW', 24, '#79d4e7', 700) +
  text(895, 997, 'No route notes interrupt the scene.', 26),
  [crop('05-display-regex', [1190, 282, 520, 525], 70, 280, 740),
   crop('01-roleplay', null, 885, 355, 840)]);

await card(7, '06-native-history', 'Same conversation. Different views.',
  'Enjoy the scene in RP. Switch to DSH to inspect the original tools and progress.',
  rect(55, 285, 825, 795) + rect(920, 285, 825, 795) +
  text(80, 252, 'NATIVE DSH · TOOLS & PROGRESS', 24, '#79d4e7', 700) +
  text(945, 252, 'RP · CHARACTER DIALOGUE', 24, '#79d4e7', 700) +
  text(85, 1018, 'Three subagent calls in the original record.', 26) +
  text(950, 1018, 'The same turn, focused on the story.', 26),
  [crop('06-native-history', [530, 96, 940, 666], 70, 350, 795),
   crop('01-roleplay', [0, 263, 825, 277], 935, 490, 795)]);

await card(2, '07-swipe-paths', 'Swipe a reply. Its story follows.',
  'Revisit an earlier reply: the continuation below switches to that saved path automatically.',
  rect(55, 250, 790, 830) + rect(955, 250, 790, 830) +
  text(85, 305, 'CANDIDATE 1 / 3', 28, '#79d4e7', 700) +
  text(985, 305, 'CANDIDATE 3 / 3', 28, '#79d4e7', 700) +
  text(865, 475, '⇄', 64, '#79d4e7') +
  text(861, 525, 'Swipe', 25, '#79d4e7') +
  text(85, 625, '↓  ITS SAVED CONTINUATION', 25, '#79d4e7', 700) +
  text(985, 625, '↓  ITS SAVED CONTINUATION', 25, '#79d4e7', 700) +
  text(85, 1018, 'Same playthrough. Different saved paths.', 26) +
  text(985, 1018, 'Switching restores; it does not regenerate.', 26),
  [crop('swipe-a', [605, 250, 520, 90], 80, 355, 740),
   crop('swipe-c', [605, 250, 520, 90], 980, 355, 740),
   crop('swipe-a', [605, 415, 520, 148], 80, 675, 740),
   crop('swipe-c', [605, 415, 520, 148], 980, 675, 740)]);
