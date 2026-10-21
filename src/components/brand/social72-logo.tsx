import { cn } from "@/lib/cn";

export const SOCIAL72_LOGO = "/social72-logo.png";

export function Social72Logo({
  className,
  onDark = false,
}: {
  className?: string;
  onDark?: boolean;
}) {
  const mark = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={SOCIAL72_LOGO} alt="Social72" className={cn("h-7 w-auto", className)} />
  );
  if (!onDark) return mark;
  return <div className="inline-flex rounded-md bg-white px-2 py-1.5">{mark}</div>;
}
