// Draws the app icons and the share picture into public/ (run: node scripts/make-icons.mjs).
// Uses sharp from android-app/node_modules (run npm ci there first).
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../android-app/package.json', import.meta.url));
const sharp = require('sharp');
const out = new URL('../public/', import.meta.url);
fs.mkdirSync(out, { recursive: true });

const kite = (x, y, s, rot, a, b) => `
  <g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">
    <polygon points="0,-6 0,-26 18,-6" fill="${a}"/><polygon points="0,-6 18,-6 0,30" fill="${b}"/>
    <polygon points="0,-6 0,30 -18,-6" fill="${a}"/><polygon points="0,-6 -18,-6 0,-26" fill="${b}"/>
    <path d="M0 -26 L0 30 M-18 -6 L18 -6" stroke="rgba(60,40,30,.55)" stroke-width="1.4"/>
    <path d="M0 30 q-8 12 -2 22 q8 10 0 22" fill="none" stroke="rgba(70,70,90,.7)" stroke-width="1.6"/>
    <circle cx="-3" cy="44" r="3.4" fill="${a}"/><circle cx="1" cy="60" r="3.4" fill="${b}"/><circle cx="-1" cy="74" r="3.4" fill="${a}"/>
  </g>`;

const spark = (x, y, r) => `
  <circle cx="${x}" cy="${y}" r="${r * 1.8}" fill="url(#glow)"/>
  <path d="M${x} ${y - r} L${x + r * 0.25} ${y - r * 0.25} L${x + r} ${y} L${x + r * 0.25} ${y + r * 0.25} L${x} ${y + r} L${x - r * 0.25} ${y + r * 0.25} L${x - r} ${y} L${x - r * 0.25} ${y - r * 0.25} Z" fill="#fff6c8"/>`;

const defs = `
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5fb4e4"/><stop offset=".65" stop-color="#a9dcf0"/><stop offset="1" stop-color="#e8f6e4"/></linearGradient>
    <radialGradient id="glow"><stop offset="0" stop-color="#fff3b0" stop-opacity=".95"/><stop offset="1" stop-color="#ffb703" stop-opacity="0"/></radialGradient>
  </defs>`;

// Icon (512): content kept inside the middle 80% so round "maskable" icons don't cut it off
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${defs}
  <rect width="512" height="512" fill="url(#sky)"/>
  <path d="M0 430 Q130 380 256 410 T512 400 V512 H0 Z" fill="#8cc77f"/>
  <path d="M0 460 Q160 430 300 452 T512 446 V512 H0 Z" fill="#6cb35f"/>
  <path d="M70 470 Q200 330 340 150" fill="none" stroke="#fff" stroke-width="5"/>
  <path d="M442 470 Q320 330 172 150" fill="none" stroke="#fff" stroke-width="5"/>
  ${kite(172, 150, 2.6, -18, '#ff6b6b', '#ffd166')}
  ${kite(340, 150, 2.6, 18, '#7b2cbf', '#ffd60a')}
  ${spark(256, 252, 34)}
</svg>`;

// Share picture (1200 x 630)
const share = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">${defs}
  <rect width="1200" height="630" fill="url(#sky)"/>
  <path d="M0 520 Q300 450 600 500 T1200 480 V630 H0 Z" fill="#8cc77f"/>
  <path d="M0 565 Q350 520 700 552 T1200 540 V630 H0 Z" fill="#6cb35f"/>
  <path d="M140 580 Q420 420 760 190" fill="none" stroke="#fff" stroke-width="5"/>
  <path d="M1060 580 Q780 420 440 190" fill="none" stroke="#fff" stroke-width="5"/>
  ${kite(440, 190, 2.8, -18, '#ff6b6b', '#ffd166')}
  ${kite(760, 190, 2.8, 18, '#7b2cbf', '#ffd60a')}
  ${spark(600, 292, 40)}
  <text x="600" y="110" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="96" font-weight="900" font-style="italic" fill="#fff" stroke="rgba(30,50,70,.45)" stroke-width="6" paint-order="stroke">Kite Fight</text>
  <text x="600" y="612" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="700" fill="#fff" stroke="rgba(30,50,70,.5)" stroke-width="5" paint-order="stroke">Dash through their string. Three cuts and they drop!</text>
</svg>`;

const png = (svg, size, file) => sharp(Buffer.from(svg)).resize(size, size).png().toFile(new URL(file, out).pathname.replace(/^\/(\w:)/, '$1'));
await png(icon, 512, 'icon-512.png');
await png(icon, 192, 'icon-192.png');
await png(icon, 180, 'apple-touch-icon.png');
await sharp(Buffer.from(share)).jpeg({ quality: 86 }).toFile(new URL('share.jpg', out).pathname.replace(/^\/(\w:)/, '$1'));
console.log('icons done');
