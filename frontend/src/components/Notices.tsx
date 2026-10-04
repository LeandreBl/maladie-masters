import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useAuth, useUser } from "../auth/AuthProvider";
import { useI18n } from "../i18n/I18nProvider";
import { prefersReducedMotion } from "../lib/hooks";
import { useRealtimeEvent } from "../realtime/RealtimeProvider";

type Notice = { id: number; text: string; detail?: string; leaving?: boolean };

const NOTICE_TTL_MS = 10_000;

/**
 * What the server pushes to the player: keeps the profile in step and tells
 * them when an admin gave them something. Announcements will land here too.
 *
 * The wallet is replaced on its own whenever possible: a full profile refresh
 * during a pack reveal would give the cards away through the collection
 * counters.
 */
export function Notices() {
  const user = useUser();
  const { refresh, setWallet } = useAuth();
  const { t } = useI18n();
  const [notices, setNotices] = useState<Notice[]>([]);

  // Dismissing plays the exit animation; the notice leaves the state after it.
  const dismiss = useCallback((id: number) => {
    setNotices((current) => current.map((notice) => (notice.id === id ? { ...notice, leaving: true } : notice)));
  }, []);

  const remove = useCallback((id: number) => {
    setNotices((current) => current.filter((notice) => notice.id !== id));
  }, []);

  const show = useCallback(
    (text: string, detail?: string) => {
      const id = Date.now() + Math.random();
      setNotices((current) => [...current, { id, text, detail }]);
      window.setTimeout(() => dismiss(id), NOTICE_TTL_MS);
    },
    [dismiss],
  );

  useRealtimeEvent((message) => {
    switch (message.type) {
      case "packs.granted":
        setWallet(message.data.wallet);
        show(t.notices.packsGranted(message.data.amount), message.data.note ?? undefined);
        break;
      case "packs.refilled":
        setWallet(message.data.wallet);
        show(t.notices.packsRefilled);
        break;
      case "card.granted": {
        void refresh();
        const { quantity, shiny } = message.data;
        void api
          .card(user, message.data.cardId)
          .then((card) => show(t.notices.cardGranted(card.name, quantity, shiny)))
          .catch(() => show(t.notices.cardGranted(null, quantity, shiny)));
        break;
      }
      case "card.removed":
        void refresh();
        break;
      case "collection.reset":
        void refresh();
        show(t.notices.collectionReset);
        break;
      case "settings.updated":
      case "realtime.resync":
        // The pack timer may have changed, or a grant been missed.
        void api.wallet(user).then(setWallet).catch(() => undefined);
        break;
    }
  });

  return (
    <div className="notices" role="status" aria-live="polite">
      {notices.map((notice) => (
        <NoticeCard
          key={notice.id}
          notice={notice}
          closeLabel={t.close}
          onDismiss={() => dismiss(notice.id)}
          onGone={() => remove(notice.id)}
        />
      ))}
    </div>
  );
}

function NoticeCard({
  notice,
  closeLabel,
  onDismiss,
  onGone,
}: {
  notice: Notice;
  closeLabel: string;
  onDismiss: () => void;
  onGone: () => void;
}) {
  const card = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    // The bar runs for the notice's whole life, motion or not: it is the timer.
    bar.current?.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], {
      duration: NOTICE_TTL_MS,
      easing: "linear",
      fill: "forwards",
    });
    if (prefersReducedMotion()) return;
    card.current?.animate([{ opacity: 0, transform: "translateX(60px) scale(.96)" }, { opacity: 1, transform: "none" }], {
      duration: 260,
      easing: "cubic-bezier(.2,.9,.25,1.1)",
    });
  }, []);

  useEffect(() => {
    if (!notice.leaving) return;
    if (!card.current || prefersReducedMotion()) return onGone();
    const exit = card.current.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(40px)" }], {
      duration: 180,
      easing: "ease-in",
      fill: "forwards",
    });
    exit.onfinish = onGone;
    // `onGone` is a fresh closure on every render of the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notice.leaving]);

  return (
    <div ref={card} className="notice">
      <div>
        <strong>{notice.text}</strong>
        {notice.detail ? <span>{notice.detail}</span> : null}
      </div>
      <button type="button" aria-label={closeLabel} onClick={onDismiss}>
        ×
      </button>
      <span ref={bar} className="notice-bar" />
    </div>
  );
}
