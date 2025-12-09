# n8n Agent Platform - Documentation Website

Sitio web de documentación para n8n Agent Platform construido con Docusaurus 3.

## 🚀 Inicio Rápido

### Instalación
```bash
cd docs-website
npm install
```

### Desarrollo
```bash
npm start
```

El sitio estará disponible en http://localhost:3000

### Build
```bash
npm run build
```

Los archivos estáticos se generarán en `build/`

## 📁 Estructura

```
docs-website/
├── docs/                 # Documentación en Markdown
│   ├── intro.md         # Página de introducción
│   ├── quickstart.md    # Guía de inicio rápido
│   ├── features/        # Características de la plataforma
│   ├── agents/          # Documentación de agentes
│   ├── guides/          # Guías paso a paso
│   └── api/             # Referencia de API
├── src/
│   ├── css/             # Estilos personalizados
│   ├── pages/           # Páginas React
│   └── components/      # Componentes React
├── static/              # Archivos estáticos (imágenes, etc)
├── docusaurus.config.js # Configuración principal
└── sidebars.js          # Configuración de navegación
```

## 🎨 Personalización

### Colores del Tema
Edita los colores en `src/css/custom.css`:
```css
:root {
  --ifm-color-primary: #ff6d00;
  --ifm-color-primary-dark: #e66100;
  /* ... más colores ... */
}
```

### Fuentes
Las fuentes están configuradas para mantener consistencia con la plataforma:
- **Inter**: Fuente principal
- **Gloria Hallelujah**: Para mensajes de agentes
- **Fira Code**: Para bloques de código

### Efectos Glass
Los efectos glassmorphism están implementados con CSS personalizado:
```css
.glass-card {
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 20px;
}
```

## 📝 Añadir Documentación

### Nueva Página
1. Crea un archivo `.md` en `docs/`
2. Añade frontmatter:
```markdown
---
sidebar_position: 1
title: Mi Nueva Página
---

# Contenido aquí
```

### Nueva Categoría
1. Crea una carpeta en `docs/`
2. Actualiza `sidebars.js`:
```javascript
{
  type: 'category',
  label: 'Mi Categoría',
  items: ['mi-categoria/pagina1', 'mi-categoria/pagina2'],
}
```

## 🔍 Búsqueda

La búsqueda está configurada con Algolia. Para activarla:

1. Registra tu sitio en [Algolia DocSearch](https://docsearch.algolia.com/)
2. Actualiza las credenciales en `docusaurus.config.js`:
```javascript
algolia: {
  appId: 'YOUR_APP_ID',
  apiKey: 'YOUR_API_KEY',
  indexName: 'n8n-agent-platform',
}
```

## 🌐 i18n

El sitio soporta español e inglés. Para añadir traducciones:

```bash
# Generar archivos de traducción
npm run write-translations

# Iniciar en inglés
npm run start -- --locale en
```

## 🚀 Deployment

### GitHub Pages
```bash
GIT_USER=<GITHUB_USERNAME> npm run deploy
```

### Vercel
1. Conecta tu repo en Vercel
2. Configura build command: `npm run build`
3. Output directory: `build`

### Netlify
1. Conecta tu repo en Netlify
2. Build command: `npm run build`
3. Publish directory: `build`

## 📊 Analytics

Para añadir Google Analytics:
```javascript
// En docusaurus.config.js
gtag: {
  trackingID: 'G-XXXXXXXXXX',
  anonymizeIP: true,
}
```

## 🐛 Troubleshooting

### Error: "Cannot find module"
```bash
rm -rf node_modules package-lock.json
npm install
```

### Build falla con memoria
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

### Hot reload no funciona
```bash
npm start -- --poll 1000
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crea tu branch (`git checkout -b docs/nueva-seccion`)
3. Commit cambios (`git commit -m 'Añadir nueva sección'`)
4. Push al branch (`git push origin docs/nueva-seccion`)
5. Abrir Pull Request

## 📄 Licencia

MIT License - Ver [LICENSE](../LICENSE) para detalles.