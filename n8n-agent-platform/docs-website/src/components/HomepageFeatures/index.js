import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: '🤖 Agentes Inteligentes',
    description: (
      <>
        Agentes especializados que analizan y optimizan tus workflows 24/7 
        usando GPT-4 y Claude. MCPAgent, TelegramAgent y más.
      </>
    ),
  },
  {
    title: '🎨 Glassmorphism UI',
    description: (
      <>
        Interfaz moderna inspirada en Apple con efectos de cristal, 
        animaciones fluidas y la fuente Gloria Hallelujah para agentes.
      </>
    ),
  },
  {
    title: '🏪 Marketplace',
    description: (
      <>
        Templates certificados por IA con sistema de revenue sharing 70/30. 
        Comparte tus workflows y monetiza tu conocimiento.
      </>
    ),
  },
  {
    title: '🔄 Control de Versiones',
    description: (
      <>
        Sistema Git-style para workflows con branches, tags y rollback 
        instantáneo. Nunca pierdas una versión funcional.
      </>
    ),
  },
  {
    title: '📱 App Móvil Nativa',
    description: (
      <>
        Controla tu plataforma desde iOS o Android. Dashboard completo, 
        notificaciones push y gestión remota de agentes.
      </>
    ),
  },
  {
    title: '🔐 Seguridad Enterprise',
    description: (
      <>
        JWT + 2FA, cifrado AES-256-GCM, RBAC avanzado y auditoría 
        completa. Tus workflows están protegidos al máximo.
      </>
    ),
  },
];

function Feature({title, description}) {
  return (
    <div className={clsx('col col--4', styles.feature)}>
      <div className="feature-card">
        <div className="text--center padding-horiz--md">
          <Heading as="h3">{title}</Heading>
          <p>{description}</p>
        </div>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="text--center margin-bottom--xl">
          <h2 className="gradient-text" style={{fontSize: '3rem'}}>
            Todo lo que necesitas para automatizar
          </h2>
          <p style={{fontSize: '1.2rem', maxWidth: '800px', margin: '0 auto'}}>
            Una plataforma completa que combina IA avanzada, diseño moderno y 
            herramientas profesionales para llevar tus workflows al siguiente nivel
          </p>
        </div>
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}