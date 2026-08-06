"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });

    setSubmitting(false);

    if (!res.ok) {
      setError("Incorrect passcode");
      return;
    }

    router.push("/select-profile");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-xs">
      <input
        type="password"
        value={passcode}
        onChange={(e) => setPasscode(e.target.value)}
        placeholder="Passcode"
        className="bg-[var(--surface)] border border-[var(--line)] rounded-lg px-4 py-3 text-[var(--txt)]"
        autoFocus
      />
      {error && <p className="text-[var(--alert)] text-sm">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="bg-[var(--acc)] text-[var(--bg)] rounded-lg px-4 py-3 font-medium disabled:opacity-50"
      >
        {submitting ? "Checking..." : "Enter"}
      </button>
    </form>
  );
}
