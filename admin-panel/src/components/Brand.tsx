import { Biohazard } from "lucide-react";
import { useT } from "../i18n";

/**
 * The wordmark: a Lucide `biohazard` in an accent circle beside the name.
 * Stroke width 2.75 throughout, per the design system.
 */
export function Brand({ size = 28 }: { size?: number }) {
  const t = useT();

  return (
    <div className="flex items-center gap-[9px]">
      <span
        style={{ width: size, height: size }}
        className="grid flex-none place-items-center rounded-full bg-accent-200"
      >
        <Biohazard
          style={{ width: size * 0.6, height: size * 0.6 }}
          strokeWidth={2.75}
          className="text-accent"
        />
      </span>
      <span
        className="font-heading"
        style={{ fontSize: size * 0.5, letterSpacing: "0.01em" }}
      >
        {t.common.appName}
      </span>
    </div>
  );
}
