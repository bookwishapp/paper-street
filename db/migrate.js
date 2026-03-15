const fs = require('fs').promises;
const path = require('path');
const db = require('./utils/connection');

async function runMigrations() {
  try {
    // Create migrations table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Get list of migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();

    // Get list of already executed migrations
    const { rows: executed } = await db.query('SELECT filename FROM migrations');
    const executedFiles = new Set(executed.map(r => r.filename));

    // Run pending migrations
    for (const file of sqlFiles) {
      if (!executedFiles.has(file)) {
        console.log(`Running migration: ${file}`);
        const sqlPath = path.join(migrationsDir, file);
        const sql = await fs.readFile(sqlPath, 'utf8');

        const client = await db.getClient();
        try {
          await client.query('BEGIN');
          await client.query(sql);
          await client.query('INSERT INTO migrations (filename) VALUES ($1)', [file]);
          await client.query('COMMIT');
          console.log(`✓ Migration ${file} completed`);
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
      }
    }

    console.log('All migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations();
}

module.exports = runMigrations;