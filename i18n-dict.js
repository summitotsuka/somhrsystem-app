/**
 * ═══════════════════════════════════════════════════════════════
 *  i18n-dict.js — พจนานุกรมไทย → อังกฤษ สำหรับหน้าที่ผู้บริหารเห็น
 *
 *  ⚠️⚠️ กุญแจต้องเป็นข้อความที่ "ตัดช่องว่างหัวท้ายแล้ว" ตรงกับที่ขึ้นจอจริง
 *     ถ้าพิมพ์ต่างแม้ตัวเดียว (จุดไข่ปลา ... กับ … ไม่เหมือนกัน) จะไม่แปล
 *
 *  🚫 ห้ามใส่ชื่อคน ชื่อแผนก ชื่อประเภทการลา ชื่อวันหยุด
 *     ของพวกนั้นเป็นข้อมูลในฐานข้อมูล ไม่ใช่ป้ายกำกับในโค้ด
 *
 *  ⚠️ เพิ่มคำใหม่: ดูข้อความที่ขึ้นจอ คัดลอกมาทั้งบรรทัด แล้วใส่เป็นกุญแจ
 * ═══════════════════════════════════════════════════════════════
 */

var I18N_MONTH = {
  'มกราคม':'January','กุมภาพันธ์':'February','มีนาคม':'March','เมษายน':'April',
  'พฤษภาคม':'May','มิถุนายน':'June','กรกฎาคม':'July','สิงหาคม':'August',
  'กันยายน':'September','ตุลาคม':'October','พฤศจิกายน':'November','ธันวาคม':'December',
  'ม.ค.':'Jan','ก.พ.':'Feb','มี.ค.':'Mar','เม.ย.':'Apr','พ.ค.':'May','มิ.ย.':'Jun',
  'ก.ค.':'Jul','ส.ค.':'Aug','ก.ย.':'Sep','ต.ค.':'Oct','พ.ย.':'Nov','ธ.ค.':'Dec'
};

/**
 * ⚠️⚠️ ข้อความที่มี "ตัวเลขหรือชื่อปนอยู่ในบรรทัดเดียวกัน"
 *    เช่น "เลือกแล้ว 3 คน" — เทียบตรงทั้งข้อความไม่ได้ เพราะเลขเปลี่ยนทุกครั้ง
 *    จึงใช้รูปแบบ (regex) แทน · $1 $2 คือค่าที่จับได้จากวงเล็บ
 *
 *  ⚠️ ทำงาน "หลัง" การเทียบตรงทั้งข้อความเสมอ — ถ้าตรงเป๊ะอยู่แล้วจะไม่มาถึงตรงนี้
 *  🚫 ระวังรูปแบบที่กว้างเกินไป จะไปจับข้อมูลของผู้ใช้โดยไม่ตั้งใจ
 *     ทุกรูปแบบต้องยึดหัวหรือท้ายบรรทัด (^ $) ไม่ใช่จับลอย ๆ กลางข้อความ
 */
var I18N_PAT = [
  [/^เลือกแล้ว (\d+) คน$/,                      '$1 selected'],
  [/^รวม (\d+) รายการ$/,                        '$1 records in total'],
  [/^พบ (\d+) รายการ$/,                         '$1 records found'],
  [/^ทั้งหมด (\d+) รายการ$/,                     '$1 records'],
  [/^(\d+) รายการ$/,                            '$1 records'],
  [/^(\d+(?:\.\d+)?) ชั่วโมง$/,                 '$1 hours'],
  [/^(\d+(?:\.\d+)?) ชม\.$/,                   '$1 h'],
  [/^(\d+) วัน$/,                               '$1 days'],
  [/^(\d+) คน$/,                                '$1 people'],
  [/^ข้อมูลลงเวลาไม่สมบูรณ์ (\d+) รายการ$/,        'Incomplete attendance — $1 records'],
  [/^และอีก (\d+) รายการ$/,                      'and $1 more'],
  [/^เกิดข้อผิดพลาด: (.+)$/,                     'Something went wrong: $1'],
  [/^กำลังอนุมัติ (\d+)\/(\d+)$/,               'Approving $1 of $2'],
  [/^สวัสดี (.+)$/,                              'Hello $1'],
  [/^วันหยุดเดือน(.+)$/,                         'Holidays in $1']
];

var I18N_EN = {
  // ── เข้าสู่ระบบ / ลงทะเบียน ──
  'ระบบลงเวลาเข้า-ออกงาน':'Attendance System',
  'รหัสพนักงาน':'Employee ID','รหัสพนักงาน (EmployeeID)':'Employee ID',
  'รหัสผ่าน':'Password','เข้าสู่ระบบ':'Sign in','ลืมรหัสผ่าน':'Forgot password',
  'ลืมรหัสผ่าน?':'Forgot password?','เช่น EMP001':'e.g. EMP001',
  'ลงทะเบียนพนักงานใหม่':'Register new employee',
  'ลงทะเบียนพนักงานใหม่ →':'Register new employee →',
  'Login เพื่อเช็คอินได้เลย →':'Sign in to check in →',
  'พนักงานใหม่ยังไม่มีรหัสผ่าน':'New employees have no password yet',
  'ยืนยันตัวตน':'Verify identity',
  'ยืนยันตัวตนด้วยข้อมูลที่ HR บันทึกไว้':'Verify with the details HR has on file',
  'ยืนยันตัวตนสำเร็จ —':'Identity verified —',
  'กรอกข้อมูลเพื่อยืนยันตัวตนกับ HR แล้วตั้งรหัสผ่านได้เลย':'Verify your identity with HR, then set a password',
  'กรอกข้อมูลให้ตรงกับที่ HR ลงทะเบียนไว้ในระบบ':'Enter details exactly as HR registered them',
  'HR ต้องบันทึกข้อมูลของคุณไว้ในระบบก่อน จึงจะลงทะเบียนได้':'HR must register you before you can sign up',
  'วันที่เริ่มงาน':'Start date','วันที่เริ่มงาน (StartDate)':'Start date',
  'อีเมล':'Email','อีเมล (ที่แจ้งกับ HR)':'Email (as given to HR)',
  'ตั้งรหัสผ่าน':'Set password','ตั้งรหัสผ่านใหม่':'Set a new password',
  'ตั้งรหัส + Selfie':'Password + selfie',
  'รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)':'Password (at least 6 characters)',
  'รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)':'New password (at least 6 characters)',
  'ยืนยันรหัสผ่าน':'Confirm password',
  'ลงทะเบียนเลย ✓':'Register ✓','ลงทะเบียนสำเร็จ':'Registration complete',
  'บันทึกรหัสนี้ไว้ — ใช้ Login ทุกครั้ง':'Keep this ID — you sign in with it every time',
  'Selfie ลงทะเบียน':'Registration selfie',
  '📷 เปิดกล้องถ่าย Selfie':'📷 Open camera','📸 ถ่าย Selfie':'📸 Take selfie',
  '✓ ถ่าย Selfie เรียบร้อย':'✓ Selfie taken','ถ่ายใหม่':'Retake',
  'ถ่ายรูปหน้าตรง แสงดี (ไม่บังคับในระหว่างทดสอบ — ข้ามได้)':'Face the camera in good light (optional during testing)',
  'ตัวอย่าง 01/06/2567 (พ.ศ.) หรือ 01/06/2024 (ค.ศ.) ระบบแปลงให้อัตโนมัติ':'Example 01/06/2024 — the year is converted automatically',
  'วว/ดด/ปปปป':'DD/MM/YYYY','— หรือ —':'— or —',

  // ── หน้าแรก / ปุ่มทั่วไป ──
  'สวัสดี':'Hello','เมนูของฉัน':'My menu','งานอนุมัติ':'Approvals',
  'งานฝ่ายบุคคล':'HR tasks','ประกาศ':'Announcements','วันหยุดเดือนนี้':'Holidays this month',
  'ดูทั้งหมด ›':'View all ›','ดูปฏิทินทั้งหมด ›':'View full calendar ›',
  'ข้อมูลลงเวลาไม่สมบูรณ์':'Incomplete attendance',
  'สลิปเงินเดือน':'Payslip','‹ หน้าหลัก':'‹ Home',
  '‹ เมนูงานบุคคล':'‹ HR menu','← เมนูงานบุคคล':'← HR menu','← กลับ':'← Back',
  '↻ รีเฟรช':'↻ Refresh','ปิด':'Close','บันทึก':'Save','ยกเลิก':'Cancel',
  'ยืนยัน':'Confirm','เสร็จสิ้น':'Done','ค้นหา':'Search','ล้าง':'Clear',

  // ── ภาพรวมประจำวัน ──
  'ภาพรวมประจำวัน':'Daily overview','มาแล้ว':'Present','ยังไม่มา':'Not in yet',
  'มาสาย':'Late','ไม่มาทำงาน':'Absent','ยังไม่ออก':'Not out yet',
  'ไม่มีเข้า':'No check-in','ไม่มีออก':'No check-out',

  // ── ตัวกรองรายงาน ──
  'ช่วงวันที่':'Date range','ตั้งแต่':'From','ถึง':'To',
  'ตั้งแต่วันที่':'From date','ถึงวันที่':'To date',
  'สถานะ':'Status','ประเภท':'Type','ทั้งหมด':'All','ทุกคน':'Everyone',
  'ทุกประเภท':'All types','ทุกสถานะ':'All statuses','รายชื่อ':'People',
  'เลือกพนักงาน':'Select employees','เลือกชื่อพนักงาน':'Select employee',
  'เลือกทั้งหมด':'Select all','เลือกประเภท':'Select type','เลือกประเภท OT':'Select OT type',
  'ค้นหาชื่อ...':'Search name…','ค้นหาชื่อหรือรหัส':'Search name or ID',
  'จัดเรียง':'Sort by','ตามวันที่':'By date','ตามพนักงาน':'By employee',
  'เรียงตามวันที่ แล้วตามพนักงานในแต่ละวัน':'By date, then by employee within each day',
  'ไม่เลือกใคร = เห็นทุกคนที่คุณมีสิทธิ์เห็น':'Select no one = everyone you are allowed to see',
  'เลือกแล้ว 0 คน':'0 selected','สร้างรายงาน':'Generate report',
  'พิมพ์ / บันทึกเป็น PDF':'Print / Save as PDF','จัดหน้าให้อยู่ในกรอบ':'Fit to page',
  'จำนวนรายการ':'Records','รวม':'Total','เลขที่':'No.','เลขที่:':'No.:',
  'ตัวเอง':'Self','รายการ':'items','ไม่มี':'None',

  // ── ชื่อรายงาน ──
  'รายงานการลงเวลา':'Attendance Report','รายงานการลา':'Leave Report',
  'รายงาน OT':'OT Report','รายงานการขอ OT':'OT Request Report',
  'รายงานการขอทำงานล่วงเวลา (OT)':'Overtime (OT) Request Report',
  'รายงานการขอบันทึกเวลา':'Time Correction Request Report',
  'ดูและดาวน์โหลดรายงานตามช่วงเวลาและสถานะ':'View and download reports by period and status',

  // ── หัวตาราง / ช่องข้อมูล ──
  'ชื่อ':'Name','รหัส':'ID','พนักงาน':'Employee','เวลา':'Time',
  'เวลาเข้า':'Time in','เวลาออก':'Time out','เวลาออกงาน':'Time out',
  'เวลาเข้า/ออก':'In / Out','วันที่ยื่น':'Submitted','ช่วงลา':'Leave period',
  'ช่วง OT':'OT period','รูปแบบ':'Mode','เหตุผล':'Reason','เหตุผล:':'Reason:',
  'รายละเอียด:':'Details:','รายละเอียดงาน':'Work details',
  'รายละเอียดงานที่ทำ':'Description of work done','บันทึกเพิ่มเติม':'Notes',
  'ลายเซ็น':'Signature','· ผู้บันทึก:':'· Recorded by:',
  'จำนวนชั่วโมงโอที':'OT hours','ชั่วโมง':'hours','ชม.':'h','ชม.)':'h)',
  'ชม.OT':'h OT','0 ชม.':'0 h','(ข้ามวัน)':'(overnight)',
  'ตรวจสอบข้อมูล':'Check details','ข้อมูลที่ HR บันทึกไว้':'Details on file with HR',

  // ── สถานะคำขอ ──
  'รออนุมัติ':'Pending','รอหัวหน้าขั้น 1':'Pending supervisor (step 1)',
  'รอหัวหน้าขั้น 2':'Pending manager (step 2)','รอฝ่ายบุคคล':'Pending HR',
  'รออนุมัติ (หัวหน้า)':'Pending supervisor','รออนุมัติ (หัวหน้าแผนก)':'Pending department head',
  'รออนุมัติ (ผู้จัดการ)':'Pending manager','รออนุมัติ (ฝ่ายบุคคล)':'Pending HR',
  'รออนุมัติ (บุคคล)':'Pending HR','คำขอลารออนุมัติ':'Leave requests pending',
  'อนุมัติแล้ว':'Approved','อนุมัติแล้ว (รอบปัจจุบัน)':'Approved (current cycle)',
  'ไม่อนุมัติ':'Rejected','ไม่อนุมัติ / ยกเลิก':'Rejected / cancelled',
  'ยกเลิกแล้ว':'Cancelled','ถูกยกเลิก':'Cancelled','ยกเลิกโดย HR':'Cancelled by HR',
  'ปฏิเสธ/ยกเลิกโดย':'Rejected / cancelled by',

  // ── ปุ่มอนุมัติ ──
  'อนุมัติ':'Approve','อนุมัติ OT':'Approve OT','อนุมัติที่เลือก':'Approve selected',
  'อนุมัติหัวหน้า':'Supervisor approval','อนุมัติผู้จัดการ':'Manager approval',
  'อนุมัติบุคคล':'HR approval','หัวหน้า':'Supervisor','ผู้จัดการ':'Manager','บุคคล':'HR',
  'ระบุเหตุผล':'Give a reason','ระบุเหตุผลที่ยกเลิก':'Reason for cancelling',
  'เหตุผลที่ไม่อนุมัติ':'Reason for rejection',
  'เหตุผลที่ไม่อนุมัติ (จำเป็น):':'Reason for rejection (required):',
  'ยืนยันไม่อนุมัติ':'Confirm rejection','ยืนยันยกเลิก':'Confirm cancellation',
  'ยกเลิกคำขอ':'Cancel request','ยกเลิกใบลา':'Cancel leave request',
  'ยกเลิกใบ OT':'Cancel OT request',
  'ยกเลิกใบลา (โดยฝ่ายบุคคล)':'Cancel leave request (HR)',
  'ใช้กรณีอนุมัติผิดพลาด เช่น พนักงานมาทำงานในวันที่ลา':'For approvals made in error — e.g. the employee worked on the leave day',
  'รายการที่เลือก?':'the selected items?','ยังไม่ได้เลือกรายการ':'No items selected',
  'กรุณาเลือกรายการที่ต้องการอนุมัติ':'Please select the items to approve',

  // ── ประเภทและรูปแบบการลา ──
  'เต็มวัน':'Full day','ครึ่งเช้า':'Morning half','ครึ่งบ่าย':'Afternoon half',
  'ครึ่งวันเช้า (3.5 ชม.)':'Morning half (3.5 h)','ครึ่งวันบ่าย (5 ชม.)':'Afternoon half (5 h)',
  'รายชั่วโมง':'Hourly','ลาเป็นชั่วโมง':'Hourly leave','ลาได้เฉพาะ:':'Allowed only:',
  'ประเภทนี้ลาได้เฉพาะ:':'This type allows only:',
  'เริ่ม':'Start','เลือกเวลาเริ่ม':'Select start time','เลือกเวลาเลิก':'Select end time',
  'ส่งคำขอลา':'Submit leave request','แนบไฟล์ (ถ้ามี)':'Attachment (optional)',
  '📎 ไฟล์แนบ':'📎 Attachment','✓ แนบไฟล์แล้ว':'✓ File attached',
  'เว้นว่างได้':'Optional','อื่น ๆ':'Other',

  // ── สถานะพนักงาน ──
  'พ้นสภาพการเป็นพนักงาน':'No longer employed','วันสุดท้ายที่ทำงาน':'Last working day',
  'ลาออกเอง':'Resigned','เลิกจ้าง':'Terminated','เกษียณ':'Retired','ครบสัญญา':'Contract ended',
  'ปิดบัญชีด้วย (ล็อกอินไม่ได้)':'Also disable the account (cannot sign in)',
  '⚠️ ข้อมูลส่วนนี้ฝ่ายบุคคลเห็นเท่านั้น ไม่แสดงบนหน้าจอพนักงาน และไม่ติดไปในรายงาน':'⚠️ HR only — not shown to employees and not included in reports',

  // ── ข้อความระหว่างทำงาน ──
  'กำลังโหลด...':'Loading…','กำลังโหลด…':'Loading…',
  'กำลังโหลดรายชื่อ...':'Loading names…','กำลังโหลดรายชื่อ…':'Loading names…',
  'กำลังค้นหา...':'Searching…','กำลังส่ง...':'Sending…','กำลังอนุมัติ':'Approving',
  'กำลังอนุมัติ...':'Approving…','กำลังยกเลิก...':'Cancelling…',
  'กำลังบันทึกการไม่อนุมัติ...':'Saving rejection…',
  'กำลังเตรียมไฟล์...':'Preparing file…','กำลังแนบไฟล์...':'Attaching file…',
  'กำลังอัปโหลด':'Uploading','กำลังอัปโหลดไฟล์ กรุณารอสักครู่...':'Uploading file, please wait…',
  'กำลังส่งใบคำขอลา กรุณารอสักครู่...':'Submitting leave request, please wait…',
  'กำลังส่งใบคำขอโอที กรุณารอสักครู่...':'Submitting OT request, please wait…',

  // ── ผลลัพธ์ ──
  'สำเร็จ!':'Done!','อนุมัติเรียบร้อย':'Approved','อนุมัติสำเร็จ':'Approved successfully',
  'ปฏิเสธคำขอเรียบร้อย':'Request rejected','ปฏิเสธคำขอแล้ว':'Request rejected',
  'ยกเลิกคำขอเรียบร้อย':'Request cancelled','ยกเลิกใบลาเรียบร้อย':'Leave request cancelled',
  'ยกเลิกใบ OT แล้ว':'OT request cancelled',

  // ── ข้อผิดพลาด ──
  'เกิดข้อผิดพลาด':'Something went wrong','เกิดข้อผิดพลาด:':'Something went wrong:',
  'ไม่สำเร็จ':'Failed','โหลดไม่สำเร็จ':'Could not load',
  'โหลดข้อมูลไม่สำเร็จ':'Could not load data','โหลดรายชื่อไม่สำเร็จ':'Could not load names',
  'โหลดประเภทการลาไม่สำเร็จ':'Could not load leave types',
  'อนุมัติไม่สำเร็จ':'Approval failed','ปฏิเสธไม่สำเร็จ':'Rejection failed',
  'ยกเลิกไม่สำเร็จ':'Cancellation failed','ส่งไม่สำเร็จ':'Could not send',
  'ส่งคำขอไม่สำเร็จ':'Could not submit request','อัปโหลดไม่สำเร็จ':'Upload failed',
  'ไม่พบข้อมูล':'No data found','ไม่พบข้อมูลตามเงื่อนไข':'No data matches your filters',
  'ไม่มีข้อมูล':'No data','ไม่มีข้อมูลให้ส่งออก':'Nothing to export',
  'ไม่พบชื่อที่ค้น':'No matching name','ไม่มีรายชื่อให้เลือก':'No names available',
  'ไม่มีคำขอรออนุมัติ':'No requests pending','ยังไม่มีรายการ':'No records yet',
  'ยังไม่มีรายการ OT':'No OT records yet','ยังไม่มีประวัติการลา':'No leave history yet',
  'เลือกเงื่อนไขแล้วกด “ค้นหา”':'Set your filters, then press Search',
  'เลือกเงื่อนไขแล้วกด “ค้นหา” เพื่อดูรายงาน':'Set your filters, then press Search to view the report',
  'เวลาไม่ถูกต้อง':'Invalid time','เวลาสิ้นสุดต้องหลังเวลาเริ่ม':'End time must be after start time',
  'เวลาที่เลือกไม่อยู่ในช่วงที่กำหนด กรุณาเลือกใหม่':'That time is outside the allowed range',
  'กรอกวันและเวลาให้ครบ':'Please fill in the date and time',
  'กรุณากรอกเหตุผล':'Please give a reason','กรุณากรอกเหตุผลการลา':'Please give a reason for leave',
  'กรุณาระบุเหตุผลที่ยกเลิก':'Please give a reason for cancelling',
  'กรุณาระบุเหตุผลที่ไม่อนุมัติ':'Please give a reason for rejection',
  'กรุณาเลือกประเภทการลา':'Please select a leave type',
  'กรุณาเลือกรูปแบบการลา':'Please select a leave mode',
  'กรุณาเลือกวันที่ลา':'Please select the leave dates',
  'กรุณาเลือกเวลาเริ่ม-สิ้นสุด':'Please select a start and end time',
  'กรุณาเลือกเวลาเริ่มและสิ้นสุด':'Please select a start and end time',
  'กรุณากรอกรายละเอียดงานที่ทำ':'Please describe the work done',


  // ── ป้ายไทล์บนหน้าแรก (พนักงานและหัวหน้า) ──
  'เช็คอิน':'Check in','เช็คเอาต์':'Check out','เช็คเวลา':'My attendance',
  'ขอลางาน':'Request leave','ขอโอที':'Request OT','ปฏิทินวันหยุด':'Holiday calendar',
  'ประวัติการลา':'Leave history','ประวัติโอที':'OT history',
  'ขอบันทึกเวลา':'Time correction','ประวัติขอบันทึกเวลา':'Correction history',
  'อนุมัติลา':'Approve leave','อนุมัติโอที':'Approve OT','อนุมัติบันทึกเวลา':'Approve corrections',
  'รายงานลงเวลา':'Attendance report','รายงานโอที':'OT report',
  'รายงานขอบันทึกเวลา':'Correction report','เมนูงานบุคคล':'HR menu',
  'รายงานทีมของฉัน':'My team reports',

  // ── ป้ายไทล์ในเมนูงานบุคคล (ฝ่ายบุคคล 23 เมนู) ──
  'ภาพรวมรายวัน':'Daily overview','อัปโหลดเวลา':'Upload attendance',
  'รายงานบันทึกดิบ':'Raw scan log','Export เวลา':'Export attendance',
  'จัดการข้อมูลเวลา':'Attendance data','อนุมัติการลา':'Approve leave',
  'อนุมัติ OT':'Approve OT','อนุมัติขอลงเวลา':'Approve corrections',
  'จัดการพนักงาน':'Employees','ลงเวลาไม่สมบูรณ์':'Incomplete attendance',
  'รายงานข้อมูลพนักงาน':'Employee report','ตั้งค่าระบบ':'System settings',
  'จัดการวันหยุด':'Holidays','จัดการประกาศ':'Announcements',
  'ส่ง Telegram':'Send Telegram','ลงทะเบียนใบหน้า':'Face registration',
  'โหมด Kiosk':'Kiosk mode','รายงานเงินเดือน':'Payroll report',
  'งวดเงินเดือน':'Payroll periods',

  // ── ป้ายสถานะในรายงาน ──
  'ปกติ':'Normal','ไม่มา':'Absent','ไม่มีการลงเวลา':'No attendance record',
  'ไม่มีเวลาเข้า':'No check-in time','ไม่มีเวลาออก':'No check-out time',
  'ขาดงาน':'Absent','ลา':'On leave','สาย':'Late','ออกก่อน':'Left early',
  'วันหยุด':'Holiday','วันอาทิตย์':'Sunday','รอก่อนลองใหม่':'Please wait and try again',


  // ── ข้อความจากฝั่งฐานข้อมูล (โมดูลขอบันทึกเวลา และด่านทั่วไป) ──
  //    ⚠️ ข้อความพวกนี้มาจาก SQL ไม่ได้อยู่ในหน้าเว็บ แต่ขึ้นให้ผู้ใช้เห็น
  //    จึงต้องแปลด้วย — และยังแก้ที่ไฟล์นี้ที่เดียวเหมือนเดิม
  'กรุณาเข้าสู่ระบบ':'Please sign in',
  'กรุณาระบุวันที่':'Please specify a date',
  'ไม่พบคำขอ':'Request not found',
  'ไม่พบข้อมูลพนักงาน':'Employee not found',
  'วันที่ไม่ถูกต้อง (ต้องเป็น ปปปป-ดด-วว)':'Invalid date (must be YYYY-MM-DD)',
  'ยื่นคำขอบันทึกเวลาเรียบร้อย รออนุมัติ':'Time correction submitted — pending approval',
  'บันทึกเวลาลงระบบเรียบร้อย':'Time recorded successfully',
  'คำขอนี้ถูกบันทึกไว้แล้ว (ไม่ได้บันทึกซ้ำ)':'This request was already saved (not duplicated)',
  'คำขอนี้ถูกยกเลิก/ปฏิเสธไปแล้ว':'This request was already cancelled or rejected',
  'คำขอนี้ไม่อยู่ในสถานะที่ยกเลิกได้แล้ว':'This request can no longer be cancelled',
  'คำขอยังไม่ได้อนุมัติครบทุกขั้น':'This request has not completed all approval steps',
  'คุณไม่มีสิทธิ์ดำเนินการคำขอนี้ หรือคำขอถูกดำเนินการไปแล้ว':'You are not authorised for this request, or it has already been actioned',
  'คุณไม่มีสิทธิ์อนุมัติคำขอนี้ หรือคำขอถูกดำเนินการไปแล้ว':'You are not authorised to approve this request, or it has already been actioned',
  'คุณไม่มีสิทธิ์ยกเลิกคำขอนี้':'You are not authorised to cancel this request',
  'ยกเลิกได้เฉพาะคำขอของตัวเอง':'You can only cancel your own requests',
  'ไม่สามารถอนุมัติคำขอบันทึกเวลาของตัวเองได้':'You cannot approve your own time correction request',
  'วันนี้ขาดเวลาออก กรุณากรอกเวลาออก':'Check-out time is missing for this day — please enter it',
  'วันนี้ขาดเวลาเข้า กรุณากรอกเวลาเข้า':'Check-in time is missing for this day — please enter it',
  'กรุณากรอกเวลาเข้าหรือเวลาออกอย่างน้อยหนึ่งช่อง':'Please enter at least a check-in or check-out time',
  'เวลาออกต้องหลังเวลาเข้า':'Check-out must be after check-in',
  'รูปแบบเวลาไม่ถูกต้อง (ต้องเป็น ชช:นน)':'Invalid time format (must be HH:MM)',
  'มีคำขอ "เวลาเข้า" ที่ยังไม่จบอยู่แล้ว':'You already have an open check-in request',
  'มีคำขอ "เวลาออก" ที่ยังไม่จบอยู่แล้ว':'You already have an open check-out request',
  'วันนี้ยังทำงานไม่จบ ขอได้ตั้งแต่วันทำงานถัดไป':'Today is not finished yet — you can request from the next working day',
  'ไม่มีรายการลงเวลาไม่สมบูรณ์ในวันที่เลือก':'No incomplete attendance on the selected day',
  'ข้อมูลของวันนั้นไม่ตรงกับคำขอแล้ว (อาจมีข้อมูลเข้ามาภายหลัง) จึงไม่เขียนทับ':'That day no longer matches the request (data may have arrived since) — nothing was overwritten',
  'ตรวจรายการลงเวลาไม่สมบูรณ์ไม่สำเร็จ':'Could not check incomplete attendance',
  'กรุณายกเลิกคำขอนี้แทน':'Please cancel this request instead',

  // ── ตัวเลือกในรายการ ──
  '— เลือกประเภท —':'— Select type —','— เลือกรูปแบบ —':'— Select mode —',
  '— เลือกเวลา —':'— Select time —','— เลือกประเภทการลาก่อน —':'— Select a leave type first —',
  '— ไม่มีประเภทการลา —':'— No leave types —','— ไม่ระบุ —':'— Not specified —'
};
