import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '15432'),
  database: process.env.DB_NAME || 'n8n_agent_platform',
  user: process.env.DB_USER || 'sergio',
  password: process.env.DB_PASSWORD,
});

async function runMigrations() {
  console.log('Running database migrations...');
  
  try {
    // Create migrations table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Get list of migration files
    const migrationsDir = path.join(__dirname, '../../../migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    // Get executed migrations
    const result = await pool.query('SELECT filename FROM migrations');
    const executedMigrations = new Set(result.rows.map(row => row.filename));

    // Run pending migrations
    for (const file of migrationFiles) {
      if (!executedMigrations.has(file)) {
        console.log(`Running migration: ${file}`);
        
        const migrationSQL = fs.readFileSync(
          path.join(migrationsDir, file),
          'utf8'
        );
        
        await pool.query('BEGIN');
        try {
          await pool.query(migrationSQL);
          await pool.query(
            'INSERT INTO migrations (filename) VALUES ($1)',
            [file]
          );
          await pool.query('COMMIT');
          console.log(`✓ Migration ${file} completed`);
        } catch (error) {
          await pool.query('ROLLBACK');
          throw error;
        }
      }
    }

    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations
runMigrations();