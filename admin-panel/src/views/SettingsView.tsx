import { useEffect, useMemo, useState } from "react";
import { RarityDot } from "../components/RarityTag";
import { Button } from "../components/ui/Button";
import { Card, Panel } from "../components/ui/Card";
import { Dialog } from "../components/ui/Dialog";
import { CheckboxField, NumberField, TextField, ToggleRow } from "../components/ui/Field";
import { SkeletonList, SkeletonPanel, SkeletonRegion } from "../components/ui/Skeleton";
import { useAdminAction, useAdminResource } from "../hooks/use-admin-resource";
import { useLocale, useT } from "../i18n";
import {
  adminApi,
  RARITIES_DESC,
  type GameSettings,
  type GameSettingsPayload,
  type PackSlot,
  type Rarity,
} from "../lib/api";
import { formatRelative } from "../lib/format";

type Draft = Omit<GameSettings, "expectedDropPct" | "packHitPct" | "cardsPerPack" | "updatedAt">;
type NumericKey = {
  [K in keyof Draft]: Draft[K] extends number ? K : never;
}[keyof Draft];

/** Mirrors the backend's `MAX_CARDS_PER_PACK`. */
const MAX_CARDS_PER_PACK = 15;

/** Mirrors the backend's `DEFAULT_PACK_SLOTS` (src/cards/rarity.ts). */
const DEFAULT_PACK_SLOTS: PackSlot[] = [
  { count: 3, weights: { COMMON: 95, UNCOMMON: 5, RARE: 0, EPIC: 0, LEGENDARY: 0 } },
  { count: 1, weights: { COMMON: 0, UNCOMMON: 90, RARE: 10, EPIC: 0, LEGENDARY: 0 } },
  { count: 1, weights: { COMMON: 0, UNCOMMON: 0, RARE: 84.3, EPIC: 14, LEGENDARY: 1.7 } },
];

/** Rarities from the most common, the order slots are read in. */
const RARITIES_ASC = [...RARITIES_DESC].reverse();

const SHARE_KEYS: Array<[Rarity, NumericKey]> = [
  ["LEGENDARY", "shareLegendary"],
  ["EPIC", "shareEpic"],
  ["RARE", "shareRare"],
  ["UNCOMMON", "shareUncommon"],
];

function toDraft(settings: GameSettings): Draft {
  const {
    expectedDropPct: _expected,
    packHitPct: _hits,
    cardsPerPack: _cards,
    updatedAt: _updated,
    ...draft
  } = settings;
  return draft;
}

function slotOdds(slot: PackSlot): Record<Rarity, number> {
  const total = RARITIES_ASC.reduce((sum, rarity) => sum + Math.max(0, slot.weights[rarity]), 0);
  return Object.fromEntries(
    RARITIES_ASC.map((rarity) => [rarity, total > 0 ? Math.max(0, slot.weights[rarity]) / total : 0]),
  ) as Record<Rarity, number>;
}

/**
 * Mirrors the backend's `expectedDropShares` and `packHitOdds`, so the preview
 * follows the draft as it is typed rather than only after saving.
 */
function boosterOdds(slots: PackSlot[]) {
  const cards = slots.reduce((sum, slot) => sum + slot.count, 0);
  const share = {} as Record<Rarity, number>;
  const hit = {} as Record<Rarity, number>;
  for (const rarity of RARITIES_ASC) {
    let expected = 0;
    let none = 1;
    for (const slot of slots) {
      const odds = slotOdds(slot)[rarity];
      expected += slot.count * odds;
      none *= (1 - odds) ** slot.count;
    }
    share[rarity] = cards > 0 ? (expected / cards) * 100 : 0;
    hit[rarity] = (1 - none) * 100;
  }
  return { cards, share, hit };
}

/** The game rules, edited as a draft and saved in one go. */
export function SettingsView() {
  const t = useT();
  const { intlLocale } = useLocale();
  const { run, busy } = useAdminAction();
  const { data, setData, failed, reload } = useAdminResource((user) => adminApi.settings(user));
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    if (data) setDraft(toDraft(data));
  }, [data]);

  const changes = useMemo<GameSettingsPayload>(() => {
    if (!data || !draft) return {};
    const saved = toDraft(data);
    return Object.fromEntries(
      Object.entries(draft).filter(
        ([key, value]) => JSON.stringify(saved[key as keyof Draft]) !== JSON.stringify(value),
      ),
    ) as GameSettingsPayload;
  }, [data, draft]);

  if (!draft || !data) {
    return (
      <div className="p-[24px_28px_40px]">
        {failed ? (
          <Card className="p-6 text-sm text-muted">
            <span className="flex items-center gap-3">
              {t.common.loadError}
              <Button onClick={() => void reload()}>{t.common.retry}</Button>
            </span>
          </Card>
        ) : (
          <SkeletonRegion>
            <SkeletonPanel>
              <SkeletonList rows={8} />
            </SkeletonPanel>
          </SkeletonRegion>
        )}
      </div>
    );
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  const setNumber = (key: NumericKey) => (value: number | null) => set(key, (value ?? 0) as never);
  const setSlots = (update: (slots: PackSlot[]) => PackSlot[]) => set("packSlots", update(draft.packSlots));

  const booster = boosterOdds(draft.packSlots);
  const emptySlot = draft.packSlots.findIndex((slot) =>
    RARITIES_ASC.every((rarity) => slot.weights[rarity] <= 0),
  );
  const boosterError =
    booster.cards > MAX_CARDS_PER_PACK || booster.cards < 1
      ? t.settings.tooManyCards(MAX_CARDS_PER_PACK)
      : emptySlot !== -1
        ? t.settings.emptySlot(emptySlot + 1)
        : null;

  const shareTotal = SHARE_KEYS.reduce((sum, [, key]) => sum + (draft[key] as number), 0);
  const sharesInvalid = shareTotal > 100;
  const dirty = Object.keys(changes).length > 0;
  const pct = (value: number) => `${(Math.round(value * 10) / 10).toLocaleString(intlLocale)} %`;
  const oneIn = (hitPct: number) =>
    hitPct <= 0
      ? t.settings.never
      : t.settings.oneIn((Math.round((100 / hitPct) * 10) / 10).toLocaleString(intlLocale));

  return (
    <div className="p-[24px_28px_40px]">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="text-xs text-muted">
          {dirty ? t.settings.unsaved : t.settings.updatedAt(formatRelative(data.updatedAt, intlLocale))}
        </span>
        <div className="ml-auto flex gap-2">
          <Button disabled={!dirty || busy} onClick={() => setDraft(toDraft(data))}>
            {t.common.discard}
          </Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={!dirty || sharesInvalid || !!boosterError}
            onClick={() =>
              void run((user) => adminApi.updateSettings(user, changes), {
                success: t.common.saved,
                onDone: (updated) => setData(updated),
              })
            }
          >
            {t.common.save}
          </Button>
        </div>
      </div>

      <Panel
        className="mb-5"
        title={t.settings.boosterTitle}
        eyebrow={t.settings.cardsPerPack(booster.cards)}
        action={
          <Button className="btn-sm" onClick={() => set("packSlots", DEFAULT_PACK_SLOTS)}>
            {t.settings.resetBooster}
          </Button>
        }
      >
        <p className="mb-4 text-xs text-muted">{t.settings.boosterHelp}</p>

        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th />
                <th className="text-center">{t.settings.slotCount}</th>
                {RARITIES_ASC.map((rarity) => (
                  <th key={rarity} className="text-center">
                    <span className="inline-flex items-center gap-1">
                      <RarityDot rarity={rarity} />
                      {t.rarity[rarity]}
                    </span>
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {draft.packSlots.map((slot, index) => (
                <tr key={index} className="align-top">
                  <td className="whitespace-nowrap text-sm font-medium leading-9">{t.settings.slotLabel(index + 1)}</td>
                  <td className="w-[90px] [&_.input]:text-center">
                    <NumberField
                      value={slot.count}
                      min={1}
                      step={1}
                      onChange={(value) =>
                        setSlots((slots) =>
                          slots.map((entry, at) =>
                            at === index ? { ...entry, count: Math.max(1, Math.round(value ?? 1)) } : entry,
                          ),
                        )
                      }
                    />
                  </td>
                  {RARITIES_ASC.map((rarity) => (
                    <td key={rarity} className="w-[110px] [&_.input]:text-center">
                      <NumberField
                        value={slot.weights[rarity]}
                        min={0}
                        step="any"
                        onChange={(value) =>
                          setSlots((slots) =>
                            slots.map((entry, at) =>
                              at === index
                                ? { ...entry, weights: { ...entry.weights, [rarity]: Math.max(0, value ?? 0) } }
                                : entry,
                            ),
                          )
                        }
                      />
                      <div className="mt-1 text-center text-[11px] text-muted">
                        {pct(slotOdds(slot)[rarity] * 100)}
                      </div>
                    </td>
                  ))}
                  <td className="text-right">
                    <Button
                      className="btn-sm"
                      disabled={draft.packSlots.length <= 1}
                      onClick={() => setSlots((slots) => slots.filter((_, at) => at !== index))}
                    >
                      {t.settings.removeSlot}
                    </Button>
                  </td>
                </tr>
              ))}
              <tr>
                <td className="text-xs text-muted">{t.settings.expected}</td>
                <td />
                {RARITIES_ASC.map((rarity) => (
                  <td key={rarity} className="num text-center text-sm">
                    {pct(booster.share[rarity])}
                  </td>
                ))}
                <td />
              </tr>
              <tr>
                <td className="text-xs text-muted">{t.settings.hitOdds}</td>
                <td />
                {RARITIES_ASC.map((rarity) => (
                  <td key={rarity} className="text-center text-xs">
                    {oneIn(booster.hit[rarity])}
                  </td>
                ))}
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            className="btn-sm"
            disabled={draft.packSlots.length >= 10}
            onClick={() =>
              setSlots((slots) => [
                ...slots,
                { count: 1, weights: { COMMON: 100, UNCOMMON: 0, RARE: 0, EPIC: 0, LEGENDARY: 0 } },
              ])
            }
          >
            {t.settings.addSlot}
          </Button>
          {boosterError ? <span className="text-sm text-accent-700">{boosterError}</span> : null}
        </div>
      </Panel>

      <div className="panel-grid">
        <Panel title={t.settings.packsTitle}>
          <div className="grid gap-4">
            <NumberField
              label={`✦ ${t.settings.shinyOneIn}`}
              help={t.settings.shinyHelp}
              value={draft.shinyOneIn}
              onChange={setNumber("shinyOneIn")}
              min={1}
              step={1}
            />
            <NumberField label={t.settings.packInterval} value={draft.packIntervalMinutes} onChange={setNumber("packIntervalMinutes")} min={1} step={1} />
            <NumberField label={t.settings.packMax} help={t.settings.packMaxHelp} value={draft.packMaxStored} onChange={setNumber("packMaxStored")} min={1} step={1} />
          </div>
        </Panel>

        <Panel title={t.settings.sharesTitle}>
          <p className="mb-4 text-xs text-muted">{t.settings.sharesHelp}</p>
          <div className="grid gap-3">
            {SHARE_KEYS.map(([rarity, key]) => (
              <div key={rarity} className="grid grid-cols-[1fr_110px] items-center gap-3">
                <span className="flex items-center gap-2 text-sm">
                  <RarityDot rarity={rarity} />
                  {t.rarity[rarity]}
                </span>
                <NumberField value={draft[key] as number} onChange={setNumber(key)} min={0} step="any" />
              </div>
            ))}
            <div className="flex items-center gap-2 text-sm text-muted">
              <RarityDot rarity="COMMON" />
              {t.settings.commonRest(pct(Math.max(0, 100 - shareTotal)))}
            </div>
            {sharesInvalid ? <p className="mb-0 text-sm text-accent-700">{t.settings.sharesTooHigh}</p> : null}
          </div>
        </Panel>

        <Panel title={t.settings.syncTitle}>
          <div className="grid gap-4">
            <ToggleRow
              label={t.settings.syncEnabled}
              checked={draft.syncEnabled}
              onChange={(value) => set("syncEnabled", value)}
              onLabel={t.common.on}
              offLabel={t.common.off}
            />
            <NumberField label={t.settings.syncInterval} value={draft.syncIntervalHours} onChange={setNumber("syncIntervalHours")} min={1} step={1} />
            <NumberField
              label={t.settings.pageviewsWindow}
              help={t.settings.pageviewsWindowHelp}
              value={draft.pageviewsWindowDays}
              onChange={setNumber("pageviewsWindowDays")}
              min={1}
              step={1}
            />
          </div>
        </Panel>
      </div>

      <DangerZone />
    </div>
  );
}

/** Wipes every collection: a new season. Typing RESET is the safety catch. */
function DangerZone() {
  const t = useT();
  const { run, busy } = useAdminAction();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [history, setHistory] = useState(false);

  const close = () => {
    setOpen(false);
    setTyped("");
    setHistory(false);
  };

  return (
    <Panel title={t.settings.dangerTitle} className="mt-5">
      <div className="flex flex-wrap items-center gap-4">
        <p className="mb-0 min-w-[240px] flex-1 text-sm text-muted">{t.settings.resetAllHelp}</p>
        <Button variant="danger" onClick={() => setOpen(true)}>
          {t.settings.resetAll}
        </Button>
      </div>

      {open ? (
        <Dialog
          title={t.settings.resetAllTitle}
          body={t.settings.resetAllBody}
          onClose={close}
          actions={
            <>
              <Button onClick={close} disabled={busy}>
                {t.common.cancel}
              </Button>
              <Button
                variant="danger"
                loading={busy}
                disabled={typed.trim() !== "RESET"}
                onClick={() =>
                  void run((user) => adminApi.resetAllCollections(user, history), {
                    success: (result) => t.settings.resetAllDone(result.players, result.cards),
                    onDone: close,
                  })
                }
              >
                {t.dialogs.resetSubmit}
              </Button>
            </>
          }
        >
          <div className="grid gap-[14px]">
            <CheckboxField
              label={t.dialogs.resetHistory}
              help={t.dialogs.resetHistoryHelp}
              checked={history}
              onChange={setHistory}
            />
            <TextField label={t.settings.resetAllConfirm} value={typed} onChange={setTyped} autoComplete="off" />
          </div>
        </Dialog>
      ) : null}
    </Panel>
  );
}
