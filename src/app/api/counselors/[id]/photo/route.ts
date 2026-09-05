import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { CounselorProfile } from "@/lib/models";
import { apiHandler } from "@/lib/server/api";

export const dynamic = "force-dynamic";

/* ─── تقديم الصورة الشخصية كصورة حقيقية مع تخزين مؤقت طويل ───
   v2.5.3: كانت الصور تُنقل base64 داخل JSON قائمة الأخصائيين
   (حتى 1.5MB لكل أخصائي!) فيتباطأ دليل الأخصائيين كثيراً.
   الآن: القائمة تحمل photoUrl فقط، والصورة تُحمَّل من هنا
   كملف ثنائي خفيف يُخبّئه المتصفح أسبوعاً كاملاً. */
async function GET_impl(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await connectDB();

  const profile = (await CounselorProfile.findById(id)
    .select("photo")
    .lean()) as { photo?: string | null } | null;
  const photo = profile?.photo || null;

  if (!photo || !photo.startsWith("data:image/")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const match = photo.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return new NextResponse("Not found", { status: 404 });

  const buf = Buffer.from(match[2], "base64");
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": match[1],
      /* الصورة نادرة التغيير — أسبوع تخزين مؤقت + إعادة تحقق خلفية يومياً */
      "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
      "Content-Length": String(buf.length),
    },
  });
}

export const GET = apiHandler(GET_impl);
