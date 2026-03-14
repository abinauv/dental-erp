const mysql = require('mysql2/promise');

async function checkDatabase() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '',
      database: 'dental_erp'
    });

    console.log('Checking existing tables...');
    const [tables] = await connection.query('SHOW TABLES');
    console.log('Existing tables:');
    tables.forEach(row => console.log(' -', Object.values(row)[0]));

    console.log('\nChecking users table structure...');
    try {
      const [userColumns] = await connection.query('DESCRIBE users');
      console.log('Users table exists with columns:');
      userColumns.forEach(col => console.log(` - ${col.Field} (${col.Type})`));
    } catch (error) {
      console.log('Users table does NOT exist!');
    }

    await connection.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkDatabase();
