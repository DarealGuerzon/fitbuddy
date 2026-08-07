import { SetEntryForm } from "@/components/SetEntryForm";
import { ConditioningEntryForm } from "@/components/ConditioningEntryForm";
import { WeighInForm } from "@/components/WeighInForm";
import { AdherenceToggle } from "@/components/AdherenceToggle";

export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const { session } = await searchParams;

  return (
    <main className="flex flex-col gap-6 px-4 pt-8">
      <h1 className="text-xl font-medium">Log</h1>
      {session ? (
        <>
          <SetEntryForm sessionId={session} />
          <ConditioningEntryForm sessionId={session} />
        </>
      ) : (
        <p className="text-[var(--dim)] text-sm">
          Start a session from Today to log sets.
        </p>
      )}
      <WeighInForm />
      <AdherenceToggle />
    </main>
  );
}
