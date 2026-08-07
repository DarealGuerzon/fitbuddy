import "server-only";
import { Resend } from "resend";

export async function sendReminderEmail(to: string, subject: string, body: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: "FitBuddy <reminders@fitbuddy.app>",
    to,
    subject,
    text: body,
  });
}
