/* ═══════════════════════════════════════════════════════════════
 *  ot.js — Frontend ระบบ OT (SOM HR System)
 *  ยึดโครงจาก leave.js — ใช้ gasRun, S, go, showToast จาก index.html
 * ═══════════════════════════════════════════════════════════════ */

const OT = {
  types: [],
  myShift: 'A',
  myRequests: [],
  pending: [],
  report: [],
  reportCanVoid: false,
  team: [],
  isApprover: false,
  isHR: false,
  currentReject: null,
};

const OT_STATUS = {
  PENDING_L1: { text: 'รออนุมัติ (หัวหน้า)', cls: 'pending' },
  PENDING_L2: { text: 'รออนุมัติ (ผู้จัดการ)', cls: 'pending' },
  PENDING_HR: { text: 'รออนุมัติ (บุคคล)', cls: 'pending' },
  APPROVED:   { text: 'อนุมัติแล้ว', cls: 'approved' },
  REJECTED:   { text: 'ไม่อนุมัติ', cls: 'rejected' },
  CANCELLED:  { text: 'ยกเลิกแล้ว', cls: 'cancelled' },
  VOIDED:     { text: 'ถูกยกเลิก', cls: 'cancelled' },
};

function otEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function otTypeName(id) {
  const t = OT.types.find(x => x.id === id);
  return t ? t.name : id;
}
function otHoursText(h) {
  const n = Number(h) || 0;
  return n + ' ชม.';
}
// yyyy-MM-dd → dd/MM/yyyy
function otFmtDate(s) {
  if (!s) return '';
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}
// datetime → dd/MM/yyyy HH:mm
function otShortDT(s) {
  if (!s) return '';
  const m = String(s).match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : String(s);
}
// แสดงช่วง OT (รองรับข้ามวัน)
function otFormatRange(r) {
  const df = otFmtDate(r.dateFrom), dt = otFmtDate(r.dateTo);
  if (r.dateFrom === r.dateTo) {
    return `${df} ${r.timeFrom}-${r.timeTo}`;
  }
  return `${df} ${r.timeFrom} – ${dt} ${r.timeTo}`;
}

// ════════ ฟอร์มขอ OT ════════
function loadOTForm() {
  // โหลดประเภท OT
  const typeSel = document.getElementById('ot-type');
  const fillTypes = () => {
    if (!typeSel) return;
    typeSel.innerHTML = '<option value="">เลือกประเภท</option>' +
      OT.types.map(t => `<option value="${otEsc(t.id)}" data-rate="${t.rate}">${otEsc(t.name)} (${t.rate}x)</option>`).join('');
  };
  if (OT.types.length) fillTypes();
  else gasRun('otGetTypes', { hrToken: S.hrToken })
    .withSuccessHandler(r => { if (r && r.success) { OT.types = r.types || []; OT.myShift = r.myShift || 'A'; fillTypes(); } });

  // โหลดทีม (เผื่อหัวหน้าคีย์ให้ลูกทีม)
  gasRun('otGetMyTeam', { hrToken: S.hrToken })
    .withSuccessHandler(r => {
      if (r && r.success) {
        OT.team = r.team || [];
        OT.myShift = r.myShift || OT.myShift || 'A';
        OT.isApprover = !!r.isApprover;
        OT.isHR = !!r.isHR;
        otFillEmpDropdown();
      }
    });

  // reset ฟอร์ม
  ['ot-date-from','ot-time-from','ot-date-to','ot-time-to','ot-detail'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  OT.formFile = null;
  const fl = document.getElementById('ot-file-label'); if (fl) fl.textContent = 'แนบไฟล์ (ถ้ามี)';
  const prev = document.getElementById('ot-preview'); if (prev) prev.textContent = '';
}

// หากะของคนที่จะขอ OT (ถ้าหัวหน้าเลือกลูกทีม ใช้กะลูกทีม, ไม่งั้นกะตัวเอง)
function otTargetShift() {
  const empSel = document.getElementById('ot-emp');
  const empId = empSel ? empSel.value : '';
  if (empId) {
    const m = OT.team.find(x => x.id.toUpperCase() === empId.toUpperCase());
    if (m && m.shift) return m.shift;
  }
  return OT.myShift || 'A';
}

// วันนี้ / พรุ่งนี้ เป็น yyyy-MM-dd
function otToday() { const d = new Date(); return d.toISOString().slice(0, 10); }
function otTomorrow() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }

// set ค่า default ตามประเภท OT + กะ (2.1-2.3)
function otApplyTypeDefaults() {
  const otType = document.getElementById('ot-type').value;
  if (!otType) return;
  const shift = (otTargetShift() || 'A').toUpperCase();
  const isB = (shift === 'B');

  // หา grid ของประเภทที่เลือก (จากข้อมูลที่ backend ส่งมา) แล้วตั้งค่า dropdown/time
  const typeObj = OT.types.find(t => t.id === otType);
  OT._grid = (typeObj && typeObj.grid) ? typeObj.grid : null;
  otSetupTimeInputs(OT._grid);

  const df = document.getElementById('ot-date-from');
  const tf = document.getElementById('ot-time-from');
  const dt = document.getElementById('ot-date-to');
  const tt = document.getElementById('ot-time-to');
  const today = otToday();

  if (otType === 'HOLIDAY_WORK') {
    // ทำงานวันหยุด: A/CLEANING/DRIVER วันนี้ 08:30-18:00 / B วันนี้→พรุ่งนี้ 20:30-06:00
    if (isB) {
      df.value = today; dt.value = otTomorrow(); setTimeVal(tf, '20:30'); setTimeVal(tt, '06:00');
    } else {
      df.value = today; dt.value = today; setTimeVal(tf, '08:30'); setTimeVal(tt, '18:00');
    }
  } else {
    // NORMAL / NORMAL_BEFORE / HOLIDAY_OT / HOLIDAY_OT_BEFORE
    df.value = today; dt.value = today;
    // เวลาเริ่ม: ถ้ามี grid ไม่ preset (ให้เลือกเอง), ถ้าไม่มี grid ใช้ default เดิม
    if (!OT._grid) { setTimeVal(tf, isB ? '06:10' : '18:10'); }
    else { setTimeVal(tf, ''); }
    setTimeVal(tt, '');
  }
  // ถ้าเป็น dropdown + มีค่าเริ่ม → กรองเวลาเลิกให้สอดคล้อง
  if (tf.tagName === 'SELECT' && tf.value) otOnTimeFromChange();
  otUpdatePreview();
}

// set ค่าเวลาให้ input/select (select ต้อง option ตรงถึงติด)
function setTimeVal(el, val) {
  if (!el) return;
  el.value = val;
}

// แปลงช่องเวลาเป็น dropdown (ถ้าประเภทนี้มี grid) หรือคง type="time" (ถ้าไม่มี = คีย์เอง)
// grid = array ['HH:mm',...] หรือ null
function otSetupTimeInputs(grid) {
  const tf = document.getElementById('ot-time-from');
  const tt = document.getElementById('ot-time-to');
  if (!tf || !tt) return;

  if (!grid || !grid.length) {
    // ไม่มี grid → คืนเป็น input type="time" (คีย์เอง) ถ้าตอนนี้เป็น select อยู่
    if (tf.tagName === 'SELECT') otSwapToTime('ot-time-from');
    if (tt.tagName === 'SELECT') otSwapToTime('ot-time-to');
    return;
  }
  // มี grid → ทำเป็น dropdown
  otSwapToSelect('ot-time-from', grid, 'เลือกเวลาเริ่ม');
  // เวลาเลิก: ตอนแรกให้ทั้ง grid ไว้ก่อน (จะกรองตามเวลาเริ่มอีกที)
  otSwapToSelect('ot-time-to', grid, 'เลือกเวลาเลิก');
  OT._grid = grid;
}

// เปลี่ยน element เป็น <select> พร้อม options (คงค่า id/class เดิม)
function otSwapToSelect(id, times, placeholder) {
  const old = document.getElementById(id);
  if (!old) return;
  const sel = document.createElement('select');
  sel.id = id; sel.className = old.className;
  sel.innerHTML = `<option value="">${placeholder}</option>` +
    times.map(t => `<option value="${t}">${t}</option>`).join('');
  old.parentNode.replaceChild(sel, old);
  // bind: เปลี่ยนเวลาเริ่ม → กรองเวลาเลิก + preview
  if (id === 'ot-time-from') sel.addEventListener('change', otOnTimeFromChange);
  else sel.addEventListener('change', otUpdatePreview);
}

// เปลี่ยนกลับเป็น input type="time"
function otSwapToTime(id) {
  const old = document.getElementById(id);
  if (!old) return;
  const inp = document.createElement('input');
  inp.id = id; inp.className = old.className; inp.type = 'time';
  old.parentNode.replaceChild(inp, old);
  inp.addEventListener('input', otUpdatePreview);
}

// เมื่อเลือกเวลาเริ่ม → เวลาเลิกแสดงเฉพาะเวลา "หลัง" เวลาเริ่ม (ตามลำดับใน grid)
function otOnTimeFromChange() {
  const tf = document.getElementById('ot-time-from');
  const tt = document.getElementById('ot-time-to');
  if (!tf || !tt || tt.tagName !== 'SELECT' || !OT._grid) { otUpdatePreview(); return; }
  const startIdx = OT._grid.indexOf(tf.value);
  const cur = tt.value;
  // เวลาเลิก = เฉพาะ grid ที่อยู่ "หลัง" เวลาเริ่ม
  const opts = (startIdx >= 0) ? OT._grid.slice(startIdx + 1) : OT._grid;
  tt.innerHTML = `<option value="">เลือกเวลาเลิก</option>` +
    opts.map(t => `<option value="${t}">${t}</option>`).join('');
  if (opts.indexOf(cur) >= 0) tt.value = cur;   // คงค่าเดิมถ้ายังเลือกได้
  otUpdatePreview();
}

// dropdown เลือกพนักงาน (สำหรับหัวหน้า/HR คีย์ให้ลูกทีม)
function otFillEmpDropdown() {
  const wrap = document.getElementById('ot-emp-wrap');
  const sel = document.getElementById('ot-emp');
  if (!sel || !wrap) return;
  // พนักงานทั่วไป (ไม่ใช่ผู้อนุมัติ/HR) → ซ่อน คีย์ให้ตัวเองเท่านั้น
  if (!OT.isApprover && !OT.isHR) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';
  const selfName = S.name ? `${S.name} (ตัวเอง)` : 'ตัวเอง';
  sel.innerHTML = `<option value="">${otEsc(selfName)}</option>` +
    OT.team.filter(m => m.id.toUpperCase() !== S.empId.toUpperCase())
      .map(m => `<option value="${otEsc(m.id)}">${otEsc(m.name)} (${otEsc(m.id)})</option>`).join('');
}

// แสดง preview เวลา + ชั่วโมงโดยประมาณเมื่อกรอกครบ
function otUpdatePreview() {
  const df = document.getElementById('ot-date-from').value;
  const tf = document.getElementById('ot-time-from').value;
  let dt = document.getElementById('ot-date-to').value || df;
  const tt = document.getElementById('ot-time-to').value;
  const prev = document.getElementById('ot-preview');
  if (!prev) return;
  if (!df || !tf || !tt) { prev.textContent = ''; return; }

  const otCross = otIsOvernight(tf, tt);
  if (otCross && df === dt) {
    const dd = new Date(df + 'T00:00:00'); dd.setDate(dd.getDate() + 1);
    dt = dd.toISOString().slice(0, 10);
  }

  // คำนวณชั่วโมงคร่าวๆ ฝั่ง client (ตัดเศษ 30 นาที, ไม่รวมพักเที่ยง — server คำนวณจริงอีกที)
  const start = new Date(df + 'T' + tf + ':00');
  const end = new Date(dt + 'T' + tt + ':00');
  let diffMin = (end - start) / 60000;
  if (diffMin <= 0) { prev.innerHTML = '<span style="color:var(--er)">เวลาสิ้นสุดต้องหลังเวลาเริ่ม</span>'; return; }
  const hours = Math.floor(diffMin / 30) * 0.5;
  const crossDay = (otCross || df !== dt) ? ' (ข้ามวัน)' : '';
  prev.innerHTML = `ประมาณ <b>${hours}</b> ชม.${crossDay} <span style="color:var(--tx3)">(ฝ่ายบุคคลจะหักพักเที่ยงให้ถ้าเป็นงานวันหยุด)</span>`;
}

// ตรวจว่าคู่เวลานี้ข้ามคืนไหม (ดูลำดับใน grid)
function otIsOvernight(tf, tt) {
  if (!OT._grid || OT._grid.length === 0) return tt < tf;
  const iFrom = OT._grid.indexOf(tf);
  const iTo = OT._grid.indexOf(tt);
  if (iFrom < 0 || iTo < 0) return tt < tf;
  return (iTo > iFrom) && (tt <= tf);
}

// ส่งคำขอ OT
function submitOT() {
  const otType = document.getElementById('ot-type').value;
  const empId = (document.getElementById('ot-emp') || {}).value || '';
  const dateFrom = document.getElementById('ot-date-from').value;
  const timeFrom = document.getElementById('ot-time-from').value;
  let dateTo = document.getElementById('ot-date-to').value || dateFrom;
  const timeTo = document.getElementById('ot-time-to').value;
  const detail = document.getElementById('ot-detail').value.trim();

  if (!otType) { showToast('เลือกประเภท OT'); return; }
  if (!dateFrom || !timeFrom || !timeTo) { showToast('กรอกวันและเวลาให้ครบ'); return; }
  if (!detail) { showToast('กรุณากรอกรายละเอียดงานที่ทำ'); return; }

  // ข้ามคืนอัตโนมัติ: เวลาเลิกวนกลับ + วันเริ่ม=วันจบ → ตั้งวันจบเป็นวันถัดไป
  if (otIsOvernight(timeFrom, timeTo) && dateFrom === dateTo) {
    const dd = new Date(dateFrom + 'T00:00:00'); dd.setDate(dd.getDate() + 1);
    dateTo = dd.toISOString().slice(0, 10);
  }

  const btn = document.getElementById('ot-submit');
  if (btn) { btn.disabled = true; btn.textContent = 'กำลังส่ง...'; }

  const doSubmit = (fileUrl) => {
    gasRun('otSubmit', {
      hrToken: S.hrToken, empId: empId, otType: otType,
      dateFrom: dateFrom, timeFrom: timeFrom, dateTo: dateTo, timeTo: timeTo,
      detail: detail, fileUrl: fileUrl || '',
    })
      .withSuccessHandler(r => {
        if (btn) { btn.disabled = false; btn.textContent = 'ส่งคำขอ'; }
        if (!r || !r.success) { showToast((r && r.message) || 'ส่งไม่สำเร็จ'); return; }
        showToast('ส่งคำขอ OT แล้ว (' + r.hours + ' ชม.)', true);
        go(S.role === 'HR' ? 'hr-dash' : 'ot-history');
      })
      .withFailureHandler(() => { if (btn) { btn.disabled = false; btn.textContent = 'ส่งคำขอ'; } showToast('เกิดข้อผิดพลาด'); });
  };

  // อัปโหลดไฟล์ก่อน (ถ้ามี) — ใช้ leaveUploadFile ร่วมกับระบบลา
  if (OT.formFile) {
    gasRun('leaveUploadFile', { hrToken: S.hrToken, fileData: OT.formFile.data, fileName: OT.formFile.name, mimeType: OT.formFile.type })
      .withSuccessHandler(r => doSubmit(r && r.success ? r.url : ''))
      .withFailureHandler(() => doSubmit(''));
  } else {
    doSubmit('');
  }
}

// ════════ ประวัติ OT ของตัวเอง ════════
function loadOTHistory() {
  const box = document.getElementById('ot-history-list');
  if (box) box.innerHTML = '<div style="text-align:center;padding:20px;color:var(--tx3)">กำลังโหลด...</div>';
  // เช็คว่าเป็นผู้อนุมัติไหม → แสดงปุ่มอนุมัติ
  gasRun('otGetMyTeam', { hrToken: S.hrToken })
    .withSuccessHandler(r => {
      const btn = document.getElementById('ot-goto-approve');
      if (btn && r && r.success && (r.isApprover || r.isHR)) btn.style.display = '';
      else if (btn) btn.style.display = 'none';
    });
  // โหลดประเภทก่อน (ถ้ายังไม่มี) เพื่อแสดงชื่อ
  const load = () => gasRun('otGetMyRequests', { hrToken: S.hrToken })
    .withSuccessHandler(r => {
      if (!r || !r.success) { if (box) box.innerHTML = '<div style="padding:20px;color:var(--er)">โหลดไม่สำเร็จ</div>'; return; }
      OT.myRequests = r.requests || [];
      renderOTHistory(r);
    })
    .withFailureHandler(() => { if (box) box.innerHTML = '<div style="padding:20px;color:var(--er)">เกิดข้อผิดพลาด</div>'; });
  if (OT.types.length) load();
  else gasRun('otGetTypes', { hrToken: S.hrToken }).withSuccessHandler(r => { if (r && r.success) OT.types = r.types || []; load(); });
}

function renderOTHistory(r) {
  const box = document.getElementById('ot-history-list');
  if (!box) return;
  const reqs = OT.myRequests;
  if (!reqs.length) { box.innerHTML = '<div style="text-align:center;padding:30px;color:var(--tx3)">ยังไม่มีรายการ OT</div>'; return; }

  const pending = reqs.filter(x => x.status.indexOf('PENDING') === 0);
  const approved = reqs.filter(x => x.status === 'APPROVED');
  const others = reqs.filter(x => x.status.indexOf('PENDING') !== 0 && x.status !== 'APPROVED');

  let html = '';

  // รออนุมัติ
  if (pending.length) {
    html += '<div style="font-size:13px;font-weight:600;margin:4px 0 8px">รออนุมัติ</div>';
    html += pending.map(otHistoryCard).join('');
  }

  // อนุมัติแล้ว — รวมชั่วโมงตามประเภท (ปีปัจจุบัน)
  if (r.summary && Object.keys(r.summary).length) {
    html += `<div style="font-size:13px;font-weight:600;margin:14px 0 8px">อนุมัติแล้ว (ปี ${r.year})</div>`;
    Object.keys(r.summary).forEach(typeId => {
      const s = r.summary[typeId];
      const items = approved.filter(x => x.otType === typeId);
      html += `<div class="lv-card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-weight:600;color:var(--ac)">${otEsc(s.name)}</div>
          <div style="font-size:13px"><b>${s.hours}</b> ชม.</div>
        </div>
        <div style="margin-top:8px;display:flex;flex-direction:column;gap:6px">
          ${items.map(it => `<div style="font-size:12px;color:var(--tx2);display:flex;justify-content:space-between;border-top:1px solid var(--bd);padding-top:6px">
            <span>${otEsc(otFormatRange(it))}</span><span>${it.hours} ชม.</span></div>`).join('')}
        </div>
      </div>`;
    });
  }

  // อื่นๆ (ยกเลิก/ปฏิเสธ)
  if (others.length) {
    html += '<div style="font-size:13px;font-weight:600;margin:14px 0 8px;color:var(--tx3)">รายการอื่นๆ</div>';
    html += others.map(otHistoryCard).join('');
  }

  box.innerHTML = html;
  box.querySelectorAll('.ot-cancel-btn').forEach(b => b.addEventListener('click', () => otCancelRequest(b.getAttribute('data-id'))));
}

function otHistoryCard(r) {
  const st = OT_STATUS[r.status] || { text: r.status, cls: '' };
  const canCancel = r.status.indexOf('PENDING') === 0;
  return `<div class="lv-card">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
      <div style="font-weight:600">${otEsc(r.otTypeName)}</div>
      <span class="lv-badge ${st.cls}">${otEsc(st.text)}</span>
    </div>
    <div style="font-size:13px;color:var(--tx2);margin-top:4px">${otEsc(otFormatRange(r))} · ${otEsc(otHoursText(r.hours))}</div>
    ${r.detail ? `<div style="font-size:13px;margin-top:6px">${otEsc(r.detail)}</div>` : ''}
    ${otStepper(r.status)}
    ${r.fileUrl ? `<a href="${otEsc(r.fileUrl)}" target="_blank" style="font-size:12px;color:var(--ac)">📎 ไฟล์แนบ</a>` : ''}
    ${canCancel ? `<div style="margin-top:10px"><button class="btn o sm ot-cancel-btn" data-id="${otEsc(r.requestId)}" style="width:auto;padding:5px 14px;font-size:12px">ยกเลิกคำขอ</button></div>` : ''}
  </div>`;
}

// stepper (ใช้ร่วมแนวเดียวกับระบบลา)
function otStepper(status) {
  const steps = [{ label: 'หัวหน้า' }, { label: 'ผู้จัดการ' }, { label: 'บุคคล' }, { label: 'อนุมัติ' }];
  let activeIdx;
  if (status === 'PENDING_L1') activeIdx = 0;
  else if (status === 'PENDING_L2') activeIdx = 1;
  else if (status === 'PENDING_HR') activeIdx = 2;
  else if (status === 'APPROVED') activeIdx = 4;
  else return '';
  const dots = steps.map((s, i) => {
    let bg, col;
    if (i < activeIdx) { bg = 'var(--ok)'; col = '#fff'; }
    else if (i === activeIdx) { bg = '#c47d0a'; col = '#fff'; }
    else { bg = 'var(--sf2)'; col = 'var(--tx3)'; }
    const line = i < steps.length - 1 ? `<div style="flex:1;height:2px;background:${i < activeIdx ? 'var(--ok)' : 'var(--bd)'};margin:0 2px"></div>` : '';
    return `<div style="display:flex;align-items:center;${i < steps.length-1 ? 'flex:1' : ''}">
      <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
        <div style="width:18px;height:18px;border-radius:50%;background:${bg};color:${col};font-size:10px;display:flex;align-items:center;justify-content:center">${i < activeIdx ? '✓' : (i+1)}</div>
        <div style="font-size:9px;color:var(--tx3);white-space:nowrap">${s.label}</div>
      </div>${line}</div>`;
  }).join('');
  return `<div style="display:flex;align-items:center;margin-top:10px;padding-top:8px;border-top:1px solid var(--bd)">${dots}</div>`;
}

function otCancelRequest(reqId) {
  if (!reqId) return;
  if (!confirm('ยกเลิกคำขอ OT นี้?')) return;
  gasRun('otCancel', { hrToken: S.hrToken, requestId: reqId })
    .withSuccessHandler(r => {
      if (!r || !r.success) { showToast((r && r.message) || 'ยกเลิกไม่สำเร็จ'); return; }
      showToast('ยกเลิกแล้ว', true);
      loadOTHistory();
    })
    .withFailureHandler(() => showToast('เกิดข้อผิดพลาด'));
}

// ════════ อนุมัติ OT ════════
function loadOTApprovals() {
  const box = document.getElementById('ot-approve-list');
  if (box) box.innerHTML = '<div style="text-align:center;padding:20px;color:var(--tx3)">กำลังโหลด...</div>';
  const load = () => gasRun('otGetPendingApprovals', { hrToken: S.hrToken })
    .withSuccessHandler(r => {
      if (!r || !r.success) { if (box) box.innerHTML = '<div style="padding:20px;color:var(--er)">โหลดไม่สำเร็จ</div>'; return; }
      OT.pending = r.requests || [];
      renderOTApprovals();
    })
    .withFailureHandler(() => { if (box) box.innerHTML = '<div style="padding:20px;color:var(--er)">เกิดข้อผิดพลาด</div>'; });
  if (OT.types.length) load();
  else gasRun('otGetTypes', { hrToken: S.hrToken }).withSuccessHandler(r => { if (r && r.success) OT.types = r.types || []; load(); });
}

function renderOTApprovals() {
  const box = document.getElementById('ot-approve-list');
  if (!box) return;
  if (!OT.pending.length) { box.innerHTML = '<div style="text-align:center;padding:30px;color:var(--tx3)">ไม่มีคำขอรออนุมัติ</div>'; return; }

  box.innerHTML = OT.pending.map(r => {
    const hasAtt = r.attIn || r.attOut;
    const attLine = `<div style="font-size:12px;margin-top:6px;color:${hasAtt ? '#c47d0a' : 'var(--tx3)'}">
      เวลาเข้า/ออก (${hasAtt ? otEsc((r.attIn || '—') + ' - ' + (r.attOut || '—')) : 'ไม่มี'})${hasAtt ? ' ⚠️' : ''}
    </div>`;
    return `<div class="lv-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div>
          <div style="font-weight:600">${otEsc(r.empName)} <span style="color:var(--tx3);font-weight:400;font-size:12px">(${otEsc(r.empId)})</span></div>
          <div style="font-size:13px;color:var(--ac);margin-top:2px">${otEsc(r.otTypeName)}</div>
        </div>
      </div>
      <div style="font-size:13px;color:var(--tx2);margin-top:6px">${otEsc(otFormatRange(r))} · <b>${otEsc(otHoursText(r.hours))}</b></div>
      ${r.detail ? `<div style="font-size:13px;margin-top:6px;padding:8px;background:var(--sf2);border-radius:6px">${otEsc(r.detail)}</div>` : ''}
      ${r.fileUrl ? `<a href="${otEsc(r.fileUrl)}" target="_blank" style="font-size:12px;color:var(--ac)">📎 ไฟล์แนบ</a>` : ''}
      ${attLine}
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
        <label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer"><input type="checkbox" class="ot-check" data-id="${otEsc(r.requestId)}"> เลือก</label>
        <button class="btn sm ot-approve-btn" data-id="${otEsc(r.requestId)}" style="width:auto;padding:5px 16px;font-size:13px;background:var(--ok)">อนุมัติ</button>
        <button class="btn o sm ot-reject-btn" data-id="${otEsc(r.requestId)}" style="width:auto;padding:5px 16px;font-size:13px;color:var(--er);border-color:var(--er)">ไม่อนุมัติ</button>
        <button class="btn o sm ot-apcancel-btn" data-id="${otEsc(r.requestId)}" style="width:auto;padding:5px 14px;font-size:13px;color:var(--tx2)">ยกเลิกให้</button>
      </div>
    </div>`;
  }).join('');

  // แถบเลือกหลายรายการ
  const bar = `<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;padding:10px;background:var(--sf2);border-radius:8px">
    <label style="display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer"><input type="checkbox" id="ot-check-all"> เลือกทั้งหมด</label>
    <button class="btn sm" id="ot-approve-selected" style="width:auto;padding:5px 16px;font-size:13px;background:var(--ok)">อนุมัติที่เลือก</button>
  </div>`;
  box.innerHTML = bar + box.innerHTML;

  box.querySelectorAll('.ot-approve-btn').forEach(b => b.addEventListener('click', () => otApproveRequest(b.getAttribute('data-id'))));
  box.querySelectorAll('.ot-reject-btn').forEach(b => b.addEventListener('click', () => otRejectRequest(b.getAttribute('data-id'))));
  box.querySelectorAll('.ot-apcancel-btn').forEach(b => b.addEventListener('click', () => otCancelByApproverAction(b.getAttribute('data-id'))));
  const chkAll = document.getElementById('ot-check-all');
  if (chkAll) chkAll.addEventListener('change', () => {
    box.querySelectorAll('.ot-check').forEach(c => { c.checked = chkAll.checked; });
  });
  const apprSel = document.getElementById('ot-approve-selected');
  if (apprSel) apprSel.addEventListener('click', otApproveSelected);
}

function otApproveRequest(reqId) {
  if (!reqId) return;
  gasRun('otApprove', { hrToken: S.hrToken, requestId: reqId })
    .withSuccessHandler(r => {
      if (!r || !r.success) { showToast((r && r.message) || 'อนุมัติไม่สำเร็จ'); return; }
      showToast(r.message || 'อนุมัติเรียบร้อย', true);
      loadOTApprovals();
    })
    .withFailureHandler(() => showToast('เกิดข้อผิดพลาด'));
}

// อนุมัติหลายรายการที่เลือก (ทีละอันต่อเนื่อง)
function otApproveSelected() {
  const ids = Array.from(document.querySelectorAll('.ot-check:checked')).map(c => c.getAttribute('data-id'));
  if (!ids.length) { showToast('ยังไม่ได้เลือกรายการ'); return; }
  if (!confirm('อนุมัติ ' + ids.length + ' รายการที่เลือก?')) return;
  let done = 0, ok = 0;
  const next = () => {
    if (done >= ids.length) {
      showToast('อนุมัติสำเร็จ ' + ok + '/' + ids.length + ' รายการ', true);
      loadOTApprovals();
      return;
    }
    gasRun('otApprove', { hrToken: S.hrToken, requestId: ids[done] })
      .withSuccessHandler(r => { if (r && r.success) ok++; done++; next(); })
      .withFailureHandler(() => { done++; next(); });
  };
  next();
}

function otRejectRequest(reqId) {
  const reason = prompt('เหตุผลที่ไม่อนุมัติ (จำเป็น):', '');
  if (reason === null) return;
  if (!reason.trim()) { showToast('กรุณากรอกเหตุผล'); return; }
  gasRun('otReject', { hrToken: S.hrToken, requestId: reqId, rejectReason: reason.trim() })
    .withSuccessHandler(r => {
      if (!r || !r.success) { showToast((r && r.message) || 'ไม่สำเร็จ'); return; }
      showToast('ปฏิเสธคำขอแล้ว', true);
      loadOTApprovals();
    })
    .withFailureHandler(() => showToast('เกิดข้อผิดพลาด'));
}

function otCancelByApproverAction(reqId) {
  const reason = prompt('ยกเลิกใบ OT ให้พนักงาน\nระบุเหตุผล (จำเป็น):', '');
  if (reason === null) return;
  if (!reason.trim()) { showToast('กรุณากรอกเหตุผล'); return; }
  gasRun('otCancelByApprover', { hrToken: S.hrToken, requestId: reqId, cancelReason: reason.trim() })
    .withSuccessHandler(r => {
      if (!r || !r.success) { showToast((r && r.message) || 'ยกเลิกไม่สำเร็จ'); return; }
      showToast('ยกเลิกใบ OT แล้ว', true);
      loadOTApprovals();
    })
    .withFailureHandler(() => showToast('เกิดข้อผิดพลาด'));
}

// ════════ รายงาน OT ════════
function loadOTReport() {
  // ประเภทลงตัวกรอง
  const typeSel = document.getElementById('otr-f-type');
  if (typeSel) {
    const fill = () => { typeSel.innerHTML = '<option value="">ทุกประเภท</option>' + OT.types.map(t => `<option value="${otEsc(t.id)}">${otEsc(t.name)}</option>`).join(''); };
    if (OT.types.length) fill();
    else gasRun('otGetTypes', { hrToken: S.hrToken }).withSuccessHandler(r => { if (r && r.success) { OT.types = r.types || []; fill(); } });
  }
  // วันที่ default: ต้นเดือน - วันนี้
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const fmt = d => d.toISOString().slice(0, 10);
  const ff = document.getElementById('otr-f-from'); if (ff && !ff.value) ff.value = fmt(first);
  const ft = document.getElementById('otr-f-to'); if (ft && !ft.value) ft.value = fmt(today);

  // ดึงทีมเติม dropdown (เบา)
  const sel = document.getElementById('otr-f-emp');
  if (sel) sel.innerHTML = '<option value="">กำลังโหลด...</option>';
  gasRun('otGetMyTeam', { hrToken: S.hrToken })
    .withSuccessHandler(r => {
      if (r && r.success) { OT.reportCanVoid = !!r.isHR; otFillReportDropdown(r.team || []); }
      else if (sel) sel.innerHTML = '<option value="">เลือกชื่อพนักงาน</option>';
    })
    .withFailureHandler(() => { if (sel) sel.innerHTML = '<option value="">เลือกชื่อพนักงาน</option>'; });

  const box = document.getElementById('otr-result');
  if (box) box.innerHTML = '<div style="text-align:center;padding:30px;color:var(--tx3)">เลือกเงื่อนไขแล้วกด “ค้นหา”</div>';
}

function otFillReportDropdown(list) {
  const sel = document.getElementById('otr-f-emp');
  if (!sel) return;
  const people = Array.isArray(list) ? list : [];
  const wrap = sel.parentElement;
  if (people.length <= 1) { if (wrap) wrap.style.display = 'none'; return; }
  if (wrap) wrap.style.display = '';
  const cur = sel.value;
  sel.innerHTML = '<option value="">ทุกคน</option>' + people.map(m => `<option value="${otEsc(m.id)}">${otEsc(m.name || m.id)} (${otEsc(m.id)})</option>`).join('');
  if (cur) sel.value = cur;
}

function runOTReport() {
  const box = document.getElementById('otr-result');
  box.innerHTML = '<div style="text-align:center;padding:20px;color:var(--tx3)">กำลังโหลด...</div>';
  const empVal = document.getElementById('otr-f-emp').value;
  gasRun('otGetReport', {
    hrToken: S.hrToken,
    empIds: empVal ? [empVal] : null,
    otType: document.getElementById('otr-f-type').value,
    status: document.getElementById('otr-f-status').value,
    dateFrom: document.getElementById('otr-f-from').value,
    dateTo: document.getElementById('otr-f-to').value,
  })
    .withSuccessHandler(r => {
      if (!r || !r.success) { box.innerHTML = '<div style="padding:20px;color:var(--er)">' + otEsc((r && r.message) || 'โหลดไม่สำเร็จ') + '</div>'; return; }
      OT.report = r.rows || [];
      OT.reportCanVoid = !!r.canVoid;
      renderOTReport(OT.report);
    })
    .withFailureHandler(() => { box.innerHTML = '<div style="padding:20px;color:var(--er)">เกิดข้อผิดพลาด</div>'; });
}

function renderOTReport(rows) {
  const box = document.getElementById('otr-result');
  if (!rows.length) { box.innerHTML = '<div style="text-align:center;padding:30px;color:var(--tx3)">ไม่พบข้อมูล</div>'; return; }

  const totalHours = rows.filter(r => r.status === 'APPROVED').reduce((s, r) => s + (Number(r.hours) || 0), 0);
  let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px">
    <div style="font-size:13px;color:var(--tx2)">พบ ${rows.length} รายการ · อนุมัติแล้วรวม <b>${totalHours}</b> ชม.</div>
    <div style="display:flex;gap:6px">
      <button class="btn o sm" id="otr-pdf" style="width:auto;padding:5px 14px;font-size:12px">พิมพ์ PDF</button>
      <button class="btn o sm" id="otr-export" style="width:auto;padding:5px 14px;font-size:12px">Export CSV</button>
    </div>
  </div>`;

  html += `<div style="overflow-x:auto;border:1px solid var(--bd);border-radius:12px">
    <table style="width:100%;border-collapse:collapse;font-size:13px;white-space:nowrap">
    <thead><tr style="background:var(--sf2)">
      <th style="padding:9px 10px;text-align:left;position:sticky;left:0;background:var(--sf2)">พนักงาน</th>
      <th style="padding:9px 10px;text-align:left">ประเภท</th>
      <th style="padding:9px 10px;text-align:left">ช่วง OT</th>
      <th style="padding:9px 10px;text-align:center">เวลาออกงาน</th>
      <th style="padding:9px 10px;text-align:center">สถานะ</th>
    </tr></thead><tbody>`;

  rows.forEach((r, idx) => {
    const st = OT_STATUS[r.status] || { text: r.status, cls: '' };
    html += `<tr class="otr-row" data-idx="${idx}" style="border-top:1px solid var(--bd);cursor:pointer">
      <td style="padding:8px 10px;position:sticky;left:0;background:var(--bg)">
        <div style="font-weight:600">${otEsc(r.empName)}</div>
        <div style="font-size:11px;color:var(--tx3)">${otEsc(r.empId)}</div>
      </td>
      <td style="padding:8px 10px;color:var(--ac)">${otEsc(r.otTypeName)}</td>
      <td style="padding:8px 10px">
        <div>${otEsc(otFormatRange(r))}</div>
        <div style="font-size:11px;color:var(--tx3)"><b>${otEsc(otHoursText(r.hours))}</b></div>
      </td>
      <td style="padding:8px 10px;text-align:center;color:${r.attOut ? '#c47d0a' : 'var(--tx3)'}">${r.attOut ? otEsc(r.attOut) : '—'}</td>
      <td style="padding:8px 10px;text-align:center"><span class="lv-badge ${st.cls}">${otEsc(st.text)}</span></td>
    </tr>`;
    const canVoid = OT.reportCanVoid && (r.status === 'APPROVED' || r.status.indexOf('PENDING') === 0);
    const chain = [];
    if (r.l1By) chain.push(`หัวหน้า: ${otEsc(r.l1By)}${r.l1At ? ' (' + otEsc(otShortDT(r.l1At)) + ')' : ''}`);
    if (r.l2By) chain.push(`ผู้จัดการ: ${otEsc(r.l2By)}${r.l2At ? ' (' + otEsc(otShortDT(r.l2At)) + ')' : ''}`);
    if (r.hrBy) chain.push(`บุคคล: ${otEsc(r.hrBy)}${r.hrAt ? ' (' + otEsc(otShortDT(r.hrAt)) + ')' : ''}`);
    if (r.rejectBy) chain.push(`ปฏิเสธ/ยกเลิก: ${otEsc(r.rejectBy)}`);
    html += `<tr class="otr-detail" data-detail="${idx}" style="display:none;background:var(--sf)">
      <td colspan="5" style="padding:12px 14px;border-top:1px solid var(--bd);white-space:normal">
        ${r.detail ? `<div style="font-size:13px;margin-bottom:6px"><b>รายละเอียด:</b> ${otEsc(r.detail)}</div>` : ''}
        ${chain.length ? `<div style="font-size:12px;color:var(--tx2);margin-bottom:6px">${chain.join(' · ')}</div>` : ''}
        <div style="font-size:11px;color:var(--tx3);margin-bottom:6px">เลขที่: ${otEsc(r.requestId)}${r.createdBy ? ' · ผู้บันทึก: ' + otEsc(r.createdBy) : ''}</div>
        ${r.fileUrl ? `<a href="${otEsc(r.fileUrl)}" target="_blank" style="font-size:12px;color:var(--ac)">📎 ไฟล์แนบ</a>` : ''}
        ${canVoid ? `<div style="margin-top:8px"><button class="btn o sm otr-void-btn" data-id="${otEsc(r.requestId)}" style="width:auto;padding:5px 14px;font-size:12px;color:var(--er);border-color:var(--er)">ยกเลิกใบ OT</button></div>` : ''}
      </td>
    </tr>`;
  });
  html += '</tbody></table></div>';

  box.innerHTML = html;
  const exp = document.getElementById('otr-export'); if (exp) exp.addEventListener('click', exportOTReportCSV);
  const pdf = document.getElementById('otr-pdf'); if (pdf) pdf.addEventListener('click', printOTReportPDF);
  box.querySelectorAll('.otr-row').forEach(row => {
    row.addEventListener('click', () => {
      const idx = row.getAttribute('data-idx');
      const detail = box.querySelector('.otr-detail[data-detail="' + idx + '"]');
      if (detail) detail.style.display = (detail.style.display === 'none') ? 'table-row' : 'none';
    });
  });
  box.querySelectorAll('.otr-void-btn').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); otVoidRequest(b.getAttribute('data-id')); }));
}

// พิมพ์รายงาน OT เป็น PDF (เปิดหน้าต่างพิมพ์ → ผู้ใช้ Save as PDF)
// คอลัมน์ตามที่ฝ่ายบุคคลระบุ สำหรับพนักงานเซ็นตอนเลิกงาน
function printOTReportPDF() {
  if (!OT.report.length) { showToast('ไม่มีข้อมูล'); return; }
  const esc = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const rows = OT.report;

  let body = '';
  rows.forEach((r, idx) => {
    const st = (OT_STATUS[r.status] || { text: r.status }).text;
    body += `<tr>
      <td>${idx + 1}</td>
      <td>${esc(r.requestId)}</td>
      <td>${esc(r.empId)}</td>
      <td>${esc(r.empName)}</td>
      <td>${esc(r.otTypeName)}</td>
      <td>${esc(r.detail)}</td>
      <td>${esc(otFmtDate(r.dateFrom))}</td>
      <td>${esc(otFmtDate(r.dateTo))}</td>
      <td>${esc(r.timeFrom)}-${esc(r.timeTo)}</td>
      <td style="text-align:center">${esc(r.hours)}</td>
      <td>${esc(r.attOut || '')}</td>
      <td>${esc(st)}</td>
      <td>${esc(r.l1By || '')}</td>
      <td>${esc(r.l2By || '')}</td>
      <td>${esc(r.hrBy || '')}</td>
      <td style="min-width:60px"></td>
    </tr>`;
  });

  const totalHours = rows.filter(r => r.status === 'APPROVED').reduce((s, r) => s + (Number(r.hours) || 0), 0);
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="utf-8">
    <title>รายงานการขอ OT</title>
    <style>
      body{font-family:'Sarabun','TH Sarabun New',sans-serif;padding:16px;font-size:12px;color:#000}
      h2{text-align:center;margin:0 0 4px}
      .sub{text-align:center;font-size:12px;color:#555;margin-bottom:12px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #333;padding:4px 6px;font-size:11px;vertical-align:top}
      th{background:#eee;text-align:center}
      .foot{margin-top:8px;font-size:12px;font-weight:bold;text-align:right}
      @media print{ .noprint{display:none} }
    </style></head><body>
    <h2>รายงานการขอทำงานล่วงเวลา (OT)</h2>
    <div class="sub">SOM HR System — พิมพ์วันที่ ${otFmtDate(new Date().toISOString().slice(0,10))}</div>
    <table>
      <thead><tr>
        <th>#</th><th>เลขที่</th><th>รหัส</th><th>ชื่อ</th><th>ประเภท</th><th>รายละเอียดงาน</th>
        <th>เริ่ม</th><th>ถึง</th><th>เวลา</th><th>ชม.OT</th><th>เวลาออกงาน</th><th>สถานะ</th>
        <th>หัวหน้า</th><th>ผู้จัดการ</th><th>บุคคล</th><th>ลายเซ็น</th>
      </tr></thead>
      <tbody>${body}</tbody>
    </table>
    <div class="foot">รวมชั่วโมง OT ที่อนุมัติแล้ว: ${totalHours} ชม.</div>
    <div class="noprint" style="text-align:center;margin-top:16px">
      <button onclick="window.print()" style="padding:8px 24px;font-size:14px;cursor:pointer">พิมพ์ / บันทึกเป็น PDF</button>
    </div>
  </body></html>`);
  win.document.close();
}

function otVoidRequest(reqId) {
  const reason = prompt('ยกเลิกใบ OT (HR)\nระบุเหตุผล:', '');
  if (reason === null) return;
  gasRun('otVoidByHR', { hrToken: S.hrToken, requestId: reqId, voidReason: reason.trim() })
    .withSuccessHandler(r => {
      if (!r || !r.success) { showToast((r && r.message) || 'ยกเลิกไม่สำเร็จ'); return; }
      showToast('ยกเลิกใบ OT แล้ว', true);
      runOTReport();
    })
    .withFailureHandler(() => showToast('เกิดข้อผิดพลาด'));
}

// Export CSV (ตามคอลัมน์ที่ผู้ใช้ระบุ)
function exportOTReportCSV() {
  if (!OT.report.length) { showToast('ไม่มีข้อมูล'); return; }
  const head = ['เลขที่','รหัส','ชื่อ','ประเภท','รายละเอียดงานที่ทำ','เริ่ม','ถึง','เวลา','จำนวนชั่วโมงโอที','เวลาออกงาน','สถานะ',
                'อนุมัติหัวหน้า','เวลา','อนุมัติผู้จัดการ','เวลา','อนุมัติบุคคล','เวลา','ปฏิเสธ/ยกเลิกโดย','เหตุผล','วันที่ยื่น'];
  const esc = v => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const lines = [head.join(',')];
  OT.report.forEach(r => {
    lines.push([
      r.requestId, r.empId, r.empName, r.otTypeName, r.detail,
      otFmtDate(r.dateFrom), otFmtDate(r.dateTo), `${r.timeFrom}-${r.timeTo}`, r.hours, r.attOut || '',
      (OT_STATUS[r.status] || { text: r.status }).text,
      r.l1By, r.l1At, r.l2By, r.l2At, r.hrBy, r.hrAt, r.rejectBy, r.rejectReason, r.createdAt,
    ].map(esc).join(','));
  });
  const csv = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'ot-report-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ════════ ผูก event ════════
function initOTBindings() {
  const on = (id, ev, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); };
  // ฟอร์ม
  on('ot-type', 'change', otApplyTypeDefaults);
  on('ot-emp', 'change', otApplyTypeDefaults);
  on('ot-date-from', 'change', otUpdatePreview);
  on('ot-time-from', 'change', otUpdatePreview);
  on('ot-date-to', 'change', otUpdatePreview);
  on('ot-time-to', 'change', otUpdatePreview);
  on('ot-submit', 'click', submitOT);
  on('ot-form-back', 'click', () => go('ot-history'));
  on('ot-file', 'change', function(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      OT.formFile = { data: reader.result.split(',')[1], name: f.name, type: f.type };
      const lbl = document.getElementById('ot-file-label'); if (lbl) lbl.textContent = f.name;
    };
    reader.readAsDataURL(f);
  });
  // ประวัติ
  on('ot-history-back', 'click', () => go(S.role === 'HR' ? 'hr-dash' : 'history'));
  // อนุมัติ
  on('ot-approve-back', 'click', () => go(S.role === 'HR' ? 'hr-dash' : 'ot-history'));
  on('ot-approve-refresh', 'click', loadOTApprovals);
  // รายงาน
  on('otr-search', 'click', runOTReport);
  on('otr-back', 'click', () => go(S.role === 'HR' ? 'hr-dash' : 'history'));
  // เมนู HR
  on('hr-menu-ot-approve', 'click', () => go('ot-approve'));
  on('hr-menu-ot-report', 'click', () => go('ot-report'));
  // แท็บพนักงาน — ไปหน้าประวัติ (hub) ที่มีปุ่มขอ OT + อนุมัติ
  on('tab-ot', 'click', () => go('ot-history'));
  on('tab-ot-appr', 'click', () => go('ot-approve'));
  on('ot-goto-form', 'click', () => go('ot-form'));
  on('ot-goto-approve', 'click', () => go('ot-approve'));
}
