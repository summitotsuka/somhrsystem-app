/**
 * ═══════════════════════════════════════════════════════════════
 *  i18n.js — ชั้นแปลภาษาอังกฤษ สำหรับผู้บริหารชาวต่างชาติ (บทบาท EXEC)
 *
 *  ⚠️⚠️ หลักการออกแบบ — "ไม่แตะข้อความไทยเดิมสักคำ"
 *     ระบบนี้มีข้อความไทยประมาณ 1,390 จุดกระจายอยู่ 4 ไฟล์
 *     ถ้าไล่ใส่ป้ายกำกับทีละจุด = แก้โค้ดหลายพันบรรทัดที่ใช้งานอยู่ทุกวัน
 *     วิธีนี้จึงทำเป็น "ชั้นแปลตอนแสดงผล" แทน:
 *       อ่านข้อความที่ขึ้นจอแล้ว → เทียบกับพจนานุกรม → เปลี่ยนเฉพาะที่ตรงเป๊ะ
 *     ผลคือโค้ดเดิมไม่ถูกแตะเลย และคนไทยไม่ได้รับผลกระทบใด ๆ
 *
 *  ⚠️⚠️ เทียบแบบ "ตรงทั้งข้อความ" เท่านั้น ไม่เทียบบางส่วน
 *     เพราะชื่อพนักงาน ชื่อแผนก ชื่อวันหยุด เป็น "ข้อมูล" ไม่ใช่ "ป้ายกำกับ"
 *     การเทียบบางส่วนจะไปแก้ชื่อคนโดยไม่ตั้งใจ
 *
 *  🚫🚫 ชั้นนี้ไม่แปลข้อมูล — ชื่อพนักงาน ชื่อแผนก ชื่อประเภทการลา
 *     ชื่อวันหยุด ข้อความประกาศ ยังเป็นภาษาไทย เพราะอยู่ในฐานข้อมูล
 *
 *  ⚠️ ตัวเฝ้าดู (MutationObserver) ทำงานเฉพาะตอนเลือกภาษาอังกฤษ
 *
 *  พจนานุกรมอยู่ในไฟล์ i18n-dict.js (โหลดก่อนไฟล์นี้)
 * ═══════════════════════════════════════════════════════════════
 */

var I18N = (function () {
  'use strict';

  var KEY = 'somhr_lang';
  var lang = 'th';
  try { lang = localStorage.getItem(KEY) || 'th'; } catch (e) { lang = 'th'; }

  var MONTH = (typeof I18N_MONTH !== 'undefined') ? I18N_MONTH : {};
  var EN    = (typeof I18N_EN    !== 'undefined') ? I18N_EN    : {};
  var PAT   = (typeof I18N_PAT   !== 'undefined') ? I18N_PAT   : [];

  /** แปลข้อความเดียว — ตรงทั้งข้อความเท่านั้น ไม่ตรงก็ลองแปลงวันที่ */
  function one(s) {
    if (lang !== 'en') return s;
    var t = String(s);
    var k = t.trim();
    if (!k) return s;
    var hit = EN[k];
    if (hit !== undefined) return t.replace(k, hit);
    // ⚠️ ไม่ตรงเป๊ะ → ลองรูปแบบที่มีค่าปนอยู่ (เช่น "เลือกแล้ว 3 คน")
    //    🚫 ลองหลังการเทียบตรงเสมอ ของที่ตรงเป๊ะจะไม่มาถึงตรงนี้
    for (var i = 0; i < PAT.length; i++) {
      if (!PAT[i][0].test(k)) continue;
      // ⚠️ ส่วนที่จับได้ลองแปลต่ออีกชั้น เผื่อเป็นคำที่มีในพจนานุกรม
      //    เช่น "เกิดข้อผิดพลาด: ไม่พบคำขอ" → ส่วนหลังโคลอนแปลได้ด้วย
      //    🚫 ไม่เรียกตัวเองซ้ำ (ชั้นเดียวพอ) กันวนไม่รู้จบ
      var แทน = PAT[i][1].replace(/\$(\d)/g, function (m, n) {
        var cap = k.replace(PAT[i][0], '$' + n);
        return EN[cap.trim()] !== undefined ? EN[cap.trim()] : cap;
      });
      return t.replace(k, แทน);
    }
    return แปลงวันที่(t);
  }

  /**
   * แปลงวันที่ในข้อความ — พ.ศ. → ค.ศ. และเดือนไทย → อังกฤษ
   * ⚠️⚠️ จับเฉพาะรูปแบบที่เป็นวันที่แน่ ๆ
   *    ห้ามไล่แทนเลข 25xx ทุกตัว ไม่งั้นจะไปแก้รหัสพนักงาน เลขที่ใบคำขอ
   *    หรือจำนวนเงินโดยไม่ตั้งใจ
   */
  function แปลงวันที่(t) {
    if (t.indexOf('25') < 0 && !/[ก-๙]/.test(t)) return t;
    t = t.replace(/(\d{1,2}\/\d{1,2}\/)(25\d\d)/g, function (m, a, y) {
      return a + (parseInt(y, 10) - 543);
    });
    t = t.replace(/\b(25\d\d)(-\d{2}-\d{2})\b/g, function (m, y, rest) {
      return (parseInt(y, 10) - 543) + rest;
    });
    for (var th in MONTH) {
      if (t.indexOf(th) < 0) continue;
      var re = new RegExp('(\\d{1,2}\\s*)' + th.replace(/\./g, '\\.') + '(\\s*)(25\\d\\d)?', 'g');
      var en = MONTH[th];
      t = t.replace(re, function (m, d, sp, y) {
        return d + en + (y ? ' ' + (parseInt(y, 10) - 543) : sp);
      });
    }
    return t;
  }

  /**
   * เดินดูข้อความทั้งหมดใน root แล้วแปล
   * ⚠️ ข้าม script/style/textarea
   * ⚠️ ทำซ้ำได้ไม่เสียหาย — ข้อความที่แปลแล้วจะไม่ตรงกุญแจไทยอีก
   */
  function apply(root) {
    if (lang !== 'en' || !root) return;
    var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1 };
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (n.parentNode && SKIP[n.parentNode.nodeName]) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n, list = [];
    while ((n = w.nextNode())) list.push(n);
    for (var i = 0; i < list.length; i++) {
      var เดิม = list[i].nodeValue;
      var ใหม่ = one(เดิม);
      if (ใหม่ !== เดิม) list[i].nodeValue = ใหม่;
    }
    var el = root.querySelectorAll ? root.querySelectorAll('[placeholder],[title]') : [];
    for (var j = 0; j < el.length; j++) {
      var ph = el[j].getAttribute('placeholder');
      if (ph) { var p2 = one(ph); if (p2 !== ph) el[j].setAttribute('placeholder', p2); }
      var ti = el[j].getAttribute('title');
      if (ti) { var t2 = one(ti); if (t2 !== ti) el[j].setAttribute('title', t2); }
    }
  }

  // ── ตัวเฝ้าดู: เนื้อหาที่เรนเดอร์ทีหลัง (ตารางรายงาน การ์ดอนุมัติ) ──
  //    ⚠️ เปิดเฉพาะตอนภาษาอังกฤษ · คนไทยไม่มีภาระเพิ่ม
  var obs = null;
  function เฝ้าดู() {
    if (lang !== 'en' || obs || typeof MutationObserver === 'undefined') return;
    obs = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var a = muts[i].addedNodes;
        for (var j = 0; j < a.length; j++) {
          if (a[j].nodeType === 1) apply(a[j]);
          else if (a[j].nodeType === 3) {
            var v = one(a[j].nodeValue);
            if (v !== a[j].nodeValue) a[j].nodeValue = v;
          }
        }
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  /** ⚠️ สลับภาษาแล้วโหลดหน้าใหม่ — ชั้นนี้แปลทางเดียว ไม่ได้เก็บไทยเดิมไว้ */
  function set(l) {
    lang = (l === 'en') ? 'en' : 'th';
    try { localStorage.setItem(KEY, lang); } catch (e) {}
    location.reload();
  }

  function get() { return lang; }

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () {
      if (lang === 'en') { apply(document.body); เฝ้าดู(); }
    });
  }

  return { apply: apply, set: set, get: get, one: one, dict: EN, watch: เฝ้าดู };
})();
