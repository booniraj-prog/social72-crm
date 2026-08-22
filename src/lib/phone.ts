import { HttpError } from "@/lib/session";

/** Store phones as E.164. India 10-digit numbers default to +91. */
export function normalizeMobile(input: string): string {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) {
    throw new HttpError(400, "Mobile number is required", "INVALID_MOBILE");
  }
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  if (trimmed.startsWith("+") && digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }
  throw new HttpError(400, "Enter a valid mobile number", "INVALID_MOBILE");
}

export function displayMobile(e164: string) {
  if (e164.startsWith("+91") && e164.length === 13) {
    return `${e164.slice(0, 3)} ${e164.slice(3, 8)} ${e164.slice(8)}`;
  }
  return e164;
}
