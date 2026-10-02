import { useT } from "../../i18n";
import { Button } from "./Button";

export function Pagination({
  page,
  totalPages,
  total,
  shown,
  disabled = false,
  onPage,
  summary,
}: {
  page: number;
  totalPages: number;
  total: number;
  shown?: number;
  disabled?: boolean;
  onPage: (page: number) => void;
  /** Overrides the default "Page 1 / 3 · 42 results" line. */
  summary?: string;
}) {
  const t = useT();

  return (
    <div className="flex flex-wrap items-center gap-3 pt-3">
      <span className="text-xs text-muted">
        {summary ??
          (shown === undefined
            ? t.pagination.summary(page, totalPages, total)
            : t.users.showing(shown, total))}
      </span>
      <div className="ml-auto flex gap-[6px]">
        <Button
          disabled={disabled || page <= 1}
          onClick={() => onPage(page - 1)}
        >
          {t.users.previous}
        </Button>
        <Button
          disabled={disabled || page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          {t.users.next}
        </Button>
      </div>
    </div>
  );
}
