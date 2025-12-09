import { getDatabase } from './connection';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function runMigrations() {
    const db = getDatabase();
    
    try {
        console.log('Connecting to database...');
        await db.connect();
        
        console.log('Running migrations...');
        await db.runMigrations();
        
        console.log('Migrations completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await db.close();
    }
}

// Run migrations if called directly
if (require.main === module) {
    runMigrations();
}

export { runMigrations };