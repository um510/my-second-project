-- 注文登録画面で使用する注文データ保存テーブルを作成する。
CREATE TABLE IF NOT EXISTS s_order (
    purchase_date DATE NOT NULL,
    purchase_time TIME NOT NULL,
    code VARCHAR(10) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity >= 0)
);
