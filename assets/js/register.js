const API_URL = window.APP_CONFIG.API_URL;

let currentStep = 1;
const totalSteps = 5;
let initDataCache = { packages: [], lookups: {} };

const form = document.getElementById('registrationForm');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const submitBtn = document.getElementById('submitBtn');
const stepIndicator = document.getElementById('stepIndicator');
const reviewContainer = document.getElementById('reviewContainer');

const englishLevelSelect = document.getElementById('englishLevelSelect');
const packageSelect = document.getElementById('packageSelect');
const packageAmount = document.getElementById('packageAmount');

const passportFile = document.getElementById('passportFile');
const introVideoFile = document.getElementById('introVideoFile');
const passportFileName = document.getElementById('passportFileName');
const videoFileName = document.getElementById('videoFileName');

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  updateStepUI();
  await loadInitData();
});

function bindEvents() {
  prevBtn.addEventListener('click', goPrev);
  nextBtn.addEventListener('click', goNext);

  passportFile.addEventListener('change', () => {
    passportFileName.textContent = passportFile.files[0]?.name || 'لم يتم اختيار ملف بعد';
  });

  introVideoFile.addEventListener('change', () => {
    videoFileName.textContent = introVideoFile.files[0]?.name || 'لم يتم اختيار ملف بعد';
  });

  packageSelect.addEventListener('change', () => {
    const selected = initDataCache.packages.find(p => String(p.id) === String(packageSelect.value));
    packageAmount.value = selected ? Number(selected.price || 0) : '';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!(await validateStep(currentStep))) return;

    const confirmed = document.getElementById('confirmDataCheck').checked;
    if (!confirmed) {
      showWarn('يجب تأكيد صحة البيانات قبل الإرسال');
      return;
    }

    await submitRegistration();
  });
}

async function loadInitData() {
  try {
    const res = await fetch(`${API_URL}?action=initData`);
    const json = await res.json();

    initDataCache = json?.data || { packages: [], lookups: {} };
    fillLookups();
    fillPackages();
  } catch (error) {
    console.error(error);
    showError('تعذر تحميل البيانات الأساسية من النظام');
  }
}

function fillLookups() {
  const levels = initDataCache?.lookups?.['مستوى_اللغة_الإنجليزية'] || [];
  englishLevelSelect.innerHTML = '<option value="">اختر المستوى</option>' +
    levels.map(item => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.value)}</option>`).join('');
}

function fillPackages() {
  const packages = initDataCache.packages || [];
  packageSelect.innerHTML = '<option value="">اختر الباقة</option>' +
    packages
      .filter(p => p.registerEnabled !== false)
      .map(item => `<option value="${escapeHtml(item.id)}" data-price="${Number(item.price || 0)}">${escapeHtml(item.title)} - ${Number(item.price || 0).toLocaleString('en-US')} ر.س</option>`)
      .join('');
}

function goNext() {
  validateStep(currentStep).then(ok => {
    if (!ok) return;

    if (currentStep < totalSteps) {
      currentStep++;
      if (currentStep === 5) buildReview();
      updateStepUI();
    }
  });
}

function goPrev() {
  if (currentStep > 1) {
    currentStep--;
    updateStepUI();
  }
}

function updateStepUI() {
  document.querySelectorAll('.form-step').forEach(el => {
    el.classList.toggle('active', Number(el.dataset.step) === currentStep);
  });

  document.querySelectorAll('[data-step-pill]').forEach(el => {
    el.classList.toggle('active', Number(el.dataset.stepPill) === currentStep);
  });

  stepIndicator.textContent = `الخطوة ${currentStep} من ${totalSteps}`;

  prevBtn.style.visibility = currentStep === 1 ? 'hidden' : 'visible';
  nextBtn.classList.toggle('d-none', currentStep === totalSteps);
  submitBtn.classList.toggle('d-none', currentStep !== totalSteps);
}

async function validateStep(step) {
  const fields = [...document.querySelectorAll(`.form-step[data-step="${step}"] input, .form-step[data-step="${step}"] select, .form-step[data-step="${step}"] textarea`)];
  for (const field of fields) {
    if (field.hasAttribute('required') && !String(field.value || '').trim()) {
      showWarn(`يرجى تعبئة حقل: ${getFieldLabel(field)}`);
      field.focus();
      return false;
    }
  }

  if (step === 3) {
    const age = Number(form.elements['العمر_بالميلادي'].value || 0);
    const category = form.elements['الفئة'].value;

    if (category === 'شبال' && (age < 10 || age > 15)) {
      showWarn('فئة شبال يجب أن يكون العمر فيها من 10 إلى 15 سنة');
      return false;
    }

    if (category === 'قادة' && (age < 16 || age > 20)) {
      showWarn('فئة قادة يجب أن يكون العمر فيها من 16 إلى 20 سنة');
      return false;
    }
  }

  if (step === 4) {
    if (!passportFile.files.length) {
      showWarn('يرجى رفع صورة الجواز');
      return false;
    }

    if (!introVideoFile.files.length) {
      showWarn('يرجى رفع الفيديو التعريفي');
      return false;
    }
  }

  return true;
}

function buildReview() {
  const data = collectFormData();
  const items = [
    ['اسم الطالب', data['اسم_الطالب_الثلاثي']],
    ['هوية الطالب', data['هوية_الطالب']],
    ['رقم الجواز', data['رقم_الجواز']],
    ['مدينة السكن', data['مدينة_السكن']],
    ['المدرسة', data['المدرسة']],
    ['الصف الدراسي', data['الصف_الدراسي']],
    ['العمر', data['العمر_بالميلادي']],
    ['مستوى اللغة', data['مستوى_اللغة_الإنجليزية']],
    ['جوال الابن', data['جوال_الابن']],
    ['جوال ولي الأمر', data['جوال_ولي_الأمر']],
    ['هوية ولي الأمر', data['هوية_ولي_الأمر']],
    ['الفئة', data['الفئة']],
    ['الباقة', getSelectedText(packageSelect)],
    ['مبلغ الباقة', data['مبلغ_الباقة'] ? `${Number(data['مبلغ_الباقة']).toLocaleString('en-US')} ر.س` : ''],
    ['صورة الجواز', passportFile.files[0]?.name || '—'],
    ['الفيديو التعريفي', introVideoFile.files[0]?.name || '—']
  ];

  reviewContainer.innerHTML = items.map(([key, value]) => `
    <div class="summary-item">
      <div class="summary-key">${escapeHtml(key)}</div>
      <div class="summary-value">${escapeHtml(value || '—')}</div>
    </div>
  `).join('');
}

function collectFormData() {
  return {
    'اسم_الطالب_الثلاثي': form.elements['اسم_الطالب_الثلاثي'].value.trim(),
    'هوية_الطالب': form.elements['هوية_الطالب'].value.trim(),
    'رقم_الجواز': form.elements['رقم_الجواز'].value.trim(),
    'مدينة_السكن': form.elements['مدينة_السكن'].value.trim(),
    'المدرسة': form.elements['المدرسة'].value.trim(),
    'الصف_الدراسي': form.elements['الصف_الدراسي'].value.trim(),
    'العمر_بالميلادي': form.elements['العمر_بالميلادي'].value.trim(),
    'الهوايات': form.elements['الهوايات'].value.trim(),
    'المستوى_الدراسي': form.elements['المستوى_الدراسي'].value.trim(),
    'مستوى_اللغة_الإنجليزية': form.elements['مستوى_اللغة_الإنجليزية'].value,
    'الحالة_الصحية': form.elements['الحالة_الصحية'].value.trim(),
    'جوال_الابن': form.elements['جوال_الابن'].value.trim(),
    'جوال_ولي_الأمر': form.elements['جوال_ولي_الأمر'].value.trim(),
    'هوية_ولي_الأمر': form.elements['هوية_ولي_الأمر'].value.trim(),
    'الفئة': form.elements['الفئة'].value,
    'كيف_عرفت_عن_البرنامج': form.elements['كيف_عرفت_عن_البرنامج'].value.trim(),
    'الباقة': getSelectedText(packageSelect),
    'مبلغ_الباقة': packageAmount.value || ''
  };
}

async function submitRegistration() {
  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الإرسال...';

    const data = collectFormData();

    data['صورة_الجواز'] = await fileToBase64Object(passportFile.files[0]);
    data['فيديو_تعريفي'] = await fileToBase64Object(introVideoFile.files[0]);

    const payload = {
      action: 'submitRegistration',
      data
    };

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    const json = await res.json();

    if (json.status !== 'ok') {
      showError(json.message || 'تعذر إرسال الطلب');
      return;
    }

    await Swal.fire({
      icon: 'success',
      title: 'تم إرسال الطلب بنجاح',
      html: `
        <div style="line-height:2">
          <div>رقم الطلب:</div>
          <div style="font-size:1.4rem;font-weight:900;color:#58595b">${escapeHtml(json.applicationNo || '')}</div>
          <div style="margin-top:10px">احتفظ برقم الطلب للمتابعة لاحقًا.</div>
        </div>
      `,
      confirmButtonText: 'رائع',
      confirmButtonColor: '#fbc70d'
    });

    form.reset();
    packageAmount.value = '';
    passportFileName.textContent = 'لم يتم اختيار ملف بعد';
    videoFileName.textContent = 'لم يتم اختيار ملف بعد';
    currentStep = 1;
    reviewContainer.innerHTML = '';
    document.getElementById('confirmDataCheck').checked = false;
    updateStepUI();
  } catch (error) {
    console.error(error);
    showError('حدث خطأ أثناء إرسال الطلب');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> إرسال الطلب';
  }
}

function fileToBase64Object(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file'));
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result || '';
      const base64 = String(result).split(',')[1] || '';
      const extension = (file.name.split('.').pop() || '').toLowerCase();

      resolve({
        base64,
        mimeType: file.type || 'application/octet-stream',
        extension
      });
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getSelectedText(select) {
  return select.options[select.selectedIndex]?.text || '';
}

function getFieldLabel(field) {
  const wrapper = field.closest('.col-md-6, .col-lg-6, .col-12, .col-lg-7, .col-lg-5');
  const label = wrapper?.querySelector('.form-label');
  return label ? label.textContent.trim() : 'الحقل المطلوب';
}

function showWarn(message) {
  Swal.fire({
    icon: 'warning',
    title: 'تنبيه',
    text: message,
    confirmButtonText: 'حسنًا',
    confirmButtonColor: '#fbc70d'
  });
}

function showError(message) {
  Swal.fire({
    icon: 'error',
    title: 'خطأ',
    text: message,
    confirmButtonText: 'إغلاق',
    confirmButtonColor: '#58595b'
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
