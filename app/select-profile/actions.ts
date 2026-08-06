"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function selectProfile(profileId: string) {
  const cookieStore = await cookies();
  cookieStore.set("profile_id", profileId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
  });
  redirect("/today");
}
