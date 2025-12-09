# n8n Agent Platform 🚀

Plataforma web de agentes de IA para generación y optimización de workflows de n8n. Sistema completo con generador visual de workflows, integración con n8n Cloud, y gestión de agentes IA, todo con una interfaz glassmorphism moderna inspirada en Apple.

## ✨ Características Principales

### 🤖 Core Agent Platform
- **Generador IA de Workflows**: Crea workflows completos desde lenguaje natural con GPT-4
- **Editor Visual de Workflows**: Interfaz drag-and-drop para diseñar flujos complejos
- **Agentes Especializados**: MCPs, Telegram bots, sistemas multi-agente
- **Validación Multi-nivel**: Sintaxis, semántica, rendimiento y seguridad
- **Testing Automatizado**: Framework completo con assertions y coverage

### 🎨 Interfaz Glassmorphism Moderna
- **Diseño Apple-Inspired**: Efectos de cristal con backdrop blur
- **Fuente Gloria Hallelujah**: Para todas las interacciones con agentes
- **Animaciones Fluidas**: Con Framer Motion para transiciones suaves
- **Componentes Glass**: Cards, panels y overlays con transparencias
- Ver [GLASS_DESIGN_README.md](./GLASS_DESIGN_README.md) para detalles completos

### 🏪 Marketplace de Templates
- **Templates Certificados**: Workflows pre-construidos y optimizados
- **Sistema de Revenue Sharing**: 70/30 para creadores
- **Certificación con IA**: Validación automática de calidad y seguridad
- **Cifrado End-to-End**: Protección de propiedad intelectual

### 🔄 Versionado Git-Style
- **Control de Versiones**: Sistema similar a Git para workflows
- **Branches y Tags**: Desarrollo paralelo de features
- **Rollback Instantáneo**: Volver a versiones anteriores con un click
- **Diff Visual**: Comparación lado a lado de cambios

### 📱 Aplicación Móvil Nativa
- **React Native + Expo**: App nativa para iOS y Android
- **Monitoreo en Tiempo Real**: Dashboard móvil completo
- **Control de Agentes**: Iniciar, detener y configurar desde el móvil
- **Notificaciones Push**: Alertas de optimizaciones y errores

### 🔐 Seguridad Enterprise
- **Autenticación JWT**: Con refresh tokens seguros
- **2FA/MFA**: Autenticación de dos factores con TOTP
- **Cifrado AES-256-GCM**: A nivel de organización
- **RBAC Avanzado**: Control de acceso basado en roles
- **Auditoría Completa**: Log de todas las acciones

### 🚀 Ambientes de Testing
- **Docker Containers**: Ambientes aislados por workflow
- **Testing Automatizado**: Suite completa de pruebas
- **Staging/Production**: Deploy controlado entre ambientes
- **Rollback Automático**: Si las pruebas fallan

## 📋 Requisitos del Sistema

- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Docker 24+
- n8n Cloud v1.98 (cuenta y API key)
- OpenAI API key (para GPT-4)
- Anthropic API key (opcional, para Claude)

## 🛠️ Instalación Rápida

### 1. Clonar el repositorio
```bash
git clone https://github.com/tu-usuario/n8n-agent-platform.git
cd n8n-agent-platform
```

### 2. Instalar dependencias
```bash
# Instalar todas las dependencias del monorepo
npm install

# O usar pnpm (recomendado)
pnpm install
```

### 3. Configuración inicial
```bash
# Copiar archivos de configuración
cp core/.env.example core/.env
cp web-dashboard/.env.example web-dashboard/.env
cp mobile-app/.env.example mobile-app/.env

# Editar configuraciones
nano core/.env
```

### 4. Iniciar servicios
```bash
# Iniciar PostgreSQL y Redis con Docker (aislado en puertos únicos)
docker compose up -d

# Ejecutar migraciones
npm run setup:db

# Iniciar la plataforma
npm run dev
```

## 🚀 Componentes del Sistema

### 1. Core Platform (`/core`)
Motor principal de agentes con:
- Orquestador de agentes IA
- API REST y WebSocket
- Sistema de colas con Bull
- Integración con n8n Cloud

### 2. Web Dashboard (`/web-dashboard`)
Interfaz glassmorphism con:
- Dashboard en tiempo real
- Chat con agentes (Gloria Hallelujah font)
- Métricas y analytics avanzados
- Gestión de marketplace

### 3. Mobile App (`/mobile-app`)
Aplicación React Native con:
- Dashboard móvil completo
- Control remoto de agentes
- Notificaciones push
- Interfaz nativa optimizada

### 4. Docs Website (`/docs-website`)
Documentación completa:
- Guías de usuario
- Referencias de API
- Tutoriales interactivos
- Ejemplos de workflows

## 📊 API Endpoints

### 🤖 Workflow Generator (NUEVO)
```http
POST   /api/v1/generator/generate     # Generar workflow desde descripción
POST   /api/v1/generator/optimize     # Optimizar workflow existente  
POST   /api/v1/generator/validate     # Validar workflow
GET    /api/v1/generator/templates    # Buscar templates
```

### 📊 Dashboard & Analytics
```http
GET    /api/v1/dashboard/data         # Métricas reales del dashboard
GET    /api/v1/analytics/workflows    # Analytics de workflows
GET    /api/v1/analytics/agents       # Analytics de agentes
POST   /api/v1/reports/generate       # Generar reportes
```

### 🔔 Notificaciones
```http
GET    /api/v1/notifications          # Listar notificaciones
PUT    /api/v1/notifications/:id/read # Marcar como leída
DELETE /api/v1/notifications/:id      # Eliminar notificación
POST   /api/v1/notifications/:id/snooze # Posponer notificación
```

### 💬 Chat con AI
```http
POST   /api/v1/chat/message           # Enviar mensaje al AI
GET    /api/v1/chat/suggestions       # Obtener sugerencias
GET    /api/v1/chat/conversations     # Listar conversaciones
```

### 🔧 Agentes
```http
GET    /api/v1/agents                 # Listar todos los agentes
POST   /api/v1/agents/:id/toggle      # Activar/desactivar agente
GET    /api/v1/agents/:id/settings    # Configuración de agente
POST   /api/v1/agents/:id/optimize    # Optimizar con AI
```

## 🔧 Configuración Avanzada

### Variables de Entorno
```env
# Database (Puertos aislados para evitar conflictos)
DB_HOST=localhost
DB_PORT=5433
DB_NAME=n8n_agent_platform_db
DB_USER=n8n_agent_user
DB_PASSWORD=n8n_agent_secure_password_2024

# Redis (Puerto aislado)
REDIS_HOST=localhost
REDIS_PORT=6380
REDIS_PASSWORD=<your_redis_password>

# n8n Configuration (Puerto aislado)
N8N_HOST=localhost
N8N_PORT=5679
N8N_USERNAME=n8n_agent_admin
N8N_PASSWORD=n8n_agent_admin_password_2024

# Application Configuration
NODE_ENV=development
LOG_LEVEL=debug
API_PORT=3456
WEB_PORT=5173

# AI Providers
OPENAI_API_KEY=your_openai_api_key_here
AI_PROVIDER=openai

# Security
JWT_SECRET=your_jwt_secret_key_here_change_in_production
ENCRYPTION_KEY=your_32_character_encryption_key_here_change_in_production

# Docker Network (Aislado)
DOCKER_NETWORK=n8n_agent_platform_network

# Monitoring
LOG_LEVEL=info
```

### Docker Compose
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: n8n_agent_platform
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  core:
    build: ./core
    environment:
      NODE_ENV: production
    depends_on:
      - postgres
      - redis
    ports:
      - "3456:3456"

  dashboard:
    build: ./web-dashboard
    ports:
      - "3000:3000"
    depends_on:
      - core

volumes:
  postgres_data:
  redis_data:
```

## 🤖 Agentes Disponibles

### MCPAgent (Model Context Protocol)
- Optimiza workflows de MCP
- Añade boundaries de contexto inteligentes
- Implementa gestión de estado avanzada
- Auto-healing de errores comunes

### TelegramAgent
- Optimiza bots de Telegram
- Rate limiting automático
- Router de comandos inteligente
- Manejo avanzado de media

### MultiAgentSystemAgent
- Coordina sistemas multi-agente
- Orquestación con consenso
- Balanceo de carga inteligente
- Failover automático

### CustomAgent (Extensible)
```typescript
export class CustomAgent extends BaseAgent {
  async analyze(workflow: any) {
    // Tu lógica de análisis
  }
  
  async optimize(workflow: any, suggestions: any[]) {
    // Tu lógica de optimización
  }
}
```

## 📱 Mobile App

### Instalación
```bash
cd mobile-app
npm install

# iOS
npx expo run:ios

# Android
npx expo run:android
```

### Features
- Dashboard con métricas en tiempo real
- Control completo de agentes
- Historial de optimizaciones
- Notificaciones push configurables
- Modo offline con sincronización

## 🎨 Personalización UI

### Temas
```typescript
// Cambiar colores en designTokens.ts
const customTheme = {
  colors: {
    primary: '#your-color',
    glass: {
      blue: 'rgba(59, 130, 246, 0.25)',
      // Agregar más colores
    }
  }
}
```

### Fuentes
```typescript
// Cambiar fuentes en designTokens.ts
fonts: {
  agent: '"Gloria Hallelujah", cursive',  // Fuente para agentes
  primary: '"Inter", sans-serif',         // Fuente principal
  mono: '"Fira Code", monospace'          // Código
}
```

## 📊 Monitoreo y Métricas

### Logs Estructurados
```bash
# Ver logs en tiempo real
tail -f core/logs/combined.log

# Filtrar por nivel
grep "ERROR" core/logs/error.log

# Logs de agentes específicos
grep "MCPAgent" core/logs/combined.log
```

### Métricas Prometheus
```http
GET /metrics
```

### Dashboard Grafana
Importar dashboard desde `monitoring/grafana-dashboard.json`

## 🔍 Troubleshooting

### Problemas Comunes

#### Los agentes no se ejecutan
```bash
# Verificar servicios
docker-compose ps

# Ver logs de agentes
docker-compose logs core

# Reiniciar servicios
docker-compose restart
```

#### Error de conexión con n8n
- Verificar N8N_API_KEY en `.env`
- Confirmar URL correcta de n8n Cloud
- Revisar firewall/proxy settings

#### UI no carga efectos glass
- Verificar soporte de navegador para backdrop-filter
- Actualizar a Chrome/Safari más reciente
- Revisar consola para errores de CSS

## 🚀 Deployment

### Producción con Docker
```bash
# Build images
docker-compose -f docker-compose.prod.yml build

# Deploy
docker-compose -f docker-compose.prod.yml up -d

# Escalar agentes
docker-compose -f docker-compose.prod.yml scale core=3
```

### Kubernetes
```bash
# Aplicar manifests
kubectl apply -f k8s/

# Verificar pods
kubectl get pods -n n8n-agent-platform
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crear feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Abrir Pull Request

### Guía de Estilo
- TypeScript strict mode
- ESLint + Prettier
- Conventional Commits
- Tests con Jest (>80% coverage)

## 📝 Licencia

MIT License - Ver [LICENSE](./LICENSE) para detalles

## 📞 Soporte

- 📧 Email: support@n8n-agent-platform.com
- 💬 Discord: [Únete a nuestro servidor](https://discord.gg/n8n-agents)
- 📚 Docs: [docs.n8n-agent-platform.com](https://docs.n8n-agent-platform.com)
- 🐛 Issues: [GitHub Issues](https://github.com/tu-usuario/n8n-agent-platform/issues)

---

Made with ❤️ by the n8n Agent Platform Team