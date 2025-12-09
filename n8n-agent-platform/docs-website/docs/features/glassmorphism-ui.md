---
sidebar_position: 2
---

# Glassmorphism UI

Diseño moderno inspirado en Apple con efectos de cristal y transparencias 🎨

## 🌟 Visión General

La interfaz glassmorphism de n8n Agent Platform ofrece una experiencia visual única con:

- **Efectos de cristal** con backdrop blur
- **Transparencias multinivel** para profundidad
- **Animaciones fluidas** con Framer Motion
- **Fuente Gloria Hallelujah** para interacciones con agentes
- **Gradientes dinámicos** y partículas animadas

<div className="glass-card">
  <h3>Ejemplo de Glass Card</h3>
  <p>Este es un ejemplo en vivo del efecto glassmorphism que verás en toda la plataforma.</p>
</div>

## 🎨 Sistema de Diseño

### Tokens de Diseño

```typescript
export const designTokens = {
  // Colores de cristal
  colors: {
    glass: {
      blue: 'rgba(59, 130, 246, 0.25)',
      purple: 'rgba(147, 51, 234, 0.25)',
      green: 'rgba(34, 197, 94, 0.25)',
      orange: 'rgba(251, 146, 60, 0.25)',
    }
  },
  
  // Efectos de cristal
  glass: {
    light: {
      background: 'rgba(255, 255, 255, 0.25)',
      backdrop: 'blur(16px)',
      border: '1px solid rgba(255, 255, 255, 0.18)',
    },
    medium: {
      background: 'rgba(255, 255, 255, 0.15)',
      backdrop: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.12)',
    },
    heavy: {
      background: 'rgba(255, 255, 255, 0.1)',
      backdrop: 'blur(24px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
    }
  },
  
  // Sistema de bordes redondeados
  borderRadius: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '32px',
    full: '9999px'
  }
};
```

### Tipografía

<div className="feature-card">
  <h4 style={{fontFamily: 'Gloria Hallelujah'}}>Gloria Hallelujah</h4>
  <p className="agent-message">¡Hola! Esta es la fuente que usamos para todas las interacciones con agentes. Le da un toque personal y amigable 😊</p>
</div>

<div className="feature-card">
  <h4>Inter</h4>
  <p>Fuente principal para la interfaz, moderna y altamente legible en todos los tamaños.</p>
</div>

<div className="feature-card">
  <h4 style={{fontFamily: 'Fira Code, monospace'}}>Fira Code</h4>
  <p>Para código y elementos técnicos, con ligaduras para mejor legibilidad.</p>
</div>

## 🧩 Componentes

### GlassCard

El componente base para todos los contenedores con efecto cristal:

```tsx
<GlassCard 
  variant="medium"      // light | medium | heavy | dark
  rounded="xl"         // xs | sm | md | lg | xl | 2xl | 3xl | full
  hover={true}         // Efecto hover
  glow={true}          // Resplandor suave
  glowColor="blue"     // Color del resplandor
>
  <Typography variant="h5">Contenido</Typography>
</GlassCard>
```

### AgentBubble

Visualización de agentes con animaciones flotantes:

```tsx
<AgentBubble
  agent={{
    name: "Workflow Wizard",
    status: "active",
    mood: "excited"      // happy | working | thinking | sleeping | excited
  }}
  size="large"           // small | medium | large
  interactive={true}     // Permite interacción
  showControls={true}    // Muestra controles
/>
```

Estados de ánimo de los agentes:
- 😊 **Happy**: Animación suave de rebote
- 💼 **Working**: Pulso constante
- 🤔 **Thinking**: Rotación lenta
- 😴 **Sleeping**: Respiración sutil
- 🎉 **Excited**: Rebote energético

### AgentChatPanel

Panel de chat con diseño cristal:

```tsx
<AgentChatPanel
  agent={selectedAgent}
  isOpen={true}
  position={{ x: 100, y: 100 }}  // Posición inicial
  draggable={true}                // Permite arrastrar
  minimizable={true}              // Botón minimizar
/>
```

Características del chat:
- Panel arrastrable con efecto cristal
- Mensajes del agente en Gloria Hallelujah
- Indicador de escritura animado
- Efectos de entrada para mensajes

## 🎬 Animaciones

### Framer Motion

Todas las animaciones usan Framer Motion para fluidez:

```tsx
// Animación de entrada
<motion.div
  initial={{ opacity: 0, scale: 0, rotate: -180 }}
  animate={{ opacity: 1, scale: 1, rotate: 0 }}
  transition={{
    type: "spring",
    stiffness: 200,
    damping: 20,
  }}
>
  <AgentBubble />
</motion.div>
```

### Animaciones Predefinidas

```typescript
// Floating animation
const floatingAnimation = {
  y: [0, -20, 0],
  transition: {
    duration: 3,
    repeat: Infinity,
    ease: "easeInOut"
  }
};

// Pulse animation
const pulseAnimation = {
  scale: [1, 1.05, 1],
  transition: {
    duration: 2,
    repeat: Infinity
  }
};
```

## 🌈 Gradientes y Fondos

### Fondo Principal

```css
background: 
  radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.1) 0%, transparent 50%),
  radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.1) 0%, transparent 50%),
  radial-gradient(circle at 40% 80%, rgba(120, 219, 255, 0.1) 0%, transparent 50%),
  linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

### Partículas Animadas

```tsx
// Partículas flotantes en el fondo
<ParticleBackground
  particleCount={50}
  particleSize={2}
  speed={0.5}
  color="rgba(255, 255, 255, 0.5)"
/>
```

## 💎 Mejores Prácticas

### ✅ DO - Hacer

1. **Usar variantes consistentes** de GlassCard
2. **Mantener jerarquía visual** con diferentes niveles de transparencia
3. **Aplicar Gloria Hallelujah** solo para agentes
4. **Usar animaciones sutiles** que no distraigan
5. **Mantener contraste adecuado** para legibilidad

### ❌ DON'T - No Hacer

1. **No mezclar** efectos de cristal con fondos sólidos
2. **No abusar** de las animaciones
3. **No usar Gloria Hallelujah** para texto general
4. **No aplicar blur excesivo** que afecte el rendimiento
5. **No ignorar** la accesibilidad

## 🎯 Personalización

### Cambiar Colores de Acento

```typescript
// En designTokens.ts
const customColors = {
  glass: {
    primary: 'rgba(255, 109, 0, 0.25)',    // Tu color
    secondary: 'rgba(25, 118, 210, 0.25)', // Tu color
  }
};
```

### Ajustar Transparencias

```typescript
// Para más o menos transparencia
glass: {
  light: {
    background: 'rgba(255, 255, 255, 0.35)', // Más opaco
    backdrop: 'blur(24px)',                   // Más blur
  }
}
```

### Crear Nuevas Variantes

```tsx
// GlassCard personalizado
const CustomGlassCard = styled(GlassCard)`
  background: linear-gradient(
    135deg, 
    rgba(255, 255, 255, 0.2), 
    rgba(255, 255, 255, 0.1)
  );
  &:hover {
    transform: translateY(-10px) rotateY(5deg);
  }
`;
```

## 🚀 Performance

### Optimizaciones Implementadas

1. **GPU Acceleration**
   ```css
   transform: translateZ(0);
   will-change: transform;
   ```

2. **Conditional Rendering**
   ```tsx
   {isVisible && <GlassEffect />}
   ```

3. **Debounced Animations**
   ```typescript
   const debouncedAnimation = useDebouncedCallback(
     () => animateElement(),
     100
   );
   ```

4. **Memoización**
   ```tsx
   const MemoizedGlassCard = React.memo(GlassCard);
   ```

## 🌐 Compatibilidad

### Navegadores Soportados

| Navegador | Versión | Soporte |
|-----------|---------|---------|
| Chrome | 76+ | ✅ Completo |
| Safari | 9+ | ✅ Completo |
| Firefox | 70+ | ✅ Completo |
| Edge | 79+ | ✅ Completo |
| IE | - | ❌ No soportado |

### Fallbacks

Para navegadores sin soporte de `backdrop-filter`:

```css
/* Fallback */
.glass-card {
  background: rgba(255, 255, 255, 0.9);
}

/* Con soporte */
@supports (backdrop-filter: blur(10px)) {
  .glass-card {
    background: rgba(255, 255, 255, 0.25);
    backdrop-filter: blur(16px);
  }
}
```

## 📸 Galería

### Dashboard
![Dashboard con glassmorphism](../../static/img/dashboard-glass.png)

### Agent Bubbles
![Burbujas de agentes flotantes](../../static/img/agents-glass.png)

### Chat Panel
![Panel de chat cristal](../../static/img/chat-glass.png)

## 🎨 Recursos

- [Figma Design System](https://figma.com/n8n-agent-glass)
- [Storybook Components](https://storybook.n8n-agent-platform.com)
- [CodeSandbox Playground](https://codesandbox.io/s/n8n-glass)

<div className="gradient-text" style={{fontSize: '1.5rem', textAlign: 'center', marginTop: '3rem'}}>
  ¿Quieres personalizar más? Consulta nuestra guía de temas avanzados →
</div>