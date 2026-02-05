const fs = require('fs');
const mysql = require('mysql2/promise');

async function setupInventory() {
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
    const schemaPath = '../../database/05_inventory_schema.sql';
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('Executing schema...');
    await connection.query(schema);

    console.log('✓ Inventory tables created successfully!');

    await connection.end();
  } catch (error) {
    console.error('Error setting up inventory:', error.message);
    process.exit(1);
  }
}

setupInventory();
