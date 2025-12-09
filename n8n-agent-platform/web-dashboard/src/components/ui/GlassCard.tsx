import React, { ReactNode, HTMLAttributes } from 'react';
import { styled } from '@mui/material/styles';
import { Box, BoxProps } from '@mui/material';
import { designTokens } from '../../theme/designTokens';

interface GlassCardProps extends BoxProps {
  children: ReactNode;
  variant?: 'light' | 'medium' | 'heavy' | 'dark';
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  hover?: boolean;
  glow?: boolean;
  glowColor?: 'blue' | 'purple' | 'green' | 'orange' | 'red';
  className?: string;
}

const StyledGlassCard = styled(Box)<GlassCardProps>(({ 
  theme, 
  variant = 'light', 
  rounded = 'xl',
  hover = false,
  glow = false,
  glowColor = 'blue'
}) => {
  const glassVariant = designTokens.glass[variant];
  const radius = designTokens.borderRadius[rounded];
  const glowShadow = designTokens.shadows.colored[glowColor];

  return {
    background: glassVariant.background,
    backdropFilter: glassVariant.backdrop,
    WebkitBackdropFilter: glassVariant.backdrop,
    border: glassVariant.border,
    borderRadius: radius,
    boxShadow: glow ? glowShadow : glassVariant.shadow,
    position: 'relative',
    overflow: 'hidden',
    transition: `all ${designTokens.animation.duration.normal} ${designTokens.animation.easing.ease}`,

    // Glass shine effect
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: '-100%',
      width: '100%',
      height: '100%',
      background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent)',
      transition: `left ${designTokens.animation.duration.slow} ${designTokens.animation.easing.ease}`,
      zIndex: 1,
    },

    // Hover effects
    ...(hover && {
      cursor: 'pointer',
      '&:hover': {
        transform: 'translateY(-2px) scale(1.02)',
        boxShadow: glow 
          ? `${glowShadow}, 0 12px 40px 0 rgba(31, 38, 135, 0.45)`
          : '0 12px 40px 0 rgba(31, 38, 135, 0.45)',
        '&::before': {
          left: '100%',
        },
      },
    }),

    // Glow animation for special states
    ...(glow && {
      animation: 'pulse-glow 2s ease-in-out infinite alternate',
      '@keyframes pulse-glow': {
        '0%': {
          boxShadow: glowShadow,
        },
        '100%': {
          boxShadow: `${glowShadow}, 0 0 20px ${designTokens.colors.glass[glowColor]}`,
        },
      },
    }),

    // Responsive design
    [theme.breakpoints.down('sm')]: {
      borderRadius: designTokens.borderRadius.lg,
    },
  };
});

const GlassCard: React.FC<GlassCardProps> = ({ 
  children, 
  variant = 'light',
  rounded = 'xl',
  hover = false,
  glow = false,
  glowColor = 'blue',
  className,
  ...props 
}) => {
  return (
    <StyledGlassCard
      variant={variant}
      rounded={rounded}
      hover={hover}
      glow={glow}
      glowColor={glowColor}
      className={className}
      {...props}
    >
      <Box sx={{ position: 'relative', zIndex: 2 }}>
        {children}
      </Box>
    </StyledGlassCard>
  );
};

export default GlassCard;