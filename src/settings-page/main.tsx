import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { AiSettingsForm } from "../side-panel/settings/AiSettingsForm";
import {
  applyNodeColorRendering,
  loadUiSettings,
  saveUiSettings,
  type UiSettings
} from "../side-panel/settings/ui-settings-storage";
import { THEME_OPTIONS, applyTheme } from "../side-panel/settings/theme-storage";
import { useI18n } from "../side-panel/i18n/useI18n";
import {
  DEFAULT_LANGUAGE,
  type CustomLanguage,
  type I18nKey,
  type LanguageMode,
  generateCustomLanguage,
  loadLanguageSettings,
  saveCustomLanguage,
  saveLanguageMode
} from "../side-panel/i18n/i18n-storage";
import { recordApiTaskLog } from "../side-panel/task-log";
import type { LayoutMode } from "../side-panel/graph/graph-storage";
import "../side-panel/styles.css";
import "./settings-page.css";

const LAYOUT_OPTIONS: Array<{ value: LayoutMode; label: string }> = [
  { value: "single", label: "Single-side" },
  { value: "radial", label: "Radial" },
  { value: "list", label: "Matrix" },
  { value: "two-sided", label: "Two-sided" }
];

const LAYOUT_LABEL_KEYS = {
  single: "layout.single",
  radial: "layout.radial",
  list: "layout.matrix",
  "two-sided": "layout.twoSided"
} satisfies Record<LayoutMode, I18nKey>;

const LANGUAGE_OPTIONS: Array<{ value: LanguageMode; labelKey: I18nKey }> = [
  { value: "browser", labelKey: "settings.language.browser" },
  { value: "en", labelKey: "settings.language.english" },
  { value: "zh", labelKey: "settings.language.chinese" }
];

const THEME_LABEL_KEYS = {
  browser: "settings.theme.browser",
  day: "settings.theme.day",
  night: "settings.theme.night",
  "eye-care": "settings.theme.eyeCare"
} satisfies Record<(typeof THEME_OPTIONS)[number]["value"], I18nKey>;

function SettingsPage() {
  const { t } = useI18n();
  const [settings, setSettings] = useState<UiSettings | null>(null);
  const [languageMode, setLanguageMode] = useState<LanguageMode>(DEFAULT_LANGUAGE);
  const [customLanguages, setCustomLanguages] = useState<CustomLanguage[]>([]);
  const [customLanguageName, setCustomLanguageName] = useState("");
  const [translating, setTranslating] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    void Promise.all([loadUiSettings(), loadLanguageSettings()]).then(([loadedSettings, languageSettings]) => {
      setSettings(loadedSettings);
      setLanguageMode(languageSettings.mode);
      setCustomLanguages(languageSettings.customLanguages);
      applyTheme(loadedSettings.theme);
      applyNodeColorRendering(loadedSettings);
    });
  }, []);

  const update = useCallback((updates: Partial<UiSettings>) => {
    setSettings((current) => (current ? { ...current, ...updates } : current));
  }, []);

  useEffect(() => {
    if (settings) {
      applyTheme(settings.theme);
      applyNodeColorRendering(settings);
    }
  }, [settings]);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const listener = () => {
      if (settings?.theme === "browser") applyTheme("browser");
    };
    media?.addEventListener?.("change", listener);
    return () => media?.removeEventListener?.("change", listener);
  }, [settings?.theme]);

  useEffect(() => {
    setStatus((current) => current || t("settings.status.local"));
  }, [t]);

  const save = useCallback(async () => {
    if (!settings) return;
    await saveUiSettings(settings);
    await saveLanguageMode(languageMode);
    setStatus(t("settings.status.interfaceSaved"));
  }, [languageMode, settings, t]);

  const changeLanguage = useCallback(async (mode: LanguageMode) => {
    setLanguageMode(mode);
    await saveLanguageMode(mode);
  }, []);

  const translateLanguage = useCallback(async () => {
    if (!customLanguageName.trim()) {
      setStatus(t("settings.translationNeedsName"));
      return;
    }

    setTranslating(true);
    const taskId = `translate-${customLanguageName.trim().toLowerCase().replace(/\s+/g, "-")}`;
    setStatus(t("task.translate", { language: customLanguageName.trim() }));
    void recordApiTaskLog({
      id: taskId,
      kind: "translate",
      status: "running",
      message: t("task.translate", { language: customLanguageName.trim() }),
      progress: 10
    });
    try {
      const language = await generateCustomLanguage(customLanguageName);
      await saveCustomLanguage(language);
      setCustomLanguages((current) => [language, ...current.filter((item) => item.id !== language.id)].slice(0, 12));
      setLanguageMode(`custom:${language.id}`);
      setStatus(t("settings.translationSaved"));
      void recordApiTaskLog({
        id: taskId,
        kind: "translate",
        status: "success",
        message: t("task.translateDone", { language: language.label }),
        progress: 100
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : t("settings.translationFailed");
      setStatus(message);
      void recordApiTaskLog({
        id: taskId,
        kind: "translate",
        status: "error",
        message,
        progress: 100
      });
    } finally {
      setTranslating(false);
    }
  }, [customLanguageName, t]);

  return (
    <main className="settings-page">
      <header className="settings-page__header">
        <div>
          <h1>{t("settings.title")}</h1>
          <p>{t("settings.subtitle")}</p>
        </div>
        <button type="button" onClick={() => window.close()}>
          {t("settings.close")}
        </button>
      </header>

      <section className="settings-page__grid">
        <AiSettingsForm onSaved={setStatus} />

        <section className="settings-section">
          <div className="settings-section__header">
            <strong>{t("settings.section.interface")}</strong>
            <span>{t("settings.section.interfaceHint")}</span>
          </div>

          {settings ? (
            <>
              <label>
                {t("settings.defaultLayout")}
                <select
                  value={settings.defaultLayout}
                  onChange={(event) => update({ defaultLayout: event.currentTarget.value as LayoutMode })}
                >
                  {LAYOUT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(LAYOUT_LABEL_KEYS[option.value])}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                {t("settings.theme")}
                <select
                  value={settings.theme}
                  onChange={(event) => update({ theme: event.currentTarget.value as UiSettings["theme"] })}
                >
                  {THEME_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(THEME_LABEL_KEYS[option.value])}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                {t("settings.language")}
                <select value={languageMode} onChange={(event) => void changeLanguage(event.currentTarget.value as LanguageMode)}>
                  {LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </option>
                  ))}
                  {customLanguages.map((language) => (
                    <option key={language.id} value={`custom:${language.id}`}>
                      {language.label}
                    </option>
                  ))}
                </select>
              </label>

              <p>{t("settings.languageHint")}</p>

              <div className="settings-section__inline">
                <label>
                  {t("settings.customLanguage")}
                  <input
                    value={customLanguageName}
                    onChange={(event) => setCustomLanguageName(event.currentTarget.value)}
                    placeholder={t("settings.customLanguagePlaceholder")}
                  />
                </label>
                <button type="button" onClick={() => void translateLanguage()} disabled={translating}>
                  {translating ? t("settings.generatingTranslation") : t("settings.generateTranslation")}
                </button>
              </div>

              <p>{t("settings.customTranslationHint")}</p>

              <fieldset className="settings-fieldset">
                <legend>{t("settings.nodeColorRendering")}</legend>
                <label>
                  {t("settings.nodeColorRenderMode")}
                  <select
                    value={settings.nodeColorRenderMode}
                    onChange={(event) =>
                      update({ nodeColorRenderMode: event.currentTarget.value as UiSettings["nodeColorRenderMode"] })
                    }
                  >
                    <option value="gradient">{t("settings.nodeColorRenderGradient")}</option>
                    <option value="solid">{t("settings.nodeColorRenderSolid")}</option>
                  </select>
                </label>
                <label>
                  {t("settings.nodeColorRenderStrength")}
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={settings.nodeColorRenderStrength}
                    onChange={(event) => update({ nodeColorRenderStrength: Number(event.currentTarget.value) })}
                  />
                  <span>{settings.nodeColorRenderStrength}%</span>
                </label>
              </fieldset>

              <label className="settings-panel__check">
                <input
                  type="checkbox"
                  checked={settings.floatingPanelEnabled}
                  onChange={(event) => update({ floatingPanelEnabled: event.currentTarget.checked })}
                />
                {t("settings.enableFloat")}
              </label>

              <label className="settings-panel__check">
                <input
                  type="checkbox"
                  checked={settings.launcherEnabled}
                  onChange={(event) => update({ launcherEnabled: event.currentTarget.checked })}
                />
                {t("settings.showLauncher")}
              </label>

              <div className="settings-panel__actions">
                <button type="button" onClick={save}>
                  {t("settings.saveInterface")}
                </button>
              </div>
            </>
          ) : (
            <p>{t("settings.loadingInterface")}</p>
          )}
        </section>

        <section className="settings-section">
          <div className="settings-section__header">
            <strong>{t("settings.section.updates")}</strong>
            <span>{t("settings.section.updatesHint")}</span>
          </div>

          {settings ? (
            <>
              <label className="settings-panel__check">
                <input
                  type="checkbox"
                  checked={settings.updateNoticeEnabled}
                  onChange={(event) => update({ updateNoticeEnabled: event.currentTarget.checked })}
                />
                {t("settings.showUpdates")}
              </label>

              <label className="settings-panel__check">
                <input
                  type="checkbox"
                  checked={settings.includePrereleaseUpdates}
                  onChange={(event) => update({ includePrereleaseUpdates: event.currentTarget.checked })}
                />
                {t("settings.includePrerelease")}
              </label>

              <label>
                {t("settings.ignoredVersion")}
                <input
                  value={settings.ignoredVersion}
                  onChange={(event) => update({ ignoredVersion: event.currentTarget.value })}
                  placeholder="v0.1.1"
                />
              </label>

              <p>
                {t("settings.updateHint")}
              </p>

              <div className="settings-panel__actions">
                <button type="button" onClick={save}>
                  {t("settings.saveUpdates")}
                </button>
              </div>
            </>
          ) : (
            <p>{t("settings.loadingUpdates")}</p>
          )}
        </section>
      </section>

      <section className="settings-page__status">{status}</section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SettingsPage />
  </StrictMode>
);
