/*
 * push-admin.js – Live English admin push notifications
 * يفعّل استقبال تنبيهات الإدارة من مشروع الإشعارات المركزي.
 */
(function (window, document) {
  'use strict';

  const PUSH_CONFIG = {
    supabaseUrl: 'https://yqkkjjfeupfmywadqlwd.supabase.co',
    publishableKey: 'sb_publishable_EtaamtevjICX2rqCN_JoPw__fgGG3w4',
    vapidPublicKey: 'BD6Y3Ct60okcHxn2NvR2Dqw51UMYB0l2XlFS4v_oj3byC_Xckf5CqYli6k-BU-u7dTvIgsNf6OWnyK-xxp-x425',
    appKey: 'live-english',
    swPath: '/sw.js'
  };

  window.LIVE_ENGLISH_PUSH_CONFIG = PUSH_CONFIG;

  document.addEventListener('DOMContentLoaded', () => {
    bindPushButton();
    refreshPushButtonState();
  });

  function bindPushButton() {
    const btn = document.getElementById('enableAdminPushBtn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
      try {
        setButtonLoading(true);
        const result = await enableAdminPush();
        localStorage.setItem('liveEnglishPushSubscriptionId', result.subscription_id || '');
        localStorage.setItem('liveEnglishPushEnabled', '1');

        await notifyUser('success', 'تم تفعيل التنبيهات', 'ستصلك إشعارات عند وجود تسجيل جديد.');
        refreshPushButtonState();
      } catch (error) {
        console.error('[Live English Push]', error);
        await notifyUser('error', 'تعذر تفعيل التنبيهات', error.message || 'حدث خطأ غير متوقع');
        refreshPushButtonState();
      } finally {
        setButtonLoading(false);
      }
    });
  }

  async function enableAdminPush() {
    if (!('serviceWorker' in navigator)) {
      throw new Error('المتصفح لا يدعم Service Worker.');
    }

    if (!('PushManager' in window)) {
      throw new Error('المتصفح لا يدعم Web Push.');
    }

    if (!('Notification' in window)) {
      throw new Error('المتصفح لا يدعم التنبيهات.');
    }

    if (Notification.permission === 'denied') {
      throw new Error('تم منع التنبيهات من إعدادات المتصفح. فعّلها من إعدادات الموقع ثم أعد المحاولة.');
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('لم يتم منح إذن التنبيهات.');
    }

    const registration = await navigator.serviceWorker.register(PUSH_CONFIG.swPath, {
      scope: '/'
    });

    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUSH_CONFIG.vapidPublicKey)
      });
    }

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Riyadh';
    const staff = getCurrentStaffUser();

    const response = await fetch(`${PUSH_CONFIG.supabaseUrl}/functions/v1/register-push-subscription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PUSH_CONFIG.publishableKey}`,
        'apikey': PUSH_CONFIG.publishableKey
      },
      body: JSON.stringify({
        app_key: PUSH_CONFIG.appKey,
        subscription: subscription.toJSON(),
        timezone,
        user_key: staff?.id ? `staff:${staff.id}` : 'staff:admin'
      })
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok || !json.ok) {
      throw new Error(json.error || json.message || 'فشل تسجيل الاشتراك في مركز الإشعارات.');
    }

    return json;
  }

  function refreshPushButtonState() {
    const btn = document.getElementById('enableAdminPushBtn');
    if (!btn) return;

    if (!('Notification' in window)) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-bell-slash"></i><span class="btn-label-mobile-hide"> التنبيهات غير مدعومة</span>';
      return;
    }

    if (Notification.permission === 'granted' && localStorage.getItem('liveEnglishPushEnabled') === '1') {
      btn.classList.remove('btn-outline-secondary');
      btn.classList.add('btn-le');
      btn.innerHTML = '<i class="fa-solid fa-bell"></i><span class="btn-label-mobile-hide"> التنبيهات مفعّلة</span>';
      return;
    }

    btn.classList.remove('btn-le');
    btn.classList.add('btn-outline-secondary');
    btn.innerHTML = '<i class="fa-regular fa-bell"></i><span class="btn-label-mobile-hide"> تفعيل التنبيهات</span>';
  }

  function setButtonLoading(isLoading) {
    const btn = document.getElementById('enableAdminPushBtn');
    if (!btn) return;
    btn.disabled = isLoading;
    if (isLoading) {
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span class="btn-label-mobile-hide"> جاري التفعيل...</span>';
    }
  }

  function getCurrentStaffUser() {
    try {
      return JSON.parse(localStorage.getItem('liveEnglishStaffUser') || 'null');
    } catch {
      return null;
    }
  }

  function notifyUser(icon, title, text) {
    if (window.Swal) {
      return Swal.fire({ icon, title, text, confirmButtonColor: '#fbc70d' });
    }
    window.alert(`${title}\n${text || ''}`);
    return Promise.resolve();
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
})(window, document);
