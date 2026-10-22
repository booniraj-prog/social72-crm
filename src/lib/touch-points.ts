export const TOUCH_POINTS = [
  { key: "call", label: "Follow-up calling", durationMin: 15 },
  { key: "brochure", label: "Share brochure", durationMin: 15 },
  { key: "meeting", label: "Initiate meeting", durationMin: 45 },
  { key: "gmeet", label: "Google Meet", durationMin: 45 },
  { key: "whatsapp", label: "WhatsApp message", durationMin: 10 },
  { key: "sms", label: "Send SMS", durationMin: 10 },
] as const;

export type TouchPointKey = (typeof TOUCH_POINTS)[number]["key"];

export function touchPointLabel(key?: string | null) {
  return TOUCH_POINTS.find((item) => item.key === key)?.label ?? "Follow-up";
}

export function touchPointDuration(key?: string | null) {
  return TOUCH_POINTS.find((item) => item.key === key)?.durationMin ?? 30;
}

function digits(mobile?: string | null) {
  return (mobile ?? "").replace(/\D/g, "").replace(/^0+/, "");
}

export function waHref(mobile: string | null | undefined, text: string) {
  const phone = digits(mobile);
  if (!phone) return "";
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export function smsHref(mobile: string | null | undefined, text: string) {
  const phone = digits(mobile);
  if (!phone) return "";
  return `sms:+${phone}?body=${encodeURIComponent(text)}`;
}

export function telHref(mobile: string | null | undefined) {
  const phone = digits(mobile);
  if (!phone) return "";
  return `tel:+${phone}`;
}

export function touchMessage(kind: string, leadName: string, clientName: string) {
  if (kind === "brochure") {
    return `Hi ${leadName}, sharing the ${clientName} brochure from Social72. Happy to walk you through it.`;
  }
  if (kind === "whatsapp") {
    return `Hi ${leadName}, this is Social72 following up on ${clientName}. When is a good time to connect?`;
  }
  if (kind === "sms") {
    return `Hi ${leadName}, Social72 reminder for ${clientName}. Reply if you would like a callback.`;
  }
  if (kind === "meeting" || kind === "gmeet") {
    return `Hi ${leadName}, confirming our ${clientName} meeting. Joining details are in the calendar invite.`;
  }
  return `Hi ${leadName}, Social72 calling about ${clientName}.`;
}

export const GMEET_NEW = "https://meet.google.com/new";
