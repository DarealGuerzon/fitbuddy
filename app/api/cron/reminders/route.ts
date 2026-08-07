import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { sendPushNotification } from "@/lib/push";
import type { Profile } from "@/lib/types";
import type webpush from "web-push";

function isAuthorized(authHeader: string | null): boolean {
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!authHeader) return false;
  const authBuf = Buffer.from(authHeader);
  const expectedBuf = Buffer.from(expected);
  if (authBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(authBuf, expectedBuf);
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!isAuthorized(authHeader)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  // The app's 2 users are both in a fixed, non-DST timezone (Philippines, UTC+8).
  // weigh_ins.date stores the client's local calendar date (see lib/form.ts's
  // getLocalDate), so "today" here must match that timezone, not server UTC.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());

  const { data: profiles } = await supabase.from("profiles").select("*").returns<Profile[]>();
  const { data: weighInsToday } = await supabase
    .from("weigh_ins")
    .select("profile_id")
    .eq("date", today);

  const weighedInIds = new Set((weighInsToday ?? []).map((w) => w.profile_id));
  const missing = (profiles ?? []).filter((p) => !weighedInIds.has(p.id) && p.push_subscription);

  const results = await Promise.allSettled(
    missing.map((profile) =>
      sendPushNotification(profile.push_subscription as unknown as webpush.PushSubscription, {
        title: "FitBuddy",
        body: "No weigh-in logged today yet.",
      })
    )
  );

  results.forEach((result, i) => {
    if (result.status === "rejected") {
      console.error(`Push notification failed for profile ${missing[i].id}:`, result.reason);
    }
  });

  return NextResponse.json({
    checked: profiles?.length ?? 0,
    notified: missing.length,
    failures: results.filter((r) => r.status === "rejected").length,
  });
}
