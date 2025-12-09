# Prompt Ultra-Detallado para Claude Code: n8n VS Code Extension

## 🎯 OBJETIVO PRINCIPAL

Crear una extensión completa de VS Code que funcione como un "GitHub Copilot para n8n workflows", especializada en MCPs (Model Context Protocol), Telegram bots y sistemas de agentes. La extensión debe proporcionar sugerencias inteligentes, validación automática, ejecución de pruebas y un entorno de desarrollo optimizado para workflows complejos de n8n.

## 📋 CONTEXTO Y ARCHIVOS DE REFERENCIA

### Archivo de Requerimientos
- **Archivo:** `n8n_requirements_table.md` (descargado de este chat)
- **Instrucción:** Usar las respuestas de la columna "Respuesta Sugerida" como especificación base
- **Prioridad:** Todos los requerimientos marcados son obligatorios para el MVP

### Documentación Externa
- **Carpeta:** `./documentation/`
- **Contenido:** Documentación de APIs de n8n, Telegram, MCPs y otros servicios externos
- **Instrucción:** Consultar estos archivos para implementación precisa de integraciones

## 🏗️ ARQUITECTURA TÉCNICA REQUERIDA

### Estructura del Proyecto
```
n8n-copilot-extension/
├── src/extension/               # Extensión VS Code principal
├── src/webview-ui/             # React components para webviews
├── src/server/                 # Express.js backend local
├── src/database/               # PostgreSQL schemas y migrations
├── src/ai-engine/              # Motor de IA y sugerencias
├── src/validators/             # Validadores específicos por tipo
├── src/executors/              # Ejecutores de workflows
├── documentation/              # Docs APIs externas (ya existe)
├── templates/                  # Base de datos de templates
└── tests/                      # Testing suite completo
```

### Stack Tecnológico Obligatorio
- **Frontend:** React + TypeScript + Tailwind CSS
- **Backend:** Express.js + TypeScript
- **Base de Datos:** PostgreSQL (local) + MongoDB (cloud backup)
- **IA:** OpenAI GPT-4 + modelo local fallback
- **Testing:** Jest + Playwright
- **Bundling:** Webpack + esbuild

## 🎯 FUNCIONALIDADES CORE A IMPLEMENTAR

### 1. Sistema de Sugerencias Inteligentes (Copilot-like)

**Requerimientos específicos:**
- Autocompletado contextual mientras escribes nodos
- Generación automática de workflows desde descripción en lenguaje natural
- Sugerencias de optimización en tiempo real
- Detección de patrones y mejores prácticas

**Validación requerida:**
- Probar autocompletado con workflows de 10-30 nodos
- Generar MCPs completos desde prompt en <30 segundos
- Accuracy >85% en sugerencias de nodos siguientes

### 2. Validación Automática Multi-Nivel

**Tipos de validación:**
- **Sintáctica:** JSON válido, estructura n8n correcta
- **Semántica:** Conexiones lógicas, tipos de datos compatibles
- **Funcional:** APIs accesibles, credenciales válidas
- **Performance:** Detección de loops, cuellos de botella

**Validación específica por tipo:**
- **MCPs:** Validar protocol compliance, context boundaries
- **Telegram:** Webhook configuration, bot token validity
- **Agentes:** State consistency, communication patterns

### 3. Ejecutor de Workflows con Testing

**Funcionalidades:**
- Ejecución local con datos mock
- Testing unitario por nodo
- Ejecución completa con n8n Cloud v1.98
- Debugging paso a paso con breakpoints

**Validación requerida:**
- Ejecutar workflows de hasta 50 nodos sin timeout
- Compatibilidad 100% con n8n Cloud v1.98 API
- Test coverage >90% para nodos críticos

## 🔧 INTEGRACIONES ESPECÍFICAS

### n8n Cloud v1.98 Integration
- **API Base:** `https://app.n8n.cloud/api/v1/`
- **Autenticación:** API Key + OAuth2 flow
- **Endpoints críticos:**
  - `/workflows` - CRUD operations
  - `/executions` - Run workflows
  - `/credentials` - Manage API keys
- **Validación:** Probar con workflows reales de 30+ nodos

### Base de Datos de Templates
- **PostgreSQL Schema:**
  ```sql
  CREATE TABLE workflow_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    category ENUM('mcp', 'telegram', 'agent'),
    nodes JSONB,
    description TEXT,
    tags JSONB,
    created_at TIMESTAMP
  );
  ```
- **Seed inicial:** 50+ templates por categoría

### Sistema de IA
- **Primary:** OpenAI GPT-4 para generación
- **Fallback:** Modelo local (Ollama/CodeLlama)
- **Context:** Últimos 10 workflows del usuario
- **Validación:** Response time <5 segundos para sugerencias

## 🎨 INTERFAZ DE USUARIO

### VS Code Integration
- **Command Palette Commands:**
  - `n8n: Create Workflow from Description`
  - `n8n: Validate Current Workflow`
  - `n8n: Execute Workflow`
  - `n8n: Open Visual Editor`
  - `n8n: Generate Tests`

- **Status Bar Elements:**
  - Conexión n8n (verde/rojo/amarillo)
  - Última ejecución con tiempo
  - Contador de errores activos

- **Sidebar Panel:** Explorador de workflows con categorización

### Webview Components
- **Canvas Visual:** Representación gráfica del workflow
- **Execution Dashboard:** Métricas y resultados en tiempo real
- **Template Library:** Catálogo searchable de templates
- **AI Assistant Panel:** Chat interface para sugerencias

## 🧪 TESTING Y VALIDACIÓN

### Test Suite Obligatorio
- **Unit Tests:** >90% coverage todos los módulos
- **Integration Tests:** Flujo completo end-to-end
- **Performance Tests:** Workflows 50+ nodos en <30 segundos
- **API Tests:** Todos los endpoints n8n Cloud v1.98

### Criterios de Validación
- **Funcional:** Crear, editar, ejecutar workflow sin errores
- **Performance:** Tiempo respuesta UI <100ms
- **Reliability:** 99% uptime para validaciones locales
- **Usability:** Onboarding completo en <5 minutos

## 📊 MÉTRICAS Y MONITOREO

### KPIs a Trackear
- Tiempo promedio de desarrollo de workflow
- Tasa de éxito de ejecuciones
- Accuracy de sugerencias IA
- Tiempo de respuesta de validaciones

### Dashboard Requirements
- Real-time execution metrics
- Historical trend analysis
- Error rate monitoring
- Resource usage tracking

## 🔒 SEGURIDAD Y COMPLIANCE

### Requerimientos de Seguridad
- Encriptación local de credenciales
- No logging de datos sensibles
- Rate limiting para APIs externas
- Validación de inputs para prevenir injection

### Compliance
- GDPR awareness para datos personales
- SOC 2 compatible logging
- Audit trail para cambios críticos

## 🚀 DEPLOYMENT Y DISTRIBUCIÓN

### Package Requirements
- VS Code Extension (.vsix)
- Auto-updater integrado
- Cross-platform compatibility (Windows, macOS, Linux)
- Marketplace listing optimizado

### Installation Flow
1. Install from VS Code Marketplace
2. Auto-detect n8n configuration
3. Setup wizard para conexión
4. Import templates iniciales
5. Tutorial interactivo

## ✅ CRITERIOS DE ACEPTACIÓN

### MVP Definition of Done
- [ ] Extensión instala sin errores en VS Code
- [ ] Conecta exitosamente a n8n Cloud v1.98
- [ ] Crea workflow MCP desde descripción natural
- [ ] Valida sintaxis y lógica en tiempo real
- [ ] Ejecuta workflow de 30 nodos sin fallos
- [ ] Muestra métricas en dashboard webview
- [ ] Autocompletado funciona con >85% accuracy
- [ ] Base de datos templates cargada (150+ items)
- [ ] Test suite pasa 100% casos críticos
- [ ] Documentación completa disponible

### Performance Benchmarks
- Startup time: <3 segundos
- Validation time: <500ms para workflows 30 nodos
- IA suggestions: <5 segundos response time
- Memory usage: <200MB steady state
- CPU usage: <10% durante operación normal

## 🔄 PROCESO DE DESARROLLO

### Metodología
1. **Setup inicial:** Estructura proyecto + configuración
2. **Core engine:** Parser, validator, executor básico
3. **VS Code integration:** Commands, providers, webviews
4. **IA integration:** OpenAI + suggestion engine
5. **UI polish:** Dashboard, templates, UX refinement
6. **Testing:** Comprehensive test suite
7. **Documentation:** User guide, API docs, troubleshooting

### Validation Gates
- Cada feature debe pasar tests antes de merge
- Manual testing con workflows reales cada sprint
- Performance benchmarking semanal
- User feedback integration continua

## 📚 DOCUMENTACIÓN REQUERIDA

### User Documentation
- Getting started guide
- Feature overview con screenshots
- Troubleshooting common issues
- Advanced configuration options

### Developer Documentation
- Architecture overview
- API reference
- Extension points para plugins
- Contribution guidelines

## 🎯 OBJETIVOS DE NEGOCIO

### Success Metrics
- 70% reducción tiempo desarrollo workflows
- 50% reducción errores runtime
- 90% user satisfaction score
- 1000+ installs en primeros 3 meses

### ROI Validation
- Time tracking antes/después implementación
- Error rate comparison
- Developer productivity metrics
- Cost benefit analysis

---

## 🚨 INSTRUCCIONES FINALES PARA CLAUDE CODE

1. **Prioridad 1:** Implementar funcionalidades core antes que UI polish
2. **Prioridad 2:** Compatibilidad n8n Cloud v1.98 es CRÍTICA - no negociable
3. **Prioridad 3:** Performance testing en cada milestone
4. **Iteración:** Crear MVP funcional primero, iterar sobre feedback
5. **Testing:** Cada feature debe tener tests automatizados
6. **Documentation:** Documentar decisiones técnicas importantes

**NOTA IMPORTANTE:** Consultar `documentation/` folder para especificaciones exactas de APIs. Usar `n8n_requirements_table.md` como single source of truth para todos los requerimientos funcionales.