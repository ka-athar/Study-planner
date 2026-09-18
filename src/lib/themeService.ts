import { ThemeMode, ThemeConfig, ThemePalette, ThemePreset } from '../types';

const THEME_STORAGE_KEY = 'studyos_theme_config';

export interface PaletteDefinition {
  id: ThemePalette;
  name: string;
  desc: string;
  bgPreview: string;
  accentPreview: string;
  light: {
    '--bg-app': string;
    '--bg-card': string;
    '--bg-surface': string;
    '--bg-header': string;
    '--bg-accent': string;
    '--text-primary': string;
    '--text-muted': string;
    '--border-theme': string;
    '--color-primary': string;
    '--color-primary-hover': string;
    '--primary-rgb': string;
  };
  dark: {
    '--bg-app': string;
    '--bg-card': string;
    '--bg-surface': string;
    '--bg-header': string;
    '--bg-accent': string;
    '--text-primary': string;
    '--text-muted': string;
    '--border-theme': string;
    '--color-primary': string;
    '--color-primary-hover': string;
    '--primary-rgb': string;
  };
}

export const THEME_PALETTES: Record<string, PaletteDefinition> = {
  natural_ethos: {
    id: 'natural_ethos',
    name: 'Natural Ethos',
    desc: 'Calming sage, warm paper & clean porcelain',
    bgPreview: '#FAFAF7',
    accentPreview: '#4D7C5D',
    light: {
      '--bg-app': '#FAF9F5',
      '--bg-card': '#FFFFFF',
      '--bg-surface': '#F4F1EA',
      '--bg-header': '#FFFFFF',
      '--bg-accent': '#EDE8DE',
      '--text-primary': '#2D312E',
      '--text-muted': '#6B726A',
      '--border-theme': '#E3DED4',
      '--color-primary': '#4D7C5D',
      '--color-primary-hover': '#3D634A',
      '--primary-rgb': '77, 124, 93',
    },
    dark: {
      '--bg-app': '#1E2320',
      '--bg-card': '#272E2A',
      '--bg-surface': '#222825',
      '--bg-header': '#222825',
      '--bg-accent': '#323B36',
      '--text-primary': '#F1F5F2',
      '--text-muted': '#9EABA2',
      '--border-theme': '#38423D',
      '--color-primary': '#6BA87E',
      '--color-primary-hover': '#82BB93',
      '--primary-rgb': '107, 168, 126',
    },
  },
  nord_studio: {
    id: 'nord_studio',
    name: 'Nord Studio',
    desc: 'Clean arctic white, sky blue & fresh slate',
    bgPreview: '#F8FAFC',
    accentPreview: '#0284C7',
    light: {
      '--bg-app': '#F8FAFC',
      '--bg-card': '#FFFFFF',
      '--bg-surface': '#F1F5F9',
      '--bg-header': '#FFFFFF',
      '--bg-accent': '#E2E8F0',
      '--text-primary': '#0F172A',
      '--text-muted': '#64748B',
      '--border-theme': '#E2E8F0',
      '--color-primary': '#0284C7',
      '--color-primary-hover': '#0369A1',
      '--primary-rgb': '2, 132, 199',
    },
    dark: {
      '--bg-app': '#1E293B',
      '--bg-card': '#283548',
      '--bg-surface': '#202C3F',
      '--bg-header': '#202C3F',
      '--bg-accent': '#334155',
      '--text-primary': '#F8FAFC',
      '--text-muted': '#94A3B8',
      '--border-theme': '#3B4D66',
      '--color-primary': '#38BDF8',
      '--color-primary-hover': '#7DD3FC',
      '--primary-rgb': '56, 189, 248',
    },
  },
  obsidian_dark: {
    id: 'obsidian_dark',
    name: 'Emerald Clean',
    desc: 'Bright clean light canvas with emerald accents',
    bgPreview: '#F9FAF7',
    accentPreview: '#059669',
    light: {
      '--bg-app': '#F9FAF7',
      '--bg-card': '#FFFFFF',
      '--bg-surface': '#F0F3EC',
      '--bg-header': '#FFFFFF',
      '--bg-accent': '#E2E8DC',
      '--text-primary': '#1B241E',
      '--text-muted': '#5D6E63',
      '--border-theme': '#DCE3D6',
      '--color-primary': '#059669',
      '--color-primary-hover': '#047857',
      '--primary-rgb': '5, 150, 105',
    },
    dark: {
      '--bg-app': '#18241E',
      '--bg-card': '#203028',
      '--bg-surface': '#1C2B24',
      '--bg-header': '#1C2B24',
      '--bg-accent': '#2A3D34',
      '--text-primary': '#F0FDF4',
      '--text-muted': '#86EFAC',
      '--border-theme': '#334D41',
      '--color-primary': '#10B981',
      '--color-primary-hover': '#34D399',
      '--primary-rgb': '16, 185, 129',
    },
  },
  sunset_amber: {
    id: 'sunset_amber',
    name: 'Warm Sunset',
    desc: 'Warm cream, terracotta & honey amber tones',
    bgPreview: '#FFFDF9',
    accentPreview: '#D97706',
    light: {
      '--bg-app': '#FFFDF9',
      '--bg-card': '#FFFFFF',
      '--bg-surface': '#FDF4EB',
      '--bg-header': '#FFFFFF',
      '--bg-accent': '#FCE7D2',
      '--text-primary': '#38200F',
      '--text-muted': '#855E42',
      '--border-theme': '#F5DECB',
      '--color-primary': '#D97706',
      '--color-primary-hover': '#B45309',
      '--primary-rgb': '217, 119, 6',
    },
    dark: {
      '--bg-app': '#271F19',
      '--bg-card': '#332921',
      '--bg-surface': '#2D241D',
      '--bg-header': '#2D241D',
      '--bg-accent': '#44372D',
      '--text-primary': '#FFFBEB',
      '--text-muted': '#FDE68A',
      '--border-theme': '#4F3E33',
      '--color-primary': '#F59E0B',
      '--color-primary-hover': '#FBBF24',
      '--primary-rgb': '245, 158, 11',
    },
  },
  royal_indigo: {
    id: 'royal_indigo',
    name: 'Royal Indigo',
    desc: 'Scholarly porcelain & vibrant iris indigo',
    bgPreview: '#F9FAFF',
    accentPreview: '#4F46E5',
    light: {
      '--bg-app': '#F8F9FE',
      '--bg-card': '#FFFFFF',
      '--bg-surface': '#EEF2FF',
      '--bg-header': '#FFFFFF',
      '--bg-accent': '#E0E7FF',
      '--text-primary': '#0F172A',
      '--text-muted': '#58657B',
      '--border-theme': '#E0E7FF',
      '--color-primary': '#4F46E5',
      '--color-primary-hover': '#4338CA',
      '--primary-rgb': '79, 70, 229',
    },
    dark: {
      '--bg-app': '#1A1D2D',
      '--bg-card': '#24283E',
      '--bg-surface': '#1F2236',
      '--bg-header': '#1F2236',
      '--bg-accent': '#2F3452',
      '--text-primary': '#EEF2FF',
      '--text-muted': '#A5B4FC',
      '--border-theme': '#3B4166',
      '--color-primary': '#818CF8',
      '--color-primary-hover': '#A5B4FC',
      '--primary-rgb': '129, 140, 248',
    },
  },
  rose_crimson: {
    id: 'rose_crimson',
    name: 'Rose Crimson',
    desc: 'Refined velvet rose, clean marble & berry accents',
    bgPreview: '#FFF9FA',
    accentPreview: '#E11D48',
    light: {
      '--bg-app': '#FFF9FA',
      '--bg-card': '#FFFFFF',
      '--bg-surface': '#FFF1F2',
      '--bg-header': '#FFFFFF',
      '--bg-accent': '#FFE4E6',
      '--text-primary': '#1E1B1B',
      '--text-muted': '#7A6B6D',
      '--border-theme': '#FECDD3',
      '--color-primary': '#E11D48',
      '--color-primary-hover': '#BE123C',
      '--primary-rgb': '225, 29, 72',
    },
    dark: {
      '--bg-app': '#241619',
      '--bg-card': '#311E22',
      '--bg-surface': '#2B191D',
      '--bg-header': '#2B191D',
      '--bg-accent': '#44262C',
      '--text-primary': '#FFF1F2',
      '--text-muted': '#FDA4AF',
      '--border-theme': '#542E36',
      '--color-primary': '#FB7185',
      '--color-primary-hover': '#FDA4AF',
      '--primary-rgb': '251, 113, 133',
    },
  },
  cyber_mint: {
    id: 'cyber_mint',
    name: 'Cyber Mint',
    desc: 'Crisp glacial white with electric teal & mint',
    bgPreview: '#F4FDFC',
    accentPreview: '#0D9488',
    light: {
      '--bg-app': '#F4FDFC',
      '--bg-card': '#FFFFFF',
      '--bg-surface': '#E6FAF8',
      '--bg-header': '#FFFFFF',
      '--bg-accent': '#CCFBF1',
      '--text-primary': '#132A27',
      '--text-muted': '#4B6B67',
      '--border-theme': '#99F6E4',
      '--color-primary': '#0D9488',
      '--color-primary-hover': '#0F766E',
      '--primary-rgb': '13, 148, 136',
    },
    dark: {
      '--bg-app': '#132322',
      '--bg-card': '#1B312F',
      '--bg-surface': '#162A28',
      '--bg-header': '#162A28',
      '--bg-accent': '#234441',
      '--text-primary': '#F0FDFA',
      '--text-muted': '#5EEAD4',
      '--border-theme': '#2D5955',
      '--color-primary': '#14B8A6',
      '--color-primary-hover': '#2DD4BF',
      '--primary-rgb': '20, 184, 166',
    },
  },
};

export const DEFAULT_THEME: ThemeConfig = {
  mode: 'light',
  palette: 'natural_ethos',
  preset: 'natural_ethos',
  highContrast: false,
  compactMode: false,
};

/**
 * Returns true if system prefers dark mode
 */
export function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Computes whether the theme should render as dark based on mode and system preferences
 */
export function computeIsDark(mode: ThemeMode = 'light'): boolean {
  if (mode === 'dark') return true;
  // User explicitly asked for a bright, non-dark aesthetic as default
  return false;
}

/**
 * Retrieves the list of available theme palette presets
 */
export function getAvailablePalettes(): PaletteDefinition[] {
  return Object.values(THEME_PALETTES);
}

/**
 * Resolves current theme configuration from storage
 */
export function getStoredThemeConfig(): ThemeConfig {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const palette = parsed.palette || parsed.preset || 'natural_ethos';
      return {
        mode: parsed.mode || 'light',
        palette,
        preset: palette as ThemePreset,
        highContrast: Boolean(parsed.highContrast),
        compactMode: Boolean(parsed.compactMode),
      };
    }
  } catch (e) {
    console.warn('Failed to parse theme config from storage:', e);
  }
  return DEFAULT_THEME;
}

/**
 * Applies theme CSS variables, attributes, and classes immediately to the DOM
 */
export function applyThemeToDOM(config: ThemeConfig): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const isDark = computeIsDark(config.mode);
  const activePaletteKey = config.palette || config.preset || 'natural_ethos';
  const paletteDef = THEME_PALETTES[activePaletteKey] || THEME_PALETTES.natural_ethos;
  const variables = isDark ? paletteDef.dark : paletteDef.light;

  // 1. Immediately inject all CSS Custom Properties directly into :root style
  for (const [property, value] of Object.entries(variables)) {
    root.style.setProperty(property, value);
  }

  // Handle High Contrast mode adjustments
  if (config.highContrast) {
    root.style.setProperty('--border-theme', isDark ? '#FFFFFF' : '#000000');
    root.classList.add('high-contrast');
  } else {
    root.classList.remove('high-contrast');
  }

  // Handle Compact Spacing mode class
  if (config.compactMode) {
    root.classList.add('compact-mode');
  } else {
    root.classList.remove('compact-mode');
  }

  // 2. Set root DOM attributes for styling and CSS selectors
  root.setAttribute('data-theme', isDark ? 'dark' : 'light');
  root.setAttribute('data-mode', config.mode || 'light');
  root.setAttribute('data-palette', activePaletteKey);
  root.style.colorScheme = isDark ? 'dark' : 'light';

  // 3. Toggle standard Tailwind dark class
  if (isDark) {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
  }

  // 4. Update body background and color directly as fallback
  if (document.body) {
    document.body.style.backgroundColor = variables['--bg-app'];
    document.body.style.color = variables['--text-primary'];
  }

  // 5. Update browser theme-color meta tag for seamless UI chrome
  let metaTheme = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (!metaTheme) {
    metaTheme = document.createElement('meta');
    metaTheme.name = 'theme-color';
    document.head.appendChild(metaTheme);
  }
  metaTheme.content = variables['--bg-app'];

  // 6. Broadcast event so any canvas/recharts or custom components can react immediately
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('studyos:theme-changed', {
        detail: { config, isDark, palette: activePaletteKey, variables },
      })
    );
  }
}

/**
 * Saves theme configuration to localStorage and immediately applies it to the DOM
 */
export function saveThemeConfig(config: ThemeConfig): void {
  try {
    const resolvedPalette = config.palette || config.preset || 'natural_ethos';
    const resolvedConfig: ThemeConfig = {
      ...config,
      palette: resolvedPalette,
      preset: resolvedPalette as ThemePreset,
    };
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(resolvedConfig));
    applyThemeToDOM(resolvedConfig);
  } catch (e) {
    console.warn('Failed to save theme config:', e);
  }
}

/**
 * Initialize theme listener on app start
 */
export function initializeTheme(): ThemeConfig {
  const current = getStoredThemeConfig();
  applyThemeToDOM(current);

  if (typeof window !== 'undefined' && window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      const latest = getStoredThemeConfig();
      if (latest.mode === 'system') {
        applyThemeToDOM(latest);
      }
    };
    
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleSystemChange);
    } else if ((mediaQuery as any).addListener) {
      (mediaQuery as any).addListener(handleSystemChange);
    }
  }

  return current;
}
