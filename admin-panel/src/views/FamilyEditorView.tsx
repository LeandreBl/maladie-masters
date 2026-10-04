import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuthedUser } from "../auth-context";
import { CardThumb, RarityTag } from "../components/RarityTag";
import { Button } from "../components/ui/Button";
import { Card, InsetTile, Panel } from "../components/ui/Card";
import { ConfirmDialog } from "../components/ui/Dialog";
import { CheckboxField, NumberField, TextField } from "../components/ui/Field";
import { Pagination } from "../components/ui/Pagination";
import { Seg } from "../components/ui/Seg";
import { SkeletonList, SkeletonPanel, SkeletonRegion } from "../components/ui/Skeleton";
import { Tag } from "../components/ui/Tag";
import { useAdminAction, useAdminResource } from "../hooks/use-admin-resource";
import { LOCALES, translateError, useLocale, useT } from "../i18n";
import { useSetPageHeading } from "../layouts/page-heading";
import {
  adminApi,
  FAMILY_RULE_FIELDS,
  LOCALIZED_RULE_FIELDS,
  type AdminCard,
  type AdminFamily,
  type FamilyPayload,
  type FamilyPreview,
  type FamilyPreviewCard,
  type FamilyPreviewView,
  type FamilyRule,
  type Locale,
} from "../lib/api";
import { formatNumber, formatRelative } from "../lib/format";
import { cn } from "../lib/utils";

/** Long enough to type a regex without a request per keystroke. */
const PREVIEW_DEBOUNCE_MS = 350;
const PREVIEW_PAGE_SIZE = 40;

const EMPTY: FamilyPayload = {
  names: { en: "", fr: "", zh: "" },
  icon: "",
  bonusPoints: 100,
  enabled: true,
  match: "any",
  rules: [{ field: "name", pattern: "", locale: null, exclude: false }],
  includedCardIds: [],
  excludedCardIds: [],
};

function toPayload(family: AdminFamily): FamilyPayload {
  return {
    names: { en: family.names.en ?? "", fr: family.names.fr ?? "", zh: family.names.zh ?? "" },
    icon: family.icon ?? "",
    bonusPoints: family.bonusPoints,
    enabled: family.enabled,
    match: family.match,
    rules: family.rules.map((rule) => ({ ...rule, locale: rule.locale ?? null, exclude: !!rule.exclude })),
    includedCardIds: family.includedCardIds,
    excludedCardIds: family.excludedCardIds,
  };
}

const without = (ids: string[], id: string) => ids.filter((other) => other !== id);

/**
 * One family: its identity, its rules and, beside them, what those rules
 * select right now — the count per rule, the members, the cards left out —
 * so a regex can be checked before anyone's score depends on it.
 */
export function FamilyEditorView() {
  const { familyId } = useParams();
  const isNew = !familyId;
  const t = useT();
  const { intlLocale } = useLocale();
  const navigate = useNavigate();
  const { run, busy } = useAdminAction();

  const { data, setData, failed, reload } = useAdminResource(
    (user) => (familyId ? adminApi.family(user, familyId) : Promise.resolve(null)),
    [familyId],
  );
  const [draft, setDraft] = useState<FamilyPayload | null>(isNew ? EMPTY : null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (data) setDraft(toPayload(data));
  }, [data]);

  const saved = useMemo(() => (data ? toPayload(data) : EMPTY), [data]);
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(saved);

  const preview = useFamilyPreview(draft);

  useSetPageHeading({
    crumb: t.crumbs.families,
    title: draft?.names.en || data?.name || t.families.newTitle,
  });

  if (!draft) {
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

  const set = <K extends keyof FamilyPayload>(key: K, value: FamilyPayload[K]) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  const setRule = (index: number, patch: Partial<FamilyRule>) =>
    set(
      "rules",
      draft.rules.map((rule, at) => (at === index ? { ...rule, ...patch } : rule)),
    );

  /** Puts a card in or out by hand; the opposite list loses it. */
  const pick = (cardId: string, into: "in" | "out" | "none") =>
    setDraft((current) =>
      current
        ? {
            ...current,
            includedCardIds:
              into === "in"
                ? [...without(current.includedCardIds, cardId), cardId]
                : without(current.includedCardIds, cardId),
            excludedCardIds:
              into === "out"
                ? [...without(current.excludedCardIds, cardId), cardId]
                : without(current.excludedCardIds, cardId),
          }
        : current,
    );

  const rulesInvalid = preview.data?.rules.some((rule) => rule.error) ?? false;
  const nameMissing = !draft.names.en.trim();
  const blocker = nameMissing ? t.families.nameRequired : rulesInvalid ? t.families.rulesInvalid : null;

  const payload = (): FamilyPayload => ({
    ...draft,
    icon: draft.icon?.trim() || null,
    names: {
      en: draft.names.en.trim(),
      ...(draft.names.fr?.trim() ? { fr: draft.names.fr.trim() } : {}),
      ...(draft.names.zh?.trim() ? { zh: draft.names.zh.trim() } : {}),
    },
  });

  const save = () =>
    void run(
      (user) =>
        familyId ? adminApi.updateFamily(user, familyId, payload()) : adminApi.createFamily(user, payload()),
      {
        success: isNew ? t.families.created : t.common.saved,
        onDone: (family) => {
          if (isNew) navigate(`/admin/families/${family.id}`, { replace: true });
          else setData(family);
        },
      },
    );

  return (
    <div className="p-[24px_28px_40px]">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link to="/admin/families" className="text-sm text-accent-700 hover:text-accent">
          {t.families.back}
        </Link>
        {data?.resolvedAt ? (
          <span className="text-xs text-muted">
            {t.families.lastResolved(formatRelative(data.resolvedAt, intlLocale))}
          </span>
        ) : null}
        {data?.resolveError ? <Tag tone="accent" title={data.resolveError}>{t.families.resolveFailed}</Tag> : null}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {blocker && dirty ? <span className="text-sm text-accent-700">{blocker}</span> : null}
          {!isNew ? (
            <Button variant="danger" disabled={busy} onClick={() => setConfirmDelete(true)}>
              {t.families.deleteFamily}
            </Button>
          ) : null}
          <Button disabled={!dirty || busy} onClick={() => setDraft(saved)}>
            {t.common.discard}
          </Button>
          <Button variant="primary" loading={busy} disabled={!dirty || !!blocker} onClick={save}>
            {t.common.save}
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(380px,520px)_1fr]">
        <div className="grid gap-5">
          <Panel title={t.families.identityTitle}>
            <div className="grid gap-4">
              <div className="grid grid-cols-[90px_1fr] gap-3">
                <TextField
                  label={t.families.icon}
                  value={draft.icon ?? ""}
                  placeholder="🦀"
                  onChange={(value) => set("icon", value)}
                  inputClassName="text-center text-lg"
                />
                <TextField
                  label={t.families.nameEn}
                  value={draft.names.en}
                  placeholder="Cancers"
                  onChange={(value) => set("names", { ...draft.names, en: value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label={t.families.nameFr}
                  value={draft.names.fr ?? ""}
                  placeholder={draft.names.en}
                  onChange={(value) => set("names", { ...draft.names, fr: value })}
                />
                <TextField
                  label={t.families.nameZh}
                  value={draft.names.zh ?? ""}
                  placeholder={draft.names.en}
                  onChange={(value) => set("names", { ...draft.names, zh: value })}
                />
              </div>
              <p className="-mt-2 mb-0 text-[11px] text-muted">{t.families.nameHelp}</p>
              <NumberField
                label={t.families.bonus}
                help={t.families.bonusHelp}
                value={draft.bonusPoints}
                min={0}
                step={1}
                onChange={(value) => set("bonusPoints", Math.max(0, Math.round(value ?? 0)))}
              />
              <CheckboxField
                label={t.families.enabledLabel}
                help={t.families.enabledHelp}
                checked={draft.enabled}
                onChange={(value) => set("enabled", value)}
              />
            </div>
          </Panel>

          <Panel title={t.families.rulesTitle}>
            <p className="mb-4 text-xs text-muted">{t.families.rulesHelp}</p>
            <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
              {t.families.matchLabel}
              <Seg
                value={draft.match}
                onChange={(value) => set("match", value)}
                options={[
                  { value: "any" as const, label: t.families.matchAny },
                  { value: "all" as const, label: t.families.matchAll },
                ]}
              />
            </div>

            <div className="grid gap-3">
              {draft.rules.map((rule, index) => (
                <RuleRow
                  key={index}
                  index={index}
                  rule={rule}
                  check={preview.data?.rules[index]}
                  pending={preview.loading}
                  onChange={(patch) => setRule(index, patch)}
                  onRemove={() => set("rules", draft.rules.filter((_, at) => at !== index))}
                />
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                className="btn-sm"
                disabled={draft.rules.length >= 20}
                onClick={() => set("rules", [...draft.rules, { field: "name", pattern: "", locale: null, exclude: false }])}
              >
                {t.families.addRule}
              </Button>
              <Button
                className="btn-sm"
                disabled={draft.rules.length >= 20}
                onClick={() => set("rules", [...draft.rules, { field: "name", pattern: "", locale: null, exclude: true }])}
              >
                {t.families.addExclude}
              </Button>
            </div>
          </Panel>

          <Panel
            title={t.families.picksTitle}
            eyebrow={t.families.picks(draft.includedCardIds.length, draft.excludedCardIds.length)}
            action={
              draft.includedCardIds.length + draft.excludedCardIds.length > 0 ? (
                <Button
                  className="btn-sm"
                  onClick={() => setDraft({ ...draft, includedCardIds: [], excludedCardIds: [] })}
                >
                  {t.families.clearPicks}
                </Button>
              ) : null
            }
          >
            <CardPicker onPick={(card) => pick(card.id, "in")} />
          </Panel>
        </div>

        <PreviewPanel preview={preview} onPick={pick} />
      </div>

      {confirmDelete && data ? (
        <ConfirmDialog
          danger
          title={t.families.deleteTitle}
          message={t.families.deleteBody(data.name)}
          confirmLabel={t.families.deleteFamily}
          busy={busy}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() =>
            void run((user) => adminApi.deleteFamily(user, data.id), {
              success: t.families.deleted,
              onDone: () => navigate("/admin/families", { replace: true }),
            })
          }
        />
      ) : null}
    </div>
  );
}

function RuleRow({
  index,
  rule,
  check,
  pending,
  onChange,
  onRemove,
}: {
  index: number;
  rule: FamilyRule;
  check: FamilyPreview["rules"][number] | undefined;
  pending: boolean;
  onChange: (patch: Partial<FamilyRule>) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const { intlLocale } = useLocale();
  const localized = LOCALIZED_RULE_FIELDS.includes(rule.field);

  return (
    <div
      className={cn(
        "rounded-[12px] border p-3",
        rule.exclude ? "border-accent-300 bg-accent-100" : "border-divider",
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="num w-6 text-xs text-muted">#{index + 1}</span>
        <select
          className="input w-auto"
          value={rule.exclude ? "exclude" : "include"}
          onChange={(event) => onChange({ exclude: event.target.value === "exclude" })}
        >
          <option value="include">{t.families.include}</option>
          <option value="exclude">{t.families.exclude}</option>
        </select>
        <select
          className="input w-auto"
          value={rule.field}
          onChange={(event) => onChange({ field: event.target.value as FamilyRule["field"] })}
        >
          {FAMILY_RULE_FIELDS.map((field) => (
            <option key={field} value={field}>
              {t.families.fields[field]}
            </option>
          ))}
        </select>
        {localized ? (
          <select
            className="input w-auto"
            value={rule.locale ?? ""}
            onChange={(event) => onChange({ locale: (event.target.value || null) as Locale | null })}
          >
            <option value="">{t.families.anyLanguage}</option>
            {LOCALES.map((locale) => (
              <option key={locale} value={locale}>
                {t.common.languageNames[locale] ?? locale}
              </option>
            ))}
          </select>
        ) : null}
        <Button className="btn-sm ml-auto" onClick={onRemove}>
          {t.families.removeRule}
        </Button>
      </div>
      <input
        className="input w-full font-mono text-[13px]"
        value={rule.pattern}
        spellCheck={false}
        placeholder={t.families.placeholders[rule.field]}
        onChange={(event) => onChange({ pattern: event.target.value })}
      />
      <div className={cn("mt-[6px] min-h-[16px] text-xs", pending && "opacity-60")}>
        {check?.error ? (
          <span className="text-accent-700">{check.error}</span>
        ) : check ? (
          <span className="text-muted">
            {t.families.ruleMatches(formatNumber(check.matches, intlLocale))}
            {check.labels.length > 0 ? ` · ${check.labels.join(", ")}` : null}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Adds a card by hand: a search over the whole catalog. */
function CardPicker({ onPick }: { onPick: (card: AdminCard) => void }) {
  const t = useT();
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setApplied(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const { data } = useAdminResource(
    (user) =>
      applied
        ? adminApi.cards(user, { search: applied, pageSize: 6, sort: "popularity" })
        : Promise.resolve(null),
    [applied],
  );

  return (
    <div className="grid gap-2">
      <input
        className="input"
        type="search"
        placeholder={t.families.addCard}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {applied && data
        ? data.items.map((card) => (
            <button
              key={card.id}
              type="button"
              className="flex items-center gap-3 rounded-[10px] p-1 text-left text-sm hover:bg-accent-100"
              onClick={() => {
                onPick(card);
                setSearch("");
              }}
            >
              <CardThumb src={card.imageUrl} size={28} />
              <span className="min-w-0 flex-1 truncate">
                <span className="text-muted">#{card.number}</span> {card.name}
              </span>
              <RarityTag rarity={card.rarity} />
            </button>
          ))
        : null}
    </div>
  );
}

type PreviewState = ReturnType<typeof useFamilyPreview>;

/**
 * Re-runs the preview a moment after the draft stops changing. A request
 * still in flight when the next one starts is aborted: only the latest
 * draft's answer may land.
 */
function useFamilyPreview(draft: FamilyPayload | null) {
  const user = useAuthedUser();
  const t = useT();
  const [view, setView] = useState<FamilyPreviewView>("members");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<FamilyPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  const definition = draft
    ? JSON.stringify({
        match: draft.match,
        rules: draft.rules,
        includedCardIds: draft.includedCardIds,
        excludedCardIds: draft.excludedCardIds,
      })
    : null;

  // A new definition or view starts the list over; picking a card does not
  // move the page under the cursor, which only changes the two id lists.
  const rulesKey = draft ? JSON.stringify({ match: draft.match, rules: draft.rules }) : null;
  useEffect(() => setPage(1), [rulesKey, view, search]);

  useEffect(() => {
    if (!definition) return;
    const timer = window.setTimeout(() => {
      controller.current?.abort();
      const next = new AbortController();
      controller.current = next;
      setLoading(true);
      adminApi
        .previewFamily(
          user,
          { ...JSON.parse(definition), view, search: search.trim() || undefined, page, pageSize: PREVIEW_PAGE_SIZE },
          next.signal,
        )
        .then((result) => {
          setData(result);
          setError(null);
        })
        .catch((caught) => {
          if (next.signal.aborted) return;
          setError(translateError(caught, t.common.loadError, t));
        })
        .finally(() => {
          if (controller.current === next) setLoading(false);
        });
    }, PREVIEW_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [user, t, definition, view, search, page]);

  useEffect(() => () => controller.current?.abort(), []);

  return { data, loading, error, view, setView, search, setSearch, page, setPage };
}

function PreviewPanel({
  preview,
  onPick,
}: {
  preview: PreviewState;
  onPick: (cardId: string, into: "in" | "out" | "none") => void;
}) {
  const t = useT();
  const { intlLocale } = useLocale();
  const { data, loading, error } = preview;
  const n = (value: number) => formatNumber(value, intlLocale);

  return (
    <Panel
      className="xl:sticky xl:top-4"
      title={t.families.previewTitle}
      eyebrow={loading ? t.families.updating : undefined}
    >
      <div className="mb-4 grid grid-cols-3 gap-3">
        <InsetTile label={t.families.members} value={data ? n(data.counts.members) : "…"} />
        <InsetTile label={t.families.droppable} value={data ? n(data.counts.droppable) : "…"} />
        <InsetTile label={t.families.excluded} value={data ? n(data.counts.excluded) : "…"} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Seg
          value={preview.view}
          onChange={preview.setView}
          options={[
            { value: "members" as const, label: t.families.viewMembers, count: data?.counts.members },
            { value: "excluded" as const, label: t.families.viewExcluded, count: data?.counts.excluded },
          ]}
        />
        <input
          className="input min-w-[160px] flex-1"
          type="search"
          placeholder={t.families.searchPreview}
          value={preview.search}
          onChange={(event) => preview.setSearch(event.target.value)}
        />
      </div>

      {error ? <p className="text-sm text-accent-700">{error}</p> : null}

      <div className={cn("grid gap-1 transition-opacity", loading && "opacity-60")}>
        {data && data.items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">{t.families.previewEmpty}</p>
        ) : null}
        {data?.items.map((card) => (
          <PreviewRow key={card.id} card={card} onPick={onPick} />
        ))}
      </div>

      {data && data.total > data.pageSize ? (
        <Pagination
          page={data.page}
          totalPages={Math.ceil(data.total / data.pageSize)}
          total={data.total}
          disabled={loading}
          onPage={preview.setPage}
        />
      ) : null}
    </Panel>
  );
}

function PreviewRow({
  card,
  onPick,
}: {
  card: FamilyPreviewCard;
  onPick: (cardId: string, into: "in" | "out" | "none") => void;
}) {
  const t = useT();
  const action: { label: string; into: "in" | "out" | "none" } =
    card.reason === "rules"
      ? { label: t.families.takeOut, into: "out" }
      : card.reason === "excludedByRule"
        ? { label: t.families.putBack, into: "in" }
        : { label: t.families.undoPick, into: "none" };

  return (
    <div className="flex items-center gap-3 border-b border-divider py-[7px] last:border-b-0">
      <CardThumb src={card.imageUrl} size={34} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm">
          <a
            className="truncate font-medium hover:text-accent"
            href={card.wikipediaUrl}
            target="_blank"
            rel="noreferrer"
          >
            <span className="text-muted">#{card.number}</span> {card.name}
          </a>
          <RarityTag rarity={card.rarity} />
        </div>
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
          <span className="truncate">{card.description ?? card.wikidataId}</span>
          {card.hits.length > 0 ? (
            <span className="num">{card.hits.map((hit) => `#${hit + 1}`).join(" ")}</span>
          ) : null}
          {card.reason !== "rules" ? <span>· {t.families.reasons[card.reason]}</span> : null}
          {!card.droppable ? <span>· {t.families.notDroppable}</span> : null}
        </div>
      </div>
      <Button className="btn-sm flex-none" onClick={() => onPick(card.id, action.into)}>
        {action.label}
      </Button>
    </div>
  );
}
