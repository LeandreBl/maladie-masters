export function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  return (
    <div className="pager">
      <button type="button" aria-label="←" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ←
      </button>
      <span className="mono">
        {page} / {pages}
      </span>
      <button type="button" aria-label="→" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        →
      </button>
    </div>
  );
}
