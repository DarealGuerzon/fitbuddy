import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  // profile_id here is a possession check, not a session check — this route is
  // intentionally excluded from proxy.ts's auth guard so it's reachable pre-auth.
  // A forged profile_id cookie could overwrite another profile's subscription;
  // accepted risk for a 2-user household app where profile IDs aren't exposed
  // pre-login and aren't guessable.
  const cookieStore = await cookies();
  const profileId = cookieStore.get("profile_id")?.value;
  if (!profileId) {
    return NextResponse.json({ error: "No profile selected" }, { status: 401 });
  }

  const subscription = await request.json();

  if (
    typeof subscription?.endpoint !== "string" ||
    typeof subscription?.keys?.p256dh !== "string" ||
    typeof subscription?.keys?.auth !== "string"
  ) {
    return NextResponse.json({ error: "Invalid subscription payload" }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ push_subscription: subscription })
    .eq("id", profileId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
