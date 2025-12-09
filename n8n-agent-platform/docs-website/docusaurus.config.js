// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// There are various equivalent ways to declare your Docusaurus config.
// See: https://docusaurus.io/docs/api/docusaurus-config

import {themes as prismThemes} from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'n8n Agent Platform',
  tagline: 'Plataforma autónoma de agentes de IA para optimización continua de workflows',
  favicon: 'img/favicon.ico',

  // Set the production url of your site here
  url: 'https://docs.n8n-agent-platform.com',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'n8n-agent-platform', // Usually your GitHub org/user name.
  projectName: 'n8n-agent-platform', // Usually your repo name.

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'es',
    locales: ['es', 'en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/n8n-agent-platform/n8n-agent-platform/tree/main/docs-website/',
          remarkPlugins: [],
          rehypePlugins: [],
        },
        blog: {
          showReadingTime: true,
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/n8n-agent-platform/n8n-agent-platform/tree/main/docs-website/',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themes: ['@docusaurus/theme-mermaid'],
  
  markdown: {
    mermaid: true,
  },

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // Replace with your project's social card
      image: 'img/docusaurus-social-card.jpg',
      navbar: {
        title: 'n8n Agent Platform',
        logo: {
          alt: 'n8n Agent Platform Logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Documentación',
          },
          {
            type: 'docSidebar',
            sidebarId: 'apiSidebar',
            position: 'left',
            label: 'API Reference',
          },
          {to: '/blog', label: 'Blog', position: 'left'},
          {to: '/showcase', label: 'Showcase', position: 'left'},
          {
            type: 'search',
            position: 'right',
          },
          {
            href: 'https://github.com/n8n-agent-platform/n8n-agent-platform',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {
                label: 'Introducción',
                to: '/docs/intro',
              },
              {
                label: 'Guía Rápida',
                to: '/docs/quickstart',
              },
              {
                label: 'API Reference',
                to: '/docs/api/overview',
              },
            ],
          },
          {
            title: 'Comunidad',
            items: [
              {
                label: 'Discord',
                href: 'https://discord.gg/n8n-agents',
              },
              {
                label: 'Twitter',
                href: 'https://twitter.com/n8n_agents',
              },
              {
                label: 'Stack Overflow',
                href: 'https://stackoverflow.com/questions/tagged/n8n-agents',
              },
            ],
          },
          {
            title: 'Más',
            items: [
              {
                label: 'Blog',
                to: '/blog',
              },
              {
                label: 'GitHub',
                href: 'https://github.com/n8n-agent-platform/n8n-agent-platform',
              },
              {
                label: 'Changelog',
                href: 'https://github.com/n8n-agent-platform/n8n-agent-platform/releases',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} n8n Agent Platform. Built with Docusaurus.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ['bash', 'typescript', 'json', 'yaml', 'docker'],
      },
      algolia: {
        // The application ID provided by Algolia
        appId: 'YOUR_APP_ID',
        // Public API key: it is safe to commit it
        apiKey: 'YOUR_SEARCH_API_KEY',
        indexName: 'n8n-agent-platform',
        // Optional: see doc section below
        contextualSearch: true,
        // Optional: path for search page that enabled by default (`false` to disable it)
        searchPagePath: 'search',
      },
      announcementBar: {
        id: 'new_features',
        content:
          '🎉 <b>Nuevo!</b> Glassmorphism UI, Marketplace de Templates y App Móvil ya disponibles!',
        backgroundColor: '#ff6d00',
        textColor: '#ffffff',
        isCloseable: true,
      },
    }),
};

export default config;