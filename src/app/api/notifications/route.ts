import { NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/session";
import { listNotifications, unreadCount } from "@/modules/ops/service";

export async function GET() {
  try {
    const user = await requireUser();
    const [items, unread] = await Promise.all([
      listNotifications(user.id),
      unreadCount(user.id),
    ]);
    return NextResponse.json({
      unread,
      notifications: items.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        leadId: n.leadId,
        leadName: n.lead?.fullName ?? null,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}
