import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { GratitudeContent } from "@/lib/models";
import { apiHandler } from "@/lib/server/api";

export const dynamic = "force-dynamic";

/* النص الافتراضي — يُزرع مرة واحدة عند أول تشغيل ثم يبقى تعديل الأدمين محفوظاً */
const DEFAULT_AR = `من منصة «رفيقي النفسي» نتقدّم بجزيل الشكر والعرفان إلى كل من وقف بجانبنا:

إلى الأخصائيين النفسيين المتطوعين الذين منحوا وقتهم وقلوبهم لراحة من أومد بهم الله، وإلى المنقذين والمتطوعين الذين لم يبخلوا بالجهد في أحلك اللحظات، وإلى كل متضرر شاركنا ثقته وكل صوت رافق رحلة تعافٍ — أنتم من يحوّلون هذه المنصة من فكرة إلى أمل حقيقي.

شكراً لكل يد ممدودة، ولكل كلمة طيبة، ولكل دعوة في ظهر الغيب.`;
const DEFAULT_FR = `De la part de « Rafiqi Nafsi », nous adressons nos sincères remerciements et notre profonde gratitude à tous ceux qui se sont tenus à nos côtés :

Aux psychologues bénévoles qui ont donné de leur temps et de leur cœur pour apaiser ceux dont Dieu a éprouvé le sort, aux sauveteurs et volontaires qui n'ont pas ménagé leurs efforts dans les moments les plus sombres, et à chaque personne éprouvée qui nous a confié sa confiance et accompagné ce chemin de rétablissement — c'est vous qui transformez cette plateforme d'une simple idée en un véritable espoir.

Merci à chaque main tendue, à chaque mot de douceur, et à chaque prière discrète.`;
const DEFAULT_EN = `From « Rafiqi Nafsi », we extend our heartfelt thanks and gratitude to everyone who stood by our side:

To the volunteer psychologists who gave their time and hearts to comfort those affected, to the rescuers and volunteers who spared no effort in the darkest hours, and to every survivor who entrusted us with their confidence and walked this healing journey with us — you are the ones who turn this platform from an idea into a real hope.

Thank you for every helping hand, every kind word, and every silent prayer.`;

const ALLOWED_SYMBOLS = ["❤️", "💛", "💚", "💙", "🧡", "🌹", "🌟", "✨", "🕊️", "💐", "🤲", "🫶", "🌸"];

function mapContent(c: Record<string, unknown>) {
  return {
    id: String(c._id ?? ""),
    textAr: c.textAr,
    textFr: c.textFr,
    textEn: c.textEn,
    symbol: (c.symbol as string) || "❤️",
    active: c.active !== false,
  };
}

async function ensureSeeded() {
  const count = await GratitudeContent.countDocuments();
  if (count > 0) return;
  try {
    await GratitudeContent.create({ textAr: DEFAULT_AR, textFr: DEFAULT_FR, textEn: DEFAULT_EN, symbol: "❤️", active: true });
    console.log("🌱 تم زرع نص صفحة الشكر والعرفان الافتراضي");
  } catch (e) {
    console.error("تعذر زرع نص صفحة الشكر:", (e as Error).message);
  }
}

/* ─── عام: محتوى صفحة الشكر (سجل مفرد) ─── */
async function GET_impl() {
  await connectDB();
  await ensureSeeded();
  const doc = await GratitudeContent.findOne().sort({ createdAt: 1 }).lean();
  return NextResponse.json({ content: doc ? mapContent(doc as unknown as Record<string, unknown>) : null });
}

/* ─── إدارة الأدمين: قراءة + تحديث (نص ثلاثي اللغات + الرمز) ─── */
async function POST_impl(req: NextRequest) {
  const body = await req.json();
  const action = body.action;
  await connectDB();
  await ensureSeeded();

  if (action === "get") {
    const doc = await GratitudeContent.findOne().sort({ createdAt: 1 }).lean();
    return NextResponse.json({ content: doc ? mapContent(doc as unknown as Record<string, unknown>) : null });
  }

  if (action === "update") {
    const textAr = String(body.textAr || "").trim();
    const textFr = String(body.textFr || "").trim();
    const textEn = String(body.textEn || "").trim();
    if (!textAr || !textFr || !textEn) {
      return NextResponse.json({ error: "MISSING_LANGUAGES" }, { status: 400 });
    }
    const symbol = ALLOWED_SYMBOLS.includes(String(body.symbol || "")) ? String(body.symbol) : "❤️";
    const doc = await GratitudeContent.findOne().sort({ createdAt: 1 });
    if (!doc) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    doc.textAr = textAr;
    doc.textFr = textFr;
    doc.textEn = textEn;
    doc.symbol = symbol;
    if (typeof body.active === "boolean") doc.active = body.active;
    await doc.save();
    return NextResponse.json({ ok: true, content: mapContent(doc.toObject() as unknown as Record<string, unknown>) });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export const GET = apiHandler(GET_impl);
export const POST = apiHandler(POST_impl);
