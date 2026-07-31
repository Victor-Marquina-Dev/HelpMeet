/* ── HELPMEET i18n — lightweight translation system ── */

const HelpmeetI18n = (function () {
  'use strict';

  var translations = {};
  var currentLang = 'es';
  var supportedLangs = ['es', 'en'];
  var STORAGE_KEY = 'helpmeet-lang';

  function detectLang() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored && supportedLangs.indexOf(stored) !== -1) return stored;
    } catch (e) { /* storage unavailable */ }

    var navLang = (navigator.language || navigator.userLanguage || '').split('-')[0];
    return supportedLangs.indexOf(navLang) !== -1 ? navLang : 'es';
  }

  function setDocumentLang(lang) {
    document.documentElement.lang = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* storage unavailable */ }
    currentLang = lang;
  }

  function t(key, fallback) {
    return _getNested(translations[currentLang], key) || fallback || key;
  }

  function tObj(key, fallback) {
    return translations[currentLang][key] || translations.es[key] || fallback || {};
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

  function applyToDOM() {
    var els = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var key = el.getAttribute('data-i18n');
      var text = _getNested(translations[currentLang], key);
      if (text !== undefined) {
        if (el.tagName === 'META') {
          el.setAttribute('content', text);
        } else {
          el.textContent = text;
        }
      }
    }

    /* data-i18n-attr for attributes like placeholder, aria-label, title */
    var attrEls = document.querySelectorAll('[data-i18n-attr]');
    for (var j = 0; j < attrEls.length; j++) {
      var ael = attrEls[j];
      var pairs = ael.getAttribute('data-i18n-attr').split(',');
      for (var k = 0; k < pairs.length; k++) {
        var parts = pairs[k].trim().split(':');
        var attrName = parts[0].trim();
        var attrKey = parts.slice(1).join(':').trim();
        var attrText = _getNested(translations[currentLang], attrKey);
        if (attrText !== undefined) {
          ael.setAttribute(attrName, attrText);
        }
      }
    }

    /* data-i18n-html for innerHTML replacements */
    var htmlEls = document.querySelectorAll('[data-i18n-html]');
    for (var m = 0; m < htmlEls.length; m++) {
      var hel = htmlEls[m];
      var hkey = hel.getAttribute('data-i18n-html');
      var htext = _getNested(translations[currentLang], hkey);
      if (htext !== undefined) {
        hel.innerHTML = htext;
      }
    }
  }

  function updateStructuredData() {
    var ld = document.querySelector('script[type="application/ld+json"]');
    if (!ld) return;
    try {
      var data = JSON.parse(ld.textContent);
      var tData = translations[currentLang].structuredData;
      if (tData && tData.description) data.description = tData.description;
      if (tData && tData.offerDescription && data.offers) data.offers.description = tData.offerDescription;
      ld.textContent = JSON.stringify(data);
    } catch (e) { /* ignore parse errors */ }
  }

  function updateLangSwitchers() {
    var switchers = document.querySelectorAll('[data-lang-switch]');
    for (var i = 0; i < switchers.length; i++) {
      var sw = switchers[i];
      var target = sw.getAttribute('data-lang-switch');
      sw.classList.toggle('active', target === currentLang);
    }
  }

  function switchLang(lang) {
    if (supportedLangs.indexOf(lang) === -1) return;
    setDocumentLang(lang);
    applyToDOM();
    updateStructuredData();
    updateLangSwitchers();
  }

  function loadAll(callback) {
    var loaded = 0;
    var total = supportedLangs.length;

    function checkDone() {
      loaded++;
      if (loaded >= total && typeof callback === 'function') callback();
    }

    for (var i = 0; i < supportedLangs.length; i++) {
      load(supportedLangs[i], checkDone);
    }
  }

  function load(lang, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/landing/i18n/' + lang + '.json?v=20260725', true);
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          translations[lang] = JSON.parse(xhr.responseText);
        } catch (e) {
          translations[lang] = {};
        }
      }
      if (typeof callback === 'function') callback();
    };
    xhr.onerror = function () {
      translations[lang] = {};
      if (typeof callback === 'function') callback();
    };
    xhr.send();
  }

  return {
    init: function () {
      currentLang = detectLang();
      setDocumentLang(currentLang);

      loadAll(function () {
        applyToDOM();
        updateStructuredData();
        updateLangSwitchers();

        /* Bind language switcher buttons */
        var switchers = document.querySelectorAll('[data-lang-switch]');
        for (var i = 0; i < switchers.length; i++) {
          switchers[i].addEventListener('click', function () {
            var lang = this.getAttribute('data-lang-switch');
            switchLang(lang);
          });
        }

        /* Dispatch event so other scripts know i18n is ready */
        var event = new CustomEvent('helpmeet:i18n-ready', { detail: { lang: currentLang } });
        document.dispatchEvent(event);
      });
    },

    t: t,
    tObj: tObj,
    switchLang: switchLang,
    getLang: function () { return currentLang; }
  };
})();

/* Auto-init when DOM is ready */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () { HelpmeetI18n.init(); });
} else {
  HelpmeetI18n.init();
}
