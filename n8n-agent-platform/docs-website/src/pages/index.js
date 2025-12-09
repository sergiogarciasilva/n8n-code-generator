import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg glass-card"
            to="/docs/intro">
            Comenzar - 5min ⏱️
          </Link>
          <Link
            className="button button--outline button--lg glass-card"
            style={{marginLeft: '1rem'}}
            to="/docs/quickstart">
            Ver Demo 🎬
          </Link>
        </div>
        <div className="agent-message" style={{marginTop: '2rem', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto'}}>
          ¡Hola! Soy Workflow Wizard 🧙‍♂️ Tu plataforma ya optimizó +10,000 workflows este mes!
        </div>
      </div>
    </header>
  );
}

export default function Home() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title} - Documentación`}
      description="Plataforma autónoma de agentes de IA para optimización continua de workflows de n8n">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        
        {/* Stats Section */}
        <section className={styles.stats}>
          <div className="container">
            <div className="row">
              <div className="col col--3">
                <div className="glass-card text--center">
                  <h2 className="gradient-text">98.5%</h2>
                  <p>Tasa de Éxito</p>
                </div>
              </div>
              <div className="col col--3">
                <div className="glass-card text--center">
                  <h2 className="gradient-text">24/7</h2>
                  <p>Optimización Continua</p>
                </div>
              </div>
              <div className="col col--3">
                <div className="glass-card text--center">
                  <h2 className="gradient-text">3x</h2>
                  <p>Más Rápido</p>
                </div>
              </div>
              <div className="col col--3">
                <div className="glass-card text--center">
                  <h2 className="gradient-text">+1000</h2>
                  <p>Usuarios Activos</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className={styles.cta}>
          <div className="container">
            <div className="glass-card text--center" style={{padding: '3rem'}}>
              <h2 className="gradient-text" style={{fontSize: '2.5rem'}}>
                ¿Listo para transformar tus workflows?
              </h2>
              <p style={{fontSize: '1.2rem', margin: '2rem 0'}}>
                Únete a miles de desarrolladores que ya están optimizando sus automatizaciones con IA
              </p>
              <div>
                <Link
                  className="button button--primary button--lg"
                  to="/docs/intro">
                  Empezar Gratis →
                </Link>
                <Link
                  className="button button--outline button--lg"
                  style={{marginLeft: '1rem'}}
                  to="https://discord.gg/n8n-agents">
                  Únete al Discord 💬
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}