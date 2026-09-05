/* اختبار E2E للمحادثة الفورية عبر الخادم الموحّد
 * مسار حقيقي كامل: إنشاء متضرر → حجز جلسة مع أخصائي → محادثة عميلين → كشف أزمة → تحقق من التخزين
 * التشغيل:  TEST_URL=http://127.0.0.1:3100 node scripts/test-socket.js
 */
const { io } = require("socket.io-client");

const URL = process.env.TEST_URL || "http://127.0.0.1:3100";
let fails = 0;
const ok = (name, cond) => {
  console.log((cond ? "✅" : "❌") + " " + name);
  if (!cond) fails++;
};

async function main() {
  const jsonOrThrow = async (r, label) => {
    const text = await r.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`${label}: استجابة غير JSON (status=${r.status}): ${text.slice(0, 200)}`);
    }
  };

  /* 1) تجهيز جلسة حقيقية عبر REST (نظام الحسابات الجديد) */
  const stamp = Date.now();
  const vRes = await fetch(`${URL}/api/victim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "register", pseudonym: "ضيف-اختبار-" + stamp, password: "test-pass-123", recoveryPhrase: "عبارة استرجاع اختبار" }),
  });
  const vData = await jsonOrThrow(vRes, "POST /api/victim");
  ok("إنشاء متضرر بحساب جديد (POST /api/victim)", vData.ok && !!vData.user?.id);

  const cRes = await fetch(`${URL}/api/counselors`);
  const cData = await jsonOrThrow(cRes, "GET /api/counselors");
  const counselor = (cData.counselors || [])[0];
  ok("جلب أخصائي موثّق", !!counselor?.userId);

  const sRes = await fetch(`${URL}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      victimId: vData.user.id,
      counselorId: counselor.userId,
      topic: "anxiety",
      mode: "TEXT",
    }),
  });
  const sData = await jsonOrThrow(sRes, "POST /api/sessions");
  const sid = sData.session?.id;
  ok("حجز جلسة (POST /api/sessions)", !!sid);

  /* 2) عميلان حقيقيان */
  const a = io(URL, { path: "/socket.io", transports: ["websocket", "polling"] });
  const b = io(URL, { path: "/socket.io", transports: ["websocket", "polling"] });

  let aReady = false, bReady = false, crisisSeen = false, typingSeen = false;
  const received = [];
  let presenceRoles = [];
  const tryStart = () => {
    if (aReady && bReady) {
      a.emit("join_session", { sessionId: sid, role: "VICTIM", name: "ضيف-اختبار" });
      b.emit("join_session", { sessionId: sid, role: "COUNSELOR", name: "د. أمينة ب." });
      setTimeout(() => a.emit("typing", { sessionId: sid, role: "VICTIM", typing: true }), 500);
      setTimeout(() => a.emit("text_message", { sessionId: sid, role: "VICTIM", name: "ضيف-اختبار", content: "مرحباً، أحتاج الدعم" }), 700);
      setTimeout(() => a.emit("text_message", { sessionId: sid, role: "VICTIM", name: "ضيف-اختبار", content: "أحياناً أريد الموت من كل هذا الدمار" }), 1200);
    }
  };

  b.on("text_message", (m) => received.push(m.content));
  b.on("crisis_alert", (d) => { crisisSeen = !!d.phrase; });
  b.on("typing", (d) => { if (d.typing) typingSeen = true; });
  b.on("presence", (d) => { presenceRoles = d.members.map((m) => m.role); });
  a.on("connect", () => { aReady = true; tryStart(); });
  b.on("connect", () => { bReady = true; tryStart(); });

  await new Promise((r) => setTimeout(r, 3000));

  ok(`الاتصال المباشر بالموقع نفسه (${URL})`, aReady && bReady);
  ok("حضور الغرفة (VICTIM + COUNSELOR)", presenceRoles.includes("VICTIM") && presenceRoles.includes("COUNSELOR"));
  ok("الرسالة الفورية وصلت للطرف الثاني", received.some((c) => c.includes("أحتاج الدعم")));
  ok("مؤشر الكتابة", typingSeen);
  ok("كشف عبارة الأزمة → تنبيه فوري", crisisSeen);

  /* 3) تحقق التخزين */
  const mRes = await fetch(`${URL}/api/messages?sessionId=${sid}`);
  const mData = await mRes.json();
  ok(`تخزين الرسائل في القاعدة (${(mData.messages || []).length})`, (mData.messages || []).length >= 2);

  const crRes = await fetch(`${URL}/api/crisis`);
  const crData = await crRes.json();
  ok("سجل الأزمة يظهر للإدارة", (crData.logs || []).some((l) => l.sessionId === sid));

  const seRes = await fetch(`${URL}/api/sessions/${sid}`);
  const seData = await seRes.json();
  ok("علم الأزمة على الجلسة (crisisFlag)", seData.session?.crisisFlag === true);

  a.disconnect(); b.disconnect();
  console.log(fails === 0 ? "\n🎉 كل اختبارات المحادثة نجحت" : `\n💥 ${fails} اختبارات فشلت`);
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((e) => { console.error("خطأ في الاختبار:", e); process.exit(1); });
