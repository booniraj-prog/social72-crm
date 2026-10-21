import { prisma } from "@/lib/db";

export async function alertChannelsForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });
  if (!user) {
    return { emailTo: null as string | null, phoneTo: null as string | null, emailQueued: false, smsQueued: false };
  }
  const emailTo = user.notifyEmail
    ? user.alertEmail || user.email
    : user.role.notifyEmail
      ? user.role.alertEmail
      : null;
  const phoneTo = user.notifySms
    ? user.alertPhone || user.mobile
    : user.role.notifySms
      ? user.role.alertPhone
      : null;
  return {
    emailTo: emailTo || null,
    phoneTo: phoneTo || null,
    emailQueued: Boolean(emailTo),
    smsQueued: Boolean(phoneTo),
  };
}
