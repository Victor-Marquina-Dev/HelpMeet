/* ── HELPMEET APP i18n ── */
'use strict';

const HelpmeetI18n = (function () {
  var translations = {};
  var currentLang = 'es';
  var supported = ['es', 'en'];
  var STORE_KEY = 'hm.ui_lang';
  var loaded = false;
  var readyCallbacks = [];

  function _detect() {
    try {
      var stored = localStorage.getItem(STORE_KEY);
      if (stored && supported.indexOf(stored) !== -1) return stored;
    } catch (e) { /* storage unavailable */ }
    return 'es';
  }

  function _setLang(lang) {
    currentLang = lang;
    document.documentElement.lang = lang;
    try { localStorage.setItem(STORE_KEY, lang); } catch (e) { /* ignore */ }
  }

  function _apply() {
    var els = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var key = el.getAttribute('data-i18n');
      var text = _getNested(translations[currentLang], key);
      if (text !== undefined) {
        if (el.tagName === 'META' || el.tagName === 'INPUT' && el.type === 'placeholder') {
          el.setAttribute(el.tagName === 'META' ? 'content' : 'placeholder', text);
        } else {
          el.textContent = text;
        }
      }
    }

    /* data-i18n-attr: attr1:key1,attr2:key2 */
    var attrEls = document.querySelectorAll('[data-i18n-attr]');
    for (var j = 0; j < attrEls.length; j++) {
      var ael = attrEls[j];
      var pairs = ael.getAttribute('data-i18n-attr').split(',');
      for (var k = 0; k < pairs.length; k++) {
        var parts = pairs[k].trim().split(':');
        if (parts.length >= 2) {
          var aname = parts[0].trim();
          var akey = parts.slice(1).join(':').trim();
          var atext = _getNested(translations[currentLang], akey);
          if (atext !== undefined) ael.setAttribute(aname, atext);
        }
      }
    }

    /* data-i18n-html */
    var htmlEls = document.querySelectorAll('[data-i18n-html]');
    for (var m = 0; m < htmlEls.length; m++) {
      var hel = htmlEls[m];
      var hkey = hel.getAttribute('data-i18n-html');
      var htext = _getNested(translations[currentLang], hkey);
      if (htext !== undefined) hel.innerHTML = htext;
    }
  }

  function _getNested(obj, path) {
    if (!obj || !path) return undefined;
    var parts = path.split('.');
    var current = obj;
    for (var i = 0; i < parts.length; i++) {
      if (current == null) return undefined;
      current = current[parts[i]];
    }
    return current;
  }

  /* Public t() function — callable from anywhere */
  function t(key, fallback) {
    return _getNested(translations[currentLang], key) || fallback || key;
  }

  function switchLang(lang) {
    if (supported.indexOf(lang) === -1) return;
    _setLang(lang);
    _apply();
    _updateSwitchers();
    /* notify */
    var event = new CustomEvent('helpmeet:lang-changed', { detail: { lang: lang } });
    document.dispatchEvent(event);
  }

  function _updateSwitchers() {
    var sw = document.querySelectorAll('[data-lang-switch]');
    for (var i = 0; i < sw.length; i++) {
      sw[i].classList.toggle('active', sw[i].getAttribute('data-lang-switch') === currentLang);
    }
  }

  function _loadAll(cb) {
    var total = supported.length;
    var done = 0;
    function check() { done++; if (done >= total && typeof cb === 'function') cb(); }
    for (var i = 0; i < supported.length; i++) _load(supported[i], check);
  }

  function _load(lang, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'i18n/' + lang + '.json?v=20260725', true);
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { translations[lang] = JSON.parse(xhr.responseText); } catch (e) { translations[lang] = {}; }
      }
      if (typeof cb === 'function') cb();
    };
    xhr.onerror = function () { translations[lang] = {}; if (typeof cb === 'function') cb(); };
    xhr.send();
  }

  function init() {
    currentLang = _detect();
    _setLang(currentLang);

    _loadAll(function () {
      _apply();
      _updateSwitchers();
      loaded = true;

      /* bind switchers */
      var sw = document.querySelectorAll('[data-lang-switch]');
      for (var i = 0; i < sw.length; i++) {
        sw[i].addEventListener('click', function () {
          switchLang(this.getAttribute('data-lang-switch'));
        });
      }

      var event = new CustomEvent('helpmeet:i18n-ready', { detail: { lang: currentLang } });
      document.dispatchEvent(event);

      /* flush pending callbacks */
      for (var j = 0; j < readyCallbacks.length; j++) readyCallbacks[j]();
      readyCallbacks = [];
    });
  }

  function onReady(cb) {
    if (loaded) { cb(); return; }
    readyCallbacks.push(cb);
  }

  return {
    init: init,
    t: t,
    switchLang: switchLang,
    getLang: function () { return currentLang; },
    isLoaded: function () { return loaded; },
    onReady: onReady
  };
})();

/* Auto-init */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () { HelpmeetI18n.init(); });
} else {
  HelpmeetI18n.init();
}

/* Expose t() globally for use throughout app.js */
window.t = HelpmeetI18n.t.bind(HelpmeetI18n);
window.__ = window.t;
