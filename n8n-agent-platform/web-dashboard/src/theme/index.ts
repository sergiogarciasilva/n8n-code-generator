import { createTheme, ThemeOptions } from '@mui/material/styles';
import { designTokens, cssVariables } from './designTokens';

// Inject CSS variables
const style = document.createElement('style');
style.textContent = cssVariables;
document.head.appendChild(style);

const baseTheme: ThemeOptions = {
  palette: {
    mode: 'light',
    primary: {
      main: '#ff6d00',
      light: '#ff9e40',
      dark: '#c43e00',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
      contrastText: '#ffffff',
    },
    success: {
      main: '#22c55e',
      light: '#4ade80',
      dark: '#16a34a',
    },
    warning: {
      main: '#f59e0b',
      light: '#fbbf24',
      dark: '#d97706',
    },
    error: {
      main: '#ef4444',
      light: '#f87171',
      dark: '#dc2626',
    },
    info: {
      main: '#3b82f6',
      light: '#60a5fa',
      dark: '#2563eb',
    },
    background: {
      default: 'rgba(248, 250, 252, 0.95)',
      paper: 'rgba(255, 255, 255, 0.25)',
    },
    text: {
      primary: 'rgba(15, 23, 42, 0.87)',
      secondary: 'rgba(51, 65, 85, 0.60)',
      disabled: 'rgba(71, 85, 105, 0.38)',
    },
    divider: 'rgba(148, 163, 184, 0.12)',
  },
  typography: {
    fontFamily: designTokens.fonts.primary,
    h1: {
      fontFamily: designTokens.fonts.primary,
      fontWeight: 800,
      fontSize: '3.5rem',
      lineHeight: 1.2,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontFamily: designTokens.fonts.primary,
      fontWeight: 700,
      fontSize: '2.5rem',
      lineHeight: 1.3,
      letterSpacing: '-0.01em',
    },
    h3: {
      fontFamily: designTokens.fonts.primary,
      fontWeight: 600,
      fontSize: '2rem',
      lineHeight: 1.3,
    },
    h4: {
      fontFamily: designTokens.fonts.primary,
      fontWeight: 600,
      fontSize: '1.5rem',
      lineHeight: 1.4,
    },
    h5: {
      fontFamily: designTokens.fonts.primary,
      fontWeight: 600,
      fontSize: '1.25rem',
      lineHeight: 1.4,
    },
    h6: {
      fontFamily: designTokens.fonts.primary,
      fontWeight: 600,
      fontSize: '1.125rem',
      lineHeight: 1.4,
    },
    subtitle1: {
      fontFamily: designTokens.fonts.primary,
      fontWeight: 500,
      fontSize: '1rem',
      lineHeight: 1.5,
    },
    subtitle2: {
      fontFamily: designTokens.fonts.primary,
      fontWeight: 500,
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
    body1: {
      fontFamily: designTokens.fonts.primary,
      fontWeight: 400,
      fontSize: '1rem',
      lineHeight: 1.6,
    },
    body2: {
      fontFamily: designTokens.fonts.primary,
      fontWeight: 400,
      fontSize: '0.875rem',
      lineHeight: 1.6,
    },
    button: {
      fontFamily: designTokens.fonts.primary,
      fontWeight: 500,
      fontSize: '0.875rem',
      lineHeight: 1.5,
      textTransform: 'none' as const,
      letterSpacing: '0.02em',
    },
    caption: {
      fontFamily: designTokens.fonts.primary,
      fontWeight: 400,
      fontSize: '0.75rem',
      lineHeight: 1.5,
    },
    overline: {
      fontFamily: designTokens.fonts.primary,
      fontWeight: 600,
      fontSize: '0.75rem',
      lineHeight: 1.5,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.08em',
    },
  },
  shape: {
    borderRadius: parseInt(designTokens.borderRadius.md.replace('px', '')),
  },
  spacing: 8,
};

const theme = createTheme({
  ...baseTheme,
  components: {
    // Global overrides
    MuiCssBaseline: {
      styleOverrides: {
        '*': {
          boxSizing: 'border-box',
        },
        html: {
          MozOsxFontSmoothing: 'grayscale',
          WebkitFontSmoothing: 'antialiased',
          height: '100%',
          width: '100%',
        },
        body: {
          height: '100%',
          width: '100%',
          margin: 0,
          padding: 0,
          fontFamily: designTokens.fonts.primary,
          background: `
            radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.05) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.05) 0%, transparent 50%),
            radial-gradient(circle at 40% 80%, rgba(120, 219, 255, 0.05) 0%, transparent 50%),
            linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)
          `,
          backgroundAttachment: 'fixed',
        },
        '#root': {
          height: '100%',
          width: '100%',
        },
        '::-webkit-scrollbar': {
          width: '8px',
          height: '8px',
        },
        '::-webkit-scrollbar-track': {
          background: 'rgba(148, 163, 184, 0.1)',
          borderRadius: '4px',
        },
        '::-webkit-scrollbar-thumb': {
          background: 'rgba(148, 163, 184, 0.3)',
          borderRadius: '4px',
          '&:hover': {
            background: 'rgba(148, 163, 184, 0.5)',
          },
        },
        // Custom glass utilities
        '.glass-effect': {
          background: designTokens.glass.light.background,
          backdropFilter: designTokens.glass.light.backdrop,
          WebkitBackdropFilter: designTokens.glass.light.backdrop,
          border: designTokens.glass.light.border,
          borderRadius: designTokens.borderRadius.xl,
        },
        '.agent-font': {
          fontFamily: `${designTokens.fonts.agent} !important`,
          fontWeight: '400 !important',
          letterSpacing: '0.5px !important',
        },
      },
    },

    // Paper component with glass effect
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          background: designTokens.glass.light.background,
          backdropFilter: designTokens.glass.light.backdrop,
          WebkitBackdropFilter: designTokens.glass.light.backdrop,
          border: designTokens.glass.light.border,
          borderRadius: designTokens.borderRadius.lg,
          transition: `all ${designTokens.animation.duration.normal} ${designTokens.animation.easing.ease}`,
        },
        elevation1: {
          boxShadow: designTokens.shadows.glass.sm,
        },
        elevation2: {
          boxShadow: designTokens.shadows.glass.md,
        },
        elevation3: {
          boxShadow: designTokens.shadows.glass.lg,
        },
        elevation4: {
          boxShadow: designTokens.shadows.glass.xl,
        },
      },
    },

    // Card with glass effect
    MuiCard: {
      styleOverrides: {
        root: {
          background: designTokens.glass.light.background,
          backdropFilter: designTokens.glass.light.backdrop,
          WebkitBackdropFilter: designTokens.glass.light.backdrop,
          border: designTokens.glass.light.border,
          borderRadius: designTokens.borderRadius.xl,
          boxShadow: designTokens.shadows.glass.md,
          transition: `all ${designTokens.animation.duration.normal} ${designTokens.animation.easing.ease}`,
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: designTokens.shadows.glass.lg,
          },
        },
      },
    },

    // Button with glass effect
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: designTokens.borderRadius.lg,
          padding: '12px 24px',
          fontSize: '0.875rem',
          fontWeight: 500,
          textTransform: 'none',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          transition: `all ${designTokens.animation.duration.normal} ${designTokens.animation.easing.spring}`,
          '&:hover': {
            transform: 'translateY(-1px)',
            boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15)',
          },
          '&:active': {
            transform: 'translateY(0)',
          },
        },
        contained: {
          background: `linear-gradient(135deg, var(--mui-palette-primary-main), var(--mui-palette-primary-dark))`,
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
          '&:hover': {
            background: `linear-gradient(135deg, var(--mui-palette-primary-light), var(--mui-palette-primary-main))`,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          },
        },
        outlined: {
          background: designTokens.glass.light.background,
          backdropFilter: designTokens.glass.light.backdrop,
          WebkitBackdropFilter: designTokens.glass.light.backdrop,
          border: designTokens.glass.light.border,
          '&:hover': {
            background: designTokens.glass.medium.background,
            border: designTokens.glass.medium.border,
          },
        },
        text: {
          background: 'transparent',
          '&:hover': {
            background: designTokens.glass.light.background,
            backdropFilter: designTokens.glass.light.backdrop,
            WebkitBackdropFilter: designTokens.glass.light.backdrop,
          },
        },
      },
    },

    // TextField with glass effect
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            background: designTokens.glass.light.background,
            backdropFilter: designTokens.glass.light.backdrop,
            WebkitBackdropFilter: designTokens.glass.light.backdrop,
            borderRadius: designTokens.borderRadius.lg,
            transition: `all ${designTokens.animation.duration.normal} ${designTokens.animation.easing.ease}`,
            '& fieldset': {
              border: designTokens.glass.light.border,
              borderRadius: designTokens.borderRadius.lg,
            },
            '&:hover': {
              background: designTokens.glass.medium.background,
              '& fieldset': {
                border: designTokens.glass.medium.border,
              },
            },
            '&.Mui-focused': {
              background: designTokens.glass.medium.background,
              boxShadow: designTokens.shadows.glass.md,
              '& fieldset': {
                border: `1px solid var(--mui-palette-primary-main)`,
              },
            },
          },
        },
      },
    },

    // AppBar with glass effect
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: designTokens.glass.medium.background,
          backdropFilter: designTokens.glass.medium.backdrop,
          WebkitBackdropFilter: designTokens.glass.medium.backdrop,
          border: 'none',
          borderBottom: designTokens.glass.medium.border,
          boxShadow: designTokens.shadows.glass.lg,
          color: 'inherit',
        },
      },
    },

    // Dialog with glass effect
    MuiDialog: {
      styleOverrides: {
        paper: {
          background: designTokens.glass.heavy.background,
          backdropFilter: designTokens.glass.heavy.backdrop,
          WebkitBackdropFilter: designTokens.glass.heavy.backdrop,
          border: designTokens.glass.heavy.border,
          borderRadius: designTokens.borderRadius['2xl'],
          boxShadow: designTokens.shadows.glass.xl,
        },
      },
    },

    // Menu with glass effect
    MuiMenu: {
      styleOverrides: {
        paper: {
          background: designTokens.glass.medium.background,
          backdropFilter: designTokens.glass.medium.backdrop,
          WebkitBackdropFilter: designTokens.glass.medium.backdrop,
          border: designTokens.glass.medium.border,
          borderRadius: designTokens.borderRadius.lg,
          boxShadow: designTokens.shadows.glass.lg,
        },
      },
    },

    // Popover with glass effect
    MuiPopover: {
      styleOverrides: {
        paper: {
          background: designTokens.glass.medium.background,
          backdropFilter: designTokens.glass.medium.backdrop,
          WebkitBackdropFilter: designTokens.glass.medium.backdrop,
          border: designTokens.glass.medium.border,
          borderRadius: designTokens.borderRadius.lg,
          boxShadow: designTokens.shadows.glass.lg,
        },
      },
    },

    // Tooltip with glass effect
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          background: designTokens.glass.dark.background,
          backdropFilter: designTokens.glass.dark.backdrop,
          WebkitBackdropFilter: designTokens.glass.dark.backdrop,
          border: designTokens.glass.dark.border,
          borderRadius: designTokens.borderRadius.md,
          color: '#ffffff',
          fontSize: '0.75rem',
          fontWeight: 500,
          padding: '8px 12px',
        },
        arrow: {
          color: designTokens.glass.dark.background,
        },
      },
    },

    // Chip with glass effect
    MuiChip: {
      styleOverrides: {
        root: {
          background: designTokens.glass.light.background,
          backdropFilter: designTokens.glass.light.backdrop,
          WebkitBackdropFilter: designTokens.glass.light.backdrop,
          border: designTokens.glass.light.border,
          borderRadius: designTokens.borderRadius.full,
          transition: `all ${designTokens.animation.duration.fast} ${designTokens.animation.easing.ease}`,
          '&:hover': {
            background: designTokens.glass.medium.background,
            transform: 'scale(1.05)',
          },
        },
        filled: {
          background: designTokens.colors.glass.blue,
          color: '#1e40af',
          fontWeight: 500,
        },
        outlined: {
          background: 'transparent',
          borderColor: 'rgba(59, 130, 246, 0.3)',
        },
      },
    },

    // IconButton with glass effect
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: designTokens.borderRadius.lg,
          transition: `all ${designTokens.animation.duration.fast} ${designTokens.animation.easing.ease}`,
          '&:hover': {
            background: designTokens.glass.light.background,
            backdropFilter: designTokens.glass.light.backdrop,
            WebkitBackdropFilter: designTokens.glass.light.backdrop,
            transform: 'scale(1.1)',
          },
        },
      },
    },

    // Fab with glass effect
    MuiFab: {
      styleOverrides: {
        root: {
          background: designTokens.glass.medium.background,
          backdropFilter: designTokens.glass.medium.backdrop,
          WebkitBackdropFilter: designTokens.glass.medium.backdrop,
          border: designTokens.glass.medium.border,
          boxShadow: designTokens.shadows.glass.lg,
          transition: `all ${designTokens.animation.duration.normal} ${designTokens.animation.easing.spring}`,
          '&:hover': {
            background: designTokens.glass.heavy.background,
            transform: 'scale(1.1)',
            boxShadow: designTokens.shadows.glass.xl,
          },
        },
      },
    },

    // Avatar with subtle glow
    MuiAvatar: {
      styleOverrides: {
        root: {
          border: '2px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
          transition: `all ${designTokens.animation.duration.normal} ${designTokens.animation.easing.ease}`,
          '&:hover': {
            transform: 'scale(1.05)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
          },
        },
      },
    },

    // Progress components with glass styling
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: designTokens.borderRadius.full,
          background: designTokens.glass.light.background,
          backdropFilter: designTokens.glass.light.backdrop,
          WebkitBackdropFilter: designTokens.glass.light.backdrop,
        },
      },
    },

    MuiCircularProgress: {
      styleOverrides: {
        root: {
          filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.1))',
        },
      },
    },
  },
});

export default theme;