import { Pool, PoolConfig } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

export class DatabaseConnection {
    private pool: Pool;
    private config: PoolConfig;

    constructor() {
        this.config = {
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME || 'n8n_copilot',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        };

        this.pool = new Pool(this.config);

        // Handle pool errors
        this.pool.on('error', (err) => {
            console.error('Unexpected error on idle client', err);
        });
    }

    async connect(): Promise<void> {
        try {
            const client = await this.pool.connect();
            console.log('Connected to PostgreSQL database');
            client.release();
        } catch (error) {
            console.error('Failed to connect to database:', error);
            throw error;
        }
    }

    async query(text: string, params?: any[]): Promise<any> {
        const start = Date.now();
        try {
            const res = await this.pool.query(text, params);
            const duration = Date.now() - start;
            console.log('Executed query', { text, duration, rows: res.rowCount });
            return res;
        } catch (error) {
            console.error('Query error:', error);
            throw error;
        }
    }

    async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async close(): Promise<void> {
        await this.pool.end();
        console.log('Database connection closed');
    }

    async runMigrations(): Promise<void> {
        try {
            // Create migrations table if not exists
            await this.query(`
                CREATE TABLE IF NOT EXISTS migrations (
                    id SERIAL PRIMARY KEY,
                    filename VARCHAR(255) UNIQUE NOT NULL,
                    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Read schema file
            const schemaPath = path.join(__dirname, 'schema.sql');
            const schema = fs.readFileSync(schemaPath, 'utf8');

            // Execute schema
            await this.query(schema);
            
            // Record migration
            await this.query(
                'INSERT INTO migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
                ['schema.sql']
            );

            console.log('Database migrations completed successfully');
        } catch (error) {
            console.error('Migration failed:', error);
            throw error;
        }
    }
}

// Singleton instance
let dbInstance: DatabaseConnection | null = null;

export function getDatabase(): DatabaseConnection {
    if (!dbInstance) {
        dbInstance = new DatabaseConnection();
    }
    return dbInstance;
}