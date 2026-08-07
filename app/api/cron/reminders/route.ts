import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { sendPushNotification } from "@/lib/push";
import type { Profile } from "@/lib/types";
import type webpush from "web-push";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);

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

  return NextResponse.json({
    checked: profiles?.length ?? 0,
    notified: missing.length,
    failures: results.filter((r) => r.status === "rejected").length,
  });
}
