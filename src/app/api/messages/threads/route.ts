import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Message, User } from "@/lib/models";
import { apiHandler } from "@/lib/server/api";

export const dynamic = "force-dynamic";

/**
 * v2.9.0 — صندوق المحادثات (خيوط DM) لمستخدم معيّن.
 * GET /api/messages/threads?userId={id}
 * يجمع كل خيوط dm:* التي يشارك فيها المستخدم ويعيد لكل خيط:
 * الطرف الآخر (معرّفه واسمه) + آخر رسالة + وقتها.
 * تعتمد عليه لوحة الأخصائي لرؤية رسائل المتضررين والرد عليها بلا جلسة،
 * كما يستعمله المتضرر لرؤية محادثاته مع المختصين.
 */
async function GET_impl(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  await connectDB();
  const rows = (await Message.aggregate([
    { $match: { threadKey: { $regex: "^dm:" } } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: "$threadKey", doc: { $first: "$$ROOT" } } },
    { $sort: { "doc.createdAt": -1 } },
    { $limit: 80 },
  ]).allowDiskUse(true)) as {
    _id: string;
    doc: { senderName?: string; senderRole?: string; content: string; createdAt: Date };
  }[];

  const threads: {
    peerId: string;
    peerName: string | null;
    lastMessage: string;
    lastAt: string;
    lastSenderRole: string | null;
    mine: boolean;
  }[] = [];

  for (const row of rows) {
    const key = String(row._id || "");
    const parts = key.split(":");
    if (parts.length !== 3) continue;
    const [, a, b] = parts;
    if (a !== userId && b !== userId) continue;
    const peerId = a === userId ? b : a;
    const peer = (await User.findById(peerId).select("pseudonym").lean()) as { pseudonym?: string } | null;
    const myMsg =
      (row.doc.senderRole === "VICTIM" && a === userId) || (row.doc.senderRole === "COUNSELOR" && b === userId);
    threads.push({
      peerId,
      peerName: peer?.pseudonym || row.doc.senderName || null,
      lastMessage: String(row.doc.content || "").slice(0, 140),
      lastAt: new Date(row.doc.createdAt).toISOString(),
      lastSenderRole: row.doc.senderRole ?? null,
      mine: myMsg,
    });
  }

  return NextResponse.json({ threads });
}

export const GET = apiHandler(GET_impl);
