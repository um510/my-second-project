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


@app.route('/order-codes/<code>', methods=['GET'])
def get_order_code_by_code(code):
    if not code:
        return jsonify({'error': 'code required'}), 400
    try:
        conn = get_conn()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # 注文登録画面は s_master を参照して名称と金額を取得する。
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


@app.route('/orders', methods=['GET'])
def get_orders():
    try:
        conn = get_conn()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # 注文一覧表示時にテーブル未作成でも空一覧で返せるよう初回作成を行う。
        cur.execute(
            '''
            CREATE TABLE IF NOT EXISTS s_order (
                purchase_date DATE NOT NULL,
                purchase_time TIME NOT NULL,
                code VARCHAR(10) NOT NULL,
                quantity INTEGER NOT NULL CHECK (quantity >= 0)
            )
            '''
        )
        cur.execute(
            '''
            SELECT
              to_char(o.purchase_date, 'YYYY/MM/DD') AS purchase_date,
              to_char(o.purchase_time, 'HH24:MI') AS purchase_time,
              o.code,
              COALESCE(c.name, '') AS name,
              COALESCE(c.kingaku, 0) AS price,
              o.quantity,
              COALESCE(c.kingaku, 0) * o.quantity AS total_amount
            FROM s_order o
            LEFT JOIN s_master c ON c.code = o.code
            ORDER BY o.purchase_date ASC, o.purchase_time ASC, o.code ASC
            '''
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify(rows), 200
    except Exception as e:
        print('db error', e)
        return jsonify({'error': 'database error'}), 500


@app.route('/orders/search', methods=['GET'])
def get_order_by_datetime():
    purchase_date = request.args.get('purchase_date')
    purchase_time = request.args.get('purchase_time')

    if not purchase_date or not purchase_time:
        return jsonify({'error': 'purchase_date/purchase_time required'}), 400

    try:
        normalized_date = str(purchase_date).replace('/', '-')

        conn = get_conn()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # 注文検索時にテーブル未作成でも空判定できるよう初回作成を行う。
        cur.execute(
            '''
            CREATE TABLE IF NOT EXISTS s_order (
                purchase_date DATE NOT NULL,
                purchase_time TIME NOT NULL,
                code VARCHAR(10) NOT NULL,
                quantity INTEGER NOT NULL CHECK (quantity >= 0)
            )
            '''
        )
        cur.execute(
            '''
            SELECT
              to_char(o.purchase_date, 'YYYY/MM/DD') AS purchase_date,
              to_char(o.purchase_time, 'HH24:MI') AS purchase_time,
              o.code,
              COALESCE(c.name, '') AS name,
              COALESCE(c.kingaku, 0) AS price,
              o.quantity,
              COALESCE(c.kingaku, 0) * o.quantity AS total_amount
            FROM s_order o
            LEFT JOIN s_master c ON c.code = o.code
            WHERE o.purchase_date = %s
              AND to_char(o.purchase_time, 'HH24:MI') = %s
            ORDER BY o.code
            LIMIT 1
            ''',
            (normalized_date, purchase_time)
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


@app.route('/orders', methods=['POST'])
def create_order():
    data = request.get_json() or {}
    purchase_date = data.get('purchase_date')
    purchase_time = data.get('purchase_time')
    code = data.get('code')
    quantity = data.get('quantity')

    if not purchase_date or not purchase_time or not code or quantity is None:
        return jsonify({'error': 'purchase_date/purchase_time/code/quantity required'}), 400

    try:
        # フロント入力 yyyy/mm/dd をDB投入向け yyyy-mm-dd へ正規化する。
        normalized_date = str(purchase_date).replace('/', '-')
        normalized_time = str(purchase_time)
        normalized_quantity = int(quantity)

        conn = get_conn()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # 注文登録時にテーブル未作成でも動作できるよう初回作成を行う。
        cur.execute(
            '''
            CREATE TABLE IF NOT EXISTS s_order (
                purchase_date DATE NOT NULL,
                purchase_time TIME NOT NULL,
                code VARCHAR(10) NOT NULL,
                quantity INTEGER NOT NULL CHECK (quantity >= 0)
            )
            '''
        )
        cur.execute(
            '''
            INSERT INTO s_order(purchase_date, purchase_time, code, quantity)
            VALUES(%s, %s, %s, %s)
            RETURNING
              purchase_date::text AS purchase_date,
              to_char(purchase_time, 'HH24:MI') AS purchase_time,
              code,
              quantity
            ''',
            (normalized_date, normalized_time, code, normalized_quantity)
        )
        created = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        return jsonify(created), 201
    except Exception as e:
        print('db error', e)
        return jsonify({'error': 'database error'}), 500


@app.route('/orders', methods=['DELETE'])
def delete_order():
    data = request.get_json() or {}
    purchase_date = data.get('purchase_date')
    purchase_time = data.get('purchase_time')
    code = data.get('code')

    if not purchase_date or not purchase_time or not code:
        return jsonify({'error': 'purchase_date/purchase_time/code required'}), 400

    try:
        normalized_date = str(purchase_date).replace('/', '-')

        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            '''
            DELETE FROM s_order
            WHERE purchase_date = %s
              AND to_char(purchase_time, 'HH24:MI') = %s
              AND code = %s
            ''',
            (normalized_date, str(purchase_time), str(code))
        )
        deleted_count = cur.rowcount
        conn.commit()
        cur.close()
        conn.close()

        if deleted_count == 0:
            return jsonify({'error': 'not found'}), 404

        return jsonify({'message': 'deleted', 'deleted_count': deleted_count}), 200
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
