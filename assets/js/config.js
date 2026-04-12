/**
 * config.js – Live English
 * يحل محل assets/js/config.js الأصلي
 *
 * يقوم بـ:
 *  1. تعريف APP_CONFIG (لتوافق الكود القديم)
 *  2. اعتراض fetch() المستهدف لـ API_URL وتحويله لـ APP_API
 *
 * ضعه في: assets/js/config.js  (استبدل الملف القديم)
 *
 * ترتيب الـ scripts في كل صفحة يجب أن يكون:
 *   1. supabase CDN
 *   2. assets/js/supabase.js
 *   3. assets/js/config.js     ← هذا الملف
 *   (ثم كود الصفحة)
 */

(function (window) {
  'use strict';

  // ─── عنوان وهمي يُستخدم في الكود القديم ─────────────────────────────────
  const FAKE_API_URL = 'https://script.google.com/macros/s/REPLACED_BY_SUPABASE/exec';

  window.APP_CONFIG = {
    API_URL: FAKE_API_URL
  };

  // ─── اعتراض fetch ─────────────────────────────────────────────────────────
  const _originalFetch = window.fetch.bind(window);

  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input?.url || '');

    // هل هذا طلب للـ API القديم؟
    if (!url.startsWith(FAKE_API_URL)) {
      return _originalFetch(input, init);
    }

    // ─── استخرج action والبارامترات ─────────────────────────────────────────
    let action = '';
    let params = {};

    if (init?.method?.toUpperCase() === 'POST') {
      // طلب POST – البيانات في body
      try {
        const body = JSON.parse(init.body);
        action = body.action || '';
        params = body;
      } catch {
        action = '';
      }
    } else {
      // طلب GET – البيانات في query string
      const qs = url.includes('?') ? new URLSearchParams(url.split('?')[1]) : new URLSearchParams();
      action = qs.get('action') || '';
      qs.forEach((v, k) => {
        // حوّل القيم النصية لأنواعها الصحيحة
        if (v === 'true')  params[k] = true;
        else if (v === 'false') params[k] = false;
        else if (v !== '' && !isNaN(Number(v)) && k !== 'applicationNo' && k !== 'search') params[k] = Number(v);
        else params[k] = v;
      });
    }

    if (!action) {
      return fakeResponse({ ok: false, message: 'لا يوجد action' });
    }

    // ─── استدعِ APP_API ───────────────────────────────────────────────────────
    const result = await window.APP_API.call(action, params);
    return fakeResponse(result);
  };

  // ─── بناء Response وهمي ──────────────────────────────────────────────────
  function fakeResponse(data) {
    const json = JSON.stringify(data);
    return new Response(json, {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

})(window);
