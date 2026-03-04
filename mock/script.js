/**
 * 商品管理フォームの初期化と操作処理
 * 
 * DOMContentLoaded イベント時に以下の機能を設定します：
 * - コード入力フィールドの入力値を数字のみに制限
 * - テーブル行クリック時にフォーム入力欄に選択行の値を自動セット
 * - 作成・更新・削除・終了ボタンのクリックイベント処理（モック実装）
 * 
 * @function
 * @returns {void}
 */
document.addEventListener('DOMContentLoaded', () => {
  const productTable = document.querySelector('.product-table tbody');
  const codeInput = document.getElementById('code');
  const nameInput = document.getElementById('name');
  const priceInput = document.getElementById('price');

  // コード入力：数字のみ
  codeInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
  });

  // テーブル行クリックでフォームにセット
  productTable.querySelectorAll('tr').forEach(row => {
    row.addEventListener('click', () => {
      const cells = row.querySelectorAll('td');
      codeInput.value = cells[0].textContent.trim();
      nameInput.value = cells[1].textContent.trim();
      priceInput.value = cells[2].textContent.trim();
    });
  });

  // ボタン操作（モック）
  document.getElementById('create').addEventListener('click', () => {
    alert('作成（モック）');
  });
  
  document.getElementById('update').addEventListener('click', () => {
    alert('更新（モック）');
  });
  
  document.getElementById('delete').addEventListener('click', () => {
    if (confirm('本当に削除しますか？')) {
      alert('削除（モック）');
    }
  });
  
  document.getElementById('close').addEventListener('click', () => {
    alert('終了（モック）');
  });
});

