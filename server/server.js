// Simple Express server with PostgreSQL integration
// Run with: node server.js (after installing dependencies)

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const app = express();
const port = process.env.PORT || 3000;

// middleware
app.use(cors());
app.use(express.json());

// create a connection pool using environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// simple health check
app.get('/', (req, res) => {
  res.send('API is running');
});

// GET /products - return all rows from s_master
app.get('/products', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT code, name, kingaku AS price FROM s_master ORDER BY code'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'database error' });
  }
});

// POST /products - insert new product into s_master
app.post('/products', async (req, res) => {
  const { code, name, price } = req.body;
  if (!code || !name || price == null) {
    return res.status(400).json({ error: 'code/name/price required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO s_master(code, name, kingaku) VALUES($1, $2, $3) RETURNING code, name, kingaku AS price',
      [code, name, price]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'database error' });
  }
});

// GET /order-codes/:code - return one row from s_master for order entry
app.get('/order-codes/:code', async (req, res) => {
  const { code } = req.params;
  if (!code) {
    return res.status(400).json({ error: 'code required' });
  }

  try {
    const result = await pool.query(
      'SELECT code, name, kingaku AS price FROM s_master WHERE code = $1',
      [code]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'database error' });
  }
});

// GET /orders - return order rows with joined display fields
app.get('/orders', async (req, res) => {
  try {
    // 注文一覧表示時にテーブル未作成でも空一覧で返せるよう初回作成を行う。
    await pool.query(
      `CREATE TABLE IF NOT EXISTS s_order (
         purchase_date DATE NOT NULL,
         purchase_time TIME NOT NULL,
         code VARCHAR(10) NOT NULL,
         quantity INTEGER NOT NULL CHECK (quantity >= 0)
       )`
    );

    const result = await pool.query(
      `SELECT
         to_char(o.purchase_date, 'YYYY/MM/DD') AS purchase_date,
         to_char(o.purchase_time, 'HH24:MI') AS purchase_time,
         o.code,
         COALESCE(c.name, '') AS name,
         COALESCE(c.kingaku, 0) AS price,
         o.quantity,
         COALESCE(c.kingaku, 0) * o.quantity AS total_amount
       FROM s_order o
       LEFT JOIN s_master c ON c.code = o.code
       ORDER BY o.purchase_date ASC, o.purchase_time ASC, o.code ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'database error' });
  }
});

// GET /orders/search - return one order row by purchase date/time
app.get('/orders/search', async (req, res) => {
  const { purchase_date, purchase_time } = req.query;
  if (!purchase_date || !purchase_time) {
    return res.status(400).json({ error: 'purchase_date/purchase_time required' });
  }

  try {
    const normalizedDate = String(purchase_date).replace(/\//g, '-');
    // 注文検索時にテーブル未作成でも空判定できるよう初回作成を行う。
    await pool.query(
      `CREATE TABLE IF NOT EXISTS s_order (
         purchase_date DATE NOT NULL,
         purchase_time TIME NOT NULL,
         code VARCHAR(10) NOT NULL,
         quantity INTEGER NOT NULL CHECK (quantity >= 0)
       )`
    );

    const result = await pool.query(
      `SELECT
         to_char(o.purchase_date, 'YYYY/MM/DD') AS purchase_date,
         to_char(o.purchase_time, 'HH24:MI') AS purchase_time,
         o.code,
         COALESCE(c.name, '') AS name,
         COALESCE(c.kingaku, 0) AS price,
         o.quantity,
         COALESCE(c.kingaku, 0) * o.quantity AS total_amount
       FROM s_order o
       LEFT JOIN s_master c ON c.code = o.code
       WHERE o.purchase_date = $1
         AND to_char(o.purchase_time, 'HH24:MI') = $2
       ORDER BY o.code
       LIMIT 1`,
      [normalizedDate, purchase_time]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'database error' });
  }
});

// POST /orders - insert one row into s_order
app.post('/orders', async (req, res) => {
  const { purchase_date, purchase_time, code, quantity } = req.body;
  if (!purchase_date || !purchase_time || !code || quantity == null) {
    return res.status(400).json({ error: 'purchase_date/purchase_time/code/quantity required' });
  }

  try {
    const normalizedDate = String(purchase_date).replace(/\//g, '-');
    // 注文登録時にテーブル未作成でも動作できるよう初回作成を行う。
    await pool.query(
      `CREATE TABLE IF NOT EXISTS s_order (
         purchase_date DATE NOT NULL,
         purchase_time TIME NOT NULL,
         code VARCHAR(10) NOT NULL,
         quantity INTEGER NOT NULL CHECK (quantity >= 0)
       )`
    );
    const result = await pool.query(
      `INSERT INTO s_order(purchase_date, purchase_time, code, quantity)
       VALUES($1, $2, $3, $4)
       RETURNING purchase_date::text AS purchase_date,
                 to_char(purchase_time, 'HH24:MI') AS purchase_time,
                 code,
                 quantity`,
      [normalizedDate, purchase_time, code, Number(quantity)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'database error' });
  }
});

// DELETE /orders - delete one row from s_order by date/time/code
app.delete('/orders', async (req, res) => {
  const { purchase_date, purchase_time, code } = req.body || {};
  if (!purchase_date || !purchase_time || !code) {
    return res.status(400).json({ error: 'purchase_date/purchase_time/code required' });
  }

  try {
    const normalizedDate = String(purchase_date).replace(/\//g, '-');
    const result = await pool.query(
      `DELETE FROM s_order
       WHERE purchase_date = $1
         AND to_char(purchase_time, 'HH24:MI') = $2
         AND code = $3`,
      [normalizedDate, String(purchase_time), String(code)]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'not found' });
    }

    res.json({ message: 'deleted', deleted_count: result.rowCount });
  } catch (err) {
    console.error('DB error', err);
    res.status(500).json({ error: 'database error' });
  }
});

// other endpoints (update/delete) could be added similarly

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
