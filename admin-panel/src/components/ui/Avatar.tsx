import { useState } from "react";
import { cn } from "../../lib/utils";

/**
 * The initials circle. The Firebase profile picture replaces the letters when
 * there is one and it loads; a broken URL falls back to the letters rather
 * than a broken-image icon.
 */
export function Avatar({
  initials,
  photoUrl,
  size = 34,
  className,
}: {
  initials: string;
  photoUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };

  if (photoUrl && !failed) {
    return (
      <img
        src={photoUrl}
        alt=""
        style={style}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={cn("flex-none rounded-full object-cover", className)}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      style={style}
      className={cn(
        "font-heading grid flex-none place-items-center rounded-full bg-accent-200 text-accent-800",
        className,
      )}
    >
      {initials}
    </span>
  );
}
