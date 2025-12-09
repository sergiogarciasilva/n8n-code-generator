export const designTokens = {
  // Border Radius System
  borderRadius: {
    none: '0px',
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '32px',
    full: '9999px',
  },

  // Glass Effect System
  glass: {
    light: {
      background: 'rgba(255, 255, 255, 0.25)',
      backdrop: 'blur(16px)',
      border: '1px solid rgba(255, 255, 255, 0.18)',
      shadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
    },
    medium: {
      background: 'rgba(255, 255, 255, 0.15)',
      backdrop: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      shadow: '0 12px 40px 0 rgba(31, 38, 135, 0.45)',
    },
    heavy: {
      background: 'rgba(255, 255, 255, 0.1)',
      backdrop: 'blur(24px)',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      shadow: '0 16px 48px 0 rgba(31, 38, 135, 0.55)',
    },
    dark: {
      background: 'rgba(0, 0, 0, 0.25)',
      backdrop: 'blur(16px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      shadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
    }
  },

  // Typography System
  fonts: {
    primary: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    agent: '"Gloria Hallelujah", cursive',
    mono: '"Fira Code", "JetBrains Mono", Consolas, Monaco, monospace',
  },

  // Animation System
  animation: {
    duration: {
      fast: '150ms',
      normal: '300ms',
      slow: '500ms',
      slower: '800ms',
    },
    easing: {
      ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    },
  },

  // Color Palette
  colors: {
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
    },
    glass: {
      white: 'rgba(255, 255, 255, 0.25)',
      black: 'rgba(0, 0, 0, 0.25)',
      blue: 'rgba(59, 130, 246, 0.25)',
      purple: 'rgba(147, 51, 234, 0.25)',
      green: 'rgba(34, 197, 94, 0.25)',
      orange: 'rgba(249, 115, 22, 0.25)',
      red: 'rgba(239, 68, 68, 0.25)',
    },
  },

  // Spacing System
  spacing: {
    px: '1px',
    0: '0px',
    0.5: '2px',
    1: '4px',
    1.5: '6px',
    2: '8px',
    2.5: '10px',
    3: '12px',
    3.5: '14px',
    4: '16px',
    5: '20px',
    6: '24px',
    7: '28px',
    8: '32px',
    9: '36px',
    10: '40px',
    11: '44px',
    12: '48px',
    14: '56px',
    16: '64px',
    20: '80px',
    24: '96px',
    28: '112px',
    32: '128px',
  },

  // Shadow System
  shadows: {
    glass: {
      sm: '0 2px 8px 0 rgba(31, 38, 135, 0.37)',
      md: '0 4px 16px 0 rgba(31, 38, 135, 0.37)',
      lg: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
      xl: '0 12px 40px 0 rgba(31, 38, 135, 0.45)',
    },
    colored: {
      blue: '0 8px 32px 0 rgba(59, 130, 246, 0.3)',
      purple: '0 8px 32px 0 rgba(147, 51, 234, 0.3)',
      green: '0 8px 32px 0 rgba(34, 197, 94, 0.3)',
      orange: '0 8px 32px 0 rgba(249, 115, 22, 0.3)',
      red: '0 8px 32px 0 rgba(239, 68, 68, 0.3)',
    },
  },
};

// CSS Custom Properties
export const cssVariables = `
  :root {
    /* Border Radius */
    --radius-none: ${designTokens.borderRadius.none};
    --radius-xs: ${designTokens.borderRadius.xs};
    --radius-sm: ${designTokens.borderRadius.sm};
    --radius-md: ${designTokens.borderRadius.md};
    --radius-lg: ${designTokens.borderRadius.lg};
    --radius-xl: ${designTokens.borderRadius.xl};
    --radius-2xl: ${designTokens.borderRadius['2xl']};
    --radius-3xl: ${designTokens.borderRadius['3xl']};
    --radius-full: ${designTokens.borderRadius.full};

    /* Glass Effects */
    --glass-light-bg: ${designTokens.glass.light.background};
    --glass-light-backdrop: ${designTokens.glass.light.backdrop};
    --glass-light-border: ${designTokens.glass.light.border};
    --glass-light-shadow: ${designTokens.glass.light.shadow};

    --glass-medium-bg: ${designTokens.glass.medium.background};
    --glass-medium-backdrop: ${designTokens.glass.medium.backdrop};
    --glass-medium-border: ${designTokens.glass.medium.border};
    --glass-medium-shadow: ${designTokens.glass.medium.shadow};

    --glass-heavy-bg: ${designTokens.glass.heavy.background};
    --glass-heavy-backdrop: ${designTokens.glass.heavy.backdrop};
    --glass-heavy-border: ${designTokens.glass.heavy.border};
    --glass-heavy-shadow: ${designTokens.glass.heavy.shadow};

    /* Fonts */
    --font-primary: ${designTokens.fonts.primary};
    --font-agent: ${designTokens.fonts.agent};
    --font-mono: ${designTokens.fonts.mono};

    /* Animation */
    --duration-fast: ${designTokens.animation.duration.fast};
    --duration-normal: ${designTokens.animation.duration.normal};
    --duration-slow: ${designTokens.animation.duration.slow};
    --duration-slower: ${designTokens.animation.duration.slower};

    --ease: ${designTokens.animation.easing.ease};
    --ease-in: ${designTokens.animation.easing.easeIn};
    --ease-out: ${designTokens.animation.easing.easeOut};
    --ease-in-out: ${designTokens.animation.easing.easeInOut};
    --ease-bounce: ${designTokens.animation.easing.bounce};
    --ease-spring: ${designTokens.animation.easing.spring};
  }

  /* Google Fonts Import */
  @import url('https://fonts.googleapis.com/css2?family=Gloria+Hallelujah&family=Inter:wght@100;200;300;400;500;600;700;800;900&family=Fira+Code:wght@300;400;500;600;700&display=swap');

  /* Global Glass Utilities */
  .glass-light {
    background: var(--glass-light-bg);
    backdrop-filter: var(--glass-light-backdrop);
    -webkit-backdrop-filter: var(--glass-light-backdrop);
    border: var(--glass-light-border);
    box-shadow: var(--glass-light-shadow);
  }

  .glass-medium {
    background: var(--glass-medium-bg);
    backdrop-filter: var(--glass-medium-backdrop);
    -webkit-backdrop-filter: var(--glass-medium-backdrop);
    border: var(--glass-medium-border);
    box-shadow: var(--glass-medium-shadow);
  }

  .glass-heavy {
    background: var(--glass-heavy-bg);
    backdrop-filter: var(--glass-heavy-backdrop);
    -webkit-backdrop-filter: var(--glass-heavy-backdrop);
    border: var(--glass-heavy-border);
    box-shadow: var(--glass-heavy-shadow);
  }

  /* Rounded Utilities */
  .rounded-none { border-radius: var(--radius-none); }
  .rounded-xs { border-radius: var(--radius-xs); }
  .rounded-sm { border-radius: var(--radius-sm); }
  .rounded-md { border-radius: var(--radius-md); }
  .rounded-lg { border-radius: var(--radius-lg); }
  .rounded-xl { border-radius: var(--radius-xl); }
  .rounded-2xl { border-radius: var(--radius-2xl); }
  .rounded-3xl { border-radius: var(--radius-3xl); }
  .rounded-full { border-radius: var(--radius-full); }

  /* Agent Font */
  .font-agent {
    font-family: var(--font-agent);
    font-weight: 400;
    letter-spacing: 0.5px;
  }

  /* Smooth Animations */
  .transition-smooth {
    transition: all var(--duration-normal) var(--ease);
  }

  .transition-bounce {
    transition: all var(--duration-normal) var(--ease-bounce);
  }

  .transition-spring {
    transition: all var(--duration-normal) var(--ease-spring);
  }
`;