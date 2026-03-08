// quick connection test using pg
const { Pool } = require('pg');

(async () => {
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'umezu',
  });

  try {
    const res = await pool.query('SELECT 1');
    console.log('Connection successful', res.rows);
  } catch (err) {
    console.error('Connection failed', err);
  } finally {
    await pool.end();
  }
})();
