from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import psycopg2
from psycopg2.extras import RealDictCursor

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# read database connection from env or hardcode
DB_PARAMS = {
    'host': os.environ.get('DB_HOST', 'localhost'),
    'port': os.environ.get('DB_PORT', '5432'),
    'dbname': os.environ.get('DB_NAME', 'postgres'),
    'user': os.environ.get('DB_USER', 'postgres'),
    'password': os.environ.get('DB_PASSWORD', 'umezu'),
}


def get_conn():
    return psycopg2.connect(**DB_PARAMS)


@app.route('/')
def health():
    return 'API running (Flask)'


@app.route('/products', methods=['GET'])
def get_products():
    try:
        conn = get_conn()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute('SELECT code, name, kingaku AS price FROM s_master ORDER BY code')
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify(rows)
    except Exception as e:
        print('db error', e)
        return jsonify({'error': 'database error'}), 500


@app.route('/products', methods=['POST'])
def create_product():
    data = request.get_json()
    code = data.get('code')
    name = data.get('name')
    price = data.get('price')
    if not code or not name or price is None:
        return jsonify({'error': 'code/name/price required'}), 400
    try:
        conn = get_conn()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            'INSERT INTO s_master(code, name, kingaku) VALUES(%s, %s, %s) RETURNING code, name, kingaku AS price',
            (code, name, price)
        )
        new = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        return jsonify(new), 201
    except Exception as e:
        print('db error', e)
        return jsonify({'error': 'database error'}), 500


@app.route('/products/<code>', methods=['GET'])
def get_product_by_code(code):
    if not code:
        return jsonify({'error': 'code required'}), 400
    try:
        conn = get_conn()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            'SELECT code, name, kingaku AS price FROM s_master WHERE code = %s',
            (code,)
        )
        row = cur.fetchone()
        cur.close()
        conn.close()
        if not row:
            return jsonify({'error': 'not found'}), 404
        return jsonify(row), 200
    except Exception as e:
        print('db error', e)
        return jsonify({'error': 'database error'}), 500


@app.route('/products/<code>', methods=['PUT'])
def update_product(code):
    if not code:
        return jsonify({'error': 'code required'}), 400
    data = request.get_json()
    name = data.get('name')
    price = data.get('price')
    if not name or price is None:
        return jsonify({'error': 'name/price required'}), 400
    try:
        conn = get_conn()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            'UPDATE s_master SET name = %s, kingaku = %s WHERE code = %s RETURNING code, name, kingaku AS price',
            (name, price, code)
        )
        updated = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        if not updated:
            return jsonify({'error': 'not found'}), 404
        return jsonify(updated), 200
    except Exception as e:
        print('db error', e)
        return jsonify({'error': 'database error'}), 500


@app.route('/products/<code>', methods=['DELETE'])
def delete_product(code):
    if not code:
        return jsonify({'error': 'code required'}), 400
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute('DELETE FROM s_master WHERE code = %s', (code,))
        deleted_count = cur.rowcount
        conn.commit()
        cur.close()
        conn.close()
        if deleted_count == 0:
            return jsonify({'error': 'not found'}), 404
        return jsonify({'message': 'deleted', 'code': code}), 200
    except Exception as e:
        print('db error', e)
        return jsonify({'error': 'database error'}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 3000)))
