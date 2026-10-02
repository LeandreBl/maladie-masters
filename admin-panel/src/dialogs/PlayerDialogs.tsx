import { useEffect, useState } from "react";
import { CardThumb, RarityTag } from "../components/RarityTag";
import { Button } from "../components/ui/Button";
import { Dialog } from "../components/ui/Dialog";
import { CheckboxField, NumberField, TextAreaField, TextField } from "../components/ui/Field";
import { useAuthedUser } from "../auth-context";
import { useAdminAction } from "../hooks/use-admin-resource";
import { useT } from "../i18n";
import { adminApi, type AdminCard } from "../lib/api";

/** Adds — or takes back — bonus packs. */
export function GrantPacksDialog({
  userId,
  onClose,
  onDone,
}: {
  userId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useT();
  const { run, busy } = useAdminAction();
  const [amount, setAmount] = useState<number | null>(5);
  const [note, setNote] = useState("");

  const valid = amount !== null && Number.isInteger(amount) && amount !== 0 && Math.abs(amount) <= 1000;

  return (
    <Dialog
      title={t.dialogs.grantTitle}
      body={t.dialogs.grantBody}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose} disabled={busy}>
            {t.common.cancel}
          </Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={!valid}
            onClick={() =>
              void run((user) => adminApi.grantPacks(user, userId, amount ?? 0, note.trim() || undefined), {
                success: t.dialogs.granted(amount ?? 0),
                onDone: () => {
                  onDone();
                  onClose();
                },
              })
            }
          >
            {t.dialogs.grantSubmit}
          </Button>
        </>
      }
    >
      <div className="grid gap-[14px]">
        <NumberField
          label={t.dialogs.grantAmount}
          help={t.dialogs.grantAmountHelp}
          value={amount}
          onChange={setAmount}
          min={-1000}
          step={1}
        />
        <TextAreaField label={t.dialogs.grantNote} value={note} onChange={setNote} rows={2} />
      </div>
    </Dialog>
  );
}

/** Finds a card by name and adds copies of it to a collection. */
export function UnlockCardDialog({
  userId,
  onClose,
  onDone,
}: {
  userId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useT();
  const user = useAuthedUser();
  const { run, busy } = useAdminAction();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<AdminCard[]>([]);
  const [picked, setPicked] = useState<AdminCard | null>(null);
  const [quantity, setQuantity] = useState<number | null>(1);
  const [shiny, setShiny] = useState(false);

  useEffect(() => {
    const query = search.trim();
    if (query.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      adminApi
        .cards(user, { search: query, pageSize: 8, sort: "popularity" })
        .then((page) => {
          if (!cancelled) setResults(page.items);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search, user]);

  return (
    <Dialog
      title={t.dialogs.unlockTitle}
      body={t.dialogs.unlockBody}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose} disabled={busy}>
            {t.common.cancel}
          </Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={!picked || !quantity || quantity < 1}
            onClick={() =>
              picked &&
              void run((current) => adminApi.unlockCard(current, userId, picked.id, quantity ?? 1, shiny), {
                success: t.dialogs.unlocked(picked.name),
                onDone: () => {
                  onDone();
                  onClose();
                },
              })
            }
          >
            {t.dialogs.unlockSubmit}
          </Button>
        </>
      }
    >
      <div className="grid gap-[14px]">
        <TextField label={t.dialogs.unlockSearch} type="search" value={search} onChange={setSearch} />
        <div className="grid max-h-[260px] gap-1 overflow-auto">
          {results.length === 0 ? (
            <p className="mb-0 text-xs text-muted">{t.dialogs.unlockPick}</p>
          ) : (
            results.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => setPicked(card)}
                className="flex items-center gap-3 rounded-md p-[6px] text-left hover:bg-neutral-100"
                style={picked?.id === card.id ? { outline: "2px solid var(--color-accent)" } : undefined}
              >
                <CardThumb src={card.imageUrl} size={30} />
                <span className="min-w-0 flex-1 truncate text-sm">
                  <span className="text-muted">#{card.number}</span> {card.name}
                </span>
                <RarityTag rarity={card.rarity} />
              </button>
            ))
          )}
        </div>
        <NumberField label={t.dialogs.unlockQuantity} value={quantity} onChange={setQuantity} min={1} step={1} />
        <CheckboxField
          label={`✦ ${t.dialogs.unlockShiny}`}
          help={t.dialogs.unlockShinyHelp}
          checked={shiny}
          onChange={setShiny}
        />
      </div>
    </Dialog>
  );
}

export function SuspendDialog({
  userId,
  onClose,
  onDone,
}: {
  userId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useT();
  const { run, busy } = useAdminAction();
  const [reason, setReason] = useState("");

  return (
    <Dialog
      title={t.dialogs.suspendTitle}
      body={t.dialogs.suspendBody}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose} disabled={busy}>
            {t.common.cancel}
          </Button>
          <Button
            variant="danger"
            loading={busy}
            disabled={reason.trim().length < 3}
            onClick={() =>
              void run((user) => adminApi.suspend(user, userId, reason.trim()), {
                success: t.dialogs.suspended,
                onDone: () => {
                  onDone();
                  onClose();
                },
              })
            }
          >
            {t.dialogs.suspendSubmit}
          </Button>
        </>
      }
    >
      <TextAreaField label={t.dialogs.suspendReason} value={reason} onChange={setReason} rows={3} />
    </Dialog>
  );
}
