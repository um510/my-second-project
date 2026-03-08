// Simple Express server with PostgreSQL integration
// Run with: node server.js (after installing dependencies)

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

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

// other endpoints (update/delete) could be added similarly

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
