import { avatarColor, cn, initials } from "@/lib/utils";

export function Avatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      title={name}
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white",
        className,
      )}
      style={{ background: avatarColor(name) }}
    >
      {initials(name) || "?"}
    </span>
  );
}
