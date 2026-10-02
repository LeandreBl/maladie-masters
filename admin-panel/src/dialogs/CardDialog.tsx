import { useEffect, useState } from "react";
import { CardThumb, RarityTag } from "../components/RarityTag";
import { Button } from "../components/ui/Button";
import { InsetTile } from "../components/ui/Card";
import { Dialog } from "../components/ui/Dialog";
import { CheckboxField, Field } from "../components/ui/Field";
import { SkeletonList } from "../components/ui/Skeleton";
import { useAdminAction, useAdminResource } from "../hooks/use-admin-resource";
import { LanguageTags } from "../components/LanguageTags";
import { useLocale, useT } from "../i18n";
import { adminApi, RARITIES_DESC, type Rarity } from "../lib/api";
import { formatDate, formatNumber, formatRelative } from "../lib/format";
import { CardStatusTag } from "../views/CardsView";

/** A card's sheet: what Wikipedia says, how it plays, and the two switches. */
export function CardDialog({
  cardId,
  onClose,
  onChanged,
}: {
  cardId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = useT();
  const { intlLocale, locale } = useLocale();
  const { run, busy } = useAdminAction();
  const { data, setData } = useAdminResource((user) => adminApi.cardDetail(user, cardId), [cardId]);

  const [enabled, setEnabled] = useState(true);
  const [override, setOverride] = useState<Rarity | "auto">("auto");

  useEffect(() => {
    if (!data) return;
    setEnabled(data.enabled);
    setOverride(data.rarityOverride ?? "auto");
  }, [data]);

  const dirty =
    !!data && (enabled !== data.enabled || override !== (data.rarityOverride ?? "auto"));
  const n = (value: number) => formatNumber(value, intlLocale);

  return (
    <Dialog
      wide
      title={data ? `#${data.number} ${data.name}` : t.common.loading}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>{t.common.close}</Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={!dirty}
            onClick={() =>
              void run(
                (user) =>
                  adminApi.updateCard(user, cardId, {
                    enabled,
                    rarityOverride: override === "auto" ? null : override,
                  }),
                {
                  success: t.common.saved,
                  onDone: (updated) => {
                    setData(updated);
                    onChanged();
                  },
                },
              )
            }
          >
            {t.common.save}
          </Button>
        </>
      }
    >
      {!data ? (
        <SkeletonList rows={6} />
      ) : (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-start gap-4">
            <CardThumb src={data.imageUrl} size={120} />
            <div className="min-w-[220px] flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <RarityTag rarity={data.rarity} />
                <CardStatusTag card={data} />
                <LanguageTags languages={data.languages} />
              </div>
              {data.lang !== locale ? (
                <p className="mb-2 text-xs text-muted">
                  {t.cardDetail.fallbackNote(t.common.languageNames[data.lang] ?? data.lang)}
                </p>
              ) : null}
              {data.description ? <p className="mb-2 text-sm text-muted">{data.description}</p> : null}
              <p className="mb-2 text-sm">{data.extract ?? <span className="text-muted">{t.cardDetail.noExtract}</span>}</p>
              <div className="flex flex-wrap gap-3 text-xs">
                <a className="text-accent-700 hover:text-accent" href={data.wikipediaUrl} target="_blank" rel="noreferrer">
                  {t.cardDetail.openWikipedia} ↗
                </a>
                <a
                  className="text-accent-700 hover:text-accent"
                  href={`https://www.wikidata.org/wiki/${data.wikidataId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t.cardDetail.wikidata} {data.wikidataId} ↗
                </a>
                {data.icd10.length > 0 ? (
                  <span className="text-muted">
                    {t.cardDetail.icd10} {data.icd10.join(", ")}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <InsetTile label={t.cardDetail.views} value={n(data.pageviews)} />
            <InsetTile label={t.cardDetail.rank} value={data.popularityRank ? `#${data.popularityRank}` : "—"} />
            <InsetTile label={t.cardDetail.owners} value={n(data.owners)} />
            <InsetTile label={t.cardDetail.drops} value={n(data.drops)} />
          </div>
          <div className="text-xs text-muted">
            {t.cardDetail.drops7d(n(data.drops7d))} · {n(data.copies)} {t.userDetail.copies.toLowerCase()} ·{" "}
            {t.cardDetail.lastSynced(formatRelative(data.lastSyncedAt, intlLocale))}
            {data.missingSince ? ` · ${t.cardDetail.missingSince(formatDate(data.missingSince, intlLocale))}` : null}
          </div>

          <div className="grid gap-2 border-t border-divider pt-4">
            <div className="eyebrow text-muted">{t.cardDetail.localizationsTitle}</div>
            {data.localizations.map((text) => (
              <div key={text.locale} className="flex flex-wrap items-baseline gap-x-3 text-sm">
                <span className="w-[70px] flex-none text-xs text-muted">
                  {t.common.languageNames[text.locale] ?? text.locale}
                </span>
                <a
                  className="font-medium text-accent-700 hover:text-accent"
                  href={text.wikipediaUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {text.name} ↗
                </a>
                <span className="text-xs text-muted">{text.description ?? ""}</span>
                <span className="num ml-auto text-xs text-muted">
                  {t.common.views(n(text.pageviews))}
                </span>
              </div>
            ))}
          </div>

          <div className="grid gap-4 border-t border-divider pt-4">
            <CheckboxField
              label={t.cardDetail.enabledLabel}
              help={t.cardDetail.enabledHelp}
              checked={enabled}
              onChange={setEnabled}
            />
            <Field label={t.cardDetail.rarityLabel} help={t.cardDetail.rarityHelp}>
              <select
                className="input"
                value={override}
                onChange={(event) => setOverride(event.target.value as Rarity | "auto")}
              >
                <option value="auto">
                  {t.cardDetail.rarityAuto(t.rarity[data.popularityRarity] ?? data.popularityRarity)}
                </option>
                {RARITIES_DESC.map((value) => (
                  <option key={value} value={value}>
                    {t.rarity[value]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      )}
    </Dialog>
  );
}
