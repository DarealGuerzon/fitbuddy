import { startSession } from "./actions";

export default function TodayPage() {
  return (
    <main className="flex flex-col gap-8 px-4 pt-8">
      <h1 className="text-xl font-medium">Today</h1>

      <div className="bg-[var(--raise)] border border-[var(--line)] rounded-lg p-6 text-[var(--dim)] text-sm">
        Muscle highlight — coming soon
      </div>

      <form action={startSession} className="flex flex-col gap-3">
        <input
          name="session_label"
          placeholder="Session label (e.g. Mon lower)"
          className="bg-[var(--surface)] border border-[var(--line)] rounded-lg px-4 py-3 text-[var(--txt)]"
        />
        <button
          type="submit"
          className="bg-[var(--acc)] text-[var(--bg)] rounded-lg px-4 py-3 font-medium"
        >
          Start logging
        </button>
      </form>
    </main>
  );
}
