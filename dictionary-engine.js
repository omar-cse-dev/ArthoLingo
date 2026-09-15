/* ============================================================
   ArthoLingo — Local Word Dictionary Engine
   Version 1.1 — Local allowlist + safety gate
   ============================================================ */
'use strict';

window.ArthoLingoDictionary = (() => {
  let dictionary = new Map();
  let readyPromise = null;
  const version = '1.1.0';

  // Bengali output safety gate. This is defense-in-depth only; the
  // production dictionary is allowlist-based and unknown words are not translated.
  const BLOCKED_MEANING_TERMS = [
    'চোদাচুদি', 'চোদা', 'চুদা', 'চুদাচুদি', 'যৌনসঙ্গম', 'যৌনমিলন',
    'শ্লীলতাহানি', 'অশ্লীল', 'অশালীন', 'নোংরা যৌন', 'যৌন নির্যাতন'
  ];

  // English input safety gate. These are common explicit/vulgar tokens and variants.
  // Legitimate neutral words such as "adult" are intentionally NOT blocked.
  const BLOCKED_WORD_PATTERNS = [
    /(?:^|[^a-z])(?:fuck|fucking|fucked|fucker|shit|bullshit|bitch|bastard|cunt)(?:[^a-z]|$)/i,
    /(?:^|[^a-z])(?:dick|cock|pussy|whore|slut|porn|porno|semen|cum)(?:[^a-z]|$)/i,
    /(?:^|[^a-z])(?:blowjob|handjob|creampie|orgasm|masturbat\w*|rape|rapist)(?:[^a-z]|$)/i,
    /(?:^|[^a-z])(?:nigger|nigga|fag|faggot|retard)(?:[^a-z]|$)/i,
  ];

  const WORD_CLEAN_RE = /[^a-zA-Z'\-]/g;
  const BENGALI_RE = /[\u0980-\u09FF]/;

  function normalizeWord(word) {
    return String(word || '')
      .normalize('NFKC')
      .toLowerCase()
      .replace(WORD_CLEAN_RE, '')
      .replace(/^[-']+|[-']+$/g, '')
      .trim();
  }

  function normalizeMeaning(value) {
    return String(value || '')
      .normalize('NFKC')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isSafeWord(word) {
    const text = String(word || '').normalize('NFKC').toLowerCase();
    return !!text && !BLOCKED_WORD_PATTERNS.some(re => re.test(text));
  }

  function isApprovedMeaning(meaning) {
    const text = normalizeMeaning(meaning);
    if (!text || !BENGALI_RE.test(text)) return false;
    const lower = text.toLowerCase();
    if (BLOCKED_MEANING_TERMS.some(term => lower.includes(term))) return false;
    return true;
  }

  async function load() {
    if (readyPromise) return readyPromise;
    readyPromise = fetch('./artholingo-dictionary.json', { cache: 'no-store' })
      .then(r => {
        if (!r.ok) throw new Error(`Dictionary HTTP ${r.status}`);
        return r.json();
      })
      .then(payload => {
        dictionary = new Map();
        const entries = payload?.entries || {};
        for (const [key, value] of Object.entries(entries)) {
          const word = normalizeWord(key || value?.word);
          const meaning = normalizeMeaning(value?.meaning_bn);
          if (!word || !meaning || value?.approved !== true || value?.safe !== true) continue;
          if (!isSafeWord(word) || !isApprovedMeaning(meaning)) continue;
          dictionary.set(word, { ...value, word, meaning_bn: meaning });
        }
        console.info(`[Dictionary] Loaded ${dictionary.size} approved local entries (v${payload?.version || version}).`);
        return dictionary;
      })
      .catch(err => {
        console.warn('[Dictionary] Failed to load local dictionary:', err);
        dictionary = new Map();
        return dictionary;
      });
    return readyPromise;
  }

  async function ready() { return load(); }

  function lookup(word) {
    const key = normalizeWord(word);
    if (!key || !isSafeWord(key)) return null;
    const item = dictionary.get(key);
    if (!item) return null;
    if (!isApprovedMeaning(item.meaning_bn)) return null;
    return item;
  }

  function size() { return dictionary.size; }

  return { ready, lookup, normalizeWord, isApprovedMeaning, isSafeWord, size };
})();
