# n8n Agent Platform - Mobile App 📱

Aplicación móvil nativa para controlar y monitorear tu plataforma de agentes n8n desde cualquier lugar. Desarrollada con React Native y Expo para iOS y Android.

## ✨ Características

### 📊 Dashboard en Tiempo Real
- Métricas actualizadas en vivo vía WebSocket
- Gráficos interactivos de rendimiento
- Estado de todos los agentes
- Notificaciones push instantáneas

### 🤖 Control de Agentes
- Iniciar/detener agentes remotamente
- Modificar configuraciones
- Ver logs en tiempo real
- Chat directo con agentes (Gloria Hallelujah font)

### 🔄 Gestión de Workflows
- Lista completa de workflows
- Historial de versiones
- Rollback con un tap
- Vista previa de cambios

### 🏪 Marketplace Móvil
- Explorar templates certificados
- Instalación con un click
- Dashboard de ingresos para creadores
- Sistema de calificaciones

### 🔐 Seguridad
- Autenticación biométrica (Face ID/Touch ID)
- 2FA integrado
- Cifrado local de datos sensibles
- Modo offline seguro

## 📱 Capturas de Pantalla

| Dashboard | Agentes | Chat | Marketplace |
|-----------|---------|------|-------------|
| ![Dashboard](./screenshots/dashboard.png) | ![Agents](./screenshots/agents.png) | ![Chat](./screenshots/chat.png) | ![Marketplace](./screenshots/marketplace.png) |

## 🚀 Instalación

### Requisitos Previos
- Node.js 18+
- npm o yarn
- Expo CLI (`npm install -g expo-cli`)
- Para iOS: macOS con Xcode
- Para Android: Android Studio

### Configuración Inicial

1. **Clonar el repositorio**
```bash
cd n8n-agent-platform/mobile-app
```

2. **Instalar dependencias**
```bash
npm install
# o
yarn install
```

3. **Configurar variables de entorno**
```bash
cp .env.example .env
```

Editar `.env`:
```env
# API Configuration
API_URL=https://your-api-url.com
WEBSOCKET_URL=wss://your-api-url.com

# Push Notifications
EXPO_PUBLIC_PUSH_TOKEN=your-expo-push-token

# Sentry (opcional)
SENTRY_DSN=your-sentry-dsn
```

## 🔧 Desarrollo

### Iniciar en Desarrollo

**Expo Go (Recomendado para desarrollo)**
```bash
npx expo start
```

**iOS Simulator**
```bash
npx expo run:ios
```

**Android Emulator**
```bash
npx expo run:android
```

### Estructura del Proyecto
```
mobile-app/
├── src/
│   ├── components/     # Componentes reutilizables
│   ├── screens/       # Pantallas de la app
│   ├── navigation/    # React Navigation setup
│   ├── services/      # API y WebSocket clients
│   ├── store/         # Zustand state management
│   ├── hooks/         # Custom React hooks
│   ├── utils/         # Utilidades y helpers
│   └── theme/         # Tema y estilos globales
├── assets/            # Imágenes, fuentes, etc.
├── app.json          # Configuración de Expo
└── package.json      # Dependencias
```

### Componentes Principales

**Dashboard Screen**
```tsx
// Métricas en tiempo real con actualización automática
<DashboardScreen>
  <MetricsCard />
  <AgentsList />
  <ActivityFeed />
</DashboardScreen>
```

**Agent Control**
```tsx
// Control completo de agentes
<AgentControlScreen>
  <AgentStatus />
  <AgentActions />
  <AgentLogs />
  <AgentChat />
</AgentControlScreen>
```

**Workflow Manager**
```tsx
// Gestión de workflows con versionado
<WorkflowScreen>
  <WorkflowList />
  <VersionHistory />
  <DiffViewer />
</WorkflowScreen>
```

## 🎨 Personalización

### Tema
```typescript
// src/theme/index.ts
export const theme = {
  colors: {
    primary: '#ff6d00',
    secondary: '#1976d2',
    glass: {
      light: 'rgba(255, 255, 255, 0.25)',
      medium: 'rgba(255, 255, 255, 0.15)',
    }
  },
  fonts: {
    agent: 'GloriaHallelujah_400Regular',
    primary: 'Inter_400Regular',
  }
}
```

### Iconos Personalizados
La app usa `@expo/vector-icons` para iconos consistentes:
```tsx
import { Ionicons } from '@expo/vector-icons';

<Ionicons name="rocket" size={24} color="#ff6d00" />
```

## 📲 Notificaciones Push

### Configuración
```typescript
// Registrar para notificaciones
import * as Notifications from 'expo-notifications';

const registerForPushNotifications = async () => {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status === 'granted') {
    const token = await Notifications.getExpoPushTokenAsync();
    // Enviar token al backend
  }
};
```

### Tipos de Notificaciones
- 🚨 Alertas de errores en workflows
- ✅ Optimizaciones completadas
- 💬 Mensajes de agentes
- 📊 Resúmenes diarios/semanales
- 🏪 Nuevos templates en marketplace

## 🔐 Seguridad

### Autenticación Biométrica
```typescript
import * as LocalAuthentication from 'expo-local-authentication';

const authenticateWithBiometrics = async () => {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Authenticate to access n8n Agent Platform',
  });
  return result.success;
};
```

### Almacenamiento Seguro
```typescript
import * as SecureStore from 'expo-secure-store';

// Guardar token seguro
await SecureStore.setItemAsync('auth_token', token);

// Recuperar token
const token = await SecureStore.getItemAsync('auth_token');
```

## 🏗️ Build y Deployment

### Build para Desarrollo
```bash
# iOS
eas build --platform ios --profile development

# Android
eas build --platform android --profile development
```

### Build para Producción
```bash
# iOS
eas build --platform ios --profile production

# Android  
eas build --platform android --profile production
```

### Configuración EAS
```json
// eas.json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "production": {
      "ios": {
        "buildNumber": "1.0.0"
      },
      "android": {
        "versionCode": 1
      }
    }
  }
}
```

## 📊 Analytics

### Eventos Rastreados
- App opens/closes
- Screen views
- Agent interactions
- Workflow modifications
- Marketplace activities

### Implementación
```typescript
import * as Analytics from 'expo-analytics-amplitude';

Analytics.logEvent('agent_started', {
  agentId: agent.id,
  agentType: agent.type,
});
```

## 🐛 Debugging

### React Native Debugger
```bash
# Instalar
brew install react-native-debugger

# Usar con Expo
# Shake device o Cmd+D en simulator
# Seleccionar "Debug Remote JS"
```

### Logs
```typescript
// Usar react-native-logs
import { logger } from './utils/logger';

logger.debug('Debug message');
logger.error('Error message', error);
```

## 🧪 Testing

### Unit Tests
```bash
npm test
```

### E2E Tests con Detox
```bash
# Build para testing
detox build -c ios.sim.debug

# Ejecutar tests
detox test -c ios.sim.debug
```

## 🚀 Performance

### Optimizaciones Implementadas
- React.memo para componentes pesados
- FlatList con getItemLayout
- Image caching con expo-image
- Lazy loading de pantallas
- WebSocket connection pooling

### Métricas Objetivo
- App launch: < 2s
- Screen transitions: < 300ms
- API responses cached offline
- 60 FPS en animaciones

## 📝 Troubleshooting

### Problemas Comunes

**Metro bundler issues**
```bash
# Limpiar cache
npx expo start -c
```

**Build failures iOS**
```bash
# Limpiar build
cd ios && pod deintegrate && pod install
```

**Network issues**
- Verificar API_URL en .env
- Confirmar CORS en backend
- Revisar certificados SSL

## 🤝 Contribuir

1. Fork el proyecto
2. Crear feature branch
3. Commit cambios
4. Push al branch
5. Abrir Pull Request

### Estándares de Código
- TypeScript strict
- ESLint + Prettier
- Componentes funcionales
- Hooks personalizados
- Tests obligatorios

## 📄 Licencia

MIT License - Ver [LICENSE](../LICENSE)

## 🆘 Soporte

- 📧 Email: mobile@n8n-agent-platform.com
- 💬 Discord: [#mobile-app](https://discord.gg/n8n-agents)
- 📚 Docs: [Mobile Docs](https://docs.n8n-agent-platform.com/mobile)

---

Made with ❤️ using React Native + Expo