const fs = require('fs');
const mysql = require('mysql2/promise');

async function setupMissingTables() {
  try {
    console.log('Connecting to database...');

    const connection = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '',
      database: 'dental_erp',
      multipleStatements: true
    });

    console.log('Reading SQL schema...');
    const schema = fs.readFileSync('./create-missing-tables.sql', 'utf8');

    console.log('Creating missing tables...');
    await connection.query(schema);

    console.log('✓ Missing inventory tables created successfully!');

    await connection.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

setupMissingTables();
