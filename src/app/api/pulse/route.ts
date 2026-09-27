import { and, desc, eq, gt, inArray, ne } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getCtx } from "@/lib/context";
import { getDb } from "@/lib/db/client";
import { media, presence, roomEvents, roomState } from "@/lib/db/schema";
import { unseenCount } from "@/lib/media/queries";

const PLACES = new Set(["site", "room", "gallery", "away"]);

export type PulseResponse = {
  serverNow: string;
  partners: { slug: string; online: boolean; lastSeenAt: string | null; place: string | null }[];
  unseenGallery: number;
  room: { playing: boolean; title: string | null; bySlug: string | null; updatedAt: string } | null;
  events: { id: number; kind: string; body: string; slug: string }[];
  lastEventId: number;
};

const ONLINE_MS = 70_000;

/**
 * Heartbeat: records that I'm here (and where), and returns whether my partner
 * is online, what's playing in the Together room, new gallery posts, and any
 * nudges or invites sent to me since `after`.
 * Called every ~25 s while a tab is visible, and with {leave:true} via
 * sendBeacon when the tab is hidden or closed.
 */
export async function POST(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { place?: string; leave?: boolean; after?: number | null };
  const place = body.leave ? "away" : PLACES.has(body.place ?? "") ? body.place! : "site";
  const db = await getDb();
  const now = new Date();

  await db
    .insert(presence)
    .values({ personId: ctx.me.id, lastSeenAt: now, place })
    .onConflictDoUpdate({ target: presence.personId, set: { lastSeenAt: now, place } });
  if (body.leave) return new NextResponse(null, { status: 204 });

  const partnerIds = ctx.partners.map((p) => p.id);
  const after = typeof body.after === "number" && Number.isFinite(body.after) ? body.after : null;
  const [states, unseen, [room], events, [latest]] = await Promise.all([
    partnerIds.length ? db.select().from(presence).where(inArray(presence.personId, partnerIds)) : Promise.resolve([]),
    unseenCount(ctx),
    db
      .select({ playing: roomState.playing, title: roomState.title, mediaTitle: media.title, updatedBy: roomState.updatedBy, updatedAt: roomState.updatedAt })
      .from(roomState)
      .leftJoin(media, eq(media.id, roomState.mediaId))
      .where(eq(roomState.relationshipId, ctx.relationship.id)),
    after === null
      ? Promise.resolve([])
      : db
          .select()
          .from(roomEvents)
          .where(and(eq(roomEvents.relationshipId, ctx.relationship.id), gt(roomEvents.id, after), ne(roomEvents.personId, ctx.me.id), inArray(roomEvents.kind, ["nudge", "invite", "system"])))
          .orderBy(roomEvents.id)
          .limit(10),
    db.select({ id: roomEvents.id }).from(roomEvents).where(eq(roomEvents.relationshipId, ctx.relationship.id)).orderBy(desc(roomEvents.id)).limit(1),
  ]);

  const slugOf = (id: string | null) => ctx.members.find((m) => m.id === id)?.slug ?? null;
  const res: PulseResponse = {
    serverNow: now.toISOString(),
    partners: ctx.partners.map((p) => {
      const s = states.find((x) => x.personId === p.id);
      const online = !!s && s.place !== "away" && now.getTime() - s.lastSeenAt.getTime() < ONLINE_MS;
      return { slug: p.slug, online, lastSeenAt: s?.lastSeenAt.toISOString() ?? null, place: online ? s!.place : null };
    }),
    unseenGallery: unseen,
    room: room ? { playing: room.playing, title: room.title ?? room.mediaTitle, bySlug: slugOf(room.updatedBy), updatedAt: room.updatedAt.toISOString() } : null,
    events: events.map((e) => ({ id: e.id, kind: e.kind, body: e.body, slug: slugOf(e.personId) ?? "" })),
    lastEventId: Math.max(latest?.id ?? 0, ...events.map((e) => e.id)),
  };
  return NextResponse.json(res, { headers: { "Cache-Control": "no-store" } });
}
