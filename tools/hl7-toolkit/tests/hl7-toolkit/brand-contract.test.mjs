import assert from 'node:assert/strict';
import { accessSync, constants, readFileSync } from 'node:fs';
import test from 'node:test';

function hexToRgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function luminance(hex) {
  const channels = hexToRgb(hex).map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
}

function contrast(first, second) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

function cssVariable(css, name) {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'));
  assert.ok(match, `Missing CSS color variable --${name}`);
  return match[1];
}

test('KAIRO Guardian branding appears without changing the one-message workflow', () => {
  const html = readFileSync('hl7-toolkit/app/index.html', 'utf8');

  assert.match(html, /<title>KAIRO Guardian \| HL7 Toolkit<\/title>/);
  assert.match(html, /aria-label="KAIRO Guardian"/);
  assert.match(html, /Clinical Systems Copilot/);
  assert.match(html, /Inspect\. Compare\. Validate\. Troubleshoot\. Faster\./);
  assert.match(html, /src="\/assets\/kairo-guardian\.png"/);
  assert.match(html, /One message at a time/);
  assert.doesNotMatch(html, /Batch Send|Start Listener|Auto Retry/i);

  accessSync('hl7-toolkit/app/assets/kairo-guardian.png', constants.R_OK);
});

test('KAIRO palette keeps normal text and primary actions highly readable', () => {
  const css = readFileSync('hl7-toolkit/app/styles/app.css', 'utf8');
  const background = cssVariable(css, 'background');
  const text = cssVariable(css, 'text');
  const accent = cssVariable(css, 'accent');
  const accentInk = cssVariable(css, 'accent-ink');

  assert.ok(contrast(background, text) >= 7, 'Normal text must meet enhanced contrast');
  assert.ok(contrast(accent, accentInk) >= 4.5, 'Primary actions must meet standard contrast');
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
});
