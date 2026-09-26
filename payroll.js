// รุ่นของไฟล์นี้ — ต้องตรงกับ APP_VERSION ใน index.html (ใช้ตรวจว่าโหลดไฟล์เก่าค้างอยู่ไหม)
window.PAYROLL_JS_VERSION = '8.2.1';

/* ═══════════════════════════════════════════════════════════════
 *  payroll.js — Frontend สลิปเงินเดือน (SOM HR System)
 *  ยึดโครงจาก ot.js — ใช้ gasRun, S, go, showToast จาก index.html
 * ═══════════════════════════════════════════════════════════════ */

const PAY = {
  periods: [],
  currentPeriod: null,   // งวดที่กำลังตรวจสอบ
  rows: [],
  editRowId: null,
  pdfToken: 0,           // token กัน batch PDF วนข้ามงวด/ซ้ำ
  pdfPeriodId: null,
};

function payEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
// จำนวนเงิน → คั่นหลักพัน
function payMoney(v) {
  const n = Number(v) || 0;
  return n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
// แปลงเป็นตัวเลข (กัน string มีลูกน้ำ)
function payNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}
// yyyy-MM-dd → dd/MM/yyyy
function payFmtDate(s) {
  if (!s) return '';
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}
function payTypeText(t) { return t === 'BONUS' ? 'โบนัส' : 'ปกติ'; }

// ════════ หน้าจัดการงวด ════════
function loadPayPeriods() {
  const box = document.getElementById('pay-periods-list');
  if (box) box.innerHTML = '<div style="text-align:center;padding:20px;color:var(--tx3)">กำลังโหลด...</div>';
  // ซ่อนฟอร์มสร้าง
  const cf = document.getElementById('pay-create-form'); if (cf) cf.style.display = 'none';

  gasRun('payGetPeriods', { hrToken: S.hrToken })
    .withSuccessHandler(r => {
      if (!r || !r.success) { if (box) box.innerHTML = '<div style="padding:20px;color:var(--er)">' + payEsc((r && r.message) || 'โหลดไม่สำเร็จ') + '</div>'; return; }
      PAY.periods = r.periods || [];
      renderPayPeriods();
    })
    .withFailureHandler(() => { if (box) box.innerHTML = '<div style="padding:20px;color:var(--er)">เกิดข้อผิดพลาด</div>'; });
}

function payDeletePeriodConfirm(periodId) {
  if (!confirm('ลบงวด ' + periodId + ' ?\n(ลบได้เฉพาะงวดที่ยังไม่มีข้อมูลพนักงาน)')) return;
  gasRunNoRetry('payDeletePeriod', { hrToken: S.hrToken, periodId: periodId })
    .withSuccessHandler(r => {
      if (r && r.success) { showToast('ลบงวดเรียบร้อย'); loadPayPeriods(); }
      else showToast((r && r.message) || 'ลบไม่สำเร็จ');
    })
    .withFailureHandler(() => showToast('เกิดข้อผิดพลาด'));
}

function renderPayPeriods() {
  const box = document.getElementById('pay-periods-list');
  if (!box) return;
  if (!PAY.periods.length) {
    box.innerHTML = '<div style="text-align:center;padding:30px;color:var(--tx3)">ยังไม่มีงวด กด “สร้างงวดใหม่” เพื่อเริ่ม</div>';
    return;
  }

  box.innerHTML = PAY.periods.map(p => {
    const isOpen = p.status === 'OPEN';
    const dot = isOpen ? 'background:var(--ok)' : 'background:var(--tx3)';
    const badge = isOpen
      ? '<span class="lv-badge" style="background:rgba(5,150,105,.1);color:var(--ok)">🟢 เปิดอยู่</span>'
      : '<span class="lv-badge" style="background:rgba(148,163,184,.15);color:var(--tx2)">🔒 ปิดแล้ว</span>';
    const canDelete = isOpen && (payNum(p.headcount) === 0);
    const actions = isOpen
      ? `<button class="btn p sm pay-review-btn" data-id="${payEsc(p.periodId)}" style="width:auto;padding:6px 14px;font-size:13px">ตรวจสอบ/โหลด</button>
         <button class="btn o sm pay-lock2-btn" data-id="${payEsc(p.periodId)}" style="width:auto;padding:6px 14px;font-size:13px">🔒 ปิดงวด</button>`
         + (canDelete ? `<button class="btn o sm pay-delperiod-btn" data-id="${payEsc(p.periodId)}" style="width:auto;padding:6px 14px;font-size:13px;color:var(--er);border-color:var(--er)">🗑 ลบงวด</button>` : '')
      : `<button class="btn o sm pay-review-btn" data-id="${payEsc(p.periodId)}" style="width:auto;padding:6px 14px;font-size:13px">ดูข้อมูล</button>
         <button class="btn o sm pay-unlock-btn" data-id="${payEsc(p.periodId)}" style="width:auto;padding:6px 14px;font-size:13px">🔓 เปิดงวด</button>`;
    return `<div class="lv-card" style="display:flex;align-items:flex-start;gap:12px">
      <div style="width:12px;height:12px;border-radius:50%;flex-shrink:0;margin-top:5px;${dot}"></div>
      <div style="flex:1">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div style="font-weight:600;font-size:16px">${payEsc(p.payRound)} · จ่าย ${payEsc(payFmtDate(p.payDate))}</div>
          ${badge}
        </div>
        <div style="font-size:13px;color:var(--tx3);margin-top:3px">รหัสงวด ${payEsc(p.periodId)} · ${payTypeText(p.payType)} · ${p.headcount} คน</div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">${actions}</div>
      </div>
    </div>`;
  }).join('');

  box.querySelectorAll('.pay-review-btn').forEach(b => b.addEventListener('click', () => openPayReview(b.getAttribute('data-id'))));
  box.querySelectorAll('.pay-lock2-btn').forEach(b => b.addEventListener('click', () => paySetStatus(b.getAttribute('data-id'), 'LOCKED')));
  box.querySelectorAll('.pay-unlock-btn').forEach(b => b.addEventListener('click', () => paySetStatus(b.getAttribute('data-id'), 'OPEN')));
  box.querySelectorAll('.pay-delperiod-btn').forEach(b => b.addEventListener('click', () => payDeletePeriodConfirm(b.getAttribute('data-id'))));
}

// สร้างงวด
function payCreatePeriod() {
  const round = document.getElementById('pay-f-round').value.trim();
  const date = document.getElementById('pay-f-date').value;
  const type = document.getElementById('pay-f-type').value;
  if (!round) { showToast('กรอกรอบการจ่าย'); return; }
  if (!date) { showToast('เลือกวันที่จ่าย'); return; }

  const btn = document.getElementById('pay-create-save');
  if (btn) { btn.disabled = true; btn.textContent = 'กำลังสร้าง...'; }
  gasRun('payCreatePeriod', { hrToken: S.hrToken, payRound: round, payDate: date, payType: type })
    .withSuccessHandler(r => {
      if (btn) { btn.disabled = false; btn.textContent = 'สร้างงวด'; }
      if (!r || !r.success) { showToast((r && r.message) || 'สร้างไม่สำเร็จ'); return; }
      showToast(r.message || 'สร้างงวดแล้ว', true);
      document.getElementById('pay-f-round').value = '';
      document.getElementById('pay-f-date').value = '';
      loadPayPeriods();
    })
    .withFailureHandler(() => { if (btn) { btn.disabled = false; btn.textContent = 'สร้างงวด'; } showToast('เกิดข้อผิดพลาด'); });
}

function paySetStatus(periodId, status) {
  const msg = status === 'LOCKED' ? 'ปิดงวดนี้? (จะแก้ไขไม่ได้จนกว่าจะเปิดใหม่)' : 'เปิดงวดนี้กลับมาแก้ไข?';
  if (!confirm(msg)) return;
  gasRun('paySetPeriodStatus', { hrToken: S.hrToken, periodId: periodId, status: status })
    .withSuccessHandler(r => {
      if (!r || !r.success) { showToast((r && r.message) || 'ไม่สำเร็จ'); return; }
      showToast(r.message || 'เรียบร้อย', true);
      loadPayPeriods();
    })
    .withFailureHandler(() => showToast('เกิดข้อผิดพลาด'));
}

function openPayReview(periodId) {
  PAY.currentPeriod = PAY.periods.find(p => p.periodId === periodId) || null;
  go('pay-review');
}

// ════════ หน้าตรวจสอบข้อมูล ════════
function loadPayReview() {
  const p = PAY.currentPeriod;
  const info = document.getElementById('pay-review-periodinfo');
  const title = document.getElementById('pay-review-title');
  const lockBtn = document.getElementById('pay-lock-btn');
  const uploadLabel = document.getElementById('pay-upload-file');

  if (!p) { if (info) info.textContent = 'ไม่พบงวด'; return; }
  if (title) title.textContent = 'ตรวจสอบ — ' + p.payRound;

  const isOpen = p.status === 'OPEN';
  if (info) {
    info.innerHTML = `<b>${payEsc(p.payRound)}</b> · รหัสงวด ${payEsc(p.periodId)} · จ่าย ${payEsc(payFmtDate(p.payDate))} · ${payTypeText(p.payType)}
      · <span style="color:${isOpen ? 'var(--ok)' : 'var(--tx3)'}">${isOpen ? '🟢 เปิดอยู่' : '🔒 ปิดแล้ว'}</span>`;
  }
  // งวดปิด → ปิดปุ่มโหลด + เปลี่ยนปุ่มเป็นเปิดงวด
  if (uploadLabel) uploadLabel.disabled = !isOpen;
  const upLabel = document.getElementById('pay-upload-label');
  if (upLabel) upLabel.parentElement.style.opacity = isOpen ? '1' : '.4';
  if (lockBtn) {
    lockBtn.textContent = isOpen ? '🔒 ปิดงวด' : '🔓 เปิดงวด';
    lockBtn.onclick = () => paySetStatusFromReview(p.periodId, isOpen ? 'LOCKED' : 'OPEN');
  }

  document.getElementById('pay-upload-status').textContent = '';
  document.getElementById('pay-load-result').innerHTML = '';
  // reset progress + ยกเลิก batch เก่า (กัน progress ค้างจากงวดก่อน)
  PAY.pdfToken = (PAY.pdfToken || 0) + 1;
  const prog = document.getElementById('pay-pdf-progress');
  if (prog) prog.style.display = 'none';
  loadPayTable();
}

function paySetStatusFromReview(periodId, status) {
  const msg = status === 'LOCKED' ? 'ปิดงวดนี้? (จะแก้ไขไม่ได้)' : 'เปิดงวดนี้กลับมาแก้ไข?';
  if (!confirm(msg)) return;
  gasRun('paySetPeriodStatus', { hrToken: S.hrToken, periodId: periodId, status: status })
    .withSuccessHandler(r => {
      if (!r || !r.success) { showToast((r && r.message) || 'ไม่สำเร็จ'); return; }
      showToast(r.message || 'เรียบร้อย', true);
      if (PAY.currentPeriod) PAY.currentPeriod.status = status;
      loadPayReview();
    })
    .withFailureHandler(() => showToast('เกิดข้อผิดพลาด'));
}

// โหลดไฟล์ Excel
function payHandleUpload(file) {
  if (!file) return;
  const p = PAY.currentPeriod;
  if (!p) return;
  const status = document.getElementById('pay-upload-status');
  if (status) { status.style.color = 'var(--tx3)'; status.textContent = 'กำลังอ่านไฟล์...'; }

  const reader = new FileReader();
  reader.onload = () => {
    const base64 = reader.result.split(',')[1];
    if (status) status.textContent = 'กำลังนำเข้าข้อมูล... (อาจใช้เวลาสักครู่)';
    gasRun('payUploadExcel', { hrToken: S.hrToken, periodId: p.periodId, fileData: base64, fileName: file.name })
      .withSuccessHandler(r => {
        if (!r || !r.success) {
          if (status) { status.style.color = 'var(--er)'; status.textContent = '✗ ' + ((r && r.message) || 'นำเข้าไม่สำเร็จ'); }
          return;
        }
        if (status) { status.style.color = 'var(--ok)'; status.textContent = '✓ นำเข้าเรียบร้อย'; }
        renderLoadResult(r.result, r.headcount);
        loadPayTable();
      })
      .withFailureHandler(() => { if (status) { status.style.color = 'var(--er)'; status.textContent = '✗ เกิดข้อผิดพลาด'; } });
  };
  reader.readAsDataURL(file);
}

// สรุปผลโหลด
function renderLoadResult(res, headcount) {
  const box = document.getElementById('pay-load-result');
  if (!box || !res) return;
  let html = `<div class="card" style="margin-bottom:14px">
    <div style="font-weight:600;font-size:15px;margin-bottom:6px">ผลการนำเข้า</div>
    <div style="font-size:12px;color:var(--tx3);margin-bottom:10px">การนำเข้าจะอัปเดต/เพิ่มเฉพาะคนในไฟล์ ไม่ลบคนอื่นในงวด</div>
    <div style="display:flex;flex-direction:column;gap:5px;font-size:14px">
      <div><b style="font-size:16px">${res.total}</b> นำเข้าจากไฟล์</div>
      <div><b style="font-size:16px;color:var(--ok)">${res.success}</b> ✓ สำเร็จ</div>
      <div><b style="font-size:16px;color:var(--er)">${res.failed}</b> ✗ ไม่สำเร็จ</div>`;
  if (res.failList && res.failList.length) {
    html += res.failList.map(f => `<div style="font-size:13px;color:var(--er);padding-left:20px">• ${payEsc(f)}</div>`).join('');
  }
  html += `<div><b style="font-size:16px;color:var(--wn)">${res.warned}</b> ⚠️ ยอดรวมไม่ตรง (ให้ตรวจสอบ)</div>`;
  if (res.warnList && res.warnList.length) {
    html += res.warnList.map(w => `<div style="font-size:13px;color:var(--wn);padding-left:20px">• ${payEsc(w)}</div>`).join('');
  }
  if (headcount != null) {
    html += `<div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--bd)"><b style="font-size:16px;color:var(--ac)">${headcount}</b> คนในงวดนี้ทั้งหมด (หลังนำเข้า)</div>`;
  }
  html += `</div></div>`;
  box.innerHTML = html;
}

// ตารางข้อมูล
function loadPayTable() {
  const box = document.getElementById('pay-review-table');
  if (!box) return;
  const p = PAY.currentPeriod;
  if (!p) return;
  box.innerHTML = '<div style="text-align:center;padding:20px;color:var(--tx3)">กำลังโหลดตาราง...</div>';

  gasRun('payGetPeriodData', { hrToken: S.hrToken, periodId: p.periodId })
    .withSuccessHandler(r => {
      if (!r || !r.success) { box.innerHTML = '<div style="padding:20px;color:var(--er)">โหลดไม่สำเร็จ</div>'; return; }
      PAY.rows = r.rows || [];
      renderPayTable();
    })
    .withFailureHandler(() => { box.innerHTML = '<div style="padding:20px;color:var(--er)">เกิดข้อผิดพลาด</div>'; });
}

function renderPayTable() {
  const box = document.getElementById('pay-review-table');
  if (!box) return;
  if (!PAY.rows.length) {
    box.innerHTML = '<div style="text-align:center;padding:30px;color:var(--tx3)">ยังไม่มีข้อมูลในงวดนี้ — โหลดไฟล์ Excel เพื่อเริ่ม</div>';
    return;
  }
  const isOpen = PAY.currentPeriod && PAY.currentPeriod.status === 'OPEN';

  const slipBadge = (st) => {
    if (st === 'ส่งแล้ว') return '<span class="lv-badge" style="background:rgba(5,150,105,.1);color:var(--ok)">ส่งแล้ว</span>';
    if (st === 'สร้างแล้ว' || st === '✓สร้างใหม่แล้ว') return '<span class="lv-badge" style="background:rgba(37,99,235,.1);color:var(--ac)">สร้างแล้ว</span>';
    return '<span class="lv-badge" style="background:rgba(148,163,184,.15);color:var(--tx2)">ยังไม่สร้าง</span>';
  };

  let html = `<div class="table-wrap" style="background:var(--sf);border:1px solid var(--bd);border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,.04)">
    <div style="padding:14px 16px;border-bottom:1px solid var(--bd);font-weight:600">พนักงาน ${PAY.rows.length} คน</div>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:14px">
      <thead><tr>
        <th style="text-align:center;padding:10px 8px;background:var(--sf2)"><input type="checkbox" id="pay-check-all" style="cursor:pointer"></th>
        <th style="text-align:left;padding:10px 12px;font-size:12px;font-weight:600;color:var(--tx2);background:var(--sf2)">#</th>
        <th style="text-align:left;padding:10px 12px;font-size:12px;font-weight:600;color:var(--tx2);background:var(--sf2)">รหัส</th>
        <th style="text-align:left;padding:10px 12px;font-size:12px;font-weight:600;color:var(--tx2);background:var(--sf2)">ชื่อ</th>
        <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;color:var(--tx2);background:var(--sf2)">เงินได้</th>
        <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;color:var(--tx2);background:var(--sf2)">เงินหัก</th>
        <th style="text-align:right;padding:10px 12px;font-size:12px;font-weight:600;color:var(--tx2);background:var(--sf2)">สุทธิ</th>
        <th style="text-align:center;padding:10px 12px;font-size:12px;font-weight:600;color:var(--tx2);background:var(--sf2)">สลิป</th>
        <th style="text-align:center;padding:10px 12px;font-size:12px;font-weight:600;color:var(--tx2);background:var(--sf2)">ตรวจ</th>
        <th style="background:var(--sf2)"></th>
      </tr></thead><tbody>`;

  // เรียงตามรหัสพนักงาน (หน้าเว็บ) — ชีตยังต่อท้ายได้
  const sortedRows = PAY.rows.slice().sort((a, b) => String(a.empId).localeCompare(String(b.empId), undefined, { numeric: true }));

  let netSum = 0;
  html += sortedRows.map((row, i) => {
    const warn = row.checkFlag === '⚠️';
    const rowBg = warn ? 'background:rgba(217,119,6,.05)' : '';
    const hasPdf = !!row.urlPDF;
    const pdfLink = hasPdf ? `<a href="${payEsc(row.urlPDF)}" target="_blank" style="color:var(--ok);font-size:13px;text-decoration:none">📄 เปิด</a>` : '';
    netSum += payNum(row.net);
    // ปุ่มการกระทำ: มี PDF แล้ว → ลบ (ต้องลบก่อนแก้), ยังไม่มี → แก้ไข (เฉพาะงวด OPEN)
    let actionBtn = '';
    if (isOpen) {
      if (hasPdf) {
        actionBtn = `<span class="pay-del-link" data-id="${payEsc(row.rowId)}" style="color:var(--er);cursor:pointer;font-weight:600;font-size:13px">ลบ</span>`;
      } else {
        actionBtn = `<span class="pay-edit-link" data-id="${payEsc(row.rowId)}" style="color:var(--ac);cursor:pointer;font-weight:600;font-size:13px">แก้ไข</span>`;
      }
    }
    return `<tr style="${rowBg}">
      <td style="padding:11px 8px;border-top:1px solid var(--bd);text-align:center"><input type="checkbox" class="pay-row-check" data-id="${payEsc(row.rowId)}" style="cursor:pointer"></td>
      <td style="padding:11px 12px;border-top:1px solid var(--bd)">${i + 1}</td>
      <td style="padding:11px 12px;border-top:1px solid var(--bd)">${payEsc(row.empId)}</td>
      <td style="padding:11px 12px;border-top:1px solid var(--bd);white-space:nowrap">${payEsc(row.name)}</td>
      <td style="padding:11px 12px;border-top:1px solid var(--bd);text-align:right;font-variant-numeric:tabular-nums">${payMoney(row.income)}</td>
      <td style="padding:11px 12px;border-top:1px solid var(--bd);text-align:right;font-variant-numeric:tabular-nums">${payMoney(row.deduct)}</td>
      <td style="padding:11px 12px;border-top:1px solid var(--bd);text-align:right;font-variant-numeric:tabular-nums;font-weight:600">${payMoney(row.net)}</td>
      <td style="padding:11px 12px;border-top:1px solid var(--bd);text-align:center">${slipBadge(row.statusSlip)} ${pdfLink}</td>
      <td style="padding:11px 12px;border-top:1px solid var(--bd);text-align:center;font-size:16px">${warn ? '⚠️' : '<span style="color:var(--ok)">✓</span>'}</td>
      <td style="padding:11px 12px;border-top:1px solid var(--bd);white-space:nowrap">${actionBtn}</td>
    </tr>`;
  }).join('');

  // แถวยอดรวมสุทธิท้ายตาราง
  html += `<tr style="background:var(--sf2);font-weight:700">
      <td colspan="6" style="padding:12px;border-top:2px solid var(--bd2);text-align:right">รวมเงินได้สุทธิทั้งงวด (${sortedRows.length} คน)</td>
      <td style="padding:12px;border-top:2px solid var(--bd2);text-align:right;font-variant-numeric:tabular-nums;color:var(--ac);font-size:15px">${payMoney(netSum)}</td>
      <td colspan="3" style="border-top:2px solid var(--bd2)"></td>
    </tr>`;

  html += `</tbody></table></div>
    <div style="font-size:12px;color:var(--tx3);padding:12px 16px;border-top:1px solid var(--bd)">
      แถวสีส้ม = ยอดรวมไม่ตรง (⚠️) · คนที่มี PDF แล้วต้องกด "ลบ" (ลบแถว+ไฟล์) ก่อนโหลดใหม่ · เรียงตามรหัสพนักงาน ${isOpen ? '' : '· งวดนี้ปิดแล้ว แก้ไขไม่ได้'}
    </div></div>`;

  box.innerHTML = html;
  box.querySelectorAll('.pay-edit-link').forEach(el => el.addEventListener('click', () => openPayEdit(el.getAttribute('data-id'))));
  box.querySelectorAll('.pay-del-link').forEach(el => el.addEventListener('click', () => payDeleteRowWithPdf(el.getAttribute('data-id'))));
  // เช็คบ็อกซ์
  const checkAll = document.getElementById('pay-check-all');
  if (checkAll) checkAll.addEventListener('change', () => {
    box.querySelectorAll('.pay-row-check').forEach(c => { c.checked = checkAll.checked; });
    payUpdateSelCount();
  });
  box.querySelectorAll('.pay-row-check').forEach(c => c.addEventListener('change', payUpdateSelCount));
  payUpdateSelCount();
}

// นับจำนวนที่เลือก + toggle ปุ่มสร้าง PDF ที่เลือก
function payUpdateSelCount() {
  const checks = document.querySelectorAll('.pay-row-check:checked');
  const count = checks.length;
  const el = document.getElementById('pay-sel-count');
  if (el) el.textContent = count;
  const selBtn = document.getElementById('pay-genpdf-sel-btn');
  if (selBtn) selBtn.style.display = count > 0 ? '' : 'none';
}

// ════════ ฟอร์มแก้ไขรายคน (accordion แบ่งกลุ่ม) ════════
// นิยามฟิลด์: [index ใน values(A-BG), label, hint?]
const PAY_GROUPS = [
  { title: 'ข้อมูลพนักงาน', fields: [
    [0, 'A รอบการจ่าย'], [1, 'B วันที่จ่าย'], [2, 'C เลขที่บัญชี'], [3, 'D ลำดับที่'],
    [4, 'E รหัสพนักงาน'], [5, 'F ชื่อ-นามสกุล'], [6, 'G ชื่อเล่น'], [7, 'H วันเริ่มงาน'],
    [8, 'I ตำแหน่ง'], [9, 'J หน่วยต้นทุน', 'DL=ค่าแรงทางตรง, OH=ค่าใช้จ่ายการผลิต, SA=ขาย&บริหาร'],
    [10, 'K ต้นทุนธุรกิจ', 'รหัสแผนก (Department ID)'], [11, 'L แผนก'],
    [12, 'M ฐานเงินเดือน'], [13, 'N วันทำงาน'], [14, 'O วันเข้ากะ'],
  ]},
  { title: 'เงินเดือน + OT', fields: [
    [15, 'P เงินเดือน'], [16, 'Q เงินเดือนอื่นๆ'], [17, 'R ขาดงาน(วัน)'], [18, 'S หักขาดงานวัน'],
    [19, 'T ขาดงาน(นาที)'], [20, 'U หักขาดงานนาที'], [21, 'V เงินเดือนรวم', 'auto: P+Q-S-U'],
    [22, 'W ชม.OT ปกติ1.5'], [23, 'X ชม.OT หยุด1.5'], [24, 'Y ชม.OT หยุด2'], [25, 'Z ชม.OT หยุด3'],
    [26, 'AA เงินOT ปกติ1.5'], [27, 'AB เงินOT หยุด1.5'], [28, 'AC เงินOT หยุด2'], [29, 'AD เงินOT หยุด3'],
    [30, 'AE เงินOT รวม', 'auto: AA+AB+AC+AD'],
  ]},
  { title: 'สวัสดิการ', fields: [
    [31, 'AF ค่าเดินทาง'], [32, 'AG ค่าอาหาร'], [33, 'AH ค่าครองชีพ'], [34, 'AI เงินเพิ่มพิเศษ'],
    [35, 'AJ ค่าตำแหน่ง'], [36, 'AK เบี้ยขยัน'], [37, 'AL ค่ากะ'], [38, 'AM สวัสดิการอื่นๆ'],
    [39, 'AN สวัสดิการรวม', 'auto: AF..AM'],
  ]},
  { title: 'เงินหัก', fields: [
    [40, 'AO เงินหักอื่น(ภาษี)'], [41, 'AP รวมเงินได้ภาษี', 'auto: V+OT+สวัสดิการ-AO'],
    [42, 'AQ ภาษีหัก ณ ที่จ่าย'], [43, 'AR อัตรา PVD'], [44, 'AS PVD'], [45, 'AT ประกันสังคม'],
    [46, 'AU EWF'], [47, 'AV หักฝึกงานJP'], [48, 'AW หักออมสิน'], [49, 'AX หักกยศ.'],
    [50, 'AY หักชุดพนักงาน'], [51, 'AZ เงินหักอื่นๆ'], [52, 'BA รวมเงินหัก', 'auto: AQ+AS..AZ'],
    [53, 'BB รายได้ไม่มีภาษี'], [54, 'BC เงินได้สุทธิ', 'auto: AP-BA+BB'], [55, 'BD หมายเหตุ'],
    [56, 'BE สมทบ PVD(นายจ้าง)'], [57, 'BF สมทบ SSO(นายจ้าง)'], [58, 'BG สมทบ EWF(นายจ้าง)'],
  ]},
];

function openPayEdit(rowId) {
  PAY.editRowId = rowId;
  const body = document.getElementById('pay-edit-body');
  const overlay = document.getElementById('pay-edit-overlay');
  body.innerHTML = '<div style="text-align:center;padding:20px;color:var(--tx3)">กำลังโหลด...</div>';
  overlay.style.display = 'flex';

  gasRun('payGetRow', { hrToken: S.hrToken, rowId: rowId })
    .withSuccessHandler(r => {
      if (!r || !r.success) { body.innerHTML = '<div style="color:var(--er)">' + payEsc((r && r.message) || 'โหลดไม่สำเร็จ') + '</div>'; return; }
      renderPayEditForm(r.values || []);
    })
    .withFailureHandler(() => { body.innerHTML = '<div style="color:var(--er)">เกิดข้อผิดพลาด</div>'; });
}

function renderPayEditForm(values) {
  const body = document.getElementById('pay-edit-body');
  const title = document.getElementById('pay-edit-title');
  if (title) title.textContent = 'แก้ไข: ' + (values[5] || '') + ' (' + (values[4] || '') + ')';

  body.innerHTML = PAY_GROUPS.map((grp, gi) => {
    const fields = grp.fields.map(f => {
      const idx = f[0], label = f[1], hint = f[2] || '';
      const val = (values[idx] !== undefined && values[idx] !== null) ? values[idx] : '';
      const isAuto = hint.indexOf('auto:') === 0;
      return `<div class="field" style="margin-bottom:10px">
        <label style="font-size:12px">${payEsc(label)}${hint ? ` <span style="color:var(--tx3);font-weight:400">— ${payEsc(hint)}</span>` : ''}</label>
        <input class="inp pay-edit-inp" data-idx="${idx}" value="${payEsc(val)}"${isAuto ? ' style="background:var(--sf2);color:var(--tx3)"' : ''}>
      </div>`;
    }).join('');
    return `<details ${gi === 0 ? 'open' : ''} style="margin-bottom:10px;border:1px solid var(--bd);border-radius:10px;overflow:hidden">
      <summary style="padding:12px 14px;font-weight:600;cursor:pointer;background:var(--sf2);font-size:14px">${payEsc(grp.title)}</summary>
      <div style="padding:14px">${fields}</div>
    </details>`;
  }).join('');
  body.innerHTML += `<div style="font-size:12px;color:var(--tx3);margin-top:6px">ช่องพื้นเทา = ระบบคำนวณ (auto) แก้ได้ถ้าต้องการ · ยอดสะสม BH-BO ระบบคำนวณให้อัตโนมัติหลังบันทึก</div>`;

  // งวดปิด → ซ่อนปุ่มบันทึก/ลบ (ดูอย่างเดียว)
  const isOpen = PAY.currentPeriod && PAY.currentPeriod.status === 'OPEN';
  const saveBtn = document.getElementById('pay-edit-save');
  const delBtn = document.getElementById('pay-edit-delete');
  if (saveBtn) saveBtn.style.display = isOpen ? '' : 'none';
  if (delBtn) delBtn.style.display = isOpen ? '' : 'none';
  // งวดปิด → input อ่านอย่างเดียว
  if (!isOpen) {
    setTimeout(() => body.querySelectorAll('.pay-edit-inp').forEach(inp => { inp.disabled = true; }), 0);
  }
}

function savePayEdit() {
  const inputs = document.querySelectorAll('.pay-edit-inp');
  const values = [];
  inputs.forEach(inp => { values[parseInt(inp.getAttribute('data-idx'), 10)] = inp.value; });

  const btn = document.getElementById('pay-edit-save');
  if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }
  gasRun('payUpdateRow', { hrToken: S.hrToken, rowId: PAY.editRowId, values: values })
    .withSuccessHandler(r => {
      if (btn) { btn.disabled = false; btn.textContent = 'บันทึก + คำนวณสะสมใหม่'; }
      if (!r || !r.success) { showToast((r && r.message) || 'บันทึกไม่สำเร็จ'); return; }
      showToast('บันทึกแล้ว ' + (r.checkFlag === '⚠️' ? '(ยอดยังไม่ตรง ⚠️)' : '✓'), true);
      document.getElementById('pay-edit-overlay').style.display = 'none';
      loadPayTable();
    })
    .withFailureHandler(() => { if (btn) { btn.disabled = false; btn.textContent = 'บันทึก + คำนวณสะสมใหม่'; } showToast('เกิดข้อผิดพลาด'); });
}

function deletePayRow() {
  if (!PAY.editRowId) return;
  if (!confirm('ลบข้อมูลพนักงานคนนี้ออกจากงวด?')) return;
  gasRun('payDeleteRow', { hrToken: S.hrToken, rowId: PAY.editRowId })
    .withSuccessHandler(r => {
      if (!r || !r.success) { showToast((r && r.message) || 'ลบไม่สำเร็จ'); return; }
      showToast('ลบแล้ว', true);
      document.getElementById('pay-edit-overlay').style.display = 'none';
      loadPayTable();
    })
    .withFailureHandler(() => showToast('เกิดข้อผิดพลาด'));
}

// ════════ สร้าง PDF ════════
// 2 โหมด: ทั้งงวด (backend หยิบ batch เอง วนจนหมด) / เลือกเฉพาะคน (frontend แบ่ง batch เอง)
// forceAll=true = สร้างใหม่ทั้งงวด (ทับของเดิม)
function payGenPDF(rowIds, forceAll) {
  const p = PAY.currentPeriod;
  if (!p) return;
  const progress = document.getElementById('pay-pdf-progress');
  const bar = document.getElementById('pay-pdf-progress-bar');
  const txt = document.getElementById('pay-pdf-progress-text');
  if (progress) progress.style.display = 'block';
  if (bar) bar.style.width = '0%';

  const btns = ['pay-genpdf-all-btn', 'pay-genpdf-sel-btn'];
  btns.forEach(id => { const b = document.getElementById(id); if (b) b.disabled = true; });

  // token กันวนข้ามงวด/ซ้ำ
  PAY.pdfToken = (PAY.pdfToken || 0) + 1;
  const myToken = PAY.pdfToken;
  PAY.pdfPeriodId = p.periodId;

  const finish = (msg) => {
    if (txt) txt.textContent = msg;
    btns.forEach(id => { const b = document.getElementById(id); if (b) b.disabled = false; });
    loadPayTable();
    setTimeout(() => { if (progress && myToken === PAY.pdfToken) progress.style.display = 'none'; }, 2500);
  };

  const stillValid = () => (myToken === PAY.pdfToken && PAY.currentPeriod && PAY.currentPeriod.periodId === PAY.pdfPeriodId);

  if (rowIds && rowIds.length) {
    // ═══ โหมดเลือกเฉพาะคน — frontend แบ่ง batch ทีละ 5 ส่งไปเรื่อยๆ ═══
    const BATCH = 3;
    const allIds = rowIds.slice();
    const totalSel = allIds.length;
    let idx = 0, errCount = 0, retries = 0;
    const MAX_RETRY = 2;

    const runChunk = () => {
      if (!stillValid()) return;
      if (idx >= totalSel) { finish(`✓ สร้าง PDF เสร็จ ${totalSel - errCount}/${totalSel} ใบ`); return; }
      const chunk = allIds.slice(idx, idx + BATCH);
      gasRunLong('payGeneratePDF', { hrToken: S.hrToken, periodId: p.periodId, rowIds: chunk })
        .withSuccessHandler(r => {
          if (!stillValid()) return;
          if (!r || !r.success) {
            // retry chunk เดิมก่อนยอมแพ้
            if (retries < MAX_RETRY) { retries++; if (txt) txt.textContent = `ลองใหม่... ${idx}/${totalSel}`; setTimeout(runChunk, 800); return; }
            finish('✗ ' + ((r && r.message) || 'สร้างไม่สำเร็จ') + ` (สร้างได้ ${idx}/${totalSel})`);
            return;
          }
          retries = 0;   // สำเร็จ → reset retry
          if (r.errors && r.errors.length) errCount += r.errors.length;
          idx += chunk.length;
          const pct = Math.min(100, Math.round((idx / totalSel) * 100));
          if (bar) bar.style.width = pct + '%';
          if (txt) txt.textContent = `กำลังสร้าง PDF... ${idx}/${totalSel}`;
          setTimeout(runChunk, 150);   // หน่วงเล็กน้อยกัน quota
        })
        .withFailureHandler(() => {
          if (!stillValid()) return;
          // การเชื่อมต่อล้ม → retry
          if (retries < MAX_RETRY) { retries++; if (txt) txt.textContent = `ลองใหม่... ${idx}/${totalSel}`; setTimeout(runChunk, 1000); return; }
          finish(`✗ การเชื่อมต่อขัดข้อง (สร้างได้ ${idx}/${totalSel} — กดสร้างอีกครั้งเพื่อทำต่อ)`);
        });
    };
    runChunk();
    return;
  }

  // ═══ โหมดทั้งงวด — backend หยิบ batch, วนจน done (forceAll=true สร้างใหม่ทั้งงวด) ═══
  let guardRounds = 0, allRetries = 0, emptyBatches = 0;
  const maxRounds = 300, MAX_RETRY_ALL = 2, MAX_EMPTY = 2;
  const runBatch = () => {
    if (!stillValid()) return;
    if (++guardRounds > maxRounds) { finish('✗ หยุด (เกินจำนวนรอบที่กำหนด)'); return; }
    gasRunLong('payGeneratePDF', { hrToken: S.hrToken, periodId: p.periodId, rowIds: null, force: !!forceAll })
      .withSuccessHandler(r => {
        if (!stillValid()) return;
        if (!r || !r.success) {
          if (allRetries < MAX_RETRY_ALL) { allRetries++; if (txt) txt.textContent = 'ลองใหม่...'; setTimeout(runBatch, 900); return; }
          finish('✗ ' + ((r && r.message) || 'สร้างไม่สำเร็จ'));
          return;
        }
        allRetries = 0;
        const total = r.scopeTotal || 0;
        const done = r.doneCount || 0;
        const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 100;
        if (bar) bar.style.width = pct + '%';
        if (txt) txt.textContent = `กำลังสร้าง PDF... ${done}/${total}`;
        if (r.done || r.remaining <= 0) {
          finish(`✓ สร้าง PDF เสร็จ ${done}/${total} ใบ`);
        } else if (r.generatedThisBatch === 0) {
          // batch นี้สร้างไม่ได้เลย (อาจ error ชั่วคราว/quota) → retry ก่อนยอมแพ้
          emptyBatches++;
          if (emptyBatches <= MAX_EMPTY) {
            if (txt) txt.textContent = `ลองใหม่... ${done}/${total}`;
            setTimeout(runBatch, 1200);
          } else {
            const errNote = (r.errors && r.errors.length) ? ' — ' + r.errors[0] : '';
            finish(`⚠️ หยุด — สร้างได้ ${done}/${total} (บางรายการสร้างไม่สำเร็จ กดสร้างอีกครั้งเพื่อทำต่อ)${errNote}`);
          }
        } else {
          emptyBatches = 0;   // batch นี้สร้างได้ → reset ตัวนับ batch ว่าง
          runBatch();
        }
      })
      .withFailureHandler(() => { if (stillValid()) finish('✗ เกิดข้อผิดพลาดในการเชื่อมต่อ'); });
  };
  runBatch();
}

function payGenPDFSelected() {
  const ids = Array.from(document.querySelectorAll('.pay-row-check:checked')).map(c => c.getAttribute('data-id'));
  if (!ids.length) { showToast('เลือกพนักงานก่อน'); return; }
  payGenPDF(ids);
}

// ลบแถวที่มี PDF แล้ว (ลบแถว + ไฟล์ PDF) — ใช้ตอนต้องแก้ไขคนที่สร้างสลิปแล้ว
function payDeleteRowWithPdf(rowId) {
  if (!confirm('คนนี้สร้างสลิป PDF แล้ว\nการลบจะลบทั้งข้อมูลและไฟล์ PDF\nจากนั้นค่อยแก้ไขในไฟล์ Excel แล้วโหลดใหม่\n\nยืนยันลบ?')) return;
  gasRun('payDeleteRow', { hrToken: S.hrToken, rowId: rowId })
    .withSuccessHandler(r => {
      if (r && r.success) { showToast('ลบเรียบร้อย'); loadPayTable(); }
      else showToast((r && r.message) || 'ลบไม่สำเร็จ');
    })
    .withFailureHandler(() => showToast('เกิดข้อผิดพลาด'));
}

// ════════ ผูก event ════════
function initPayrollBindings() {
  const on = (id, ev, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); };
  // เมนู HR
  on('hr-menu-payroll', 'click', () => go('pay-periods'));
  on('hr-menu-payreport', 'click', () => go('pay-report'));
  // หน้าจัดการงวด
  on('pay-periods-back', 'click', () => go('hr-dash'));
  on('pay-periods-refresh', 'click', loadPayPeriods);
  on('pay-create-btn', 'click', () => {
    const f = document.getElementById('pay-create-form');
    if (f) f.style.display = f.style.display === 'none' ? 'block' : 'none';
  });
  on('pay-create-save', 'click', payCreatePeriod);
  on('pay-create-cancel', 'click', () => { document.getElementById('pay-create-form').style.display = 'none'; });
  // หน้าตรวจสอบ
  on('pay-review-back', 'click', () => go('pay-periods'));
  on('pay-genpdf-all-btn', 'click', () => payGenPDF(null, true));
  on('pay-genpdf-sel-btn', 'click', payGenPDFSelected);
  // ปุ่ม Telegram ใช้ onclick ตรงใน HTML (กัน timing binding พลาด)
  on('pay-upload-file', 'change', function(e) {
    const f = e.target.files && e.target.files[0];
    if (f) payHandleUpload(f);
    e.target.value = '';   // reset ให้เลือกไฟล์เดิมซ้ำได้
  });
  // dialog แก้ไข
  on('pay-edit-save', 'click', savePayEdit);
  on('pay-edit-delete', 'click', deletePayRow);
  on('pay-edit-cancel', 'click', () => { document.getElementById('pay-edit-overlay').style.display = 'none'; });
  on('pay-edit-close', 'click', () => { document.getElementById('pay-edit-overlay').style.display = 'none'; });
}

// ════════ การ์ดสลิปเงินเดือนพนักงาน ════════
function loadMyPayslips() {
  const box = document.getElementById('my-payslip-list');
  if (box) box.innerHTML = '<div style="text-align:center;padding:20px;color:var(--tx3)">กำลังโหลด...</div>';
  gasRun('payGetMySlips', { token: S.hrToken })
    .withSuccessHandler(r => {
      if (!r || !r.success) { if (box) box.innerHTML = '<div style="padding:20px;color:var(--er)">' + payEsc((r && r.message) || 'โหลดไม่สำเร็จ') + '</div>'; return; }
      renderMyPayslips(r.slips || []);
    })
    .withFailureHandler(() => { if (box) box.innerHTML = '<div style="padding:20px;color:var(--er)">เกิดข้อผิดพลาด</div>'; });
}

function renderMyPayslips(slips) {
  const box = document.getElementById('my-payslip-list');
  if (!box) return;
  if (!slips.length) {
    box.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--tx3)">ยังไม่มีสลิปเงินเดือน</div>';
    return;
  }

  box.innerHTML = slips.map(s => `
    <div class="lv-card" style="padding:14px 16px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px">
        <div style="font-size:15px;font-weight:700">${payEsc(s.payRound)}</div>
        <div style="font-size:12px;color:var(--tx3)">จ่าย ${payEsc(payFmtDate(s.payDate))}</div>
      </div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px">
        <span style="color:var(--tx2)">รวมเงินได้</span>
        <span style="font-variant-numeric:tabular-nums">${payMoney(s.income)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px">
        <span style="color:var(--tx2)">รวมเงินหัก</span>
        <span style="color:var(--er);font-variant-numeric:tabular-nums">${payMoney(s.deduct)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:8px 0 4px;margin-top:4px;border-top:1px solid var(--bd);font-size:15px">
        <span style="font-weight:700">เงินได้สุทธิ</span>
        <span style="font-weight:700;color:var(--ac);font-variant-numeric:tabular-nums">${payMoney(s.net)} บาท</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
        ${s.bankAcct ? `<span style="font-size:12px;color:var(--tx3)">เลขบัญชี ${payEsc(s.bankAcct)}</span>` : '<span></span>'}
        <a href="${payEsc(s.url)}" target="_blank" style="font-size:13px;color:var(--ac);text-decoration:none;font-weight:600">ดูสลิป PDF →</a>
      </div>
    </div>`).join('');
}

// ════════════════════════════════════════════════
//  ส่ง Telegram แจ้งเงินเดือน (frontend)
// ════════════════════════════════════════════════
window.PAYTG = window.PAYTG || { mode: 'all', time: 'now' };

function openPayTelegram() {
  if (!PAY.currentPeriod) { showToast('เลือกงวดก่อน'); return; }
  go('pay-telegram');
}

function loadPayTelegram() {
  const p = PAY.currentPeriod;
  if (!p) { go('pay-review'); return; }
  const info = document.getElementById('paytg-periodinfo');
  if (info) info.innerHTML = `งวด <b>${payEsc(p.payRound || p.periodId)}</b> · จ่าย ${payEsc(payFmtDate(p.payDate))}`;
  // reset สถานะ
  PAYTG.mode = 'all'; PAYTG.time = 'now';
  syncPayTgUI();
  updatePayTgPreview();
  loadPayTgList();
  loadPayTgSchedules();
  document.getElementById('paytg-send-status').textContent = '';
}

// ตัวอย่างข้อความ
function updatePayTgPreview() {
  const p = PAY.currentPeriod;
  const box = document.getElementById('paytg-preview');
  if (!box || !p) return;
  box.textContent =
    '💰 สลิปเงินเดือน\n\n' +
    'รอบการจ่าย: ' + (p.payRound || p.periodId) + '\n' +
    'วันที่จ่าย: ' + payFmtDate(p.payDate) + '\n' +
    'รหัสพนักงาน: (รหัสของพนักงาน)\n' +
    'ชื่อ: (ชื่อพนักงาน)\n' +
    'เงินได้สุทธิ: (ยอดสุทธิ) บาท\n\n' +
    'ดูรายละเอียดได้ที่เมนูสลิปเงินเดือนในระบบ';
}

// sync ปุ่มโหมด/เวลา + แสดง/ซ่อนส่วน
function syncPayTgUI() {
  document.querySelectorAll('.paytg-mode').forEach(b => b.classList.toggle('active', b.getAttribute('data-mode') === PAYTG.mode));
  document.querySelectorAll('.paytg-time').forEach(b => b.classList.toggle('active', b.getAttribute('data-time') === PAYTG.time));
  document.getElementById('paytg-list-wrap').style.display = (PAYTG.mode === 'select') ? '' : 'none';
  document.getElementById('paytg-sched-box').style.display = (PAYTG.time === 'sched') ? '' : 'none';
  const btn = document.getElementById('paytg-send-btn');
  if (btn) btn.textContent = (PAYTG.time === 'sched') ? '⏰ ตั้งเวลาส่ง' : '📤 ส่ง Telegram';
}

// รายชื่อ (โหมดเลือกหลายคน) — ติ๊กได้เฉพาะคนมี PDF
function loadPayTgList() {
  const box = document.getElementById('paytg-list');
  if (!box) return;
  const rows = (PAY.rows || []).slice().sort((a, b) => String(a.empId).localeCompare(String(b.empId), undefined, { numeric: true }));
  let html = `<table style="width:100%;border-collapse:collapse;font-size:14px">
    <thead><tr>
      <th style="text-align:center;padding:10px 8px;background:var(--sf2)"><input type="checkbox" id="paytg-check-all"></th>
      <th style="text-align:left;padding:10px 12px;font-size:12px;color:var(--tx2);background:var(--sf2)">รหัส</th>
      <th style="text-align:left;padding:10px 12px;font-size:12px;color:var(--tx2);background:var(--sf2)">ชื่อ</th>
      <th style="text-align:right;padding:10px 12px;font-size:12px;color:var(--tx2);background:var(--sf2)">สุทธิ</th>
      <th style="text-align:center;padding:10px 12px;font-size:12px;color:var(--tx2);background:var(--sf2)">PDF</th>
    </tr></thead><tbody>`;
  html += rows.map(r => {
    const hasPdf = !!r.urlPDF;
    return `<tr style="${hasPdf ? '' : 'opacity:.5'}">
      <td style="padding:10px 8px;border-top:1px solid var(--bd);text-align:center"><input type="checkbox" class="paytg-check" data-id="${payEsc(r.rowId)}" ${hasPdf ? '' : 'disabled'}></td>
      <td style="padding:10px 12px;border-top:1px solid var(--bd)">${payEsc(r.empId)}</td>
      <td style="padding:10px 12px;border-top:1px solid var(--bd);white-space:nowrap">${payEsc(r.name)}</td>
      <td style="padding:10px 12px;border-top:1px solid var(--bd);text-align:right;font-variant-numeric:tabular-nums">${payMoney(r.net)}</td>
      <td style="padding:10px 12px;border-top:1px solid var(--bd);text-align:center">${hasPdf ? '<span style="color:var(--ok)">มี</span>' : '<span style="color:var(--tx3)">ยังไม่มี</span>'}</td>
    </tr>`;
  }).join('');
  html += `</tbody></table>
    <div style="padding:11px 14px;font-size:12px;color:var(--tx3);border-top:1px solid var(--bd)">คนที่ยังไม่มี PDF ติ๊กไม่ได้ (ต้องสร้างสลิปก่อน)</div>`;
  box.innerHTML = html;
  const chkAll = document.getElementById('paytg-check-all');
  if (chkAll) chkAll.addEventListener('change', () => {
    box.querySelectorAll('.paytg-check:not([disabled])').forEach(c => { c.checked = chkAll.checked; });
  });
}

// กำหนดการที่ตั้งไว้
function loadPayTgSchedules() {
  const p = PAY.currentPeriod;
  const box = document.getElementById('paytg-sched-list');
  if (!box || !p) return;
  box.innerHTML = '<div style="color:var(--tx3);font-size:13px;padding:8px">กำลังโหลด...</div>';
  gasRun('payGetScheduledSends', { hrToken: S.hrToken, periodId: p.periodId })
    .withSuccessHandler(r => {
      if (!r || !r.success) { box.innerHTML = ''; return; }
      const list = r.schedules || [];
      if (!list.length) { box.innerHTML = '<div style="color:var(--tx3);font-size:13px;padding:8px">ยังไม่มีกำหนดการ</div>'; return; }
      box.innerHTML = list.map(s => {
        const done = s.status === 'SENT';
        const dot = done ? 'var(--ok)' : 'var(--wn)';
        const label = s.rowIds === 'ALL' ? 'ส่งทั้งงวด' : ('เลือก ' + (s.rowIds ? s.rowIds.split(',').length : 0) + ' คน');
        return `<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--bd);border-radius:12px;margin-bottom:8px">
          <div style="width:10px;height:10px;border-radius:50%;background:${dot};flex-shrink:0"></div>
          <div style="flex:1">
            <div style="font-weight:600">${label} · ${payEsc(s.sendAt)}</div>
            <div style="font-size:12px;color:var(--tx3)">${s.count} คน · ${done ? 'ส่งแล้ว ✓' : 'รอส่ง'}</div>
          </div>
          ${done ? '' : `<button class="btn o sm paytg-cancel" data-id="${payEsc(s.schedId)}" style="width:auto;padding:6px 14px">ยกเลิก</button>`}
        </div>`;
      }).join('');
      box.querySelectorAll('.paytg-cancel').forEach(b => b.addEventListener('click', () => cancelPayTgSchedule(b.getAttribute('data-id'))));
    })
    .withFailureHandler(() => { box.innerHTML = ''; });
}

function cancelPayTgSchedule(schedId) {
  if (!confirm('ยกเลิกกำหนดการนี้?')) return;
  gasRun('payCancelSchedule', { hrToken: S.hrToken, schedId: schedId })
    .withSuccessHandler(r => { showToast((r && r.message) || 'ยกเลิกแล้ว'); loadPayTgSchedules(); })
    .withFailureHandler(() => showToast('ยกเลิกไม่สำเร็จ'));
}

// ส่ง / ตั้งเวลา
function doPayTgSend() {
  const p = PAY.currentPeriod;
  if (!p) return;
  const btn = document.getElementById('paytg-send-btn');
  const status = document.getElementById('paytg-send-status');

  // รวบรวม rowIds ถ้าโหมดเลือก
  let rowIds = null;
  if (PAYTG.mode === 'select') {
    rowIds = Array.from(document.querySelectorAll('.paytg-check:checked')).map(c => c.getAttribute('data-id'));
    if (!rowIds.length) { showToast('เลือกพนักงานก่อน'); return; }
  }

  if (btn) btn.disabled = true;

  if (PAYTG.time === 'sched') {
    // ตั้งเวลา
    const at = document.getElementById('paytg-sched-at').value;
    if (!at) { showToast('เลือกวันเวลาก่อน'); if (btn) btn.disabled = false; return; }
    if (status) status.textContent = 'กำลังตั้งเวลา...';
    gasRunNoRetry('payTelegramSchedule', { hrToken: S.hrToken, periodId: p.periodId, rowIds: rowIds, sendAt: at })
      .withSuccessHandler(r => {
        if (btn) btn.disabled = false;
        if (r && r.success) { if (status) status.textContent = '✓ ' + r.message; loadPayTgSchedules(); }
        else if (status) status.textContent = '✗ ' + ((r && r.message) || 'ตั้งเวลาไม่สำเร็จ');
      })
      .withFailureHandler(() => { if (btn) btn.disabled = false; if (status) status.textContent = '✗ เกิดข้อผิดพลาด'; });
  } else {
    // ส่งทันที
    if (status) status.textContent = 'กำลังส่ง...';
    gasRunNoRetry('payTelegramSendNow', { hrToken: S.hrToken, periodId: p.periodId, rowIds: rowIds })
      .withSuccessHandler(r => {
        if (btn) btn.disabled = false;
        if (r && r.success) {
          const rs = r.result || {};
          let msg = `✓ เปิดให้ดูสลิป ${rs.opened || 0} คน`;
          msg += ` · ส่ง Telegram สำเร็จ ${rs.sent || 0} คน`;
          if (rs.noChatId) msg += ` · ไม่มี Telegram ID ${rs.noChatId} คน`;
          if (rs.skipped) msg += ` · ข้าม ${rs.skipped} (ไม่มี PDF)`;
          if (status) status.textContent = msg;
          loadPayReview();   // refresh สถานะส่งแล้ว
        } else if (status) status.textContent = '✗ ' + ((r && r.message) || 'ส่งไม่สำเร็จ');
      })
      .withFailureHandler(() => { if (btn) btn.disabled = false; if (status) status.textContent = '✗ เกิดข้อผิดพลาด'; });
  }
}

// ════════════════════════════════════════════════
//  รายงานเงินเดือน (frontend)
// ════════════════════════════════════════════════
const PAYREP = { periodScope: 'all', empScope: 'all', meta: null, lastResult: null };

function loadPayReport() {
  // reset
  PAYREP.periodScope = 'all'; PAYREP.empScope = 'all'; PAYREP.lastResult = null;
  document.getElementById('payrep-result').innerHTML = '';
  payrepSyncScopeUI();
  // โหลด meta (งวด/คน/คอลัมน์)
  gasRun('payGetReportMeta', { hrToken: S.hrToken })
    .withSuccessHandler(r => {
      if (!r || !r.success) { showToast((r && r.message) || 'โหลดไม่สำเร็จ'); return; }
      PAYREP.meta = r;
      renderPayrepPeriods(r.periods || []);
      renderPayrepEmps(r.people || []);
      renderPayrepCols(r.columns || []);
    })
    .withFailureHandler(() => showToast('เกิดข้อผิดพลาด'));
}

function payrepSetPeriodScope(scope) {
  PAYREP.periodScope = scope;
  document.getElementById('payrep-period-list').style.display = (scope === 'pick') ? 'block' : 'none';
  payrepSyncScopeUI();
}
function payrepSetEmpScope(scope) {
  PAYREP.empScope = scope;
  document.getElementById('payrep-emp-box').style.display = (scope === 'pick') ? 'block' : 'none';
  payrepSyncScopeUI();
}
function payrepSyncScopeUI() {
  document.querySelectorAll('.payrep-pscope').forEach(b => b.classList.toggle('active', b.getAttribute('data-scope') === PAYREP.periodScope));
  document.querySelectorAll('.payrep-escope').forEach(b => b.classList.toggle('active', b.getAttribute('data-scope') === PAYREP.empScope));
}

function renderPayrepPeriods(periods) {
  const box = document.getElementById('payrep-period-list');
  if (!box) return;
  box.innerHTML = periods.map(p => `
    <label style="display:flex;align-items:center;gap:8px;padding:5px 0;cursor:pointer;font-size:14px">
      <input type="checkbox" class="payrep-period-chk" value="${payEsc(p.periodId)}">
      <span>${payEsc(p.payRound || p.periodId)} · จ่าย ${payEsc(payFmtDate(p.payDate))}</span>
    </label>`).join('') || '<div style="color:var(--tx3);font-size:13px">ไม่มีงวด</div>';
}

function renderPayrepEmps(people) {
  const box = document.getElementById('payrep-emp-list');
  if (!box) return;
  box.innerHTML = people.map(p => `
    <label class="payrep-emp-row" data-search="${payEsc((p.empId + ' ' + p.name).toLowerCase())}" style="display:flex;align-items:center;gap:8px;padding:5px 0;cursor:pointer;font-size:14px">
      <input type="checkbox" class="payrep-emp-chk" value="${payEsc(p.empId)}">
      <span>${payEsc(p.empId)} · ${payEsc(p.name)}</span>
    </label>`).join('') || '<div style="color:var(--tx3);font-size:13px">ไม่มีข้อมูล</div>';
}
function payrepFilterEmp(q) {
  q = (q || '').toLowerCase().trim();
  document.querySelectorAll('.payrep-emp-row').forEach(row => {
    const s = row.getAttribute('data-search') || '';
    row.style.display = (!q || s.indexOf(q) !== -1) ? 'flex' : 'none';
  });
}

function renderPayrepCols(columns) {
  const box = document.getElementById('payrep-col-list');
  if (!box) return;
  box.innerHTML = columns.map(c => `
    <label style="display:flex;align-items:center;gap:7px;padding:4px 0;cursor:pointer;font-size:13.5px;break-inside:avoid">
      <input type="checkbox" class="payrep-col-chk" value="${payEsc(c.key)}" ${c.def ? 'checked' : ''}>
      <span>${payEsc(c.label)}</span>
    </label>`).join('');
}
function payrepToggleCols() {
  const box = document.getElementById('payrep-col-box');
  box.style.display = (box.style.display === 'none') ? 'block' : 'none';
}
function payrepCheckAllCols(checked) {
  document.querySelectorAll('.payrep-col-chk').forEach(c => { c.checked = checked; });
}

function payrepRun() {
  const periodIds = (PAYREP.periodScope === 'pick')
    ? Array.from(document.querySelectorAll('.payrep-period-chk:checked')).map(c => c.value) : [];
  const empIds = (PAYREP.empScope === 'pick')
    ? Array.from(document.querySelectorAll('.payrep-emp-chk:checked')).map(c => c.value) : [];
  const colKeys = Array.from(document.querySelectorAll('.payrep-col-chk:checked')).map(c => c.value);

  if (PAYREP.periodScope === 'pick' && !periodIds.length) { showToast('เลือกงวดก่อน'); return; }
  if (PAYREP.empScope === 'pick' && !empIds.length) { showToast('เลือกพนักงานก่อน'); return; }

  const box = document.getElementById('payrep-result');
  box.innerHTML = '<div style="text-align:center;padding:20px;color:var(--tx3)">กำลังโหลด...</div>';

  gasRun('payGetReport', { hrToken: S.hrToken, periodIds: periodIds, empIds: empIds, colKeys: colKeys })
    .withSuccessHandler(r => {
      if (!r || !r.success) { box.innerHTML = '<div style="padding:20px;color:var(--er)">' + payEsc((r && r.message) || 'โหลดไม่สำเร็จ') + '</div>'; return; }
      PAYREP.lastResult = r;
      renderPayrepTable(r);
    })
    .withFailureHandler(() => { box.innerHTML = '<div style="padding:20px;color:var(--er)">เกิดข้อผิดพลาด</div>'; });
}

function renderPayrepTable(r) {
  const box = document.getElementById('payrep-result');
  if (!r.rows.length) { box.innerHTML = '<div style="text-align:center;padding:30px;color:var(--tx3)">ไม่พบข้อมูลตามเงื่อนไข</div>'; return; }

  const cols = r.columns;
  const showPeriod = r.multiPeriod;

  let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin:8px 0 12px">
      <div style="font-size:14px;color:var(--tx2)">พบ ${r.count} รายการ</div>
      <button class="btn p sm" onclick="payrepExport()" style="width:auto;padding:8px 18px">📥 Export Excel</button>
    </div>
    <div style="overflow-x:auto;border:1px solid var(--bd);border-radius:12px">
    <table style="width:100%;border-collapse:collapse;font-size:13px;white-space:nowrap">
    <thead><tr style="background:var(--sf2)">`;
  if (showPeriod) html += '<th style="padding:9px 10px;text-align:left;position:sticky;left:0;background:var(--sf2)">งวด</th>';
  cols.forEach(c => { html += `<th style="padding:9px 10px;text-align:${c.num ? 'right' : 'left'}">${payEsc(c.label)}</th>`; });
  html += '</tr></thead><tbody>';

  r.rows.forEach(row => {
    html += '<tr>';
    if (showPeriod) html += `<td style="padding:8px 10px;border-top:1px solid var(--bd);position:sticky;left:0;background:var(--sf);font-size:12px">${payEsc(row._payRound || row._periodId)}</td>`;
    cols.forEach(c => {
      const v = c.num ? payMoney(row[c.key]) : payEsc(String(row[c.key] || ''));
      html += `<td style="padding:8px 10px;border-top:1px solid var(--bd);text-align:${c.num ? 'right' : 'left'};font-variant-numeric:tabular-nums">${v}</td>`;
    });
    html += '</tr>';
  });

  // แถวรวม
  html += '<tr style="background:var(--sf2);font-weight:700">';
  let firstNum = true;
  if (showPeriod) html += '<td style="padding:10px;border-top:2px solid var(--bd2);position:sticky;left:0;background:var(--sf2)">รวม</td>';
  cols.forEach((c, i) => {
    if (c.num) {
      const label = (!showPeriod && firstNum && i > 0) ? '' : '';
      html += `<td style="padding:10px;border-top:2px solid var(--bd2);text-align:right;color:var(--ac);font-variant-numeric:tabular-nums">${payMoney(r.totals[c.key])}</td>`;
      firstNum = false;
    } else {
      html += `<td style="padding:10px;border-top:2px solid var(--bd2)">${(!showPeriod && i === 0) ? 'รวม' : ''}</td>`;
    }
  });
  html += '</tr></tbody></table></div>';
  box.innerHTML = html;
}

// โหลด SheetJS แบบ lazy (ตอนกด export ครั้งแรก)
function payrepEnsureXLSX(cb) {
  if (typeof XLSX !== 'undefined') { cb(true); return; }
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
  s.onload = () => cb(true);
  s.onerror = () => cb(false);
  document.head.appendChild(s);
}

// Export Excel (ใช้ SheetJS โหลด lazy, fallback CSV ถ้าโหลดไม่ได้)
function payrepExport() {
  const r = PAYREP.lastResult;
  if (!r || !r.rows.length) { showToast('ไม่มีข้อมูล'); return; }
  const cols = r.columns;
  const showPeriod = r.multiPeriod;

  // สร้าง array of arrays
  const header = [];
  if (showPeriod) { header.push('งวด', 'วันจ่าย'); }
  cols.forEach(c => header.push(c.label));
  const aoa = [header];

  r.rows.forEach(row => {
    const line = [];
    if (showPeriod) { line.push(row._payRound || row._periodId, payFmtDate(row._payDate)); }
    cols.forEach(c => line.push(c.num ? payNum(row[c.key]) : String(row[c.key] || '')));
    aoa.push(line);
  });
  // แถวรวม
  const totalLine = [];
  if (showPeriod) { totalLine.push('รวม', ''); }
  cols.forEach((c, i) => {
    if (c.num) totalLine.push(payNum(r.totals[c.key]));
    else totalLine.push(i === 0 && !showPeriod ? 'รวม' : '');
  });
  aoa.push(totalLine);

  const dateStr = new Date().toISOString().slice(0, 10);
  showToast('กำลังสร้างไฟล์...');

  payrepEnsureXLSX(ok => {
    if (ok && typeof XLSX !== 'undefined') {
      try {
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'รายงานเงินเดือน');
        XLSX.writeFile(wb, 'payroll_report_' + dateStr + '.xlsx');
      } catch (e) { payrepExportCsv(aoa, dateStr); }
    } else {
      payrepExportCsv(aoa, dateStr);   // fallback
    }
  });
}

function payrepExportCsv(aoa, dateStr) {
  const csv = aoa.map(row => row.map(cell => {
    const s = String(cell == null ? '' : cell);
    return (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'payroll_report_' + dateStr + '.csv';
  a.click();
}
