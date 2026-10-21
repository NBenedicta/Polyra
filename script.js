// ===========================
// Polyra — Language Translator
// ===========================

(function () {
  'use strict';

  // ---------- Config ----------

  const LANGUAGES = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'zh', name: 'Chinese (Simplified)' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'ar', name: 'Arabic' },
    { code: 'hi', name: 'Hindi' },
    { code: 'ru', name: 'Russian' },
    { code: 'nl', name: 'Dutch' },
    { code: 'sv', name: 'Swedish' },
    { code: 'tr', name: 'Turkish' },
    { code: 'pl', name: 'Polish' },
    { code: 'vi', name: 'Vietnamese' },
    { code: 'th', name: 'Thai' },
    { code: 'id', name: 'Indonesian' },
    { code: 'yo', name: 'Yoruba' },
    { code: 'ig', name: 'Igbo' },
    { code: 'ha', name: 'Hausa' },
    { code: 'sw', name: 'Swahili' },
    { code: 'zu', name: 'Zulu' },
    { code: 'am', name: 'Amharic' },
  ];

  // BCP-47 locales used for speech recognition and text-to-speech voices.
  const LOCALES = {
    en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', pt: 'pt-PT',
    zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR', ar: 'ar-SA', hi: 'hi-IN', ru: 'ru-RU',
    nl: 'nl-NL', sv: 'sv-SE', tr: 'tr-TR', pl: 'pl-PL', vi: 'vi-VN', th: 'th-TH',
    id: 'id-ID', yo: 'yo-NG', ig: 'ig-NG', ha: 'ha-NG', sw: 'sw-KE', zu: 'zu-ZA',
    am: 'am-ET',
  };

  // Target languages where DeepL supports a formal/informal tone.
  const FORMALITY_LANGS = new Set(['de', 'fr', 'it', 'es', 'nl', 'pl', 'pt', 'ja', 'ru']);

  const MAX_CHARS = 2000;
  const HISTORY_LIMIT = 50;
  const API_URL = '/api/translate';

  const STORAGE = {
    theme: 'polyra-theme',
    history: 'polyra-history',
    formality: 'polyra-formality',
    speakReplies: 'polyra-speak-replies',
  };

  // ---------- DOM ----------

  const $ = (id) => document.getElementById(id);

  const sourceLangEl = $('sourceLang');
  const targetLangEl = $('targetLang');
  const sourceTextEl = $('sourceText');
  const outputTextEl = $('outputText');
  const charCountEl = $('charCount');
  const clearBtn = $('clearBtn');
  const copyBtn = $('copyBtn');
  const copiedTip = $('copiedTip');
  const swapBtn = $('swapBtn');
  const translateBtn = $('translateBtn');
  const spinner = $('spinner');
  const errorBox = $('errorBox');
  const micBtn = $('micBtn');
  const speakSourceBtn = $('speakSourceBtn');
  const speakTargetBtn = $('speakTargetBtn');
  const saveBtn = $('saveBtn');
  const formalityGroup = $('formalityGroup');
  const formalityNote = $('formalityNote');
  const themeToggle = $('themeToggle');
  const toastEl = $('toast');

  const tabTranslate = $('tabTranslate');
  const tabConvo = $('tabConvo');
  const translateView = $('translateView');
  const convoView = $('convoView');

  const histTabRecent = $('histTabRecent');
  const histTabSaved = $('histTabSaved');
  const savedCountEl = $('savedCount');
  const historyListEl = $('historyList');
  const historyEmptyEl = $('historyEmpty');
  const clearHistoryBtn = $('clearHistoryBtn');

  const convoLangAEl = $('convoLangA');
  const convoLangBEl = $('convoLangB');
  const convoSwapBtn = $('convoSwapBtn');
  const transcriptEl = $('transcript');
  const transcriptEmptyEl = $('transcriptEmpty');
  const convoStatusEl = $('convoStatus');
  const convoNoMicEl = $('convoNoMic');
  const speakRepliesToggle = $('speakRepliesToggle');
  const clearConvoBtn = $('clearConvoBtn');

  // ---------- Storage (fails safely in private mode etc.) ----------

  function storageGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      // storage full or unavailable — features still work for this session
    }
  }

  // ---------- Small helpers ----------

  function langName(code) {
    const lang = LANGUAGES.find((l) => l.code === code);
    return lang ? lang.name : String(code || '').toUpperCase();
  }

  function isKnownLang(code) {
    return LANGUAGES.some((l) => l.code === code);
  }

  function buildOptions(selectEl, includeAuto) {
    if (includeAuto) {
      const opt = document.createElement('option');
      opt.value = 'auto';
      opt.textContent = 'Auto-Detect';
      selectEl.appendChild(opt);
    }
    LANGUAGES.forEach((lang) => {
      const opt = document.createElement('option');
      opt.value = lang.code;
      opt.textContent = lang.name;
      selectEl.appendChild(opt);
    });
  }

  let toastTimer = null;
  function showToast(message) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.hidden = true;
    }, 3200);
  }

  // ---------- Theme ----------

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const next = theme === 'dark' ? 'light' : 'dark';
    themeToggle.setAttribute('aria-label', `Switch to ${next} theme`);
  }

  applyTheme(document.documentElement.getAttribute('data-theme') || 'dark');

  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    storageSet(STORAGE.theme, next);
  });

  // ---------- API ----------
  // Calls our own /api/translate serverless function, which uses DeepL as
  // the primary engine (with real auto-detect) and falls back to MyMemory
  // only for the two languages DeepL doesn't support (Yoruba, Amharic).

  async function requestTranslation(text, source, target, formality) {
    const body = { text, source, target };
    if (formality && formality !== 'default') body.formality = formality;

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || `Translation service error (HTTP ${res.status})`);
    }
    if (!data.translatedText) {
      throw new Error('No translation was returned. Please try again.');
    }
    return data;
  }

  // ---------- Text-to-speech ----------

  const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
  let voices = [];
  let activeSpeakBtn = null;

  function loadVoices() {
    voices = synth ? synth.getVoices() : [];
  }

  if (synth) {
    loadVoices();
    synth.onvoiceschanged = loadVoices;
  }

  function findVoice(code) {
    const locale = (LOCALES[code] || code).toLowerCase();
    const norm = (v) => v.lang.replace('_', '-').toLowerCase();
    return (
      voices.find((v) => norm(v) === locale) ||
      voices.find((v) => norm(v).split('-')[0] === code)
    );
  }

  function stopSpeaking() {
    if (synth) synth.cancel();
    if (activeSpeakBtn) activeSpeakBtn.classList.remove('is-active');
    activeSpeakBtn = null;
  }

  // Speaks text in the given language. `btn` (optional) shows an active state
  // while speaking and acts as a stop toggle when pressed again.
  function speak(text, code, btn) {
    if (!synth) {
      showToast("Read-aloud isn't supported in this browser.");
      return;
    }
    if (btn && activeSpeakBtn === btn) {
      stopSpeaking();
      return;
    }
    stopSpeaking();
    if (!text) return;

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = findVoice(code);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = LOCALES[code] || code;
      showToast(`No ${langName(code)} voice on this device, so playback may sound off or be silent.`);
    }

    const done = () => {
      if (btn) btn.classList.remove('is-active');
      if (activeSpeakBtn === btn) activeSpeakBtn = null;
    };
    utterance.onend = done;
    utterance.onerror = done;

    if (btn) {
      btn.classList.add('is-active');
      activeSpeakBtn = btn;
    }
    synth.speak(utterance);
  }

  // ---------- Speech recognition ----------

  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  let activeRecognizer = null;

  function recognitionErrorMessage(code, lang) {
    switch (code) {
      case 'not-allowed':
      case 'service-not-allowed':
        return 'Microphone access is blocked. Allow it in your browser\'s site settings.';
      case 'no-speech':
        return "Didn't catch that. Try again and speak a little closer.";
      case 'audio-capture':
        return 'No microphone was found.';
      case 'network':
        return 'Voice input needs an internet connection.';
      case 'language-not-supported':
        return `Voice input isn't available for ${langName(lang)} in this browser.`;
      default:
        return 'Voice input stopped unexpectedly. Please try again.';
    }
  }

  // Starts listening in `code`. Calls onText(transcript, isFinal) as words
  // arrive and onEnd(finalTranscript) when listening stops.
  function listen(code, { onText, onEnd, onError }) {
    stopListening();
    stopSpeaking(); // don't let the mic pick up our own read-aloud

    const recognizer = new Recognition();
    recognizer.lang = code === 'auto' ? navigator.language || 'en-US' : LOCALES[code] || code;
    recognizer.interimResults = true;
    recognizer.continuous = false;
    recognizer.maxAlternatives = 1;

    let transcript = '';

    recognizer.onresult = (event) => {
      transcript = '';
      let isFinal = true;
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
        if (!event.results[i].isFinal) isFinal = false;
      }
      if (onText) onText(transcript, isFinal);
    };

    recognizer.onerror = (event) => {
      if (event.error === 'aborted') return;
      if (onError) onError(recognitionErrorMessage(event.error, code));
    };

    recognizer.onend = () => {
      if (activeRecognizer === recognizer) activeRecognizer = null;
      if (onEnd) onEnd(transcript.trim());
    };

    activeRecognizer = recognizer;
    try {
      recognizer.start();
    } catch (err) {
      activeRecognizer = null;
      if (onError) onError('Could not start the microphone. Please try again.');
      if (onEnd) onEnd('');
    }
  }

  function stopListening() {
    if (activeRecognizer) activeRecognizer.stop();
  }

  // ============================================================
  // TRANSLATE MODE
  // ============================================================

  buildOptions(sourceLangEl, true);
  buildOptions(targetLangEl, false);
  sourceLangEl.value = 'auto';
  targetLangEl.value = 'es';

  let requestToken = 0;
  let lastDetectedSource = null; // set after an Auto-Detect translation, used by swap & read-aloud
  let currentEntryId = null; // history entry matching what's on screen
  let formality = storageGet(STORAGE.formality, 'default');
  if (!['default', 'more', 'less'].includes(formality)) formality = 'default';

  function updateCharCount() {
    const len = sourceTextEl.value.length;
    charCountEl.textContent = `${len} / ${MAX_CHARS}`;
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function hideError() {
    errorBox.hidden = true;
    errorBox.textContent = '';
  }

  function setLoading(isLoading) {
    spinner.hidden = !isLoading;
    translateBtn.disabled = isLoading;
    translateBtn.textContent = isLoading ? 'Translating…' : 'Translate';
  }

  function setOutput(text) {
    outputTextEl.value = text;
    outputTextEl.classList.remove('fade-in');
    // restart animation
    void outputTextEl.offsetWidth;
    outputTextEl.classList.add('fade-in');
  }

  function setCurrentEntry(id) {
    currentEntryId = id;
    updateSaveBtn();
  }

  // ---------- Formality ----------

  function updateFormalityUI() {
    const target = targetLangEl.value;
    const supported = FORMALITY_LANGS.has(target);

    formalityGroup.querySelectorAll('.seg-btn').forEach((btn) => {
      const isOn = btn.dataset.formality === formality;
      btn.setAttribute('aria-pressed', String(isOn));
      btn.disabled = !supported && btn.dataset.formality !== 'default';
    });

    formalityGroup.classList.toggle('is-unsupported', !supported);
    formalityNote.hidden = supported;
    formalityNote.textContent = supported ? '' : `Not available for ${langName(target)}`;
  }

  function effectiveFormality() {
    return FORMALITY_LANGS.has(targetLangEl.value) ? formality : 'default';
  }

  formalityGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (!btn || btn.disabled || btn.dataset.formality === formality) return;
    formality = btn.dataset.formality;
    storageSet(STORAGE.formality, formality);
    updateFormalityUI();
    if (sourceTextEl.value.trim()) translate();
  });

  // ---------- Translation ----------

  async function translate() {
    const text = sourceTextEl.value.trim();

    if (!text) {
      setOutput('');
      hideError();
      setCurrentEntry(null);
      return;
    }

    const sourceCode = sourceLangEl.value;
    const targetCode = targetLangEl.value;

    if (sourceCode !== 'auto' && sourceCode === targetCode) {
      hideError();
      setOutput(text);
      setCurrentEntry(null);
      return;
    }

    hideError();
    setLoading(true);
    stopSpeaking();

    const token = ++requestToken;
    const tone = effectiveFormality();

    try {
      const data = await requestTranslation(text, sourceCode, targetCode, tone);
      if (token !== requestToken) return; // a newer request superseded this one

      if (sourceCode === 'auto') {
        lastDetectedSource = data.detectedSourceLang || null;
      }

      setOutput(data.translatedText);
      addToHistory({
        src: text,
        out: data.translatedText,
        from: sourceCode === 'auto' ? data.detectedSourceLang || 'auto' : sourceCode,
        to: targetCode,
        formality: tone,
      });
    } catch (err) {
      if (token !== requestToken) return;
      console.error('Translation failed:', err);
      setOutput('');
      setCurrentEntry(null);
      showError(err.message || 'Could not translate right now. Please wait a moment and try again.');
    } finally {
      if (token === requestToken) setLoading(false);
    }
  }

  // ---------- Events ----------

  sourceTextEl.addEventListener('input', () => {
    updateCharCount();
    // Translation only fires on an explicit action (Translate button,
    // language change, swap, Ctrl+Enter or finishing voice input).
  });

  sourceTextEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      translate();
    }
  });

  translateBtn.addEventListener('click', translate);

  sourceLangEl.addEventListener('change', translate);

  targetLangEl.addEventListener('change', () => {
    updateFormalityUI();
    translate();
  });

  clearBtn.addEventListener('click', () => {
    sourceTextEl.value = '';
    updateCharCount();
    setOutput('');
    setCurrentEntry(null);
    hideError();
    stopSpeaking();
    sourceTextEl.focus();
  });

  swapBtn.addEventListener('click', () => {
    if (sourceLangEl.value === 'auto') {
      // Can't swap "Auto-Detect" into the target slot meaningfully;
      // use the language we most recently detected, if we have one.
      sourceLangEl.value = targetLangEl.value;
      targetLangEl.value = isKnownLang(lastDetectedSource) ? lastDetectedSource : 'en';
    } else {
      const tmp = sourceLangEl.value;
      sourceLangEl.value = targetLangEl.value;
      targetLangEl.value = tmp;
    }

    const sourceVal = sourceTextEl.value;
    const outputVal = outputTextEl.value;
    sourceTextEl.value = outputVal;
    outputTextEl.value = sourceVal;

    updateCharCount();
    updateFormalityUI();
    hideError();

    if (sourceTextEl.value.trim()) {
      translate();
    }
  });

  copyBtn.addEventListener('click', async () => {
    const text = outputTextEl.value;
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      // Fallback for older browsers / insecure contexts
      outputTextEl.removeAttribute('readonly');
      outputTextEl.select();
      document.execCommand('copy');
      outputTextEl.setAttribute('readonly', 'true');
    }

    copiedTip.hidden = false;
    clearTimeout(copyBtn._tipTimer);
    copyBtn._tipTimer = setTimeout(() => {
      copiedTip.hidden = true;
    }, 1500);
  });

  // ---------- Read aloud ----------

  speakSourceBtn.addEventListener('click', () => {
    const code = sourceLangEl.value === 'auto' ? lastDetectedSource || 'en' : sourceLangEl.value;
    speak(sourceTextEl.value.trim(), code, speakSourceBtn);
  });

  speakTargetBtn.addEventListener('click', () => {
    speak(outputTextEl.value.trim(), targetLangEl.value, speakTargetBtn);
  });

  // ---------- Voice input ----------

  micBtn.addEventListener('click', () => {
    if (micBtn.classList.contains('is-listening')) {
      stopListening();
      return;
    }

    const before = sourceTextEl.value;
    const prefix = before && !/\s$/.test(before) ? before + ' ' : before;

    micBtn.classList.add('is-listening');
    micBtn.setAttribute('aria-label', 'Stop listening');
    hideError();

    listen(sourceLangEl.value, {
      onText(transcript) {
        sourceTextEl.value = (prefix + transcript).slice(0, MAX_CHARS);
        updateCharCount();
      },
      onError: showError,
      onEnd(transcript) {
        micBtn.classList.remove('is-listening');
        micBtn.setAttribute('aria-label', 'Speak to type');
        if (transcript) translate();
      },
    });
  });

  // ============================================================
  // HISTORY & FAVOURITES
  // ============================================================

  let history = storageGet(STORAGE.history, []);
  if (!Array.isArray(history)) history = [];
  let historyTab = 'recent';

  function saveHistory() {
    storageSet(STORAGE.history, history);
  }

  function addToHistory(entry) {
    const last = history[0];
    if (last && last.src === entry.src && last.to === entry.to && last.out === entry.out) {
      setCurrentEntry(last.id);
      return;
    }

    const item = Object.assign(
      { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), ts: Date.now(), fav: false },
      entry
    );
    history.unshift(item);

    // Keep every favourite, plus the most recent HISTORY_LIMIT others.
    let kept = 0;
    history = history.filter((h) => h.fav || ++kept <= HISTORY_LIMIT);

    saveHistory();
    setCurrentEntry(item.id);
    renderHistory();
  }

  function toggleFavourite(id) {
    const item = history.find((h) => h.id === id);
    if (!item) return;
    item.fav = !item.fav;
    saveHistory();
    updateSaveBtn();
    renderHistory();
  }

  function deleteEntry(id) {
    history = history.filter((h) => h.id !== id);
    if (currentEntryId === id) setCurrentEntry(null);
    saveHistory();
    renderHistory();
  }

  function restoreEntry(id) {
    const item = history.find((h) => h.id === id);
    if (!item) return;

    stopSpeaking();
    hideError();
    sourceLangEl.value = isKnownLang(item.from) ? item.from : 'auto';
    if (!isKnownLang(item.from)) lastDetectedSource = item.from;
    targetLangEl.value = item.to;
    sourceTextEl.value = item.src;
    updateCharCount();
    setOutput(item.out);
    updateFormalityUI();
    setCurrentEntry(item.id);

    document.querySelector('.translator-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function updateSaveBtn() {
    const item = currentEntryId && history.find((h) => h.id === currentEntryId);
    saveBtn.disabled = !item;
    const fav = !!(item && item.fav);
    saveBtn.classList.toggle('is-active', fav);
    saveBtn.setAttribute('aria-pressed', String(fav));
    saveBtn.title = fav ? 'Remove from saved' : 'Save translation';
  }

  const relTime = typeof Intl !== 'undefined' && Intl.RelativeTimeFormat
    ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
    : null;

  function timeAgo(ts) {
    const secs = Math.round((ts - Date.now()) / 1000);
    if (!relTime) return new Date(ts).toLocaleString();
    const abs = Math.abs(secs);
    if (abs < 60) return 'just now';
    if (abs < 3600) return relTime.format(Math.round(secs / 60), 'minute');
    if (abs < 86400) return relTime.format(Math.round(secs / 3600), 'hour');
    if (abs < 86400 * 7) return relTime.format(Math.round(secs / 86400), 'day');
    return new Date(ts).toLocaleDateString();
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  const STAR_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>';
  const TRASH_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path></svg>';

  function renderHistory() {
    const savedCount = history.filter((h) => h.fav).length;
    savedCountEl.textContent = String(savedCount);

    const items = historyTab === 'saved' ? history.filter((h) => h.fav) : history;

    historyListEl.textContent = '';
    items.forEach((item) => {
      const li = el('li', 'history-item');

      const body = el('button', 'history-body');
      body.type = 'button';
      body.dataset.action = 'restore';
      body.dataset.id = item.id;
      body.title = 'Open this translation';

      const meta = el('span', 'history-meta');
      meta.appendChild(el('span', 'history-langs', `${langName(item.from)} → ${langName(item.to)}`));
      if (item.formality === 'more') meta.appendChild(el('span', 'tone-pill', 'Formal'));
      if (item.formality === 'less') meta.appendChild(el('span', 'tone-pill', 'Informal'));
      meta.appendChild(el('span', 'history-time', timeAgo(item.ts)));

      body.appendChild(meta);
      body.appendChild(el('span', 'history-src', item.src));
      body.appendChild(el('span', 'history-out', item.out));

      const tools = el('div', 'history-tools');

      const star = el('button', 'icon-btn star-btn' + (item.fav ? ' is-active' : ''));
      star.type = 'button';
      star.dataset.action = 'fav';
      star.dataset.id = item.id;
      star.setAttribute('aria-pressed', String(item.fav));
      star.setAttribute('aria-label', item.fav ? 'Remove from saved' : 'Save');
      star.title = item.fav ? 'Remove from saved' : 'Save';
      star.innerHTML = STAR_SVG;

      const del = el('button', 'icon-btn delete-btn');
      del.type = 'button';
      del.dataset.action = 'delete';
      del.dataset.id = item.id;
      del.setAttribute('aria-label', 'Delete');
      del.title = 'Delete';
      del.innerHTML = TRASH_SVG;

      tools.appendChild(star);
      tools.appendChild(del);

      li.appendChild(body);
      li.appendChild(tools);
      historyListEl.appendChild(li);
    });

    historyEmptyEl.hidden = items.length > 0;
    historyEmptyEl.textContent = historyTab === 'saved'
      ? 'Star a translation to keep it here.'
      : 'Your translations will show up here.';

    const hasRecent = history.some((h) => !h.fav);
    clearHistoryBtn.hidden = historyTab === 'saved' || !hasRecent;
  }

  historyListEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'restore') restoreEntry(id);
    if (action === 'fav') toggleFavourite(id);
    if (action === 'delete') deleteEntry(id);
  });

  function setHistoryTab(tab) {
    historyTab = tab;
    histTabRecent.setAttribute('aria-selected', String(tab === 'recent'));
    histTabSaved.setAttribute('aria-selected', String(tab === 'saved'));
    renderHistory();
  }

  histTabRecent.addEventListener('click', () => setHistoryTab('recent'));
  histTabSaved.addEventListener('click', () => setHistoryTab('saved'));

  saveBtn.addEventListener('click', () => {
    if (currentEntryId) toggleFavourite(currentEntryId);
  });

  // Two-step confirm (no browser dialogs): first click arms, second clears.
  let clearArmed = false;
  let clearArmTimer = null;
  clearHistoryBtn.addEventListener('click', () => {
    if (!clearArmed) {
      clearArmed = true;
      clearHistoryBtn.textContent = 'Click again to clear';
      clearHistoryBtn.classList.add('is-danger');
      clearArmTimer = setTimeout(disarmClear, 3000);
      return;
    }
    disarmClear();
    history = history.filter((h) => h.fav);
    if (currentEntryId && !history.some((h) => h.id === currentEntryId)) setCurrentEntry(null);
    saveHistory();
    renderHistory();
  });

  function disarmClear() {
    clearArmed = false;
    clearTimeout(clearArmTimer);
    clearHistoryBtn.textContent = 'Clear recent';
    clearHistoryBtn.classList.remove('is-danger');
  }

  // ============================================================
  // CONVERSATION MODE
  // ============================================================

  buildOptions(convoLangAEl, false);
  buildOptions(convoLangBEl, false);
  convoLangAEl.value = 'en';
  convoLangBEl.value = 'es';

  speakRepliesToggle.checked = storageGet(STORAGE.speakReplies, true) !== false;
  speakRepliesToggle.addEventListener('change', () => {
    storageSet(STORAGE.speakReplies, speakRepliesToggle.checked);
    if (!speakRepliesToggle.checked) stopSpeaking();
  });

  const convoMics = convoView.querySelectorAll('.convo-mic');

  if (!Recognition) {
    convoNoMicEl.hidden = false;
    convoMics.forEach((btn) => { btn.hidden = true; });
    micBtn.hidden = true;
  }

  function sideLangs(side) {
    return side === 'a'
      ? { from: convoLangAEl.value, to: convoLangBEl.value }
      : { from: convoLangBEl.value, to: convoLangAEl.value };
  }

  function scrollTranscript() {
    transcriptEl.scrollTop = transcriptEl.scrollHeight;
  }

  function addBubble(side, original, from, to) {
    transcriptEmptyEl.hidden = true;

    const bubble = el('div', `bubble bubble-${side}`);
    const head = el('div', 'bubble-head');
    head.appendChild(el('span', `person-tag person-${side}`, side === 'a' ? 'Person A' : 'Person B'));
    head.appendChild(el('span', 'bubble-langs', `${langName(from)} → ${langName(to)}`));

    const replay = el('button', 'icon-btn speak-btn bubble-replay');
    replay.type = 'button';
    replay.setAttribute('aria-label', 'Play translation');
    replay.title = 'Play translation';
    replay.innerHTML = speakSourceBtn.innerHTML;
    replay.hidden = true;
    head.appendChild(replay);

    const translation = el('p', 'bubble-translation is-pending', 'Translating…');
    const originalEl = el('p', 'bubble-original', original);

    bubble.appendChild(head);
    bubble.appendChild(translation);
    bubble.appendChild(originalEl);
    transcriptEl.appendChild(bubble);
    scrollTranscript();

    return {
      setTranslation(text) {
        translation.classList.remove('is-pending');
        translation.textContent = text;
        replay.hidden = false;
        replay.addEventListener('click', () => speak(text, to, replay));
        scrollTranscript();
        return replay;
      },
      setError(message) {
        translation.classList.remove('is-pending');
        translation.classList.add('is-error');
        translation.textContent = message;
        scrollTranscript();
      },
    };
  }

  async function convoTurn(side, text) {
    text = text.trim();
    if (!text) return;

    const { from, to } = sideLangs(side);
    const bubble = addBubble(side, text, from, to);

    try {
      const translated = from === to
        ? text
        : (await requestTranslation(text, from, to, 'default')).translatedText;
      const replay = bubble.setTranslation(translated);
      if (speakRepliesToggle.checked) speak(translated, to, replay);
    } catch (err) {
      bubble.setError(err.message || 'Could not translate that turn.');
    }
  }

  function setConvoStatus(text) {
    convoStatusEl.hidden = !text;
    convoStatusEl.textContent = text || '';
  }

  convoMics.forEach((btn) => {
    btn.addEventListener('click', () => {
      const side = btn.dataset.side;

      if (btn.classList.contains('is-listening')) {
        stopListening();
        return;
      }

      const { from } = sideLangs(side);
      const who = side === 'a' ? 'Person A' : 'Person B';

      convoMics.forEach((b) => b.classList.remove('is-listening'));
      btn.classList.add('is-listening');
      setConvoStatus(`${who}: listening in ${langName(from)}…`);

      listen(from, {
        onText(transcript) {
          setConvoStatus(`${who}: ${transcript}`);
        },
        onError(message) {
          showToast(message);
        },
        onEnd(transcript) {
          btn.classList.remove('is-listening');
          setConvoStatus('');
          if (transcript) convoTurn(side, transcript);
        },
      });
    });
  });

  convoView.querySelectorAll('.convo-form').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('.convo-input');
      const text = input.value;
      input.value = '';
      convoTurn(form.dataset.side, text);
    });
  });

  convoSwapBtn.addEventListener('click', () => {
    const tmp = convoLangAEl.value;
    convoLangAEl.value = convoLangBEl.value;
    convoLangBEl.value = tmp;
  });

  clearConvoBtn.addEventListener('click', () => {
    stopSpeaking();
    stopListening();
    transcriptEl.querySelectorAll('.bubble').forEach((b) => b.remove());
    transcriptEmptyEl.hidden = false;
  });

  // ============================================================
  // MODE TABS
  // ============================================================

  function setMode(mode) {
    const isConvo = mode === 'convo';
    stopListening();
    stopSpeaking();
    tabTranslate.setAttribute('aria-selected', String(!isConvo));
    tabConvo.setAttribute('aria-selected', String(isConvo));
    translateView.hidden = isConvo;
    convoView.hidden = !isConvo;
  }

  tabTranslate.addEventListener('click', () => setMode('translate'));
  tabConvo.addEventListener('click', () => setMode('convo'));

  // ---------- Init ----------

  updateCharCount();
  updateFormalityUI();
  updateSaveBtn();
  renderHistory();
})();
