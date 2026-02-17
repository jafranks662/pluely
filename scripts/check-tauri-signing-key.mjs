#!/usr/bin/env node

const PRIMARY_ENV = 'TAURI_SIGNING_PRIVATE_KEY';
const LEGACY_ENV = 'TAURI_PRIVATE_KEY';

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function summarize(value) {
  const lines = value.split(/\r?\n/).filter((line) => line.length > 0);
  const header = lines[0] ?? '';

  return {
    lines,
    lineCount: lines.length,
    hasHeader: header.startsWith('untrusted comment:'),
    hasPublicHeader: header.startsWith('untrusted comment: minisign public key'),
    hasSecretHeader: header.startsWith('untrusted comment: minisign secret key')
  };
}

const keyValue = process.env[PRIMARY_ENV] ?? process.env[LEGACY_ENV] ?? '';
const keySource = process.env[PRIMARY_ENV] ? PRIMARY_ENV : process.env[LEGACY_ENV] ? LEGACY_ENV : null;

if (!keySource) {
  fail(`${PRIMARY_ENV} (or legacy ${LEGACY_ENV}) is not set.`);
}

const diagnostics = summarize(keyValue);

if (!diagnostics.hasHeader) {
  fail(`Signing key in ${keySource} is invalid: missing 'untrusted comment:' header.`);
}

if (diagnostics.hasPublicHeader) {
  fail(`Signing key in ${keySource} appears to be a minisign public key, not a secret key.`);
}

if (diagnostics.lineCount < 2) {
  fail(`Signing key in ${keySource} must contain at least 2 non-empty lines; found ${diagnostics.lineCount}.`);
}

if (!diagnostics.hasSecretHeader) {
  console.warn(`⚠️ ${keySource} header does not explicitly say 'minisign secret key'.`);
}

console.log(`✅ ${keySource} format looks valid (header present: yes, non-empty lines: ${diagnostics.lineCount}).`);
