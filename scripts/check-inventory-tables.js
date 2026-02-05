const mysql = require('mysql2/promise');

async function checkInventoryTables() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '',
      database: 'dental_erp'
    });

    const tables = [
      'inventory_categories',
      'suppliers',
      'inventory_items',
      'inventory_batches',
      'stock_transactions',
      'purchase_orders',
      'purchase_order_items',
      'stock_alerts'
    ];

    for (const table of tables) {
      console.log(`\n--- ${table} ---`);
      try {
        const [columns] = await connection.query(`DESCRIBE ${table}`);
        console.log('Exists ✓');
        console.log('Columns:', columns.map(c => c.Field).join(', '));
      } catch (error) {
        console.log('Does NOT exist ✗');
      }
    }

    await connection.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkInventoryTables();
