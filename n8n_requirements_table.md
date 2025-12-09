# Requerimientos Detallados - n8n VS Code Extension

## 1. Contexto y Objetivos del Proyecto

| **Pregunta** | **Respuesta Sugerida** | **Tu Respuesta** |
|## Requerimientos Específicos Adicionales

| **Categoría** | **Requerimiento** | **Detalles** |
|---------------|-------------------|--------------|
| **MCPs (Model Context Protocol)** | Soporte nativo para MCPs | Templates específicos, validación de protocolo, debugging MCP |
| **Telegram Bots** | Integración Telegram API | Webhooks, comandos, media handling, chat flow visualization |
| **Sistemas de Agentes** | Workflows multi-agente | Orquestación, state management, agent communication patterns |
| **Base de Datos Propia** | Templates/Snippets DB | PostgreSQL local con schemas para MCPs, Telegram, Agentes |
| **Compatibilidad n8n Cloud v1.98** | API específica | Usar exactamente los endpoints y formatos de v1.98 |
| **Subworkflows Complejos** | Navegación anidada | Visualización jerárquica, debugging cross-workflow |
| **Workflows Grandes (30+ nodos)** | Performance optimizada | Lazy loading, virtualization, chunk processing |

--------------|------------------------|------------------|
| ¿Cuánto tiempo llevas usando n8n? | 6 meses - 1 año | |
| ¿Qué tipos de workflows creates habitualmente? | MCPs (Model Context Protocol), flujos con Telegram bots, sistemas de agentes | |
| ¿Cuáles son los principales problemas al desarrollar workflows? | Debugging lento, testing manual, configuración repetitiva de nodos | |
| ¿Objetivo principal: acelerar desarrollo, validación automática o sugerencias inteligentes? | Combinación: 40% sugerencias, 35% validación, 25% aceleración | |
| ¿Nivel de impacto esperado en productividad? | Reducir tiempo de desarrollo en 50-70% | |

## 2. Usuarios y Casos de Uso

| **Pregunta** | **Respuesta Sugerida** | **Tu Respuesta** |
|--------------|------------------------|------------------|
| ¿Quién usará la extensión? | Equipo de 3 desarrolladores con experiencia en JSON y APIs | |
| ¿Nivel técnico de usuarios? | Avanzado, experiencia con JSON y APIs, vibe coding | |
| ¿Workflows colaborativos o individuales? | Principalmente individuales, ocasionalmente colaborativos | |
| ¿Tipos de workflows a optimizar? | MCPs (50%), Telegram bots (30%), Sistemas de agentes (20%) | |
| ¿Industria/dominio específico? | SaaS, e-commerce, marketing automation | |

## 3. Funcionalidades Core - Sistema de Sugerencias

| **Pregunta** | **Respuesta Sugerida** | **Tu Respuesta** |
|--------------|------------------------|------------------|
| ¿Sugerir nodos mientras escribes? | Sí, con scoring basado en contexto del workflow | |
| ¿Completar configuraciones automáticamente? | Sí, especialmente para APIs comunes (HTTP, webhooks) | |
| ¿Generar workflows desde lenguaje natural? | Sí, especialmente para MCPs y agentes (workflows 10-30 nodos) | |
| ¿Aprender patrones personales o usar generales? | Híbrido: 70% patrones personales, 30% biblioteca común | |
| ¿Sugerir optimizaciones de performance? | Sí, detectar nodos redundantes y cuellos de botella | |

## 4. Funcionalidades Core - Validación Automática

| **Pregunta** | **Respuesta Sugerida** | **Tu Respuesta** |
|--------------|------------------------|------------------|
| ¿Tipos de errores a detectar? | Sintaxis, conexiones rotas, credenciales faltantes, loops infinitos | |
| ¿Validación en tiempo real o al ejecutar? | Tiempo real para sintaxis, al ejecutar para lógica | |
| ¿Validar contra APIs reales o mocks? | Mocks por defecto, opción de APIs reales con rate limiting | |
| ¿Niveles de validación? | Error (bloquea), Warning (sugiere), Info (optimización) | |
| ¿Validar performance/memoria? | Sí, alertar workflows que consuman >100MB o >30 segundos | |

## 5. Funcionalidades Core - Ejecución y Testing

| **Pregunta** | **Respuesta Sugerida** | **Tu Respuesta** |
|--------------|------------------------|------------------|
| ¿Ejecutar workflows completos o parciales? | Ambos: nodos individuales y workflows completos | |
| ¿Datos de prueba automáticos o reales? | Automáticos por defecto, opción de datasets personalizados | |
| ¿Integración con entornos dev/staging? | Sí, configuración por perfiles (local, dev, staging, prod) | |
| ¿Historial de ejecuciones? | Últimas 50 ejecuciones con métricas básicas | |
| ¿Testing unitario de nodos? | Sí, con assertions automáticas para outputs esperados | |

## 6. Integración con n8n

| **Pregunta** | **Respuesta Sugerida** | **Tu Respuesta** |
|--------------|------------------------|------------------|
| ¿Configuración n8n actual? | n8n Cloud v1.98 (requisito de compatibilidad obligatoria) | |
| ¿Versión n8n objetivo? | n8n Cloud v1.98 (compatibilidad estricta requerida) | |
| ¿Múltiples instancias? | Sí: local (dev), staging, production | |
| ¿Método de trabajo preferido? | 60% edición VS Code, 40% edición visual n8n | |
| ¿Sincronización bidireccional? | Sí, detectar cambios en ambas direcciones | |

## 7. Formato de Archivos y Estructura

| **Pregunta** | **Respuesta Sugerida** | **Tu Respuesta** |
|--------------|------------------------|------------------|
| ¿Formato de archivos? | JSON nativo n8n + metadata adicional en .vscode/ | |
| ¿Estructura de proyecto? | Carpetas por categoría: /workflows/api/, /workflows/data/, etc. | |
| ¿Versionado específico? | Git nativo + tags automáticos por versión de workflow | |
| ¿Archivos de configuración? | .n8nrc.json para settings, .env para credenciales | |
| ¿Snippets/templates? | Base de datos propia (contexto proyecto no actualizado en LLMs) | |

## 8. Interfaz de Usuario

| **Pregunta** | **Respuesta Sugerida** | **Tu Respuesta** |
|--------------|------------------------|------------------|
| ¿Explorador de workflows en sidebar? | Sí, con categorización y búsqueda fuzzy | |
| ¿Panel de resultados de ejecución? | Sí, en panel inferior con tabs por ejecución | |
| ¿Dashboard de métricas? | Webview con charts de success rate, tiempo promedio, errores | |
| ¿Biblioteca de nodos/snippets? | Sí, con preview y drag-drop al editor | |
| ¿Vista visual integrada? | Webview con canvas interactivo + sincronización con código | |

## 9. Información en Tiempo Real

| **Pregunta** | **Respuesta Sugerida** | **Tu Respuesta** |
|--------------|------------------------|------------------|
| ¿Estado conexión n8n? | Status bar: verde (conectado), rojo (error), amarillo (sin auth) | |
| ¿Última ejecución? | Tooltip con tiempo, status, nodos ejecutados | |
| ¿Métricas performance? | Tiempo promedio últimas 10 ejecuciones en status bar | |
| ¿Errores/warnings activos? | Badge contador en explorador + panel problemas VS Code | |
| ¿Notificaciones? | Ejecuciones fallidas, APIs con rate limit, nuevas sugerencias | |

## 10. Inteligencia Artificial

| **Pregunta** | **Respuesta Sugerida** | **Tu Respuesta** |
|--------------|------------------------|------------------|
| ¿Modelo IA preferido? | OpenAI GPT-4 (cloud) + fallback a modelo local | |
| ¿Nivel de inteligencia? | Autocompletado avanzado + generación simple + optimización | |
| ¿Entrenamiento/personalización? | Workflows históricos + feedback manual + patterns community | |
| ¿Procesamiento local vs cloud? | Análisis local, generación cloud con privacy controls | |
| ¿Costo estimado IA mensual? | $10-30/usuario/mes (configurable con límites) | |

## 11. Rendimiento y Escalabilidad

| **Pregunta** | **Respuesta Sugerida** | **Tu Respuesta** |
|--------------|------------------------|------------------|
| ¿Número workflows típico? | 20-50 workflows activos por proyecto | |
| ¿Complejidad workflows? | 10-30 nodos promedio, workflows de agentes pueden llegar a 50+ | |
| ¿Uso de subworkflows? | Sí, 80% de workflows activos incluyen subworkflows | |
| ¿Volumen de datos? | Datasets típicos: 100-10K registros | |
| ¿Tiempo máximo ejecución? | 5 minutos timeout por defecto, configurable hasta 30min | |

## 12. Seguridad y Configuración

| **Pregunta** | **Respuesta Sugerida** | **Tu Respuesta** |
|--------------|------------------------|------------------|
| ¿Datos sensibles en workflows? | Sí: API keys, tokens, ocasionalmente PII | |
| ¿Nivel seguridad requerido? | Empresarial: encriptación local, no logging de credenciales | |
| ¿Validación credenciales? | Sí, test automático antes de ejecución production | |
| ¿Detección datos sensibles? | Regex patterns + ML para detectar y enmascarar en logs | |
| ¿Compliance requerido? | GDPR awareness, SOC 2 friendly | |

## 13. Tecnologías y Preferencias

| **Pregunta** | **Respuesta Sugerida** | **Tu Respuesta** |
|--------------|------------------------|------------------|
| ¿Base de datos local? | PostgreSQL local + MongoDB cloud para sync/backup | |
| ¿Framework UI preferido? | React para webviews + TypeScript obligatorio | |
| ¿Herramientas monitoreo? | Integración opcional con DataDog, New Relic, custom webhooks | |
| ¿Extensibilidad para devs? | Plugin system + VS Code marketplace + API pública | |
| ¿Testing framework? | Jest + Playwright para e2e + workflow simulation | |

## 14. Métricas y Monitoreo

| **Pregunta** | **Respuesta Sugerida** | **Tu Respuesta** |
|--------------|------------------------|------------------|
| ¿Métricas a trackear? | Tiempo ejecución, success rate, uso recursos, frecuencia nodos | |
| ¿Reportes automáticos? | Weekly digest por email + dashboard mensual | |
| ¿Exportación métricas? | JSON, CSV export + webhook para external systems | |
| ¿Alertas configurables? | Sí: failure rate >10%, execution time >5min, disk space | |
| ¿Retención datos históricos? | 90 días detailed, 1 año aggregated, export para archivo | |

## 15. Prioridades de Desarrollo

| **Pregunta** | **Respuesta Sugerida** | **Tu Respuesta** |
|--------------|------------------------|------------------|
| ¿Fase 1 (MVP)? | TODO: Editor + validación + ejecución + IA + webview + métricas + optimización + team features | |
| ¿Fase 2? | Refinamiento y optimización de todas las funcionalidades del MVP | |
| ¿Fase 3? | Funcionalidades avanzadas y escalabilidad empresarial | |
| ¿Timeline objetivo? | MVP: 4-6 semanas, Fase 2: +6 semanas, Fase 3: +8 semanas | |
| ¿Criterios de éxito? | 70% reducción tiempo debug, 50% menos errores runtime | |

## 16. Presupuesto y Recursos

| **Pregunta** | **Respuesta Sugerida** | **Tu Respuesta** |
|--------------|------------------------|------------------|
| ¿Presupuesto mensual APIs? | $100-300/mes para IA + monitoring services | |
| ¿Tiempo dedicación desarrollo? | 15-20 horas/semana x 12-16 semanas | |
| ¿Recursos externos necesarios? | Posible consulting para ML/AI optimization | |
| ¿Modelo distribución? | Open source core + premium features para teams | |
| ¿ROI esperado? | Break-even en 6 meses por ahorro tiempo desarrollo | |

---

## Instrucciones de Uso

1. **Completa la columna "Tu Respuesta"** con tus preferencias específicas
2. **Modifica las respuestas sugeridas** si no se ajustan a tu caso
3. **Agrega nuevas filas** si tienes requerimientos adicionales
4. **Prioriza las secciones** marcando las más importantes
5. **Usa este documento** como input para Claude Code

**Nota**: Las respuestas sugeridas están basadas en casos de uso típicos. Ajústalas según tu contexto específico.