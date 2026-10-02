import { useId, type ReactNode } from "react";
import { cn } from "../../lib/utils";

/**
 * `.field` + `.input` and the choice controls built on native elements — no
 * script, so keyboard and screen-reader behaviour is the browser's.
 */
export function Field({
  label,
  help,
  htmlFor,
  children,
  className,
}: {
  label?: ReactNode;
  help?: ReactNode;
  htmlFor?: string;
  /** Optional: `<Field label={…} />` alone labels the control that follows. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("field", className)}>
      {label ? <label htmlFor={htmlFor}>{label}</label> : null}
      {children}
      {help ? (
        <p className="mb-0 mt-[5px] text-[11px] text-muted">{help}</p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  help,
  placeholder,
  type = "text",
  disabled,
  required,
  autoComplete,
  className,
  inputClassName,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  help?: string;
  placeholder?: string;
  type?: "text" | "email" | "password" | "url" | "tel" | "search";
  disabled?: boolean;
  required?: boolean;
  autoComplete?: string;
  className?: string;
  inputClassName?: string;
}) {
  const id = useId();

  return (
    <Field label={label} help={help} htmlFor={id} className={className}>
      <input
        id={id}
        className={cn("input", inputClassName)}
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

/** Empty means null, which the API reads as "unlimited". */
export function NumberField({
  label,
  value,
  onChange,
  help,
  min = 0,
  step,
  placeholder,
  disabled,
  className,
}: {
  label?: string;
  value: number | null;
  onChange: (value: number | null) => void;
  help?: string;
  min?: number;
  step?: number | string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();

  return (
    <Field label={label} help={help} htmlFor={id} className={className}>
      <input
        id={id}
        className="input"
        type="number"
        min={min}
        step={step}
        value={value ?? ""}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => {
          const raw = event.target.value;
          onChange(raw === "" ? null : Number(raw));
        }}
      />
    </Field>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  help,
  rows = 3,
  placeholder,
  className,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  help?: string;
  rows?: number;
  placeholder?: string;
  className?: string;
}) {
  const id = useId();

  return (
    <Field label={label} help={help} htmlFor={id} className={className}>
      <textarea
        id={id}
        className="input"
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

/** `.radio` as a checkbox — the design uses the same dot for both. */
export function CheckboxField({
  label,
  help,
  checked,
  onChange,
  disabled,
  className,
}: {
  label: ReactNode;
  help?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  const box = (
    <label className={cn("radio", className)}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="dot" />
      {label}
    </label>
  );

  if (!help) return box;

  return (
    <div>
      {box}
      {/* Aligned with the label, past the dot. */}
      <p className="mb-0 ml-6 mt-1 text-[11px] text-muted">{help}</p>
    </div>
  );
}

/** `.radio` proper: one choice out of a named group. */
export function RadioField<T extends string>({
  name,
  option,
  value,
  onChange,
  label,
  disabled,
  className,
}: {
  name: string;
  option: T;
  value: T | null;
  onChange: (option: T) => void;
  label: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label className={cn("radio", className)}>
      <input
        type="radio"
        name={name}
        checked={value === option}
        disabled={disabled}
        onChange={() => onChange(option)}
      />
      <span className="dot" />
      {label}
    </label>
  );
}

/**
 * A toggle rendered as a two-option segmented control rather than a switch:
 * the design system has no switch, and inventing one would be the only
 * unthemed control in the panel.
 */
export function ToggleRow({
  label,
  help,
  checked,
  onChange,
  onLabel,
  offLabel,
  disabled,
}: {
  label: ReactNode;
  help?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  onLabel: string;
  offLabel: string;
  disabled?: boolean;
}) {
  const name = useId();

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-xl">
        <p className="mb-0 text-sm font-semibold">{label}</p>
        {help ? <p className="mb-0 mt-1 text-xs text-muted">{help}</p> : null}
      </div>
      <div className="seg flex-none">
        <label className="seg-opt">
          <input
            type="radio"
            name={name}
            checked={checked}
            disabled={disabled}
            onChange={() => onChange(true)}
          />
          {onLabel}
        </label>
        <label className="seg-opt">
          <input
            type="radio"
            name={name}
            checked={!checked}
            disabled={disabled}
            onChange={() => onChange(false)}
          />
          {offLabel}
        </label>
      </div>
    </div>
  );
}
