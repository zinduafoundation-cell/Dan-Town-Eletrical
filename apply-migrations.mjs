import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  host: 'vldccdtuwwyumqdkyxde.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'your_database_password', // This needs to be provided
  ssl: { rejectUnauthorized: false }
});

async function runMigrations() {
  try {
    await client.connect();
    console.log('Connected to database');
    
    // Run migrations
    const migrations = [
      '001_extensions.sql',
      '002_profiles.sql',
      '003_roles_permissions.sql',
      '004_categories_brands.sql',
      '005_products.sql',
      '008_customers.sql'
    ];
    
    for (const migration of migrations) {
      const sql = await import(`file:///c:/Users/user/dantownecomers/supabase/migrations/${migration}`, { assert: { type: 'text' } });
      console.log(`Applying ${migration}...`);
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

runMigrations();
