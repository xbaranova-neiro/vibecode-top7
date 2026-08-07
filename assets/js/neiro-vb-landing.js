/**
 * Лендинг VB — расписание на кнопках регистрации.
 * Утренний слот: data-vb-morning-hour на <html> (11 по умолчанию, 12 для части лендов).
 */
(function () {
  'use strict';

  var MONTHS_GEN = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
  ];

  var DOMAIN_FIX = {
    'gnail.com': 'gmail.com',
    'gmil.com': 'gmail.com',
    'gnil.com': 'gmail.com',
    'gmail.ru': 'gmail.com',
    'gmai.com': 'gmail.com',
    'gmaol.com': 'gmail.com',
    'gmeil.com': 'gmail.com'
  };

  function getMorningHour() {
    var h = document.documentElement.getAttribute('data-vb-morning-hour');
    return h === '12' ? '12' : '11';
  }

  function collectAdsParams() {
    if (typeof window.__adsParams === 'function') {
      try {
        return window.__adsParams();
      } catch (e) {}
    }
    var p = new URLSearchParams();
    var loc = new URLSearchParams(window.location.search);
    loc.forEach(function (val, key) {
      var k = key.toLowerCase();
      if (
        k.indexOf('utm_') === 0 ||
        k === 'gclid' ||
        k === 'fbclid' ||
        k === 'yclid' ||
        k === 'ysclid' ||
        k === 'msclkid'
      ) {
        p.set(k, val);
      }
    });
    return p;
  }

  function buildRegFormUrl(base, slot) {
    var url;
    try {
      url = new URL(base, window.location.href);
    } catch (e) {
      return base;
    }
    collectAdsParams().forEach(function (val, key) {
      if (!url.searchParams.has(key)) url.searchParams.set(key, val);
    });
    url.searchParams.set('time_web_VB', slot === 'evening' ? '19' : getMorningHour());
    return url.toString();
  }

  function getMoscowWallClock() {
    var parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Moscow',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    }).formatToParts(new Date());
    var map = {};
    parts.forEach(function (p) {
      if (p.type !== 'literal') map[p.type] = p.value;
    });
    var h = parseInt(map.hour, 10) || 0;
    if (h === 24) h = 0;
    var m = parseInt(map.minute, 10) || 0;
    return {
      y: parseInt(map.year, 10),
      mo: parseInt(map.month, 10) - 1,
      d: parseInt(map.day, 10),
      mins: h * 60 + m
    };
  }

  function msUntilNextMoscowMinute() {
    var parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Moscow',
      second: 'numeric'
    }).formatToParts(new Date());
    var sp = parts.find(function (p) {
      return p.type === 'second';
    });
    var sec = sp ? parseInt(sp.value, 10) : 0;
    var ms = (60 - sec) * 1000 + 400;
    return ms < 800 ? 800 : ms;
  }

  function addCalendarDays(ymd, deltaDays) {
    var t = Date.UTC(ymd.y, ymd.mo, ymd.d + deltaDays);
    var x = new Date(t);
    return { y: x.getUTCFullYear(), mo: x.getUTCMonth(), d: x.getUTCDate() };
  }

  function getScheduleCopy() {
    var mc = getMoscowWallClock();
    var mins = mc.mins;
    var mh = getMorningHour();
    var morning;
    var evening;
    var morningDayOffset = 0;
    var eveningDayOffset = 0;
    if (mins < 9 * 60) {
      morning = 'сегодня в ' + mh;
      evening = 'сегодня в 19';
    } else if (mins < 19 * 60) {
      morning = 'завтра в ' + mh;
      evening = 'сегодня в 19';
      morningDayOffset = 1;
    } else {
      morning = 'завтра в ' + mh;
      evening = 'завтра в 19';
      morningDayOffset = 1;
      eveningDayOffset = 1;
    }
    return {
      morning: morning,
      evening: evening,
      morningDayOffset: morningDayOffset,
      eveningDayOffset: eveningDayOffset,
      mskYmd: { y: mc.y, mo: mc.mo, d: mc.d }
    };
  }

  function moscowYmdWithDayOffset(baseYmd, dayOffset) {
    var msk = { y: baseYmd.y, mo: baseYmd.mo, d: baseYmd.d };
    if (dayOffset) msk = addCalendarDays(msk, dayOffset);
    return msk;
  }

  function formatRuDate(ymd) {
    return ymd.d + '\u00a0' + MONTHS_GEN[ymd.mo];
  }

  function fixEmailValue(el) {
    var v = (el.value || '').trim().toLowerCase();
    if (!v || v.indexOf('@') === -1) return;
    var parts = v.split('@');
    if (parts.length !== 2) return;
    var dom = parts[1];
    if (DOMAIN_FIX[dom]) el.value = parts[0] + '@' + DOMAIN_FIX[dom];
  }

  function initEmailTypoFix() {
    document.addEventListener(
      'blur',
      function (e) {
        var t = e.target;
        if (!t || !t.tagName) return;
        var tag = t.tagName.toLowerCase();
        if (tag !== 'input') return;
        var type = (t.getAttribute('type') || '').toLowerCase();
        var name = (t.getAttribute('name') || '').toLowerCase();
        var ph = (t.getAttribute('placeholder') || '').toLowerCase();
        if (type === 'email' || name.indexOf('email') !== -1 || ph.indexOf('mail') !== -1) {
          fixEmailValue(t);
        }
      },
      true
    );
  }

  var _openRegModal = null;
  var _vbInited = false;
  var _mskMinuteTimer = null;

  function refreshScheduleLabels() {
    var copy = getScheduleCopy();
    var base = copy.mskYmd;
    var dm = formatRuDate(moscowYmdWithDayOffset(base, copy.morningDayOffset));
    var de = formatRuDate(moscowYmdWithDayOffset(base, copy.eveningDayOffset));
    document.querySelectorAll('[data-vb-hero-date="morning"]').forEach(function (el) {
      el.textContent = dm;
    });
    document.querySelectorAll('[data-vb-hero-date="evening"]').forEach(function (el) {
      el.textContent = de;
    });
    document.querySelectorAll('[data-vb-slot-label="morning"]').forEach(function (el) {
      el.textContent = copy.morning;
    });
    document.querySelectorAll('[data-vb-slot-label="evening"]').forEach(function (el) {
      el.textContent = copy.evening;
    });
    document.querySelectorAll('[data-vb-slot-date="morning"]').forEach(function (el) {
      el.textContent = dm;
    });
    document.querySelectorAll('[data-vb-slot-date="evening"]').forEach(function (el) {
      el.textContent = de;
    });
  }

  function scheduleRefreshOnNextMoscowMinute() {
    if (_mskMinuteTimer) clearTimeout(_mskMinuteTimer);
    _mskMinuteTimer = setTimeout(function () {
      _mskMinuteTimer = null;
      refreshScheduleLabels();
      scheduleRefreshOnNextMoscowMinute();
    }, msUntilNextMoscowMinute());
  }

  window.VIBE_VB = {
    buildRegFormUrl: buildRegFormUrl,
    refreshScheduleLabels: refreshScheduleLabels,

    init: function (opts) {
      if (_vbInited) return;
      _vbInited = true;
      opts = opts || {};
      _openRegModal = typeof opts.openRegModal === 'function' ? opts.openRegModal : null;
      document.addEventListener('click', function (e) {
        var a = e.target.closest('[data-vb-open]');
        if (!a) return;
        var slot = a.getAttribute('data-vb-open');
        if (slot !== 'morning' && slot !== 'evening') return;
        e.preventDefault();
        if (!_openRegModal) return;
        _openRegModal(slot);
      });
      refreshScheduleLabels();
      scheduleRefreshOnNextMoscowMinute();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEmailTypoFix);
  } else {
    initEmailTypoFix();
  }
})();
