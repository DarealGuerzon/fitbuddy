import { getSupabaseServerClient } from "@/lib/supabase-server";
import type { Profile } from "@/lib/types";
import { selectProfile } from "./actions";

export default async function SelectProfilePage() {
  const supabase = getSupabaseServerClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name")
    .returns<Pick<Profile, "id" | "name">[]>();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-xl font-medium mb-2">Who&apos;s training?</h1>
      {(profiles ?? []).map((profile) => (
        <form key={profile.id} action={selectProfile.bind(null, profile.id)}>
          <button
            type="submit"
            className="bg-[var(--surface)] border border-[var(--line)] rounded-lg px-8 py-4 text-lg w-64"
          >
            {profile.name}
          </button>
        </form>
      ))}
    </main>
  );
}
