export function AdherenceStreakCard({ streak }: { streak: number }) {
  return (
    <div className="bg-[var(--raise)] border border-[var(--line)] rounded-lg p-4 flex items-center justify-between">
      <h2 className="font-medium">Adherence streak</h2>
      <span className="font-mono text-2xl text-[var(--ok)]">{streak}d</span>
    </div>
  );
}
