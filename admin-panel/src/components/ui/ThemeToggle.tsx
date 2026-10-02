import { useT } from "../../i18n";
import { useTheme } from "../../theme-context";
import { Button } from "./Button";
import { Seg } from "./Seg";

/**
 * The header's theme button. Its label is the *other* theme's name — it says
 * what pressing it does, as the design specifies.
 */
export function ThemeToggle() {
  const t = useT();
  const { theme, toggleTheme } = useTheme();

  return (
    <Button className="flex-none" onClick={toggleTheme}>
      {theme === "dark" ? t.common.themeLight : t.common.themeDark}
    </Button>
  );
}

/** The settings screen's Light / Dark choice, wired to the same live state. */
export function ThemeSeg() {
  const t = useT();
  const { theme, setTheme } = useTheme();

  return (
    <Seg
      ariaLabel={t.settings.appearance}
      value={theme}
      onChange={setTheme}
      options={[
        { value: "light" as const, label: t.common.themeLight },
        { value: "dark" as const, label: t.common.themeDark },
      ]}
    />
  );
}
