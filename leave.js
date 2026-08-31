/*═══════════════════════════════════════════════════════════════
  leave.js — Frontend ระบบลางาน (เฟส 1)
  แยกจาก index.html เพื่อไม่กระทบระบบบันทึกเวลาเดิม
  ใช้ฟังก์ชันกลางจาก index.html: gasRun, go, showToast, S (state)

  โหลดหลัง index.html <script> หลัก (ต้องมี gasRun/S/go พร้อมก่อน)
  ผูก event ใน initLeaveBindings() เรียกตอนท้าย
═══════════════════════════════════════════════════════════════*/

// state ของระบบลา (แยก namespace กันชนกับของเดิม)
const LV = {
  types: [],            // ประเภทการลา (cache จาก server)
  myRequests: [],       // ประวัติของฉัน
  pending: [],          // รายการรออนุมัติ
  currentReject: null,  // requestId ที่กำลังจะปฏิเสธ
  report: [],           // ผลรายงาน (หน้ารายงาน)
  reportCanVoid: false, // ผู้ใช้ปัจจุบันยกเลิกใบลาได้ไหม (HR)
  currentVoid: null,    // requestId ที่กำลังจะยกเลิกโดย HR
};

// ป้ายชื่อสถานะ (ไทย) + สี
const LV_STATUS = {
  PENDING_L1: { text: 'รออนุมัติ (หัวหน้าแผนก)', cls: 'lv-wait' },
  PENDING_L2: { text: 'รออนุมัติ (ผู้จัดการ)',   cls: 'lv-wait' },
  PENDING_HR: { text: 'รออนุมัติ (ฝ่ายบุคคล)',   cls: 'lv-wait' },
  APPROVED:   { text: 'อนุมัติแล้ว',             cls: 'lv-ok' },
  REJECTED:   { text: 'ไม่อนุมัติ',              cls: 'lv-no' },
  CANCELLED:  { text: 'ยกเลิกแล้ว',              cls: 'lv-no' },
  VOIDED:     { text: 'ยกเลิกโดย HR',            cls: 'lv-no' },
};

// ป้ายชื่อโหมดการลา
const LV_MODE = {
  FULL:    'เต็มวัน',
  HALF_AM: 'ครึ่งเช้า',
  HALF_PM: 'ครึ่งบ่าย',
  HOURLY:  'รายชั่วโมง',
};

function lvEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// map TypeID → ชื่อไทย (จาก LV.types)
function lvTypeName(id) {
  const t = LV.types.find(x => x.id === id);
  return t ? t.name : id;
}

// ═══════════════ หน้า "ขอลา" ═══════════════

// โหลดประเภทการลาลง dropdown (เรียกตอนเปิดหน้าขอลา)
function loadLeaveForm() {
  // reset ฟอร์ม (เคลียร์ทีละช่อง)
  ['lv-date-from','lv-date-to','lv-hourly','lv-reason','lv-file'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const modeEl = document.getElementById('lv-mode'); if (modeEl) modeEl.value = '';
  const fileInput = document.getElementById('lv-file-input'); if (fileInput) fileInput.value = '';
  const fileStatus = document.getElementById('lv-file-status'); if (fileStatus) fileStatus.textContent = '';
  const prev = document.getElementById('lv-preview'); if (prev) prev.style.display = 'none';
  document.getElementById('lv-hourly-wrap').style.display = 'none';

  // โหลดประเภท (ถ้ายังไม่มี cache)
  if (LV.types.length > 0) { lvFillTypes(); return; }
  const sel = document.getElementById('lv-type');
  sel.innerHTML = '<option>กำลังโหลด...</option>';
  gasRun('leaveGetTypes', { hrToken: S.hrToken })
    .withSuccessHandler(r => {
      if (!r || !r.success) { showToast((r && r.message) || 'โหลดประเภทการลาไม่สำเร็จ'); return; }
      LV.types = r.types || [];
      lvFillTypes();
    })
    .withFailureHandler(e => showToast('เกิดข้อผิดพลาด: ' + (e && e.message ? e.message : e)));
}

function lvFillTypes() {
  const sel = document.getElementById('lv-type');
  if (!LV.types.length) { sel.innerHTML = '<option value="">— ไม่มีประเภทการลา —</option>'; return; }
  sel.innerHTML = '<option value="">— เลือกประเภท —</option>' +
    LV.types.map(t => `<option value="${lvEsc(t.id)}">${lvEsc(t.name)}${t.maxDays ? ` (สิทธิ์ ${t.maxDays} วัน)` : ''}</option>`).join('');
}

// ── อัปโหลดไฟล์แนบ (รูป/PDF) ──
function lvOnFilePick() {
  const input = document.getElementById('lv-file-input');
  const status = document.getElementById('lv-file-status');
  const hidden = document.getElementById('lv-file');
  hidden.value = '';
  if (!input.files || !input.files[0]) { status.textContent = ''; return; }

  const file = input.files[0];
  // จำกัดชนิด
  const okType = /^image\//.test(file.type) || file.type === 'application/pdf';
  if (!okType) { status.textContent = 'รองรับเฉพาะรูปภาพหรือ PDF'; status.style.color = 'var(--er)'; input.value = ''; return; }
  // จำกัดขนาด 10MB
  if (file.size > 10 * 1024 * 1024) { status.textContent = 'ไฟล์ใหญ่เกิน 10MB'; status.style.color = 'var(--er)'; input.value = ''; return; }

  status.textContent = 'กำลังเตรียมไฟล์...'; status.style.color = 'var(--tx3)';

  // รูปภาพ → ย่อขนาดก่อนอัปโหลด (ประหยัด Drive) / PDF → อัปโหลดตามเดิม
  if (/^image\//.test(file.type)) {
    lvResizeImage(file, 1280, 0.82, (dataUrl, mime) => {
      lvDoUpload(dataUrl, file.name, mime, status, hidden);
    });
  } else {
    const reader = new FileReader();
    reader.onload = () => lvDoUpload(reader.result, file.name, file.type, status, hidden);
    reader.onerror = () => { status.textContent = 'อ่านไฟล์ไม่สำเร็จ'; status.style.color = 'var(--er)'; };
    reader.readAsDataURL(file);
  }
}

// ย่อรูปด้วย canvas — คงสัดส่วน, ด้านยาวสุดไม่เกิน maxDim, บีบอัด JPEG
function lvResizeImage(file, maxDim, quality, cb) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w >= h) { h = Math.round(h * maxDim / w); w = maxDim; }
        else        { w = Math.round(w * maxDim / h); h = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      // PNG ที่มีความโปร่งใสจะกลายเป็นพื้นขาว แต่สำหรับใบลา/เอกสารไม่มีปัญหา
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      cb(dataUrl, 'image/jpeg');
    };
    img.onerror = () => cb(reader.result, file.type);   // ย่อไม่ได้ ใช้ต้นฉบับ
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

// อัปโหลดจริง (ใช้ร่วมทั้งรูปที่ย่อแล้วและ PDF)
function lvDoUpload(dataUrl, fileName, mimeType, status, hidden) {
  status.textContent = 'กำลังอัปโหลด...'; status.style.color = 'var(--tx3)';
  gasRun('leaveUploadFile', {
    hrToken: S.hrToken, fileData: dataUrl, fileName: fileName, mimeType: mimeType,
  })
    .withSuccessHandler(r => {
      if (!r || !r.success) { status.textContent = (r && r.message) || 'อัปโหลดไม่สำเร็จ'; status.style.color = 'var(--er)'; return; }
      hidden.value = r.fileUrl;
      status.textContent = '✓ แนบไฟล์แล้ว'; status.style.color = 'var(--ok)';
    })
    .withFailureHandler(e => { status.textContent = 'อัปโหลดไม่สำเร็จ'; status.style.color = 'var(--er)'; });
}

// เปลี่ยนโหมดการลา → แสดง/ซ่อนช่อง + อัปเดตสรุปเวลา
function lvOnModeChange() {
  const mode = document.getElementById('lv-mode').value;
  const hourlyWrap = document.getElementById('lv-hourly-wrap');
  const datetoWrap = document.getElementById('lv-dateto-wrap');

  // HOURLY = แสดงช่องเวลา + ซ่อนช่อง "ถึงวันที่" (ลาชั่วโมง = วันเดียว)
  hourlyWrap.style.display = (mode === 'HOURLY') ? 'block' : 'none';
  // ครึ่งวัน/ชั่วโมง = วันเดียว ซ่อน "ถึงวันที่"
  const singleDay = (mode === 'HALF_AM' || mode === 'HALF_PM' || mode === 'HOURLY');
  datetoWrap.style.visibility = singleDay ? 'hidden' : 'visible';

  lvUpdatePreview();
}

// อัปเดตข้อความสรุปช่วงเวลาที่จะลา (ตามโหมด)
function lvUpdatePreview() {
  const mode = document.getElementById('lv-mode').value;
  const prev = document.getElementById('lv-preview');
  const df = document.getElementById('lv-date-from').value;
  if (!mode || !df) { prev.style.display = 'none'; return; }

  const fmt = (d) => {
    const [y,m,dd] = d.split('-');
    return `${dd}/${m}/${y}`;
  };
  const dt = document.getElementById('lv-date-to').value || df;
  let text = '';

  if (mode === 'FULL') {
    // นับจำนวนวัน (รวมวันแรก) — มีประโยชน์กับลายาว เช่นลาคลอด
    const d1 = new Date(df + 'T00:00:00');
    const d2 = new Date(dt + 'T00:00:00');
    const days = Math.floor((d2 - d1) / 86400000) + 1;
    const dayText = (days > 1) ? ` · ${days} วัน` : '';
    text = `${fmt(df)} (08:30) – ${fmt(dt)} (18:00) · เต็มวัน${dayText}`;
  } else if (mode === 'HALF_AM') {
    text = `${fmt(df)} (08:30) – ${fmt(df)} (12:00) · ครึ่งวันเช้า 3.5 ชม.`;
  } else if (mode === 'HALF_PM') {
    text = `${fmt(df)} (13:00) – ${fmt(df)} (18:00) · ครึ่งวันบ่าย 5 ชม.`;
  } else if (mode === 'HOURLY') {
    const tf = document.getElementById('lv-time-from').value;
    const tt = document.getElementById('lv-time-to').value;
    if (tf && tt) {
      const hrs = lvCalcHourlyClient(tf, tt);
      text = `${fmt(df)} (${tf}) – ${fmt(df)} (${tt}) · ${hrs > 0 ? hrs + ' ชม.' : 'เวลาไม่ถูกต้อง'}`;
    } else {
      text = 'กรุณาเลือกเวลาเริ่ม-สิ้นสุด';
    }
  }
  prev.textContent = text;
  prev.style.display = 'block';
}

// คำนวณชั่วโมงฝั่ง client (หักพักเที่ยง 12:00-13:00) — โชว์ preview เท่านั้น server คำนวณจริง
function lvCalcHourlyClient(tf, tt) {
  const [h1,m1] = tf.split(':').map(Number);
  const [h2,m2] = tt.split(':').map(Number);
  let s = h1*60+m1, e = h2*60+m2;
  if (e <= s) return 0;
  const overlap = Math.max(0, Math.min(e,780) - Math.max(s,720));
  return +((e - s - overlap)/60).toFixed(2);
}

// ส่งคำขอลา
function submitLeave() {
  const btn = document.getElementById('lv-submit');
  const leaveType = document.getElementById('lv-type').value;
  const dateFrom  = document.getElementById('lv-date-from').value;
  const dateTo    = document.getElementById('lv-date-to').value || dateFrom;
  const mode      = document.getElementById('lv-mode').value;
  const timeFrom  = document.getElementById('lv-time-from') ? document.getElementById('lv-time-from').value : '';
  const timeTo    = document.getElementById('lv-time-to') ? document.getElementById('lv-time-to').value : '';
  const reason    = document.getElementById('lv-reason').value.trim();
  const fileUrl   = document.getElementById('lv-file').value.trim();

  // ตรวจเบื้องต้นฝั่ง client (server ตรวจซ้ำ)
  if (!leaveType) { showToast('กรุณาเลือกประเภทการลา'); return; }
  if (!dateFrom)  { showToast('กรุณาเลือกวันที่ลา'); return; }
  if (!mode)      { showToast('กรุณาเลือกรูปแบบการลา'); return; }
  if (!reason)    { showToast('กรุณากรอกเหตุผลการลา'); return; }
  if (mode === 'HOURLY' && (!timeFrom || !timeTo)) {
    showToast('กรุณาเลือกเวลาเริ่มและสิ้นสุด'); return;
  }
  // ครึ่งวัน/รายชั่วโมง = วันเดียว (บังคับ dateTo = dateFrom)
  const singleDay = (mode === 'HALF_AM' || mode === 'HALF_PM' || mode === 'HOURLY');
  const finalDateTo = singleDay ? dateFrom : dateTo;

  btn.disabled = true; btn.textContent = 'กำลังส่ง...';
  gasRun('leaveSubmit', {
    hrToken: S.hrToken,
    leaveType, dateFrom, dateTo: finalDateTo, mode,
    timeFrom: mode === 'HOURLY' ? timeFrom : '',
    timeTo:   mode === 'HOURLY' ? timeTo : '',
    reason, fileUrl,
  })
    .withSuccessHandler(r => {
      btn.disabled = false; btn.textContent = 'ส่งคำขอลา';
      if (!r || !r.success) { showToast((r && r.message) || 'ส่งคำขอไม่สำเร็จ'); return; }
      showToast('ส่งคำขอลาเรียบร้อย (' + r.hoursText + ')', true);
      go('leave-history');   // ไปหน้าประวัติ
    })
    .withFailureHandler(e => {
      btn.disabled = false; btn.textContent = 'ส่งคำขอลา';
      showToast('เกิดข้อผิดพลาด: ' + (e && e.message ? e.message : e));
    });
}

// ═══════════════ หน้า "ประวัติการลา" ═══════════════

function loadLeaveHistory() {
  const box = document.getElementById('lv-history-list');
  const sum = document.getElementById('lv-history-summary');
  box.innerHTML = '<div style="text-align:center;padding:20px;color:var(--tx3)">กำลังโหลด...</div>';
  if (sum) sum.innerHTML = '';   // ไม่ใช้การ์ดสรุปแยกแล้ว (รวมเข้าการ์ดอนุมัติแล้ว)

  gasRun('leaveGetMyRequests', { hrToken: S.hrToken })
    .withSuccessHandler(r => {
      if (!r || !r.success) { box.innerHTML = '<div style="padding:20px;color:var(--er)">' + lvEsc((r && r.message) || 'โหลดไม่สำเร็จ') + '</div>'; return; }
      LV.myRequests = r.requests || [];
      lvRenderHistory(LV.myRequests, r.summary || {});
    })
    .withFailureHandler(e => { box.innerHTML = '<div style="padding:20px;color:var(--er)">เกิดข้อผิดพลาด</div>'; });
}

// format ช่วงรอบ yyyy-MM-dd → dd/mm/yyyy
function lvFmtCycle(s) { if (!s) return ''; const [y,m,d] = s.split('-'); return `${d}/${m}/${y}`; }

function lvRenderHistory(list, summary) {
  const box = document.getElementById('lv-history-list');
  summary = summary || {};
  if (!list.length) {
    box.innerHTML = '<div style="text-align:center;padding:30px;color:var(--tx3)">ยังไม่มีประวัติการลา</div>';
    return;
  }

  // แยก 3 กลุ่ม: รออนุมัติ (แยกการ์ด), อนุมัติแล้ว (รวมตามประเภท), ปฏิเสธ (ไม่แสดง)
  const pending = list.filter(r => r.status.indexOf('PENDING') === 0);
  const approved = list.filter(r => r.status === 'APPROVED');

  let html = '';

  // ── รออนุมัติ: แยกการ์ดแต่ละรายการ ──
  if (pending.length) {
    html += '<div style="font-size:13px;font-weight:600;margin-bottom:8px;color:#c47d0a">รออนุมัติ</div>';
    html += pending.map(r => lvHistoryCard(r)).join('');
  }

  // ── อนุมัติแล้ว: รวมการ์ดตามประเภท (ยอด+รอบมาจาก summary ที่นับถูกตามรอบ) ──
  // แสดงเฉพาะรายการในรอบปัจจุบัน (inCycle) เพื่อให้ยอดหัวการ์ดตรงกับรายการย่อย
  // ดูข้ามปี/เลือกช่วง → เมนูรายงานการลา (ทำเพิ่มภายหลัง)
  const approvedInCycle = approved.filter(r => r.inCycle);
  if (approvedInCycle.length) {
    const byType = {};
    approvedInCycle.forEach(r => { (byType[r.leaveType] = byType[r.leaveType] || []).push(r); });

    html += '<div style="font-size:13px;font-weight:600;margin:16px 0 8px">อนุมัติแล้ว (รอบปัจจุบัน)</div>';
    Object.keys(byType).forEach(type => {
      const items = byType[type];
      const s = summary[type] || {};
      // ยอดรวม "ในรอบ" จาก server (ถ้าไม่มี = 0 วัน)
      const totalText = s.text || '0 ชม.';
      const cycle = (s.cycleStart && s.cycleEnd) ? `${lvFmtCycle(s.cycleStart)} – ${lvFmtCycle(s.cycleEnd)}` : '';

      html += `<div class="lv-card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:2px">
          <div style="font-weight:600">${lvEsc(lvTypeName(type))}: ${lvEsc(totalText)}</div>
          <span class="lv-badge lv-ok">อนุมัติแล้ว</span>
        </div>
        ${cycle ? `<div style="font-size:11px;color:var(--tx3);margin-bottom:8px">รอบ ${lvEsc(cycle)}</div>` : '<div style="margin-bottom:8px"></div>'}
        <div style="display:flex;flex-direction:column;gap:6px">
          ${items.map(r => `<div style="font-size:13px;color:var(--tx2);padding-left:8px;border-left:2px solid var(--bd)">
            ${lvEsc(lvFormatRange(r))} · ${lvEsc(LV_MODE[r.mode] || r.mode)} · ${lvEsc(r.hoursText)}
          </div>`).join('')}
        </div>
      </div>`;
    });
  }

  if (!html) html = '<div style="text-align:center;padding:30px;color:var(--tx3)">ยังไม่มีรายการ</div>';
  box.innerHTML = html;

  // ผูกปุ่มยกเลิก (สร้างใหม่ทุกครั้งที่ render)
  box.querySelectorAll('.lv-cancel-btn').forEach(b => {
    b.addEventListener('click', () => cancelLeave(b.getAttribute('data-id')));
  });
}

// ยกเลิกคำขอของตัวเอง (เฉพาะที่ยังรออนุมัติ)
function cancelLeave(reqId) {
  if (!reqId) return;
  if (!confirm('ยืนยันยกเลิกคำขอลานี้?')) return;
  gasRun('leaveCancel', { hrToken: S.hrToken, requestId: reqId })
    .withSuccessHandler(r => {
      if (!r || !r.success) { showToast((r && r.message) || 'ยกเลิกไม่สำเร็จ'); return; }
      showToast('ยกเลิกคำขอเรียบร้อย', true);
      loadLeaveHistory();
    })
    .withFailureHandler(e => showToast('เกิดข้อผิดพลาด'));
}

// การ์ดรายการเดี่ยว (สำหรับรออนุมัติ)
function lvHistoryCard(r) {
  const st = LV_STATUS[r.status] || { text: r.status, cls: '' };
  const canCancel = r.status.indexOf('PENDING') === 0;
  return `<div class="lv-card">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
      <div style="font-weight:600">${lvEsc(lvTypeName(r.leaveType))}</div>
      <span class="lv-badge ${st.cls}">${lvEsc(st.text)}</span>
    </div>
    <div style="font-size:13px;color:var(--tx2);margin-top:4px">
      ${lvEsc(lvFormatRange(r))} · ${lvEsc(LV_MODE[r.mode] || r.mode)} · ${lvEsc(r.hoursText)}
    </div>
    <div style="font-size:13px;margin-top:6px">${lvEsc(r.reason)}</div>
    ${lvStepper(r.status)}
    ${r.fileUrl ? `<a href="${lvEsc(r.fileUrl)}" target="_blank" style="font-size:12px;color:var(--ac)">📎 ไฟล์แนบ</a>` : ''}
    ${canCancel ? `<div style="margin-top:10px"><button class="btn o sm lv-cancel-btn" data-id="${lvEsc(r.requestId)}" style="width:auto;padding:5px 14px;font-size:12px">ยกเลิกคำขอ</button></div>` : ''}
  </div>`;
}

// แถบแสดงขั้นตอนการอนุมัติ — ไฮไลต์ว่าอยู่ขั้นไหน
//  ขั้น: หัวหน้า → ผู้จัดการ → บุคคล → เสร็จ
function lvStepper(status) {
  const steps = [
    { key: 'L1', label: 'หัวหน้า' },
    { key: 'L2', label: 'ผู้จัดการ' },
    { key: 'HR', label: 'บุคคล' },
    { key: 'DONE', label: 'อนุมัติ' },
  ];
  // ขั้นที่กำลังรอ (index) — ขั้นก่อนหน้าถือว่าผ่านแล้ว
  let activeIdx;
  if (status === 'PENDING_L1') activeIdx = 0;
  else if (status === 'PENDING_L2') activeIdx = 1;
  else if (status === 'PENDING_HR') activeIdx = 2;
  else if (status === 'APPROVED') activeIdx = 4;   // ผ่านหมด
  else return '';   // REJECTED/CANCELLED/VOIDED ไม่แสดง stepper

  const dots = steps.map((s, i) => {
    let bg, col;
    if (i < activeIdx) { bg = 'var(--ok)'; col = '#fff'; }          // ผ่านแล้ว
    else if (i === activeIdx) { bg = '#c47d0a'; col = '#fff'; }     // กำลังรอ
    else { bg = 'var(--sf2)'; col = 'var(--tx3)'; }                 // ยังไม่ถึง
    const line = i < steps.length - 1 ? `<div style="flex:1;height:2px;background:${i < activeIdx ? 'var(--ok)' : 'var(--bd)'};margin:0 2px"></div>` : '';
    return `<div style="display:flex;align-items:center;${i < steps.length-1 ? 'flex:1' : ''}">
      <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
        <div style="width:18px;height:18px;border-radius:50%;background:${bg};color:${col};font-size:10px;display:flex;align-items:center;justify-content:center">${i < activeIdx ? '✓' : (i+1)}</div>
        <div style="font-size:9px;color:var(--tx3);white-space:nowrap">${s.label}</div>
      </div>
      ${line}
    </div>`;
  }).join('');

  return `<div style="display:flex;align-items:center;margin-top:10px;padding-top:8px;border-top:1px solid var(--bd)">${dots}</div>`;
}

// format ช่วงวันเวลาแบบ dd/mm/yyyy (HH:mm) ตามโหมด
function lvFormatRange(r) {
  const fmt = (d) => { if (!d) return ''; const [y,m,dd] = d.split('-'); return `${dd}/${m}/${y}`; };
  const df = fmt(r.dateFrom), dt = fmt(r.dateTo);
  if (r.mode === 'FULL')    return `${df} (08:30) – ${dt} (18:00)`;
  if (r.mode === 'HALF_AM') return `${df} (08:30) – ${df} (12:00)`;
  if (r.mode === 'HALF_PM') return `${df} (13:00) – ${df} (18:00)`;
  if (r.mode === 'HOURLY')  return `${df} (${r.timeFrom || '?'}) – ${df} (${r.timeTo || '?'})`;
  return `${df} – ${dt}`;
}


// ═══════════════ หน้า "รออนุมัติ" (ผู้อนุมัติ) ═══════════════

function loadLeaveApprovals() {
  const box = document.getElementById('lv-approval-list');
  box.innerHTML = '<div style="text-align:center;padding:20px;color:var(--tx3)">กำลังโหลด...</div>';

  gasRun('leaveGetPendingApprovals', { hrToken: S.hrToken })
    .withSuccessHandler(r => {
      if (!r || !r.success) { box.innerHTML = '<div style="padding:20px;color:var(--er)">' + lvEsc((r && r.message) || 'โหลดไม่สำเร็จ') + '</div>'; return; }
      LV.pending = r.requests || [];
      lvRenderApprovals(LV.pending);
    })
    .withFailureHandler(e => { box.innerHTML = '<div style="padding:20px;color:var(--er)">เกิดข้อผิดพลาด</div>'; });
}

function lvRenderApprovals(list) {
  const box = document.getElementById('lv-approval-list');
  if (!list.length) {
    box.innerHTML = '<div style="text-align:center;padding:30px;color:var(--tx3)">ไม่มีคำขอรออนุมัติ</div>';
    return;
  }
  // แถบเครื่องมือ: เลือกทั้งหมด + อนุมัติที่เลือก
  let html = `<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding:10px 12px;background:var(--sf2);border-radius:8px">
    <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">
      <input type="checkbox" id="lv-check-all" style="width:16px;height:16px"> เลือกทั้งหมด
    </label>
    <button class="btn sm" id="lv-approve-selected" style="width:auto;padding:6px 16px;font-size:13px;margin-left:auto;background:var(--ok)">อนุมัติที่เลือก</button>
  </div>`;

  html += list.map(r => {
    const dr = lvFormatRange(r);
    return `<div class="lv-card">
      <div style="display:flex;gap:10px">
        <input type="checkbox" class="lv-appr-check" data-id="${lvEsc(r.requestId)}" style="width:17px;height:17px;margin-top:2px;flex-shrink:0">
        <div style="flex:1">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
            <div>
              <div style="font-weight:600">${lvEsc(r.empName)} <span style="color:var(--tx3);font-weight:400;font-size:12px">(${lvEsc(r.empId)})</span></div>
              <div style="font-size:13px;color:var(--ac);margin-top:2px">${lvEsc(lvTypeName(r.leaveType))}</div>
            </div>
          </div>
          <div style="font-size:16px;font-weight:600;color:var(--tx1);margin-top:8px;padding:8px 10px;background:var(--sf2);border-radius:6px">⏱ ${lvEsc(dr)} · ${lvEsc(LV_MODE[r.mode] || r.mode)} · <span style="color:var(--ac)">${lvEsc(r.hoursText)}</span></div>
          <div style="font-size:13px;margin-top:6px;padding:8px;background:var(--sf2);border-radius:6px">${lvEsc(r.reason)}</div>
          ${r.fileUrl ? `<a href="${lvEsc(r.fileUrl)}" target="_blank" style="font-size:12px;color:var(--ac)">📎 ไฟล์แนบ</a>` : ''}
          <div style="font-size:14px;margin-top:8px;padding:7px 10px;border-radius:6px;background:${(r.attIn || r.attOut) ? 'rgba(196,125,10,.1)' : 'var(--sf2)'};color:${(r.attIn || r.attOut) ? '#c47d0a' : 'var(--tx3)'};font-weight:${(r.attIn || r.attOut) ? '600' : '400'}">
            เวลาเข้า/ออกจริง: ${(r.attIn || r.attOut) ? lvEsc((r.attIn || '—') + ' - ' + (r.attOut || '—')) + ' ⚠️' : 'ไม่มี'}
          </div>
          <div style="display:flex;gap:8px;margin-top:10px">
            <button class="btn sm lv-approve-btn" data-id="${lvEsc(r.requestId)}" style="width:auto;padding:5px 16px;font-size:13px;background:var(--ok)">อนุมัติ</button>
            <button class="btn o sm lv-reject-btn" data-id="${lvEsc(r.requestId)}" style="width:auto;padding:5px 16px;font-size:13px;color:var(--er);border-color:var(--er)">ไม่อนุมัติ</button>
            <button class="btn o sm lv-apcancel-btn" data-id="${lvEsc(r.requestId)}" style="width:auto;padding:5px 14px;font-size:13px;color:var(--tx2)">ยกเลิกให้</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');

  box.innerHTML = html;

  // ผูก event
  box.querySelectorAll('.lv-approve-btn').forEach(b => b.addEventListener('click', () => approveLeave(b.getAttribute('data-id'))));
  box.querySelectorAll('.lv-reject-btn').forEach(b => b.addEventListener('click', () => openRejectDialog(b.getAttribute('data-id'))));
  box.querySelectorAll('.lv-apcancel-btn').forEach(b => b.addEventListener('click', () => cancelByApprover(b.getAttribute('data-id'))));

  const chkAll = document.getElementById('lv-check-all');
  if (chkAll) chkAll.addEventListener('change', () => {
    box.querySelectorAll('.lv-appr-check').forEach(c => { c.checked = chkAll.checked; });
  });
  const btnSel = document.getElementById('lv-approve-selected');
  if (btnSel) btnSel.addEventListener('click', approveSelected);
}

// อนุมัติหลายรายการที่เลือก (ทีละอันแบบต่อเนื่อง)
function approveSelected() {
  const ids = Array.from(document.querySelectorAll('.lv-appr-check:checked')).map(c => c.getAttribute('data-id'));
  if (!ids.length) { showToast('กรุณาเลือกรายการที่ต้องการอนุมัติ'); return; }
  if (!confirm(`ยืนยันอนุมัติ ${ids.length} รายการที่เลือก?`)) return;

  let done = 0, failed = 0;
  const next = (i) => {
    if (i >= ids.length) {
      showToast(`อนุมัติสำเร็จ ${done} รายการ` + (failed ? ` (ไม่สำเร็จ ${failed})` : ''), true);
      loadLeaveApprovals();
      return;
    }
    gasRun('leaveApprove', { hrToken: S.hrToken, requestId: ids[i] })
      .withSuccessHandler(r => { if (r && r.success) done++; else failed++; next(i + 1); })
      .withFailureHandler(() => { failed++; next(i + 1); });
  };
  next(0);
}

function approveLeave(reqId) {
  if (!reqId) return;
  gasRun('leaveApprove', { hrToken: S.hrToken, requestId: reqId })
    .withSuccessHandler(r => {
      if (!r || !r.success) { showToast((r && r.message) || 'อนุมัติไม่สำเร็จ'); return; }
      showToast(r.message || 'อนุมัติเรียบร้อย', true);
      loadLeaveApprovals();   // refresh
    })
    .withFailureHandler(e => showToast('เกิดข้อผิดพลาด'));
}

// ── ผู้อนุมัติยกเลิกใบลาให้พนักงาน (กรณีพนักงานขอยกเลิกแต่เลยขั้นแรกมาแล้ว) ──
function cancelByApprover(reqId) {
  if (!reqId) return;
  const reason = prompt('ยกเลิกใบลาให้พนักงาน\nระบุเหตุผล (จำเป็น):', '');
  if (reason === null) return;   // กด cancel
  if (!reason.trim()) { showToast('กรุณากรอกเหตุผล'); return; }
  gasRun('leaveCancelByApprover', { hrToken: S.hrToken, requestId: reqId, cancelReason: reason.trim() })
    .withSuccessHandler(r => {
      if (!r || !r.success) { showToast((r && r.message) || 'ยกเลิกไม่สำเร็จ'); return; }
      showToast('ยกเลิกใบลาเรียบร้อย', true);
      loadLeaveApprovals();
    })
    .withFailureHandler(e => showToast('เกิดข้อผิดพลาด'));
}

// ── ปฏิเสธ: เปิด dialog กรอกเหตุผล ──
function openRejectDialog(reqId) {
  LV.currentReject = reqId;
  document.getElementById('lv-reject-reason').value = '';
  document.getElementById('lv-reject-overlay').style.display = 'flex';
}

function closeRejectDialog() {
  LV.currentReject = null;
  document.getElementById('lv-reject-overlay').style.display = 'none';
}

function confirmReject() {
  const reason = document.getElementById('lv-reject-reason').value.trim();
  if (!reason) { showToast('กรุณาระบุเหตุผลที่ไม่อนุมัติ'); return; }
  if (!LV.currentReject) return;

  gasRun('leaveReject', { hrToken: S.hrToken, requestId: LV.currentReject, rejectReason: reason })
    .withSuccessHandler(r => {
      closeRejectDialog();
      if (!r || !r.success) { showToast((r && r.message) || 'ปฏิเสธไม่สำเร็จ'); return; }
      showToast('ปฏิเสธคำขอเรียบร้อย', true);
      loadLeaveApprovals();
    })
    .withFailureHandler(e => { closeRejectDialog(); showToast('เกิดข้อผิดพลาด'); });
}

// ═══════════════ หน้า "รายงานการลา" ═══════════════

function loadLeaveReport() {
  // โหลดประเภทลงตัวกรอง (ใช้ cache ถ้ามี)
  const typeSel = document.getElementById('lvr-f-type');
  if (typeSel) {
    const fill = () => {
      typeSel.innerHTML = '<option value="">ทุกประเภท</option>' +
        LV.types.map(t => `<option value="${lvEsc(t.id)}">${lvEsc(t.name)}</option>`).join('');
    };
    if (LV.types.length) fill();
    else gasRun('leaveGetTypes', { hrToken: S.hrToken })
      .withSuccessHandler(r => { if (r && r.success) { LV.types = r.types || []; fill(); } });
  }
  // ตั้งค่าวันเริ่มต้น: ต้นเดือน - วันนี้
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const fmt = (d) => d.toISOString().slice(0,10);
  const fFrom = document.getElementById('lvr-f-from');
  const fTo = document.getElementById('lvr-f-to');
  if (fFrom && !fFrom.value) fFrom.value = fmt(first);
  if (fTo && !fTo.value) fTo.value = fmt(today);

  // ดึงรายชื่อทีมทันที (เบา เร็ว) เติม dropdown — ยังไม่ดึงข้อมูลการลา
  const sel = document.getElementById('lvr-f-emp');
  if (sel) sel.innerHTML = '<option value="">กำลังโหลดรายชื่อ...</option>';
  gasRun('leaveGetMyTeam', { hrToken: S.hrToken })
    .withSuccessHandler(r => {
      if (r && r.success) {
        LV.reportCanVoid = !!r.canVoid;
        lvFillTeamDropdown(r.team || []);
      } else if (sel) {
        sel.innerHTML = '<option value="">เลือกชื่อพนักงาน</option>';
      }
    })
    .withFailureHandler(() => { if (sel) sel.innerHTML = '<option value="">เลือกชื่อพนักงาน</option>'; });

  // แสดงข้อความรอค้นหา (ยังไม่ดึงข้อมูลการลา)
  const box = document.getElementById('lvr-result');
  if (box) box.innerHTML = '<div style="text-align:center;padding:30px;color:var(--tx3)">เลือกเงื่อนไขแล้วกด “ค้นหา” เพื่อดูรายงาน</div>';
}

function runLeaveReport() {
  const box = document.getElementById('lvr-result');
  box.innerHTML = '<div style="text-align:center;padding:20px;color:var(--tx3)">กำลังโหลด...</div>';

  const empVal = document.getElementById('lvr-f-emp').value;
  const payload = {
    hrToken: S.hrToken,
    empIds:    empVal ? [empVal] : null,
    leaveType: document.getElementById('lvr-f-type').value,
    status:    document.getElementById('lvr-f-status').value,
    dateFrom:  document.getElementById('lvr-f-from').value,
    dateTo:    document.getElementById('lvr-f-to').value,
  };

  gasRun('leaveGetReport', payload)
    .withSuccessHandler(r => {
      if (!r || !r.success) { box.innerHTML = '<div style="padding:20px;color:var(--er)">' + lvEsc((r && r.message) || 'โหลดไม่สำเร็จ') + '</div>'; return; }
      LV.report = r.rows || [];
      LV.reportCanVoid = !!r.canVoid;
      lvRenderReport(LV.report);
    })
    .withFailureHandler(e => { box.innerHTML = '<div style="padding:20px;color:var(--er)">เกิดข้อผิดพลาด</div>'; });
}

// เติม dropdown ชื่อพนักงาน (คงค่าที่เลือกไว้)
function lvFillTeamDropdown(list) {
  const sel = document.getElementById('lvr-f-emp');
  if (!sel) return;
  const people = Array.isArray(list) ? list : [];

  // มีคนเดียว (ตัวเอง) = พนักงานทั่วไป → ซ่อน dropdown
  const wrap = sel.parentElement;
  if (people.length <= 1) { if (wrap) wrap.style.display = 'none'; return; }
  if (wrap) wrap.style.display = '';

  const cur = sel.value;
  sel.innerHTML = '<option value="">ทุกคน</option>' +
    people.map(m => `<option value="${lvEsc(m.id)}">${lvEsc(m.name || m.id)} (${lvEsc(m.id)})</option>`).join('');
  if (cur) sel.value = cur;
}

function lvRenderReport(rows) {
  const box = document.getElementById('lvr-result');
  if (!rows.length) {
    box.innerHTML = '<div style="text-align:center;padding:30px;color:var(--tx3)">ไม่พบข้อมูลตามเงื่อนไข</div>';
    return;
  }
  // สรุปจำนวน + ปุ่ม export
  let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
    <div style="font-size:14px;color:var(--tx2)">พบ ${rows.length} รายการ · แตะแถวเพื่อดูรายละเอียด</div>
    <button class="btn sm" id="lvr-export" style="width:auto;padding:6px 16px;font-size:13px">↓ Excel (CSV)</button>
  </div>`;

  // ตาราง
  html += `<div style="overflow-x:auto;border:1px solid var(--bd);border-radius:12px">
    <table style="width:100%;border-collapse:collapse;font-size:13px;white-space:nowrap">
    <thead><tr style="background:var(--sf2)">
      <th style="padding:9px 10px;text-align:left;position:sticky;left:0;background:var(--sf2)">พนักงาน</th>
      <th style="padding:9px 10px;text-align:left">ประเภท</th>
      <th style="padding:9px 10px;text-align:left">ช่วงลา</th>
      <th style="padding:9px 10px;text-align:center">เวลาเข้า/ออก</th>
      <th style="padding:9px 10px;text-align:center">สถานะ</th>
    </tr></thead><tbody>`;

  rows.forEach((r, idx) => {
    const st = LV_STATUS[r.status] || { text: r.status, cls: '' };
    const hasAtt = (r.attIn || r.attOut);
    const attTxt = hasAtt ? ((r.attIn || '—') + ' - ' + (r.attOut || '—')) : 'ไม่มี';
    // แถวหลัก (แตะได้)
    html += `<tr class="lvr-row" data-idx="${idx}" style="border-top:1px solid var(--bd);cursor:pointer">
      <td style="padding:8px 10px;position:sticky;left:0;background:var(--bg)">
        <div style="font-weight:600">${lvEsc(r.empName)}</div>
        <div style="font-size:11px;color:var(--tx3)">${lvEsc(r.empId)}</div>
      </td>
      <td style="padding:8px 10px;color:var(--ac)">${lvEsc(lvTypeName(r.leaveType))}</td>
      <td style="padding:8px 10px">
        <div>${lvEsc(lvFormatRange(r))}</div>
        <div style="font-size:11px;color:var(--tx3)">${lvEsc(LV_MODE[r.mode] || r.mode)} · ${lvEsc(r.hoursText)}</div>
      </td>
      <td style="padding:8px 10px;text-align:center;color:${hasAtt ? '#c47d0a' : 'var(--tx3)'}">${lvEsc(attTxt)}${hasAtt ? ' ⚠️' : ''}</td>
      <td style="padding:8px 10px;text-align:center"><span class="lv-badge ${st.cls}">${lvEsc(st.text)}</span></td>
    </tr>`;
    // แถวรายละเอียด (ซ่อนไว้ แตะแถวหลักเพื่อเปิด)
    const chain = [];
    if (r.l1By) chain.push(`หัวหน้า: ${lvEsc(r.l1By)}${r.l1At ? ' (' + lvEsc(lvShortDT(r.l1At)) + ')' : ''}`);
    if (r.l2By) chain.push(`ผู้จัดการ: ${lvEsc(r.l2By)}${r.l2At ? ' (' + lvEsc(lvShortDT(r.l2At)) + ')' : ''}`);
    if (r.hrBy) chain.push(`บุคคล: ${lvEsc(r.hrBy)}${r.hrAt ? ' (' + lvEsc(lvShortDT(r.hrAt)) + ')' : ''}`);
    if (r.rejectBy) chain.push(`ปฏิเสธ/ยกเลิก: ${lvEsc(r.rejectBy)}`);
    const canVoid = LV.reportCanVoid && (r.status === 'APPROVED' || r.status.indexOf('PENDING') === 0);
    html += `<tr class="lvr-detail" data-detail="${idx}" style="display:none;background:var(--sf)">
      <td colspan="5" style="padding:12px 14px;border-top:1px solid var(--bd);white-space:normal">
        <div style="font-size:13px;margin-bottom:6px"><b>เหตุผล:</b> ${lvEsc(r.reason || '—')}</div>
        ${chain.length ? `<div style="font-size:12px;color:var(--tx2);margin-bottom:6px">${chain.join(' · ')}</div>` : ''}
        <div style="font-size:11px;color:var(--tx3);margin-bottom:6px">เลขที่: ${lvEsc(r.requestId)} · ยื่น ${lvEsc(lvShortDT(r.createdAt))}</div>
        ${r.fileUrl ? `<a href="${lvEsc(r.fileUrl)}" target="_blank" style="font-size:12px;color:var(--ac)">📎 ไฟล์แนบ</a>` : ''}
        ${canVoid ? `<div style="margin-top:8px"><button class="btn o sm lvr-void-btn" data-id="${lvEsc(r.requestId)}" style="width:auto;padding:5px 14px;font-size:12px;color:var(--er);border-color:var(--er)">ยกเลิกใบลา</button></div>` : ''}
      </td>
    </tr>`;
  });
  html += '</tbody></table></div>';

  box.innerHTML = html;

  // ผูกปุ่ม + แตะแถวขยาย
  const exp = document.getElementById('lvr-export');
  if (exp) exp.addEventListener('click', exportReportCSV);
  box.querySelectorAll('.lvr-row').forEach(row => {
    row.addEventListener('click', () => {
      const idx = row.getAttribute('data-idx');
      const detail = box.querySelector('.lvr-detail[data-detail="' + idx + '"]');
      if (detail) detail.style.display = (detail.style.display === 'none') ? 'table-row' : 'none';
    });
  });
  box.querySelectorAll('.lvr-void-btn').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); openVoidDialog(b.getAttribute('data-id')); }));
}

// ย่อ datetime "yyyy-MM-dd HH:mm:ss" → "dd/MM/yyyy HH:mm"
function lvShortDT(s) {
  if (!s) return '';
  const m = String(s).match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`;
  return String(s);
}

// ── ส่งออก CSV (เปิดใน Excel, รองรับไทยด้วย UTF-8 BOM) ──
function exportReportCSV() {
  if (!LV.report.length) { showToast('ไม่มีข้อมูลให้ส่งออก'); return; }
  const head = ['เลขที่','รหัส','ชื่อ','ประเภท','เริ่ม','ถึง','เวลา','รูปแบบ','ชั่วโมง','สถานะ','เหตุผล',
                'อนุมัติหัวหน้า','เวลา','อนุมัติผู้จัดการ','เวลา','อนุมัติบุคคล','เวลา','ปฏิเสธ/ยกเลิกโดย','วันที่ยื่น'];
  const esc = (v) => {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
  };
  const lines = [head.join(',')];
  LV.report.forEach(r => {
    const timeRange = (r.mode === 'HOURLY' && r.timeFrom) ? `${r.timeFrom}-${r.timeTo}` : '';
    lines.push([
      r.requestId, r.empId, r.empName, lvTypeName(r.leaveType),
      lvFmtCycle(r.dateFrom), lvFmtCycle(r.dateTo), timeRange,
      LV_MODE[r.mode] || r.mode, r.hours,
      (LV_STATUS[r.status] || {text:r.status}).text, r.reason,
      r.l1By, r.l1At, r.l2By, r.l2At, r.hrBy, r.hrAt, r.rejectBy, r.createdAt,
    ].map(esc).join(','));
  });
  const csv = '\uFEFF' + lines.join('\r\n');   // BOM ให้ Excel อ่านไทยถูก
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'leave-report-' + new Date().toISOString().slice(0,10) + '.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── HR ยกเลิกใบลา (void) ──
function openVoidDialog(reqId) {
  LV.currentVoid = reqId;
  document.getElementById('lvr-void-reason').value = '';
  document.getElementById('lvr-void-overlay').style.display = 'flex';
}
function closeVoidDialog() {
  LV.currentVoid = null;
  document.getElementById('lvr-void-overlay').style.display = 'none';
}
function confirmVoid() {
  const reason = document.getElementById('lvr-void-reason').value.trim();
  if (!reason) { showToast('กรุณาระบุเหตุผลที่ยกเลิก'); return; }
  if (!LV.currentVoid) return;
  gasRun('leaveVoidByHR', { hrToken: S.hrToken, requestId: LV.currentVoid, voidReason: reason })
    .withSuccessHandler(r => {
      closeVoidDialog();
      if (!r || !r.success) { showToast((r && r.message) || 'ยกเลิกไม่สำเร็จ'); return; }
      showToast('ยกเลิกใบลาเรียบร้อย', true);
      runLeaveReport();
    })
    .withFailureHandler(e => { closeVoidDialog(); showToast('เกิดข้อผิดพลาด'); });
}

// ═══════════════ ผูก event (เรียกตอนโหลดเสร็จ) ═══════════════
function initLeaveBindings() {
  const on = (id, evt, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(evt, fn); };

  // เมนู
  on('tab-leave', 'click', () => go('leave-form'));
  on('tab-leave-appr', 'click', () => go('leave-approve'));
  on('hr-menu-leave-approve', 'click', () => go('leave-approve'));
  on('menu-leave-request', 'click', () => go('leave-form'));
  on('menu-leave-history', 'click', () => go('leave-history'));

  // หน้าขอลา
  on('lv-mode', 'change', lvOnModeChange);
  on('lv-date-from', 'change', lvUpdatePreview);
  on('lv-date-to', 'change', lvUpdatePreview);
  on('lv-time-from', 'change', lvUpdatePreview);
  on('lv-time-to', 'change', lvUpdatePreview);
  on('lv-file-input', 'change', lvOnFilePick);
  on('lv-submit', 'click', submitLeave);
  on('lv-to-history', 'click', () => go('leave-history'));

  // หน้าประวัติ
  on('lv-to-form', 'click', () => go('leave-form'));

  // dialog ปฏิเสธ
  on('lv-reject-cancel', 'click', closeRejectDialog);
  on('lv-reject-confirm', 'click', confirmReject);

  // หน้ารายงาน
  on('lvr-run', 'click', runLeaveReport);
  on('lvr-void-cancel', 'click', closeVoidDialog);
  on('lvr-void-confirm', 'click', confirmVoid);
  on('lv-to-report', 'click', () => go('leave-report'));
  on('lvr-back', 'click', () => go(S.role === 'HR' ? 'hr-dash' : 'history'));
  on('hr-menu-leave-report', 'click', () => go('leave-report'));
  on('tab-leave-report', 'click', () => go('leave-report'));

  // back buttons
  on('lv-form-back', 'click', () => go(S.role === 'HR' ? 'hr-dash' : 'history'));
  on('lv-history-back', 'click', () => go(S.role === 'HR' ? 'hr-dash' : 'history'));
  on('lv-approve-back', 'click', () => go(S.role === 'HR' ? 'hr-dash' : 'history'));
  on('lv-approve-refresh', 'click', () => { if (typeof loadLeaveApprovals === 'function') loadLeaveApprovals(); });
}