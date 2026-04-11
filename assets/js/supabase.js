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
    async getPackages({ includeHidden } = {}) {
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
    async getYears({ includeHidden } = {}) {
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
      const mediaList = d['الوسائط'] || [];

      // احذف القديم وأعد الإدراج
      await sb.from('year_media').delete().eq('year_id', yearId);

      if (mediaList.length) {
        const rows = mediaList.map((m, i) => ({
          year_id: yearId,
          type: m.type || 'image',
          url: m.url || '',
          file_id: m.fileId || '',
          caption: m.caption || '',
          display_order: i
        }));
        const { error } = await sb.from('year_media').insert(rows);
        if (error) throw error;
      }

      return { ok: true };
    },

    // ── submitRegistration ────────────────────────────────────────────────────
    async submitRegistration({ data: d }) {
      const applicationNo = generateApplicationNo();
      const studentName   = d['اسم_الطالب_الثلاثي'] || 'طالب';

      // ── رفع الملفات لـ Google Drive ──────────────────────────────────────
      let passportUrl    = '';
      let passportFileId = '';
      let videoUrl       = '';
      let videoFileId    = '';
      let appFolderId    = '';
      let appFolderPath  = '';

      try {
        const uploadResult = await uploadFilesToDrive(
          studentName,
          applicationNo,
          d['صورة_الجواز'] || null,
          d['فيديو_تعريفي'] || null
        );

        if (uploadResult.passportFile) {
          passportUrl    = uploadResult.passportFile.url    || '';
          passportFileId = uploadResult.passportFile.fileId || '';
        }
        if (uploadResult.videoFile) {
          videoUrl    = uploadResult.videoFile.url    || '';
          videoFileId = uploadResult.videoFile.fileId || '';
        }
        appFolderId   = uploadResult.appFolderId   || '';
        appFolderPath = uploadResult.appFolderPath || '';
      } catch (uploadErr) {
        // لا توقف التسجيل إذا فشل الرفع – سجّل الخطأ فقط
        console.error('خطأ في رفع الملفات:', uploadErr);
      }

      // ── حفظ الطلب في Supabase ────────────────────────────────────────────
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
        // روابط Drive
        passport_image_path: passportUrl,
        passport_file_id:    passportFileId,
        intro_video_path:    videoUrl,
        intro_video_file_id: videoFileId,
        drive_folder_id:     appFolderId,
        drive_folder_path:   appFolderPath
      }).select('id').single();

      if (error) throw error;

      await logAction(inserted.id, 'النظام', 'تم إرسال الطلب', null, 'تسجيل أولي', 'طلب جديد');

      return { ok: true, applicationNo, data: { applicationNo } };
    },

    // ── getApplications ───────────────────────────────────────────────────────
    async getApplications({ stage, status, search, category } = {}) {
      let q = sb.from('applications').select('*, staff_users(name)').order('submitted_at', { ascending: false });

      if (stage === 'registration') {
        q = q.in('application_status', ['تسجيل أولي', 'تحت المراجعة']);
      } else if (stage === 'payment') {
        q = q.in('application_status', ['مقبول مبدئيًا وبانتظار السداد', 'سداد جزئي', 'مؤجل السداد']);
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
      const { data, error } = await sb.from('applications')
        .select('*, application_logs(*), staff_users(name)')
        .eq('application_no', applicationNo)
        .single();
      if (error) throw error;

      return {
        ok: true,
        data: {
          application: mapApplicationFull(data),
          timeline: (data.application_logs || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).map(mapLog)
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

      // اجلب بيانات الطلب لرسالة الواتساب
      const { data: app } = await sb.from('applications')
        .select('guardian_phone, student_name, application_no')
        .eq('application_no', d['رقم_الطلب']).single();

      // اجلب رسالة القبول من الإعدادات
      const { data: settingRow } = await sb.from('settings').select('value').eq('key', 'رسالة_قبول_أولي').single();
      let msg = (settingRow?.value || 'مرحباً، تم قبول طلبكم مبدئياً في برنامج Live English 🎉\nرقم الطلب: {رقم_الطلب}')
        .replace('{اسم_الطالب}', app?.student_name || '')
        .replace('{رقم_الطلب}', app?.application_no || '');

      const phone = (app?.guardian_phone || '').replace(/\D/g, '').replace(/^0/, '966');
      const whatsappUrl = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` : null;

      return { ok: true, data: { whatsappUrl } };
    },

    // ── getWhatsappMessage ────────────────────────────────────────────────────
    async getWhatsappMessage({ applicationNo, type } = {}) {
      const { data: app } = await sb.from('applications')
        .select('guardian_phone, student_name, application_no')
        .eq('application_no', applicationNo).single();

      const keyMap = {
        'acceptance': 'رسالة_قبول_أولي',
        'payment_reminder': 'رسالة_تذكير_السداد',
        'paid': 'رسالة_السداد_المكتمل'
      };

      const { data: settingRow } = await sb.from('settings').select('value').eq('key', keyMap[type] || 'رسالة_قبول_أولي').single();
      let msg = (settingRow?.value || '')
        .replace('{اسم_الطالب}', app?.student_name || '')
        .replace('{رقم_الطلب}', app?.application_no || '');

      const phone = (app?.guardian_phone || '').replace(/\D/g, '').replace(/^0/, '966');
      const whatsappUrl = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` : null;

      return { ok: true, data: { whatsappUrl, message: msg } };
    },

    // ── savePaymentAction ─────────────────────────────────────────────────────
    async savePaymentAction({ actor, data: d } = {}) {
      const { data: app } = await sb.from('applications')
        .select('id,application_status,paid_amount,guardian_phone,student_name,application_no,category')
        .eq('application_no', d['رقم_الطلب']).single();
      if (!app) throw new Error('الطلب غير موجود');

      const newPaid   = Number(d['المبلغ_المدفوع'] || 0);
      const newStatus = d['حالة_الطلب'];
      const total     = Number(d['المبلغ_الإجمالي'] || 0);

      const { error } = await sb.from('applications').update({
        application_status: newStatus,
        paid_amount: newPaid,
        updated_at: new Date().toISOString()
      }).eq('id', app.id);
      if (error) throw error;

      await logAction(app.id, actor, 'عملية سداد', app.application_status, newStatus,
        `المبلغ المدفوع: ${newPaid} | الإجمالي: ${total}`);

      // أنشئ فاتورة إذا اكتمل السداد
      if (newStatus === 'مكتمل السداد') {
        const invoiceNo = generateInvoiceNo();
        await sb.from('invoices').insert({
          invoice_no: invoiceNo,
          application_id: app.id,
          application_no: app.application_no,
          student_name: app.student_name,
          category: app.category,
          amount: total || newPaid
        });
        return { ok: true, data: { invoiceNo } };
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
      const { data: app } = await sb.from('applications').select('id').eq('application_no', d['رقم_الطلب']).single();
      if (!app) throw new Error('الطلب غير موجود');

      const { error } = await sb.from('applications').update({
        assigned_teacher_id: d['معرف_المعلم'],
        application_status: 'طالب نشط',
        updated_at: new Date().toISOString()
      }).eq('id', app.id);
      if (error) throw error;

      await logAction(app.id, actor, 'تسكين الطالب', null, 'طالب نشط', `تم التسكين لدى المعلم`);
      return { ok: true };
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
      const { data: app } = await sb.from('applications').select('id').eq('application_no', d['رقم_الطلب']).single();
      if (!app) throw new Error('الطلب غير موجود');

      const { data: teacher } = await sb.from('staff_users').select('id').eq('name', actor).single();

      const { error } = await sb.from('teacher_reports').insert({
        application_id: app.id,
        teacher_id: teacher?.id || null,
        teacher_name: actor || '',
        report_text: d['نص_التقرير'] || '',
        grade: d['التقدير'] || ''
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
      price:           r.price,
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
      media:          (r.year_media || []).map(m => ({
        id:     m.id,
        type:   m.type,
        url:    m.url,
        fileId: m.file_id,
        caption: m.caption,
        order:  m.display_order
      }))
    };
  }

  function mapApplication(r) {
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
      paymentStatus:     r.payment_status,
      paidAmount:        r.paid_amount,
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
      'صورة_الجواز_رابط':       r.passport_image_path,
      'فيديو_تعريفي_رابط':      r.intro_video_path
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
    return {
      id:        r.id,
      actor:     r.actor,
      action:    r.action,
      oldStatus: r.old_status,
      newStatus: r.new_status,
      notes:     r.notes,
      date:      formatDate(r.created_at)
    };
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
