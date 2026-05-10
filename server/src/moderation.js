// Text cleaning, link detection and a small profanity filter for the community chat.

// Control characters, soft hyphen, zero-width space, BOM, invisible operators and bidi
// overrides are stripped from stored text. ZWJ/ZWNJ/LRM/RLM are kept (emoji sequences, scripts).
const STRIP_FROM_STORED = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F­​‪-‮⁠-⁤⁦-⁩﻿]/g;
// For detection only we also drop every zero-width / directional mark, so "f‍uck" is caught.
const INVISIBLE_FOR_DETECTION = /[­​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

/** Normalises user text. Single-line text collapses all whitespace; multiline keeps up to one blank line. */
export function cleanText(value, { multiline = false } = {}) {
  let text = String(value).normalize('NFC').replace(/\r\n?/g, '\n').replace(STRIP_FROM_STORED, '');
  if (multiline) {
    text = text
      .replace(/\t/g, ' ')
      .replace(/[^\S\n]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n');
  } else {
    text = text.replace(/\s+/g, ' ');
  }
  return text.trim();
}

/** Length in Unicode code points, so an emoji counts as one character. */
export function charLength(text) {
  let n = 0;
  for (const _ of text) n++; // eslint-disable-line no-unused-vars
  return n;
}

// ---------------------------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------------------------

// Common and spam-prone TLDs. Two-letter TLDs that are also everyday English words
// (to, in, it, no, at, be, me, us, so, is ...) are left out, so "nice work.It rocks" still posts.
const TLDS = [
  'com', 'net', 'org', 'edu', 'gov', 'io', 'co', 'dev', 'app', 'ai', 'info', 'biz', 'xyz', 'gg', 'tv',
  'ly', 'uk', 'ca', 'de', 'fr', 'ru', 'cn', 'jp', 'au', 'nl', 'br', 'es', 'pl', 'se', 'ch', 'dk',
  'fi', 'cz', 'eu', 'nz', 'za', 'sg', 'ph', 'site', 'online', 'store', 'shop', 'tech', 'link', 'click',
  'top', 'live', 'pro', 'cc', 'ws', 'fm', 'vc', 'tk', 'ml', 'ga', 'cf', 'gq', 'xxx', 'club', 'fun',
  'space', 'website', 'page', 'blog', 'news', 'vip', 'lol', 'zip', 'mov', 'icu', 'cyou', 'buzz',
  'onion', 'porn', 'sex', 'bet', 'casino', 'win', 'money', 'loan', 'crypto', 'nft', 'tk',
].join('|');

const LINK_PATTERNS = [
  /\b[a-z][a-z0-9+.-]{1,20}:\/\//i, // any scheme://
  /\b(?:mailto|javascript):/i,
  /\bwww\d{0,3}\./i,
  new RegExp(`\\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\\.[a-z0-9-]+)*\\.(?:${TLDS})\\b`, 'i'),
  /\b\d{1,3}(?:\.\d{1,3}){3}\b/, // bare IPv4 address
];

function normaliseForLinks(text) {
  return text
    .normalize('NFKC')
    .replace(INVISIBLE_FOR_DETECTION, '')
    .replace(/\s*[[({]\s*(?:\.|dot)\s*[\])}]\s*/gi, '.') // example[.]com, example (dot) com
    .replace(new RegExp(`\\s+dot\\s+(?=(?:${TLDS})\\b)`, 'gi'), '.'); // example dot com
}

export function containsLink(text) {
  const normalised = normaliseForLinks(text);
  return LINK_PATTERNS.some((re) => re.test(normalised));
}

// ---------------------------------------------------------------------------------------------
// Profanity
// ---------------------------------------------------------------------------------------------

// Deliberately small. Modes:
//   sub  - matches anywhere inside a word ("bullshit")
//   pre  - matches at the start of a word ("cunts" but not "Scunthorpe")
//   word - the whole word, optionally plural ("ass", "asses" but not "class" or "assess")
// Letters may be repeated ("fuuuck") and common leetspeak is decoded ("sh1t", "@ss", "$lut").
const RULES = [
  ['fuck', 'sub'], ['fuk', 'word'], ['fck', 'word'], ['fcuk', 'sub'], ['phuck', 'sub'],
  ['motherf', 'pre'], ['shit', 'sub'], ['bitch', 'sub'], ['cunt', 'pre'], ['whore', 'sub'],
  ['slut', 'sub'], ['asshole', 'sub'], ['ass', 'word'], ['arse', 'word'], ['arsehole', 'sub'],
  ['bastard', 'pre'], ['dick', 'word'], ['dickhead', 'sub'], ['cock', 'word'], ['cocksuck', 'sub'],
  ['prick', 'word'], ['pussy', 'word'], ['twat', 'word'], ['wank', 'pre'], ['bollocks', 'word'],
  ['dildo', 'sub'], ['porn', 'sub'], ['rape', 'word'], ['rapist', 'word'], ['nigger', 'sub'],
  ['nigga', 'sub'], ['faggot', 'sub'], ['fag', 'word'], ['retard', 'word'], ['retarded', 'word'],
  ['kike', 'word'], ['spic', 'word'], ['chink', 'word'], ['gook', 'word'], ['wetback', 'word'],
  ['tranny', 'word'], ['dyke', 'word'], ['coon', 'word'], ['paki', 'word'],
];

function letterPattern(root) {
  return [...root].map((ch) => `${ch}+`).join('');
}

// Real words that the repeated-letter matching would otherwise catch.
const ALLOWED_WORDS = new Set(['shiitake', 'shiitakes']);

const MATCHERS = RULES.map(([root, mode]) => {
  const body = letterPattern(root);
  if (mode === 'sub') return new RegExp(body);
  if (mode === 'pre') return new RegExp(`^${body}`);
  return new RegExp(`^${body}(?:e?s)?$`);
});

const LEET = { 0: 'o', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', 9: 'g', '@': 'a', $: 's', '!': 'i', '|': 'i', '+': 't', '€': 'e' };

function decodeLeet(token, one) {
  let out = '';
  for (const ch of token) out += ch === '1' ? one : (LEET[ch] ?? ch);
  return out.replace(/[^a-z]/g, '');
}

/** Returns the word-level candidates a text should be checked against. */
function profanityCandidates(text) {
  const base = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(INVISIBLE_FOR_DETECTION, '')
    .toLowerCase();
  // Split on whitespace and punctuation that doesn't double as leetspeak or in-word obfuscation
  // (". - _ *" stay so "f.u.c.k" collapses to one word).
  const rawTokens = base.split(/[\s,;:?"'`()[\]{}<>/\\~^&%#=]+/).filter(Boolean);
  const candidates = new Set();
  const singles = [];
  const flushSingles = () => {
    if (singles.length >= 3) candidates.add(singles.join(''));
    singles.length = 0;
  };
  for (const raw of rawTokens) {
    // Trailing/leading punctuation isn't part of the word ("shit!" -> "shit"), but keep $ and @.
    const token = raw.replace(/^[^a-z0-9@$|!]+/, '').replace(/[^a-z0-9@$]+$/, '');
    if (!token) continue;
    for (const one of ['i', 'l']) {
      const decoded = decodeLeet(token, one);
      if (decoded) candidates.add(decoded);
    }
    const decoded = decodeLeet(token, 'i');
    if (decoded.length === 1) singles.push(decoded); // "f u c k" -> "fuck"
    else flushSingles();
  }
  flushSingles();
  return candidates;
}

export function isOffensive(text) {
  for (const word of profanityCandidates(text)) {
    if (ALLOWED_WORDS.has(word)) continue;
    if (MATCHERS.some((re) => re.test(word))) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------------------------
// Device (coarse, from the User-Agent; nothing else about the visitor is derived or stored)
// ---------------------------------------------------------------------------------------------

export function deviceFromUserAgent(ua) {
  if (typeof ua !== 'string' || ua.trim() === '') return 'unknown';
  if (/(?:bot|crawl|spider|slurp)\b|curl\/|wget\/|python|httpie|axios|go-http|java\/|^node$|undici/i.test(ua)) {
    return 'unknown';
  }
  if (/mobi|android|iphone|ipad|ipod|windows phone|blackberry|opera mini|silk\//i.test(ua)) return 'mobile';
  if (/windows nt|macintosh|mac os x|x11|linux|cros/i.test(ua)) return 'desktop';
  return 'unknown';
}
