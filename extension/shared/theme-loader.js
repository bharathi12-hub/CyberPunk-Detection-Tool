/**
 * Theme Loader
 * Reads the saved theme + mode from chrome.storage.local and applies them
 * to <body data-theme="..." data-mode="...">. Shared by popup.js,
 * dashboard.js, and options.js so all three surfaces stay visually in sync.
 *
 * Call applyTheme() as early as possible (before paint) to avoid a flash
 * of the default theme.
 */

const DEFAULT_THEME = 'cyan';
const DEFAULT_MODE = 'dark';

export async function applyTheme() {
  const { bsa_settings: settings } = await chrome.storage.local.get('bsa_settings');
  const theme = settings?.theme || DEFAULT_THEME;
  const mode = settings?.mode || DEFAULT_MODE;

  document.body.setAttribute('data-theme', theme);
  document.body.setAttribute('data-mode', mode);

  return { theme, mode };
}

/**
 * Listens for theme/mode changes made elsewhere (e.g. the options page)
 * and live-updates this page without requiring a reload.
 */
export function watchThemeChanges() {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.bsa_settings) return;
    const settings = changes.bsa_settings.newValue;
    if (!settings) return;
    if (settings.theme) document.body.setAttribute('data-theme', settings.theme);
    if (settings.mode) document.body.setAttribute('data-mode', settings.mode);
  });
}
