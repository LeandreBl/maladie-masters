import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { LeaderboardEntry } from "../api/types";
import { useMe, useUser } from "../auth/AuthProvider";
import { useI18n } from "../i18n/I18nProvider";
import { initialOf } from "../lib/format";

function Avatar({ row, size }: { row: LeaderboardEntry; size: number }) {
  const style = { width: size, height: size, fontSize: size * 0.4 };
  return row.photoUrl ? (
    <img className="avatar" style={style} src={row.photoUrl} alt="" referrerPolicy="no-referrer" />
  ) : (
    <span className="avatar" style={style}>
      {initialOf(row.displayName)}
    </span>
  );
}

export function LeaderboardPage() {
  const user = useUser();
  const me = useMe();
  const { t } = useI18n();
  const [rows, setRows] = useState<LeaderboardEntry[] | null>(null);

  useEffect(() => {
    void api.leaderboard(user).then(setRows);
  }, [user]);

  const name = (row: LeaderboardEntry) => {
    const shown = row.displayName ?? t.leaderboard.anonymous;
    return row.userId === me.id ? `${shown} (${t.leaderboard.you})` : shown;
  };

  return (
    <main className="page page--narrow">
      <div className="section" style={{ gap: 10 }}>
        <h1 className="h1">{t.leaderboard.title}</h1>
        <p className="muted" style={{ fontSize: 15, lineHeight: 1.5 }}>
          {t.leaderboard.scoring}
        </p>
      </div>
      {!rows ? <p className="muted">{t.loading}</p> : null}
      {rows && rows.length > 0 ? (
        <div className="podium">
          {rows.slice(0, 3).map((row, i) => (
            <div key={row.userId} className={`panel podium-tile p${i + 1}`}>
              <div className="top">
                <span className="podium-rank">{row.rank}</span>
                <Avatar row={row} size={52} />
              </div>
              <div className="name">{name(row)}</div>
              <div className="mono">{t.leaderboard.entry(row.score, row.uniqueOwned)}</div>
            </div>
          ))}
        </div>
      ) : null}
      {rows && rows.length > 3 ? (
        <div className="panel lb-table">
          {rows.slice(3).map((row) => (
            <div key={row.userId} className={row.userId === me.id ? "lb-row me" : "lb-row"}>
              <span className="mono rank">{row.rank}</span>
              <Avatar row={row} size={36} />
              <span className="name">{name(row)}</span>
              <span className="mono entry">{t.leaderboard.entry(row.score, row.uniqueOwned)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </main>
  );
}
