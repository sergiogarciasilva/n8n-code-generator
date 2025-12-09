# n8n Agent Platform - Web Platform User Guide

## 🌐 Introducción

La plataforma web n8n Agent Platform es una solución completa para crear, gestionar y optimizar workflows de n8n usando inteligencia artificial. Esta guía te ayudará a aprovechar al máximo todas las características de la plataforma.

## 🚀 Acceso a la Plataforma

### URLs Principales

- **Dashboard Principal**: http://localhost:5173
- **Enterprise Dashboard**: http://localhost:5173/enterprise-dashboard.html
- **Generador de Workflows IA**: http://localhost:5173/workflow-generator.html
- **Métricas Avanzadas**: http://localhost:5173/advanced-metrics-dashboard.html
- **API Documentation**: http://localhost:3000/api-docs

### Primer Acceso

1. Abre tu navegador (Chrome, Firefox, Safari recomendados)
2. Navega a http://localhost:5173
3. Inicia sesión con tus credenciales
4. Serás dirigido al dashboard principal

## 🎨 Interfaz Glassmorphism

La plataforma utiliza un diseño moderno glassmorphism inspirado en Apple con:

- **Efectos de cristal**: Fondos semi-transparentes con blur
- **Gradientes animados**: Orbes de colores que flotan en el fondo
- **Tipografía amigable**: Gloria Hallelujah para una experiencia única
- **Dark mode**: Diseño optimizado para reducir fatiga visual

## 📊 Dashboard Principal

### Widgets Principales

1. **Estado de Servicios**
   - Monitoreo en tiempo real de todos los servicios
   - Indicadores visuales de salud del sistema
   - Logs en vivo

2. **Estadísticas Rápidas**
   - Total de workflows
   - Tasa de éxito
   - Completaciones de IA
   - Usuarios activos

3. **Accesos Directos**
   - Generador de Workflows
   - Agentes IA
   - Seguridad Empresarial
   - Analytics
   - Marketplace

## 🤖 Generador de Workflows con IA

### Crear un Workflow desde Lenguaje Natural

1. Navega a "Generador de Workflows"
2. En el campo de texto, describe tu workflow en lenguaje natural:
   ```
   "Necesito un workflow que revise mis emails cada hora, 
   extraiga los archivos adjuntos PDF y los guarde en Google Drive"
   ```
3. Haz clic en "Generar con IA"
4. El sistema creará automáticamente:
   - Nodos necesarios
   - Conexiones entre nodos
   - Configuración básica
   - Validaciones

### Editor Visual

- **Panel de Nodos**: Arrastra y suelta nodos desde la barra lateral
- **Canvas**: Conecta nodos visualmente
- **Propiedades**: Configura cada nodo en el panel derecho
- **Vista de Código**: Alterna entre vista visual y JSON

### Testing y Validación

1. **Test Manual**: Ejecuta el workflow con datos de prueba
2. **Validación Automática**: El sistema valida:
   - Sintaxis correcta
   - Compatibilidad de conexiones
   - Seguridad
   - Rendimiento estimado

## 📈 Métricas y Analytics

### Dashboard de Métricas Avanzadas

Accede a análisis detallados:

1. **Tendencias de Ejecución**
   - Gráficos de línea temporal
   - Comparación período anterior
   - Predicciones basadas en IA

2. **Distribución de Uso**
   - Tipos de nodos más usados
   - Modelos de IA preferidos
   - Análisis de errores

3. **Métricas de Rendimiento**
   - Tiempo promedio de ejecución
   - Uso de memoria
   - Tasa de éxito/fallo

### Alertas y Notificaciones

Configura alertas para:
- Fallos de workflow
- Límites de API alcanzados
- Anomalías detectadas
- Optimizaciones sugeridas

## 🔐 Seguridad y Permisos

### Gestión de Usuarios

1. **Roles Disponibles**:
   - Admin: Acceso total
   - Developer: Crear y editar workflows
   - Analyst: Solo lectura y reportes
   - Guest: Acceso limitado

2. **Configuración de Seguridad**:
   - Autenticación de dos factores
   - Tokens de API
   - Logs de auditoría
   - Políticas de contraseña

## 🛒 Marketplace de Templates

### Explorar Templates

1. Navega al Marketplace
2. Filtra por:
   - Categoría (Marketing, Sales, IT, etc.)
   - Popularidad
   - Calificación
   - Precio (gratis/premium)

### Usar un Template

1. Selecciona un template
2. Haz clic en "Usar Template"
3. Personaliza según tus necesidades
4. Guarda como nuevo workflow

## 🤝 Agentes IA

### Tipos de Agentes Disponibles

1. **Agente de Optimización**
   - Analiza workflows existentes
   - Sugiere mejoras
   - Implementa optimizaciones

2. **Agente de Debugging**
   - Detecta errores
   - Sugiere correcciones
   - Valida fixes

3. **Agente MCP (Model Context Protocol)**
   - Orquesta múltiples modelos
   - Gestiona contexto complejo
   - Optimiza para tareas específicas

4. **Telegram Bot Agent**
   - Integración con Telegram
   - Respuestas automatizadas
   - Procesamiento de comandos

## 💡 Tips y Mejores Prácticas

### Optimización de Workflows

1. **Usa nombres descriptivos** para nodos y workflows
2. **Documenta** la lógica compleja con comentarios
3. **Prueba incrementalmente** - valida cada sección
4. **Monitorea el rendimiento** regularmente

### Gestión de Recursos

1. **Configura límites** de rate para APIs externas
2. **Usa caché** cuando sea posible
3. **Programa ejecuciones** en horarios de baja carga
4. **Revisa logs** regularmente

### Colaboración

1. **Usa versionado** para cambios importantes
2. **Comparte templates** en el marketplace
3. **Documenta** casos de uso
4. **Solicita reviews** para workflows críticos

## 🐛 Solución de Problemas

### Problemas Comunes

1. **Workflow no se ejecuta**
   - Verifica credenciales de API
   - Revisa logs de error
   - Valida sintaxis

2. **Rendimiento lento**
   - Optimiza consultas de datos
   - Reduce nodos innecesarios
   - Usa ejecución paralela

3. **Errores de conexión**
   - Verifica endpoints
   - Revisa firewalls
   - Confirma tokens válidos

### Soporte

- **Documentación**: /docs
- **API Reference**: /api-docs
- **Community Forum**: Próximamente
- **Email**: support@n8n-agent-platform.com

## 🚀 Características Avanzadas

### Webhooks

1. Crea endpoints personalizados
2. Gestiona autenticación
3. Procesa datos en tiempo real

### Integraciones Enterprise

- SAP
- Salesforce
- Microsoft 365
- Google Workspace
- Slack
- Y más de 300 servicios

### API REST

Accede a todas las funcionalidades vía API:
```bash
# Ejemplo: Crear workflow
curl -X POST http://localhost:3000/api/workflows \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Mi Workflow", "nodes": [...]}'
```

## 📱 Acceso Móvil

Aunque la plataforma está optimizada para desktop, puedes acceder desde dispositivos móviles:

1. La interfaz se adapta a pantallas pequeñas
2. Funciones básicas disponibles
3. Monitoreo y alertas completas
4. App nativa próximamente

## 🎯 Próximos Pasos

1. **Explora** el generador de workflows con IA
2. **Crea** tu primer workflow automatizado
3. **Prueba** los agentes de optimización
4. **Comparte** tus creaciones en el marketplace

¡Bienvenido a la nueva era de automatización con n8n Agent Platform!