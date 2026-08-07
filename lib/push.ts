import "server-only";
import webpush from "web-push";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) throw new Error("VAPID keys are not set");
  webpush.setVapidDetails("mailto:daryl@spiralytics.com", publicKey, privateKey);
  configured = true;
}

export async function sendPushNotification(
  subscription: webpush.PushSubscription,
  payload: { title: string; body: string }
) {
  ensureConfigured();
  await webpush.sendNotification(subscription, JSON.stringify(payload));
}
