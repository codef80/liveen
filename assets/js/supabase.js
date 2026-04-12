/**
 * supabase.js – Live English
 * البيانات → Supabase | الملفات → Google Drive
 * ضعه في: assets/js/supabase.js
 *
 * المتطلبات:
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
 *   يُضاف قبل هذا الملف في كل صفحة
 */

(function (window) {
  'use strict';

  // ─── إعدادات Supabase ────────────────────────────────────────────────────
  const SUPABASE_URL = 'https://ixzhntzkxoufpbrlelnx.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_IZQOeekcFcwleIILJmwf3A_TrjYWmnN';

  // ─── رابط Apps Script لرفع الملفات لـ Drive ──────────────────────────────
  // ← ضع هنا رابط الـ Web App بعد النشر
  const DRIVE_UPLOAD_URL = 'https://script.google.com/macros/s/AKfycbwADSBTPigKPc1vQyfwOFgzVNG0H84aEhYVNO-G8LubWoAMVmPEcuoE1pWP1Nr-BdJB/exec';

  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  // ─── مولّد رقم الطلب ─────────────────────────────────────────────────────
  function generateApplicationNo() {
    const prefix = 'LE';
    const ts = Date.now().toString().slice(-6);
    const rand = Math.floor(Math.random() * 900 + 100);
    return `${prefix}-${ts}-${rand}`;
  }

  function generateInvoiceNo() {
    return 'INV-' + Date.now().toString().slice(-8);
  }

  // ─── رفع ملفات الطلب إلى Google Drive عبر Apps Script ───────────────────
  async function uploadFilesToDrive(studentName, applicationNo, passport, video) {
    if (!DRIVE_UPLOAD_URL || DRIVE_UPLOAD_URL.startsWith('ضع')) {
      console.warn('DRIVE_UPLOAD_URL غير مضبوط – الملفات لن تُرفع');
      return { passportFile: null, videoFile: null };
    }

    const payload = {
      action: 'uploadFiles',
      studentName,
      applicationNo,
      passport: passport || null,
      video: video || null
    };

    const res = await fetch(DRIVE_UPLOAD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    if (!json.ok) throw new Error('فشل رفع الملفات: ' + (json.message || ''));

    return {
      passportFile: json.passportFile || null,
      videoFile:    json.videoFile    || null,
      appFolderId:  json.appFolderId  || '',
      appFolderPath: json.appFolderPath || ''
    };
  }

  // ─── سجّل حركة طلب ───────────────────────────────────────────────────────
  async function logAction(applicationId, actor, action, oldStatus, newStatus, notes) {
    await sb.from('application_logs').insert({
      application_id: applicationId,
      actor: actor || 'النظام',
      action,
      old_status: oldStatus || null,
      new_status: newStatus || null,
      notes: notes || null
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  ACTIONS  (نفس أسماء actions القديمة بالضبط)
  // ════════════════════════════════════════════════════════════════════════════

  const actions = {

    // ── initData ─────────────────────────────────────────────────────────────
    async initData() {
      const { data: rows } = await sb.from('settings').select('key,value');
      const settings = {};
      (rows || []).forEach(r => { settings[r.key] = r.value; });

      const { data: packages } = await sb.from('packages').select('*').eq('enabled', true).order('display_order');
      const { data: years } = await sb.from('years').select('*, year_media(*)').eq('enabled', true).order('display_order');

      return { ok: true, data: { settings, packages: packages || [], years: years || [] } };
    },

    // ── getPackages ───────────────────────────────────────────────────────────
    async getPackages(params = {}) {
      const includeHidden = params.includeHidden === true
        || params.includeHidden === 'true'
        || params.includeHidden === '1';
      let q = sb.from('packages').select('*').order('display_order');
      if (!includeHidden) q = q.eq('enabled', true);
      const { data, error } = await q;
      if (error) throw error;
      return { ok: true, data: (data || []).map(mapPackage) };
    },

    // ── savePackage ───────────────────────────────────────────────────────────
    async savePackage({ data: d }) {
      const row = {
        title: d['عنوان_الباقة'],
        description: d['الوصف'] || '',
        price: Number(d['السعر'] || 0),
        display_order: Number(d['ترتيب_الظهور'] || 0),
        enabled: toBool(d['مفعل']),
        register_enabled: toBool(d['زر_التسجيل_مفعل']),
        image_file_id: d['معرف_ملف_الصورة'] || '',
        image_url: d['رابط_الصورة'] || ''
      };
      if (d['معرف_الباقة']) {
        const { error } = await sb.from('packages').update(row).eq('id', d['معرف_الباقة']);
        if (error) throw error;
      } else {
        const { error } = await sb.from('packages').insert(row);
        if (error) throw error;
      }
      return { ok: true };
    },

    // ── deletePackage ─────────────────────────────────────────────────────────
    async deletePackage({ data: d }) {
      const { error } = await sb.from('packages').delete().eq('id', d['معرف_الباقة']);
      if (error) throw error;
      return { ok: true };
    },

    // ── getYears ──────────────────────────────────────────────────────────────
    async getYears(params = {}) {
      const includeHidden = params.includeHidden === true
        || params.includeHidden === 'true'
        || params.includeHidden === '1';
      let q = sb.from('years').select('*, year_media(*)').order('display_order');
      if (!includeHidden) q = q.eq('enabled', true);
      const { data, error } = await q;
      if (error) throw error;
      return { ok: true, data: (data || []).map(mapYear) };
    },

    // ── saveYear ──────────────────────────────────────────────────────────────
    async saveYear({ data: d }) {
      const row = {
        year: d['السنة'],
        title: d['عنوان_السنة'] || '',
        description: d['الوصف'] || '',
        participants: d['عدد_المشاركين'] || '',
        activities: d['أبرز_الأنشطة'] || '',
        display_order: Number(d['ترتيب_الظهور'] || 0),
        enabled: toBool(d['مفعل']),
        drive_folder_id: d['معرف_مجلد_الصور'] || '',
        drive_folder_url: d['رابط_مجلد_الصور'] || '',
        youtube_links: d['روابط_يوتيوب'] || []
      };
      if (d['معرف_السنة']) {
        const { error } = await sb.from('years').update(row).eq('id', d['معرف_السنة']);
        if (error) throw error;
        return { ok: true, id: d['معرف_السنة'] };
      } else {
        const { data, error } = await sb.from('years').insert(row).select('id').single();
        if (error) throw error;
        return { ok: true, id: data.id };
      }
    },

    // ── saveYearMedia ─────────────────────────────────────────────────────────
    async saveYearMedia({ data: d }) {
      const yearId = d['معرف_السنة'];

      // وضع الاستبدال الكامل (إذا أُرسلت قائمة الوسائط)
      if (Array.isArray(d['الوسائط'])) {
        await sb.from('year_media').delete().eq('year_id', yearId);
        if (d['الوسائط'].length) {
          const rows = d['الوسائط'].map((m, i) => ({
            year_id:       yearId,
            type:          m.type || 'image',
            url:           m.url  || '',
            file_id:       m.fileId || m['معرف_الملف'] || '',
            caption:       m.caption || m['العنوان'] || '',
            display_order: i
          }));
          const { error } = await sb.from('year_media').insert(rows);
          if (error) throw error;
        }
        return { ok: true };
      }

      // وضع إضافة وسيط واحد (append)
      const type = String(d['نوع_الوسيط'] || 'image');
      const normalizedType = type === 'صورة' ? 'image' : type === 'فيديو' ? 'video' : 'link';

      // احسب آخر ترتيب
      const { data: existing } = await sb.from('year_media')
        .select('display_order')
        .eq('year_id', yearId)
        .order('display_order', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextOrder = existing ? (existing.display_order + 1) : 0;

      const { error } = await sb.from('year_media').insert({
        year_id:       yearId,
        type:          normalizedType,
        url:           d['الرابط'] || '',
        file_id:       d['معرف_الملف'] || '',
        caption:       d['العنوان'] || d['الوصف'] || '',
        display_order: Number(d['ترتيب_الظهور'] || nextOrder)
      });
      if (error) throw error;

      return { ok: true };
    },

    // ── submitRegistration ────────────────────────────────────────────────────
    async submitRegistration({ data: d }) {
      const applicationNo = generateApplicationNo();
      const studentName   = d['اسم_الطالب_الثلاثي'] || 'طالب';

      // ── 1. احفظ الطلب في Supabase فورًا (بدون انتظار الملفات) ─────────────
      const { data: inserted, error } = await sb.from('applications').insert({
        application_no:      applicationNo,
        student_name:        studentName,
        student_identity:    d['هوية_الطالب'],
        passport_no:         d['رقم_الجواز']               || '',
        city:                d['مدينة_السكن']               || '',
        school:              d['المدرسة']                   || '',
        grade:               d['الصف_الدراسي']              || '',
        age:                 d['العمر_بالميلادي']           || '',
        hobbies:             d['الهوايات']                  || '',
        academic_level:      d['المستوى_الدراسي']           || '',
        english_level:       d['مستوى_اللغة_الإنجليزية']   || '',
        health_status:       d['الحالة_الصحية']             || '',
        student_phone:       d['جوال_الابن']                || '',
        guardian_phone:      d['جوال_ولي_الأمر']            || '',
        guardian_identity:   d['هوية_ولي_الأمر']            || '',
        category:            d['الفئة']                     || '',
        source:              d['كيف_عرفت_عن_البرنامج']      || '',
        application_status:  'تسجيل أولي',
        // الملفات ستُرفع في الخلفية لاحقًا
        passport_image_path: '',
        passport_file_id:    '',
        intro_video_path:    '',
        intro_video_file_id: '',
        drive_folder_id:     '',
        drive_folder_path:   ''
      }).select('id').single();

      if (error) throw error;

      await logAction(inserted.id, 'النظام', 'تم إرسال الطلب', null, 'تسجيل أولي', 'طلب جديد');

      // ── أنشئ فاتورة فورية بسعر 0 (تُحدَّث عند تحديد السعر) ───────────────
      await sb.from('invoices').insert({
        invoice_no:     generateInvoiceNo(),
        application_id: inserted.id,
        application_no: applicationNo,
        student_name:   studentName,
        category:       d['الفئة'] || '',
        amount:         0
      });

      // ── 2. ارفع الملفات في الخلفية (لا تنتظر النتيجة) ────────────────────
      const hasPassport = d['صورة_الجواز']?.base64;
      const hasVideo    = d['فيديو_تعريفي']?.base64;

      if ((hasPassport || hasVideo) && DRIVE_UPLOAD_URL && !DRIVE_UPLOAD_URL.startsWith('ضع')) {
        // fire-and-forget – لا نعرض خطأ للمستخدم إذا فشل الرفع
        uploadFilesToDrive(studentName, applicationNo, d['صورة_الجواز'] || null, d['فيديو_تعريفي'] || null)
          .then(async (uploadResult) => {
            const update = {};
            if (uploadResult.passportFile) {
              update.passport_image_path = uploadResult.passportFile.url    || '';
              update.passport_file_id    = uploadResult.passportFile.fileId || '';
            }
            if (uploadResult.videoFile) {
              update.intro_video_path    = uploadResult.videoFile.url    || '';
              update.intro_video_file_id = uploadResult.videoFile.fileId || '';
            }
            if (uploadResult.appFolderId) {
              update.drive_folder_id   = uploadResult.appFolderId   || '';
              update.drive_folder_path = uploadResult.appFolderPath || '';
            }
            if (Object.keys(update).length) {
              await sb.from('applications').update(update).eq('id', inserted.id);
            }
          })
          .catch(err => console.warn('رفع الملفات (خلفية):', err));
      }

      // ── 3. أرجع النتيجة فورًا ─────────────────────────────────────────────
      return { ok: true, applicationNo, data: { applicationNo } };
    },

    // ── getApplications ───────────────────────────────────────────────────────
    async getApplications({ stage, status, search, category } = {}) {
      let q = sb.from('applications')
        .select('*, staff_users(id, name), invoices(invoice_no, amount)')
        .order('submitted_at', { ascending: false });

      if (stage === 'registration') {
        q = q.in('application_status', ['تسجيل أولي', 'تحت المراجعة']);
      } else if (stage === 'payment') {
        // السداد: يشمل المقبولين وحالات السداد الجزئي فقط - مكتمل ينتقل للطلاب
        q = q.in('application_status', [
          'مقبول مبدئيًا وبانتظار السداد',
          'سداد جزئي',
          'مؤجل السداد'
        ]);
      } else if (stage === 'students') {
        q = q.in('application_status', ['مكتمل السداد', 'طالب نشط', 'مقبول']);
      }

      if (status) q = q.eq('application_status', status);
      if (category) q = q.eq('category', category);

      const { data, error } = await q;
      if (error) throw error;

      let rows = data || [];
      if (search) {
        const s = search.toLowerCase();
        rows = rows.filter(r =>
          (r.application_no || '').toLowerCase().includes(s) ||
          (r.student_name || '').toLowerCase().includes(s) ||
          (r.student_identity || '').toLowerCase().includes(s) ||
          (r.guardian_phone || '').includes(s)
        );
      }

      return { ok: true, data: rows.map(mapApplication) };
    },

    // ── getRegistrationApplications ───────────────────────────────────────────
    async getRegistrationApplications(params) {
      return actions.getApplications({ ...params, stage: 'registration' });
    },

    // ── getPaymentStageApplications ───────────────────────────────────────────
    async getPaymentStageApplications(params) {
      return actions.getApplications({ ...params, stage: 'payment' });
    },

    // ── getActiveStudents ─────────────────────────────────────────────────────
    async getActiveStudents(params) {
      return actions.getApplications({ ...params, stage: 'students' });
    },

    // ── dashboardStats ────────────────────────────────────────────────────────
    async dashboardStats() {
      const { data, error } = await sb.from('applications').select('application_status');
      if (error) throw error;

      const counts = {};
      (data || []).forEach(r => {
        counts[r.application_status] = (counts[r.application_status] || 0) + 1;
      });

      return { ok: true, data: { totalApplications: (data || []).length, statusCounts: counts } };
    },

    // ── getStudentProfile ─────────────────────────────────────────────────────
    async getStudentProfile({ applicationNo } = {}) {
      // جلب الطلب مع الـ logs
      const { data, error } = await sb.from('applications')
        .select('*, application_logs(*), staff_users(name)')
        .eq('application_no', applicationNo)
        .single();
      if (error) throw error;

      // جلب تقارير المعلم
      const { data: reportRows } = await sb.from('teacher_reports')
        .select('*')
        .eq('application_id', data.id)
        .order('created_at', { ascending: false });

      // جلب الفاتورة إن وجدت
      const { data: invoiceRow } = await sb.from('invoices')
        .select('*')
        .eq('application_no', applicationNo)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // ── بناء المرفقات من حقول Drive ──────────────────────────────────────
      const attachments = [];

      if (data.passport_image_path) {
        attachments.push({
          id:              data.id + '_passport',
          'معرف_المرفق':   data.id + '_passport',
          'نوع_المرفق':   'صورة الجواز',
          'اسم_الملف':    'صورة الجواز',
          'نوع_الملف':    'image',
          'رابط_الملف':   buildDriveViewUrl(data.passport_image_path, data.passport_file_id),
          url:             buildDriveViewUrl(data.passport_image_path, data.passport_file_id),
          type:            'image',
          fileName:        'صورة الجواز'
        });
      }

      if (data.intro_video_path) {
        attachments.push({
          id:              data.id + '_video',
          'معرف_المرفق':   data.id + '_video',
          'نوع_المرفق':   'فيديو تعريفي',
          'اسم_الملف':    'الفيديو التعريفي',
          'نوع_الملف':    'video',
          'رابط_الملف':   buildDriveViewUrl(data.intro_video_path, data.intro_video_file_id),
          url:             buildDriveViewUrl(data.intro_video_path, data.intro_video_file_id),
          type:            'video',
          fileName:        'الفيديو التعريفي'
        });
      }

      // ── timeline ──────────────────────────────────────────────────────────
      const timeline = (data.application_logs || [])
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .map(mapLog);

      // ── تقارير المعلم ─────────────────────────────────────────────────────
      const reports = (reportRows || []).map(r => {
        const lines = [
          r.edu_status      ? `الحالة التعليمية: ${r.edu_status}`   : '',
          r.lang_level      ? `مستوى اللغة: ${r.lang_level}`         : '',
          r.attendance      ? `الحضور: ${r.attendance}`               : '',
          r.behavior        ? `السلوك: ${r.behavior}`                 : '',
          r.skills          ? `المهارات: ${r.skills}`                 : '',
          r.recommendations ? `التوصيات: ${r.recommendations}`         : '',
          r.notes           ? `ملاحظات: ${r.notes}`                   : ''
        ].filter(Boolean);
        const displayText = lines.length > 0 ? lines.join('\n') : (r.report_text || '');
        return {
          id:              r.id,
          'المعلم':        r.teacher_name        || '',
          'ملاحظات':       displayText,
          'التوصيات':      r.recommendations     || '',
          'التقدير':       r.grade               || r.edu_status || '',
          'تاريخ_الإنشاء': formatDate(r.created_at),
          teacher:         r.teacher_name        || '',
          reportText:      displayText,
          eduStatus:       r.edu_status          || '',
          langLevel:       r.lang_level          || '',
          attendance:      r.attendance          || '',
          behavior:        r.behavior            || '',
          skills:          r.skills              || '',
          recommendations: r.recommendations     || '',
          notes:           r.notes               || '',
          grade:           r.grade               || '',
          createdAt:       formatDate(r.created_at)
        };
      });

      // ── بيانات الفاتورة ───────────────────────────────────────────────────
      const totalAmount = invoiceRow?.amount   || 0;
      const paidAmount  = data.paid_amount     || 0;
      const remaining   = totalAmount - paidAmount;

      const invoice = invoiceRow ? {
        'رقم_الفاتورة':   invoiceRow.invoice_no,
        'الإجمالي':       totalAmount,
        'المدفوع':        paidAmount,
        'المتبقي':        remaining,
        'حالة_السداد':    data.payment_status || data.application_status || '',
        'تاريخ_الإنشاء': formatDate(invoiceRow.created_at),
        'رابط_الفاتورة': `invoice.html?applicationNo=${encodeURIComponent(applicationNo)}`
      } : {};

      const appFull = mapApplicationFull(data);
      // أضف بيانات الفاتورة للـ application مباشرة
      appFull['رقم_الفاتورة']  = invoiceRow?.invoice_no || '';
      appFull['رابط_الفاتورة'] = invoiceRow ? `invoice.html?applicationNo=${encodeURIComponent(applicationNo)}` : '';
      appFull['المدفوع']        = paidAmount;
      appFull['المتبقي']        = remaining;
      appFull['مبلغ_الباقة']   = totalAmount;
      appFull['حالة_السداد']   = data.payment_status || data.application_status || '';

      return {
        ok: true,
        data: {
          application: appFull,
          student:     appFull,   // نفس البيانات – الكود يقرأ من الاثنين
          attachments,
          timeline,
          reports,
          invoice,
          payments: invoiceRow ? [{
            'حالة_السداد':    data.payment_status || data.application_status || '',
            'تاريخ_العملية': formatDate(data.updated_at),
            'المدفوع':        paidAmount,
            'المتبقي':        remaining,
            'الإجمالي':       totalAmount,
            'رابط_الفاتورة': `invoice.html?applicationNo=${encodeURIComponent(applicationNo)}`
          }] : [],
          assignedTeacher: {
            teacherName: data.staff_users?.name || '',
            teacherId:   data.assigned_teacher_id || ''
          }
        }
      };
    },

    // ── updateApplicationStatus ───────────────────────────────────────────────
    async updateApplicationStatus({ actor, data: d } = {}) {
      const { data: app } = await sb.from('applications').select('id,application_status').eq('application_no', d['رقم_الطلب']).single();
      if (!app) throw new Error('الطلب غير موجود');

      const update = { application_status: d['حالة_الطلب'], updated_at: new Date().toISOString() };
      if (d['سبب_الرفض'])   update.rejection_reason = d['سبب_الرفض'];
      if (d['ملاحظات_عامة']) update.general_notes    = d['ملاحظات_عامة'];

      const { error } = await sb.from('applications').update(update).eq('id', app.id);
      if (error) throw error;

      await logAction(app.id, actor, d['وصف_الحركة'] || 'تغيير الحالة', app.application_status, d['حالة_الطلب'], d['ملاحظات_عامة'] || '');

      return { ok: true };
    },

    // ── acceptRegistrationAndPrepareWhatsapp ──────────────────────────────────
    async acceptRegistrationAndPrepareWhatsapp({ actor, data: d } = {}) {
      await actions.updateApplicationStatus({
        actor,
        data: {
          'رقم_الطلب': d['رقم_الطلب'],
          'حالة_الطلب': 'مقبول مبدئيًا وبانتظار السداد',
          'وصف_الحركة': 'تم القبول الأولي'
        }
      });

      // جلب بيانات الطلب
      const { data: app } = await sb.from('applications')
        .select('id, guardian_phone, student_name, application_no, category, paid_amount')
        .eq('application_no', d['رقم_الطلب']).single();

      // ── أنشئ فاتورة عند القبول المبدئي إذا لم تكن موجودة ────────────────
      const { data: existingInv } = await sb.from('invoices')
        .select('id').eq('application_no', d['رقم_الطلب']).maybeSingle();

      if (!existingInv && app) {
        // جلب سعر الفئة
        const { data: pkg } = await sb.from('packages')
          .select('price').eq('title', app.category).maybeSingle();

        await sb.from('invoices').insert({
          invoice_no:     generateInvoiceNo(),
          application_id: app.id,
          application_no: app.application_no,
          student_name:   app.student_name,
          category:       app.category,
          amount:         pkg?.price || 0
        });
      }

      // جلب رسالة القبول من الإعدادات
      const { data: settingRow } = await sb.from('settings').select('value').eq('key', 'رسالة_قبول_أولي').maybeSingle();
      let msg = (settingRow?.value || 'مرحباً، تم قبول طلبكم مبدئياً في برنامج Live English 🎉\nرقم الطلب: {رقم_الطلب}')
        .replace('{اسم_الطالب}', app?.student_name || '')
        .replace('{رقم_الطلب}', app?.application_no || '');

      const phone = (app?.guardian_phone || '').replace(/\D/g, '').replace(/^0/, '966');
      const whatsappUrl = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` : null;

      return { ok: true, data: { whatsappUrl } };
    },

    // ── getWhatsappMessage ────────────────────────────────────────────────────
    async getWhatsappMessage({ applicationNo, type } = {}) {
      // جلب بيانات الطلب كاملة
      const { data: app } = await sb.from('applications')
        .select('guardian_phone, student_name, application_no, category, paid_amount, payment_status, application_status')
        .eq('application_no', applicationNo).single();

      // جلب الفاتورة
      const { data: inv } = await sb.from('invoices')
        .select('invoice_no, amount')
        .eq('application_no', applicationNo)
        .maybeSingle();

      const keyMap = {
        'acceptance':       'رسالة_قبول_أولي',
        'payment_reminder': 'رسالة_تذكير_السداد',
        'reminder':         'رسالة_تذكير_السداد',
        'paid':             'رسالة_السداد_المكتمل'
      };

      const { data: settingRow } = await sb.from('settings')
        .select('value').eq('key', keyMap[type] || 'رسالة_تذكير_السداد').maybeSingle();

      const paidAmount  = app?.paid_amount   || 0;
      const totalAmount = inv?.amount        || 0;
      const remaining   = totalAmount - paidAmount;
      const invoiceUrl  = inv?.invoice_no
        ? `invoice.html?applicationNo=${encodeURIComponent(applicationNo)}`
        : '';

      let msg = (settingRow?.value || 'السلام عليكم، بخصوص الطالب {اسم_الطالب} 👋')
        .replace(/\{اسم_الطالب\}/g,    app?.student_name      || '')
        .replace(/\{رقم_الطلب\}/g,     app?.application_no    || '')
        .replace(/\{الفئة\}/g,          app?.category          || '')
        .replace(/\{رقم_الفاتورة\}/g,  inv?.invoice_no         || '')
        .replace(/\{رابط_الفاتورة\}/g, invoiceUrl)
        .replace(/\{المبلغ_الكلي\}/g,  totalAmount.toLocaleString('en-US'))
        .replace(/\{المدفوع\}/g,        paidAmount.toLocaleString('en-US'))
        .replace(/\{المتبقي\}/g,        remaining.toLocaleString('en-US'))
        .replace(/\{حالة_السداد\}/g,    app?.payment_status    || app?.application_status || '')
        .replace(/\{حالة_الطلب\}/g,     app?.application_status || '');

      const phone = (app?.guardian_phone || '').replace(/\D/g, '').replace(/^0/, '966');
      const whatsappUrl = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` : null;

      return { ok: true, data: { whatsappUrl, message: msg } };
    },

    // ── savePaymentAction ─────────────────────────────────────────────────────
    async savePaymentAction({ actor, data: d } = {}) {
      const { data: app } = await sb.from('applications')
        .select('id,application_status,paid_amount,paid_history,guardian_phone,student_name,application_no,category')
        .eq('application_no', d['رقم_الطلب']).single();
      if (!app) throw new Error('الطلب غير موجود');

      // ── ترجمة الإجراء إلى حالة الطلب ────────────────────────────────────
      const actionMap = {
        'مكتمل السداد':              'مكتمل السداد',
        'دفع جزئي':                  'سداد جزئي',
        'مؤجل':                      'مؤجل السداد',
        'بانتظار السداد':            'مقبول مبدئيًا وبانتظار السداد',
        'سداد جزئي':                 'سداد جزئي',
        'مؤجل السداد':               'مؤجل السداد'
      };

      const rawAction = d['الإجراء'] || d['حالة_الطلب'] || '';
      const newStatus = actionMap[rawAction] || rawAction;
      if (!newStatus) throw new Error('الإجراء غير محدد');

      const addedNow  = Number(d['المدفوع_الآن'] || d['المبلغ_المدفوع'] || 0);
      const notes     = d['ملاحظات'] || '';

      // ── السداد التراكمي: اجمع على القديم ─────────────────────────────────
      const prevPaid   = Number(app.paid_amount || 0);
      const totalPaid  = prevPaid + addedNow;

      // ── سجل تاريخ السداد ────────────────────────────────────────────────
      const history    = Array.isArray(app.paid_history) ? app.paid_history : [];
      if (addedNow > 0) {
        history.push({
          amount: addedNow,
          action: rawAction,
          actor:  actor || '',
          date:   new Date().toISOString(),
          notes
        });
      }

      const { error } = await sb.from('applications').update({
        application_status: newStatus,
        paid_amount:        totalPaid,
        payment_status:     newStatus,
        paid_history:       history,
        updated_at:         new Date().toISOString()
      }).eq('id', app.id);
      if (error) throw error;

      await logAction(app.id, actor, 'عملية سداد', app.application_status, newStatus,
        `الإجراء: ${rawAction} | مدفوع الآن: ${addedNow} | الإجمالي المدفوع: ${totalPaid} | ${notes}`);

      // ── أنشئ/حدّث فاتورة ────────────────────────────────────────────────
      const { data: existingInv } = await sb.from('invoices')
        .select('id, amount').eq('application_no', app.application_no).maybeSingle();

      // جلب سعر الفئة من packages
      const { data: pkg } = await sb.from('packages')
        .select('price').eq('title', app.category).maybeSingle();
      const packagePrice = Number(pkg?.price || 0);

      const invoiceTotal = Number(d['المبلغ_الإجمالي'] || 0) || packagePrice;

      if (!existingInv) {
        await sb.from('invoices').insert({
          invoice_no:     d['رقم_الفاتورة'] || generateInvoiceNo(),
          application_id: app.id,
          application_no: app.application_no,
          student_name:   app.student_name,
          category:       app.category,
          amount:         invoiceTotal
        });
      } else if (invoiceTotal > 0 && invoiceTotal !== existingInv.amount) {
        await sb.from('invoices').update({ amount: invoiceTotal }).eq('id', existingInv.id);
      } else if (existingInv.amount === 0 && packagePrice > 0) {
        // حدّث المبلغ من سعر الباقة إذا كان 0
        await sb.from('invoices').update({ amount: packagePrice }).eq('id', existingInv.id);
      }

      return { ok: true };
    },
    

    // ── getInvoiceByApplicationNo ─────────────────────────────────────────────
    async getInvoiceByApplicationNo({ applicationNo } = {}) {
      const { data, error } = await sb.from('invoices')
        .select('*')
        .eq('application_no', applicationNo)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) throw new Error('لا توجد فاتورة لهذا الطلب');

      return {
        ok: true,
        data: {
          invoiceNo:     data.invoice_no,
          applicationNo: data.application_no,
          studentName:   data.student_name,
          category:      data.category,
          amount:        data.amount,
          createdAt:     formatDate(data.created_at)
        }
      };
    },

    // ── cancelApplication ─────────────────────────────────────────────────────
    async cancelApplication({ actor, data: d } = {}) {
      return actions.updateApplicationStatus({
        actor,
        data: { 'رقم_الطلب': d['رقم_الطلب'], 'حالة_الطلب': 'منسحب', 'وصف_الحركة': 'إلغاء الطلب' }
      });
    },

    // ── getRejectedApplications ───────────────────────────────────────────────
    async getRejectedApplications({ search, category, status } = {}) {
      let q = sb.from('applications')
        .select('*')
        .in('application_status', ['مرفوض', 'منسحب'])
        .order('updated_at', { ascending: false });

      if (status) q = q.eq('application_status', status);
      if (category) q = q.eq('category', category);

      const { data, error } = await q;
      if (error) throw error;

      let rows = data || [];
      if (search) {
        const s = search.toLowerCase();
        rows = rows.filter(r =>
          (r.application_no || '').toLowerCase().includes(s) ||
          (r.student_name || '').toLowerCase().includes(s)
        );
      }

      return { ok: true, data: rows.map(mapApplication) };
    },

    // ── restoreApplication ────────────────────────────────────────────────────
    async restoreApplication({ actor, data: d } = {}) {
      return actions.updateApplicationStatus({
        actor,
        data: { 'رقم_الطلب': d['رقم_الطلب'], 'حالة_الطلب': 'تسجيل أولي', 'وصف_الحركة': 'استعادة الطلب' }
      });
    },

    // ── updateStudentProfile ──────────────────────────────────────────────────
    async updateStudentProfile({ actor, data: d } = {}) {
      const { data: app } = await sb.from('applications').select('id').eq('application_no', d['رقم_الطلب']).single();
      if (!app) throw new Error('الطلب غير موجود');

      const { error } = await sb.from('applications').update({
        student_name:      d['اسم_الطالب_الثلاثي'] || undefined,
        student_identity:  d['هوية_الطالب'] || undefined,
        guardian_phone:    d['جوال_ولي_الأمر'] || undefined,
        guardian_identity: d['هوية_ولي_الأمر'] || undefined,
        city:              d['مدينة_السكن'] || undefined,
        school:            d['المدرسة'] || undefined,
        grade:             d['الصف_الدراسي'] || undefined,
        general_notes:     d['ملاحظات_عامة'] || undefined,
        updated_at:        new Date().toISOString()
      }).eq('id', app.id);
      if (error) throw error;

      await logAction(app.id, actor, 'تعديل بيانات الطالب', null, null, 'تم تعديل البيانات');
      return { ok: true };
    },

    // ── assignStudentToTeacher ────────────────────────────────────────────────
    async assignStudentToTeacher({ actor, data: d } = {}) {
      const { data: app } = await sb.from('applications')
        .select('id, application_status').eq('application_no', d['رقم_الطلب']).single();
      if (!app) throw new Error('الطلب غير موجود');

      const { error } = await sb.from('applications').update({
        assigned_teacher_id: d['معرف_المعلم'],
        updated_at: new Date().toISOString()
      }).eq('id', app.id);
      if (error) throw error;

      // جلب اسم المعلم للـ log
      const { data: teacher } = await sb.from('staff_users')
        .select('name').eq('id', d['معرف_المعلم']).maybeSingle();

      await logAction(app.id, actor, 'تسكين الطالب', null, null,
        `تم التسكين لدى المعلم: ${teacher?.name || d['معرف_المعلم']}`);

      return { ok: true, data: { teacherName: teacher?.name || '' } };
    },

    // ── getTeacherAssignedStudents ─────────────────────────────────────────────
    async getTeacherAssignedStudents({ teacherId, search } = {}) {
      let q = sb.from('applications')
        .select('*')
        .eq('assigned_teacher_id', teacherId)
        .order('submitted_at', { ascending: false });

      const { data, error } = await q;
      if (error) throw error;

      let rows = data || [];
      if (search) {
        const s = search.toLowerCase();
        rows = rows.filter(r =>
          (r.student_name || '').toLowerCase().includes(s) ||
          (r.application_no || '').toLowerCase().includes(s)
        );
      }

      return { ok: true, data: rows.map(mapApplication) };
    },

    // ── saveTeacherReport ─────────────────────────────────────────────────────
    async saveTeacherReport({ actor, data: d } = {}) {
      const { data: app } = await sb.from('applications')
        .select('id').eq('application_no', d['رقم_الطلب']).single();
      if (!app) throw new Error('الطلب غير موجود');

      const { data: teacher } = await sb.from('staff_users')
        .select('id').eq('name', actor).maybeSingle();

      // نص موحد للعرض
      const reportText = [
        d['الحالة_التعليمية'] ? `الحالة التعليمية: ${d['الحالة_التعليمية']}` : '',
        d['مستوى_اللغة']      ? `مستوى اللغة: ${d['مستوى_اللغة']}`           : '',
        d['الحضور']            ? `الحضور: ${d['الحضور']}`                     : '',
        d['السلوك']            ? `السلوك: ${d['السلوك']}`                     : '',
        d['المهارات']          ? `المهارات: ${d['المهارات']}`                 : '',
        d['التوصيات']          ? `التوصيات: ${d['التوصيات']}`                 : '',
        d['ملاحظات']           ? `ملاحظات: ${d['ملاحظات']}`                   : '',
        d['نص_التقرير']        ? d['نص_التقرير']                              : ''
      ].filter(Boolean).join('\n');

      const { error } = await sb.from('teacher_reports').insert({
        application_id:  app.id,
        teacher_id:      teacher?.id        || null,
        teacher_name:    d['المعلم']        || actor || '',
        report_text:     reportText,
        grade:           d['التقدير']       || d['الحالة_التعليمية'] || '',
        // حقول منفصلة
        edu_status:      d['الحالة_التعليمية'] || '',
        lang_level:      d['مستوى_اللغة']      || '',
        attendance:      d['الحضور']            || '',
        behavior:        d['السلوك']            || '',
        skills:          d['المهارات']          || '',
        recommendations: d['التوصيات']          || '',
        notes:           d['ملاحظات']           || ''
      });
      if (error) throw error;

      return { ok: true };
    },

    // ── getUsers ──────────────────────────────────────────────────────────────
    async getUsers({ search, role, status } = {}) {
      let q = sb.from('staff_users').select('*').order('created_at', { ascending: false });
      if (role) q = q.eq('role', role);
      if (status) q = q.eq('status', status);

      const { data, error } = await q;
      if (error) throw error;

      let rows = data || [];
      if (search) {
        const s = search.toLowerCase();
        rows = rows.filter(r =>
          (r.name || '').toLowerCase().includes(s) ||
          (r.username || '').toLowerCase().includes(s)
        );
      }

      return { ok: true, data: rows.map(mapUser) };
    },

    // ── saveUser ──────────────────────────────────────────────────────────────
    async saveUser({ data: d } = {}) {
      const row = {
        name:     d['الاسم'],
        username: d['اسم_المستخدم'],
        role:     d['الدور'],
        status:   d['الحالة'] || 'نشط',
        phone:    d['الجوال'] || ''
      };
      if (d['كلمة_المرور']) row.password = d['كلمة_المرور'];

      if (d['معرف_المستخدم']) {
        const { error } = await sb.from('staff_users').update(row).eq('id', d['معرف_المستخدم']);
        if (error) throw error;
      } else {
        if (!d['كلمة_المرور']) throw new Error('كلمة المرور مطلوبة');
        const { error } = await sb.from('staff_users').insert(row);
        if (error) throw error;
      }
      return { ok: true };
    },

    // ── loginStaff ────────────────────────────────────────────────────────────
    async loginStaff({ username, password } = {}) {
      const { data, error } = await sb.from('staff_users')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .eq('status', 'نشط')
        .single();

      if (error || !data) return { ok: false, message: 'بيانات الدخول غير صحيحة أو الحساب معطل' };

      // سجّل آخر دخول
      await sb.from('staff_users').update({ last_login: new Date().toISOString() }).eq('id', data.id);

      return {
        ok: true,
        user: {
          id:       data.id,
          name:     data.name,
          username: data.username,
          role:     data.role,
          phone:    data.phone
        }
      };
    },

    // ── savePublicSettings ────────────────────────────────────────────────────
    async savePublicSettings({ data: d } = {}) {
      const upserts = Object.entries(d).map(([key, value]) => ({ key, value: String(value ?? '') }));
      const { error } = await sb.from('settings').upsert(upserts, { onConflict: 'key' });
      if (error) throw error;
      return { ok: true };
    }

  };

  // ════════════════════════════════════════════════════════════════════════════
  //  Mappers – تحويل أسماء الأعمدة الإنجليزية ← عربية
  // ════════════════════════════════════════════════════════════════════════════

  function mapPackage(r) {
    return {
      id:              r.id,
      title:           r.title,
      description:     r.description,
      price:           r.price || 0,
      order:           r.display_order,
      enabled:         r.enabled,
      registerEnabled: r.register_enabled,
      imageFileId:     r.image_file_id,
      imageUrl:        r.image_url
    };
  }

  function mapYear(r) {
    return {
      id:             r.id,
      year:           r.year,
      title:          r.title,
      description:    r.description,
      participants:   r.participants,
      activities:     r.activities,
      order:          r.display_order,
      enabled:        r.enabled,
      driveFolderId:  r.drive_folder_id,
      driveFolderUrl: r.drive_folder_url,
      youtubeLinks:   r.youtube_links || [],
      media:          (r.year_media || [])
        .sort((a, b) => a.display_order - b.display_order)
        .map(m => ({
          id:      m.id,
          type:    m.type,
          url:     m.url,
          fileId:  m.file_id,
          title:   m.caption || '',
          caption: m.caption || '',
          order:   m.display_order,
          enabled: true
        }))
    };
  }

  function mapApplication(r) {
    // الفاتورة - Supabase يرجع array من invoices
    const inv = Array.isArray(r.invoices) ? (r.invoices[0] || {}) : (r.invoices || {});
    return {
      id:                r.id,
      applicationNo:     r.application_no,
      name:              r.student_name,
      studentIdentity:   r.student_identity,
      passportNo:        r.passport_no,
      city:              r.city,
      school:            r.school,
      grade:             r.grade,
      age:               r.age,
      hobbies:           r.hobbies,
      academicLevel:     r.academic_level,
      englishLevel:      r.english_level,
      healthStatus:      r.health_status,
      studentPhone:      r.student_phone,
      guardianPhone:     r.guardian_phone,
      guardianIdentity:  r.guardian_identity,
      category:          r.category,
      source:            r.source,
      applicationStatus: r.application_status,
      rejectionReason:   r.rejection_reason,
      generalNotes:      r.general_notes,
      passportImageUrl:  r.passport_image_path,
      introVideoUrl:     r.intro_video_path,
      assignedTeacherId: r.assigned_teacher_id,
      assignedTeacher:   r.staff_users?.name || '',
      teacherName:       r.staff_users?.name || '',   // للكرت في admin
      paymentStatus:     r.payment_status || r.application_status || '',
      paidAmount:        r.paid_amount || 0,
      invoiceNo:         inv.invoice_no  || '',
      invoiceAmount:     inv.amount      || 0,
      invoiceUrl:        inv.invoice_no  ? `invoice.html?applicationNo=${encodeURIComponent(r.application_no)}` : '',
      submittedAt:       formatDate(r.submitted_at),
      updatedAt:         formatDate(r.updated_at)
    };
  }

  function mapApplicationFull(r) {
    const base = mapApplication(r);
    return {
      ...base,
      'رقم_الطلب':              r.application_no,
      'اسم_الطالب_الثلاثي':     r.student_name,
      'هوية_الطالب':            r.student_identity,
      'رقم_الجواز':             r.passport_no,
      'مدينة_السكن':            r.city,
      'المدرسة':                r.school,
      'الصف_الدراسي':           r.grade,
      'العمر_بالميلادي':        r.age,
      'مستوى_اللغة_الإنجليزية': r.english_level,
      'الحالة_الصحية':          r.health_status,
      'جوال_الابن':             r.student_phone,
      'جوال_ولي_الأمر':         r.guardian_phone,
      'هوية_ولي_الأمر':         r.guardian_identity,
      'الفئة':                  r.category,
      'حالة_الطلب':             r.application_status,
      'سبب_الرفض':              r.rejection_reason,
      'ملاحظات_عامة':           r.general_notes,
      // روابط Drive – صحيحة للعرض
      'صورة_الجواز_رابط':    buildDriveViewUrl(r.passport_image_path, r.passport_file_id),
      'فيديو_تعريفي_رابط':   buildDriveViewUrl(r.intro_video_path,   r.intro_video_file_id),
      'مجلد_الطلب_رابط':     r.drive_folder_id
        ? `https://drive.google.com/drive/folders/${r.drive_folder_id}`
        : '',
      passportImageUrl:  buildDriveViewUrl(r.passport_image_path, r.passport_file_id),
      introVideoUrl:     buildDriveViewUrl(r.intro_video_path,    r.intro_video_file_id)
    };
  }

  function mapUser(r) {
    return {
      id:        r.id,
      name:      r.name,
      username:  r.username,
      role:      r.role,
      status:    r.status,
      phone:     r.phone,
      lastLogin: formatDate(r.last_login),
      createdAt: formatDate(r.created_at)
    };
  }

  function mapLog(r) {
    const title  = r.new_status || r.action || '';
    const desc   = [
      r.notes   ? r.notes                              : '',
      r.actor   ? `بواسطة: ${r.actor}`                 : '',
      r.old_status && r.new_status
        ? `${r.old_status} ← ${r.new_status}` : ''
    ].filter(Boolean).join(' | ');

    return {
      id:          r.id,
      actor:       r.actor,
      action:      r.action,
      oldStatus:   r.old_status,
      newStatus:   r.new_status,
      notes:       r.notes,
      date:        formatDate(r.created_at),
      // حقول عربية يقرأها الكود القديم
      'الحالة':    title,
      'الوصف':     desc || r.action || '',
      'بواسطة':    r.actor || '',
      'التاريخ':   formatDate(r.created_at),
      'نوع_الحركة': r.action || ''
    };
  }

  // ─── بناء رابط عرض Drive مباشر (بدون طلب إذن) ──────────────────────────
  function buildDriveViewUrl(url, fileId) {
    const id = fileId || extractFileIdFromUrl(url);
    if (id) {
      // رابط preview مباشر لا يطلب إذن طالما الملف مشارك بـ "anyone with link"
      return `https://drive.google.com/file/d/${id}/preview`;
    }
    return url || '#';
  }

  function extractFileIdFromUrl(url) {
    if (!url) return '';
    const m = url.match(/\/file\/d\/([^/]+)/) || url.match(/[?&]id=([^&]+)/);
    return m ? m[1] : '';
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function toBool(v) {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') return ['true', '1', 'yes', 'نعم', 'مفعل'].includes(v.toLowerCase());
    return !!v;
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' });
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  واجهة APP_API المتوافقة مع الكود القديم
  //  بدلاً من fetch(API_URL, ...) استخدم APP_API.call(action, params)
  // ════════════════════════════════════════════════════════════════════════════

  window.APP_API = {
    /**
     * استدعاء action
     * @param {string} action
     * @param {object} params  – نفس البنية التي كانت ترسل لـ Apps Script
     * @returns {Promise<object>}  – نفس شكل الرد { ok, data, ... }
     */
    async call(action, params = {}) {
      const fn = actions[action];
      if (!fn) return { ok: false, message: `Action غير معروف: ${action}` };
      try {
        return await fn(params);
      } catch (e) {
        console.error(`[APP_API] ${action}:`, e);
        return { ok: false, message: e.message || 'حدث خطأ' };
      }
    },

    // وصول مباشر لـ Supabase client للاستخدامات المتقدمة
    get db() { return sb; }
  };

})(window);
