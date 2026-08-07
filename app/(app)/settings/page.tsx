import { PushSubscribeButton } from "@/components/PushSubscribeButton";

export default function SettingsPage() {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  return (
    <main className="flex flex-col gap-6 px-4 pt-8">
      <h1 className="text-xl font-medium">Settings</h1>
      {vapidPublicKey ? (
        <PushSubscribeButton vapidPublicKey={vapidPublicKey} />
      ) : (
        <p className="text-[var(--dim)] text-sm">Push not configured yet.</p>
      )}
    </main>
  );
}
