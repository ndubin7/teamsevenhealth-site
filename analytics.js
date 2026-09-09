/* Team7 Health - analytics.js
 * GA4 wrapper plus attribution capture.
 *
 * Design rule carried over from CreditKeys: attribution and page variant are
 * merged into every event inside track(), so no call site can forget them.
 *
 * BEFORE LAUNCH:
 *   1. Replace GA4_MEASUREMENT_ID below with the real G-XXXXXXXXXX.
 *   2. Register these GA4 custom dimensions (Admin > Data display > Custom
 *      definitions, scope: Event) BEFORE any traffic runs. Registration is
 *      NOT retroactive: offer_name, page_variant, source.
 */
(function () {
  'use strict';

  var GA4_MEASUREMENT_ID = 'G-XXXXXXXXXX';

  /* ---------- gtag bootstrap ---------- */
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_MEASUREMENT_ID;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA4_MEASUREMENT_ID, { send_page_view: true });

  /* ---------- storage helpers ---------- */
  function get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }

  /* ---------- attribution ----------
   * Captured from the ad click URL on first landing, then persisted for the
   * session so deeper pages still carry it.
   */
  var PARAMS = {
    t7_click:  'mgid_click_id',
    t7_ad:     'mgid_ad_id',
    t7_widget: 'mgid_widget_id',
    t7_camp:   'mgid_campaign_id',
    // Legacy ck_* kept so any old link still resolves.
    ck_click:  'mgid_click_id',
    ck_ad:     'mgid_ad_id',
    ck_widget: 'mgid_widget_id',
    ck_camp:   'mgid_campaign_id'
  };

  (function captureAttribution() {
    var q = new URLSearchParams(window.location.search);
    Object.keys(PARAMS).forEach(function (p) {
      var v = q.get(p);
      if (v) set('t7_attr_' + PARAMS[p], v);
    });
  })();

  var Attribution = {
    all: function () {
      return {
        mgid_click_id:    get('t7_attr_mgid_click_id'),
        mgid_ad_id:       get('t7_attr_mgid_ad_id'),
        mgid_widget_id:   get('t7_attr_mgid_widget_id'),
        mgid_campaign_id: get('t7_attr_mgid_campaign_id')
      };
    },
    mgidClickId: function () { return get('t7_attr_mgid_click_id'); }
  };

  /* ---------- session id (becomes subid2) ---------- */
  var sid = get('t7_session_id');
  if (!sid) {
    sid = 't7_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    set('t7_session_id', sid);
  }

  /* ---------- tracking ---------- */
  var Analytics = {
    sessionId: function () { return sid; },

    track: function (eventName, params) {
      if (typeof gtag !== 'function') return;

      var merged = {};
      var attr = Attribution.all();
      for (var k in attr) { if (attr[k]) merged[k] = attr[k]; }

      merged.session_id = sid;

      var v = get('t7_ab_page');
      if (v) merged.page_variant = v;

      if (params) { for (var p in params) { merged[p] = params[p]; } }

      gtag('event', eventName, merged);
    }
  };

  window.T7Attribution = Attribution;
  window.T7Analytics = Analytics;

  /* ---------- engagement events ---------- */
  var engagedFired = false;
  setTimeout(function () {
    if (!engagedFired) { engagedFired = true; Analytics.track('page_engaged', {}); }
  }, 10000);

  var depthFired = {};
  window.addEventListener('scroll', function () {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    if (h <= 0) return;
    var pct = (window.scrollY / h) * 100;
    [50, 90].forEach(function (mark) {
      if (pct >= mark && !depthFired[mark]) {
        depthFired[mark] = true;
        Analytics.track('scroll_depth', { percent_scrolled: mark });
      }
    });
  }, { passive: true });

  var started = Date.now();
  window.addEventListener('pagehide', function () {
    var dwell = Math.round((Date.now() - started) / 1000);
    // sendBeacon survives the unload where a normal gtag call would not.
    if (navigator.sendBeacon) {
      Analytics.track('page_exit', { dwell_seconds: dwell });
    }
  });
})();
