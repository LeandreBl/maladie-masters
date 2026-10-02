import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ApiError, api } from "../api/client";
import type { DiscordLinkCode, DiscordStatus } from "../api/types";
import { useMe, useUser } from "../auth/AuthProvider";
import type { DiscordCommand } from "../i18n/dictionaries";
import { useI18n } from "../i18n/I18nProvider";
import { demoCard } from "../lib/demo-cards";
import { initialOf, intlLocale } from "../lib/format";
import { prefersReducedMotion } from "../lib/hooks";
import { CardFace } from "./CardTile";

const BOT_ICON = "/discord/bot-icon.png";

const COMMANDS: Array<[string, DiscordCommand]> = [
  ["/maladie link code:", "link"],
  ["/maladie unlink", "unlink"],
  ["/maladie-setup channel", "channel"],
  ["/maladie-setup off", "off"],
  ["/maladie-setup list", "list"],
];

/**
 * Links the account to Discord, folded inside the profile. The code goes from
 * here to Discord (`/maladie link`), never the other way: only the Discord
 * user who types it gets linked, so nobody can have someone else mentioned.
 */
export function DiscordSection() {
  const user = useUser();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<DiscordStatus | null>(null);
  const [code, setCode] = useState<DiscordLinkCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const body = useRef<HTMLDivElement>(null);

  const run = useCallback(
    async (action: () => Promise<void>) => {
      try {
        setError(null);
        await action();
      } catch (caught) {
        setError(caught instanceof ApiError ? (caught.code && t.errors[caught.code]) || caught.message : String(caught));
      }
    },
    [t],
  );

  const reload = useCallback(
    () =>
      run(async () => {
        const next = await api.discord(user);
        setStatus(next);
        setCode(next.pendingCode);
      }),
    [run, user],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  // While a code waits to be typed, notice the link as soon as it happens.
  useEffect(() => {
    if (!code || status?.account) return;
    const timer = window.setInterval(() => void reload(), 5000);
    return () => window.clearInterval(timer);
  }, [code, status?.account, reload]);

  useEffect(() => {
    if (!open || prefersReducedMotion()) return;
    body.current?.animate([{ opacity: 0, transform: "translateY(-6px)" }, { opacity: 1, transform: "none" }], {
      duration: 180,
      easing: "ease-out",
    });
  }, [open]);

  const state = !status
    ? null
    : !status.enabled
      ? { dot: "var(--line)", text: t.discord.disabled }
      : status.account
        ? { dot: "var(--r-uncommon)", text: t.discord.linkedAs(status.account.username) }
        : code
          ? { dot: "var(--r-legendary)", text: t.discord.notLinked }
          : { dot: "var(--muted)", text: t.discord.notLinked };

  return (
    <section className="panel discord">
      <button type="button" className="discord-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <img src={BOT_ICON} alt="" />
        <span className="discord-head-text">
          <span className="overline">{t.discord.title}</span>
          <span className="discord-status">
            <i style={{ background: state?.dot ?? "var(--line)" }} />
            <span>{state?.text ?? t.loading}</span>
          </span>
        </span>
        <span className={open ? "chevron open" : "chevron"} aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div ref={body} className="discord-body">
          <p>{t.discord.intro}</p>
          {error ? <p className="error">{error}</p> : null}
          {!status ? null : !status.enabled ? (
            <div className="discord-box discord-box--muted">{t.discord.disabled}</div>
          ) : (
            <>
              <div className="discord-box">
                {status.account ? (
                  <Linked
                    account={status.account}
                    onUnlink={() => void run(async () => setStatus(await api.unlinkDiscord(user)))}
                    onAnnounce={(announce) =>
                      void run(async () => setStatus(await api.updateDiscord(user, { announce })))
                    }
                  />
                ) : (
                  <NotLinked code={code} onGetCode={() => void run(async () => setCode(await api.discordLinkCode(user)))} />
                )}
              </div>
              <Preview />
              <div className="discord-box">
                <h3>{t.discord.serverTitle}</h3>
                <p>{t.discord.serverHelp}</p>
                {status.inviteUrl ? (
                  <a className="btn btn-inverse" href={status.inviteUrl} target="_blank" rel="noreferrer">
                    <img src={BOT_ICON} alt="" />
                    {t.discord.invite}
                  </a>
                ) : null}
                <div className="commands">
                  {COMMANDS.map(([command, key]) => (
                    <div key={key}>
                      <code>{command}</code>
                      <span>{t.discord.commands[key]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}

function Linked({
  account,
  onUnlink,
  onAnnounce,
}: {
  account: NonNullable<DiscordStatus["account"]>;
  onUnlink: () => void;
  onAnnounce: (announce: boolean) => void;
}) {
  const { t } = useI18n();
  return (
    <>
      <div className="discord-linked">
        <span className="avatar">
          {initialOf(account.username)}
          <i />
        </span>
        <div className="big">{t.discord.linkedAs(account.username)}</div>
        <button type="button" className="btn btn-ghost" onClick={onUnlink}>
          {t.discord.unlink}
        </button>
      </div>
      <button
        type="button"
        className="switch-row"
        role="switch"
        aria-checked={account.announce}
        onClick={() => onAnnounce(!account.announce)}
      >
        <span className={account.announce ? "switch on" : "switch"} />
        {t.discord.announce}
      </button>
    </>
  );
}

function NotLinked({ code, onGetCode }: { code: DiscordLinkCode | null; onGetCode: () => void }) {
  const { t, locale } = useI18n();
  const [copied, setCopied] = useState(false);
  const command = code ? `/maladie link code:${code.code}` : "";

  // The dot pulses while the code waits to be typed.
  const pulse = useCallback((el: HTMLElement | null) => {
    if (!el || prefersReducedMotion()) return;
    el.animate(
      [
        { opacity: 1, transform: "scale(1)" },
        { opacity: 0.25, transform: "scale(1.8)" },
        { opacity: 1, transform: "scale(1)" },
      ],
      { duration: 1400, iterations: Infinity },
    );
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <>
      <div className="big">{t.discord.notLinked}</div>
      {code ? (
        <>
          <p>{t.discord.codeHelp}</p>
          <div className="code-block">
            <code>
              <span>/maladie link code:</span>
              <span>{code.code}</span>
            </code>
            <button
              type="button"
              className="btn btn-soft"
              onClick={() =>
                void navigator.clipboard
                  .writeText(command)
                  .then(() => setCopied(true))
                  .catch(() => undefined)
              }
            >
              {copied ? t.profile.copied : t.profile.copy}
            </button>
          </div>
          <div className="expires">
            <i ref={pulse} />
            <span>
              {t.discord.expiresAt(
                new Date(code.expiresAt).toLocaleTimeString(intlLocale(locale), { hour: "2-digit", minute: "2-digit" }),
              )}
            </span>
          </div>
        </>
      ) : null}
      <button type="button" className="btn btn-accent" onClick={onGetCode}>
        {code ? t.discord.newCode : t.discord.getCode}
      </button>
    </>
  );
}

/** What the bot posts when the player draws a legendary. */
function Preview() {
  const me = useMe();
  const { t, locale } = useI18n();
  const card = demoCard("tuberculosis", t, locale);
  const mention = `@${me.displayName ?? me.email.split("@")[0]}`;

  // The bot's line, with Discord's **bold** and the mention as a pill.
  const MENTION = "\u0001";
  const NAME = "\u0002";
  const parts: ReactNode[] = [];
  t.discord.announceSample(MENTION, NAME)
    .split("**")
    .forEach((chunk, i) =>
      chunk
        .split(/(\u0001|\u0002)/)
        .filter(Boolean)
        .forEach((piece, j) => {
          const key = `${i}-${j}`;
          if (piece === MENTION) parts.push(<span key={key} className="mention">{mention}</span>);
          else {
            const text = piece === NAME ? card.name : piece;
            parts.push(i % 2 ? <strong key={key}>{text}</strong> : <span key={key}>{text}</span>);
          }
        }),
    );

  return (
    <div className="discord-box">
      <span className="overline">{t.discord.preview}</span>
      <div className="discord-msg">
        <img src={BOT_ICON} alt="" />
        <div className="discord-msg-body">
          <div className="discord-msg-head">
            <strong>{t.appName}</strong>
            <span className="bot-tag">BOT</span>
            <span className="mono">
              {new Date().toLocaleTimeString(intlLocale(locale), { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <div>{parts}</div>
          <div style={{ marginTop: 6 }}>
            <CardFace card={card} width={132} holo />
          </div>
        </div>
      </div>
    </div>
  );
}
