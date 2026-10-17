import { formatDate } from "./dates";
import { sanitizePhone } from "./phone";

type ReminderInput = {
  name: string;
  packageName: string;
  expiryDate: string; // YYYY-MM-DD
  gymName: string;
  today: string; // YYYY-MM-DD
};

export function buildReminderMessage({ name, packageName, expiryDate, gymName, today }: ReminderInput): string {
  const firstName = name.trim().split(/\s+/)[0];
  const when = formatDate(expiryDate);
  const status =
    expiryDate === today
      ? `expires today (${when})`
      : expiryDate > today
        ? `expires on ${when}`
        : `expired on ${when}`;

  return [
    `Hello ${firstName}, 👋`,
    ``,
    `This is a friendly reminder from ${gymName}: your *${packageName}* package ${status}.`,
    ``,
    `Renew now to keep your training streak going 💪 Just reply to this message or visit the front desk.`,
    ``,
    `Thank you!`,
  ].join("\n");
}

/**
 * wa.me deep link. encodeURIComponent handles spaces, newlines, "&", "#",
 * emoji etc. so names/packages can never break out of the `text` param.
 */
export function buildWhatsAppUrl(phone: string, message: string): string {
  return `https://wa.me/${sanitizePhone(phone)}?text=${encodeURIComponent(message)}`;
}
