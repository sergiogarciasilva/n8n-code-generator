/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  // By default, Docusaurus generates a sidebar from the docs folder structure
  tutorialSidebar: [
    'intro',
    'quickstart',
    {
      type: 'category',
      label: 'Instalación',
      items: [
        'installation/requirements',
        'installation/docker',
        'installation/manual',
        'installation/configuration',
      ],
    },
    {
      type: 'category',
      label: 'Características',
      items: [
        'features/agents',
        'features/glassmorphism-ui',
        'features/marketplace',
        'features/versioning',
        'features/mobile-app',
        'features/security',
        'features/testing-environments',
      ],
    },
    {
      type: 'category',
      label: 'Agentes',
      items: [
        'agents/overview',
        'agents/mcp-agent',
        'agents/telegram-agent',
        'agents/multi-agent',
        'agents/custom-agents',
      ],
    },
    {
      type: 'category',
      label: 'Guías',
      items: [
        'guides/first-workflow',
        'guides/agent-configuration',
        'guides/marketplace-publishing',
        'guides/version-control',
        'guides/mobile-setup',
        'guides/deployment',
      ],
    },
    {
      type: 'category',
      label: 'Desarrollo',
      items: [
        'development/architecture',
        'development/creating-agents',
        'development/api-integration',
        'development/testing',
        'development/contributing',
      ],
    },
    {
      type: 'category',
      label: 'Troubleshooting',
      items: [
        'troubleshooting/common-issues',
        'troubleshooting/performance',
        'troubleshooting/debugging',
        'troubleshooting/faq',
      ],
    },
  ],

  apiSidebar: [
    'api/overview',
    {
      type: 'category',
      label: 'Endpoints',
      items: [
        'api/agents',
        'api/workflows',
        'api/marketplace',
        'api/versioning',
        'api/auth',
        'api/websocket',
      ],
    },
    {
      type: 'category',
      label: 'SDK',
      items: [
        'sdk/javascript',
        'sdk/python',
        'sdk/examples',
      ],
    },
  ],
};

export default sidebars;