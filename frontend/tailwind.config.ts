import type { Config } from 'tailwindcss';

/**
 * Design System Proximo — « Minimalist Modern »
 * =============================================
 * - Signature Electric Blue : #0052FF → #4D7CFF (actions globales, CTA)
 * - Fond chaud #FAFAFA, texte Deep Slate #0F172A
 * - Couleurs sémantiques par catégorie (annonces & signalements)
 * - « brand-* » conservé comme alias du vert historique pour la
 *   migration progressive ; les nouveaux composants utilisent
 *   `primary` / `category-*`.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Palette de base ──────────────────────────────────
        background: '#FAFAFA',
        foreground: '#0F172A',
        muted: '#F1F5F9',
        'muted-foreground': '#64748B',
        card: '#FFFFFF',
        border: '#E2E8F0',

        // ── Signature Electric Blue ──────────────────────────
        primary: {
          DEFAULT: '#0052FF',
          hover: '#0043D6',
          secondary: '#4D7CFF',
          soft: 'rgba(0, 82, 255, 0.08)',
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          600: '#0052FF',
          700: '#0043D6',
        },

        // ── Alias historique → désormais mappé sur la signature Electric Blue.
        // Tous les anciens composants (bg-brand-600, text-brand-700, bg-brand-50…)
        // héritent automatiquement du nouveau style sans édition individuelle.
        brand: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          500: '#4D7CFF',
          600: '#0052FF',
          700: '#0043D6',
        },

        // ── Catégories sémantiques ───────────────────────────
        category: {
          // 🔧 Prêt de matériel — Electric Blue
          loan: { DEFAULT: '#0052FF', soft: '#EFF6FF', border: '#BFDBFE' },
          // 🤝 Service entre voisins — Indigo/Violet
          service: { DEFAULT: '#6366F1', soft: '#EEF2FF', border: '#C7D2FE' },
          // 🎁 Don — Émeraude
          gift: { DEFAULT: '#10B981', soft: '#ECFDF5', border: '#A7F3D0' },
          // 📢 Avis aux résidents — Ambre
          notice: { DEFAULT: '#F59E0B', soft: '#FFFBEB', border: '#FDE68A' },
          // 🚨 Signalement Syndic — Rouge Corail
          incident: { DEFAULT: '#EF4444', soft: '#FEF2F2', border: '#FECACA' },
          // Statuts incidents
          status: {
            open: '#F59E0B',
            progress: '#0052FF',
            resolved: '#10B981',
          },
        },

        // ── Sections inversées (landing, stats) ──────────────
        slate: {
          900: '#0F172A',
        },
      },
      fontFamily: {
        display: ['var(--font-calistoga)', 'ui-serif', 'Georgia', 'serif'],
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #0052FF 0%, #4D7CFF 100%)',
        'soft-glow': 'radial-gradient(circle, rgba(0,82,255,0.06) 0%, transparent 70%)',
      },
      boxShadow: {
        card: '0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)',
        'card-hover':
          '0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -1px rgba(15, 23, 42, 0.04)',
        glow: '0 0 0 1px rgba(0, 82, 255, 0.1), 0 8px 24px -4px rgba(0, 82, 255, 0.25)',
      },
      letterSpacing: {
        badge: '0.15em',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.4s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
