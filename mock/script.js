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
  const API_BASE = window.API_BASE_URL || 'https://product-master-api.onrender.com';
  const productTable = document.querySelector('.product-table tbody');
  const codeInput = document.getElementById('code');
  const nameInput = document.getElementById('name');
  const priceInput = document.getElementById('price');
  const createBtn = document.getElementById('create');
  const updateBtn = document.getElementById('update');
  const deleteBtn = document.getElementById('delete');
  const closeBtn = document.getElementById('close');
  const existingCodes = new Set();

  // OS/ブラウザごとの差を吸収するため、スクロールバー幅を実測してCSS変数に反映する。
  function applyScrollbarWidth() {
    const probe = document.createElement('div');
    probe.style.position = 'absolute';
    probe.style.top = '-9999px';
    probe.style.width = '100px';
    probe.style.height = '100px';
    probe.style.overflow = 'scroll';
    document.body.appendChild(probe);
    const scrollbarWidth = probe.offsetWidth - probe.clientWidth;
    document.body.removeChild(probe);
    document.documentElement.style.setProperty('--product-scrollbar-width', `${scrollbarWidth}px`);
  }

  function syncProductTableScrollLayout() {
    // 1px誤差を吸収して、実際に縦スクロールが必要な時だけ補正を有効化する。
    const hasScroll = productTable.scrollHeight > productTable.clientHeight + 1;
    productTable.classList.toggle('has-scroll', hasScroll);
  }

  function resetInputs() {
    codeInput.value = '';
    nameInput.value = '';
    priceInput.value = '';
  }

  function showOnlyClose() {
    createBtn.disabled = true;
    updateBtn.disabled = true;
    deleteBtn.disabled = true;
    closeBtn.disabled = false;
  }

  function showExistingMode() {
    createBtn.disabled = true;
    updateBtn.disabled = false;
    deleteBtn.disabled = false;
    closeBtn.disabled = false;
  }

  function showNewMode() {
    createBtn.disabled = false;
    updateBtn.disabled = true;
    deleteBtn.disabled = true;
    closeBtn.disabled = false;
  }

  function refreshButtonStateByCode() {
    const code = codeInput.value.trim();
    if (!code) {
      showOnlyClose();
      return;
    }
    if (existingCodes.has(code)) {
      showExistingMode();
      return;
    }
    showNewMode();
  }

  async function fetchProductByCode(code) {
    // 優先: 1件取得API
    const singleResp = await fetch(`${API_BASE}/products/${encodeURIComponent(code)}`);
    if (singleResp.ok) {
      return await singleResp.json();
    }
    if (singleResp.status !== 404) {
      throw new Error(`HTTP ${singleResp.status}`);
    }

    // 互換: 注文画面向け1件取得API
    const orderCodeResp = await fetch(`${API_BASE}/order-codes/${encodeURIComponent(code)}`);
    if (orderCodeResp.ok) {
      return await orderCodeResp.json();
    }
    if (orderCodeResp.status !== 404) {
      throw new Error(`HTTP ${orderCodeResp.status}`);
    }

    // 最終手段: 一覧から一致コードを抽出
    const listResp = await fetch(`${API_BASE}/products`);
    if (!listResp.ok) {
      throw new Error(`HTTP ${listResp.status}`);
    }
    const list = await listResp.json();
    return list.find((item) => String(item.code) === code) || null;
  }

  async function fillByCodeFromDb() {
    const code = codeInput.value.trim();
    if (!code) {
      nameInput.value = '';
      priceInput.value = '';
      showOnlyClose();
      return;
    }

    try {
      const item = await fetchProductByCode(code);
      if (!item) {
        // 存在しない場合は名称・金額を初期化
        nameInput.value = '';
        priceInput.value = '';
        existingCodes.delete(code);
        showNewMode();
        return;
      }

      nameInput.value = item.name ?? '';
      priceInput.value = item.price ?? '';
      existingCodes.add(String(item.code));
      showExistingMode();
    } catch (err) {
      console.error('コード検索失敗', err);
      // 通信失敗時でも、現時点のコード一致判定でボタン状態を維持する。
      refreshButtonStateByCode();
    }
  }

  applyScrollbarWidth();
  syncProductTableScrollLayout();
  showOnlyClose();
  window.addEventListener('resize', () => {
    applyScrollbarWidth();
    syncProductTableScrollLayout();
  });

  // コード入力：数字のみ
  codeInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
    // 入力中でも一致/不一致を即時反映してボタン状態を切り替える。
    refreshButtonStateByCode();

    if (!e.target.value.trim()) {
      nameInput.value = '';
      priceInput.value = '';
    }
  });
  // コード欄からフォーカスが外れたタイミングで存在判定する
  codeInput.addEventListener('blur', fillByCodeFromDb);

  // テーブル行クリックでフォームにセット
  function bindRowClick(row) {
    row.addEventListener('click', () => {
      const cells = row.querySelectorAll('td');
      codeInput.value = cells[0].textContent.trim();
      nameInput.value = cells[1].textContent.trim();
      priceInput.value = cells[2].textContent.trim();
      showExistingMode();
    });
  }

  // サーバから一覧を取得してテーブルに書き出す
  async function loadProducts() {
    try {
      const resp = await fetch(`${API_BASE}/products`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const list = await resp.json();
      productTable.innerHTML = ''; // 既存行をクリア
      existingCodes.clear();
      list.forEach(item => {
        existingCodes.add(String(item.code));
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="code">${item.code}</td><td class="name">${item.name}</td><td class="price">${item.price}</td>`;
        bindRowClick(tr);
        productTable.appendChild(tr);
      });
      syncProductTableScrollLayout();
      // 一覧再表示後は入力欄とボタン状態を初期化する。
      resetInputs();
      showOnlyClose();
    } catch (err) {
      console.error('ロード失敗', err);
      alert('データの読み込みに失敗しました。サーバーが起動しているか確認してください。');
    }
  }

  // 初期ロード
  loadProducts();

  // ボタン操作（モックから実サーバ連携へ変更）
  createBtn.addEventListener('click', async () => {
    // 入力チェック
    const code = codeInput.value.trim();
    const name = nameInput.value.trim();
    const price = parseInt(priceInput.value, 10);

    if (!code || !name || isNaN(price)) {
      alert('すべての項目を正しく入力してください');
      return;
    }

    try {
      const resp = await fetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name, price })
      });
      if (!resp.ok) throw new Error(await resp.text());
      await resp.json();
      // 作成後は一覧を再取得し、コード昇順の表示をサーバ結果に合わせる。
      await loadProducts();

      alert('登録が完了しました');
    } catch (err) {
      console.error(err);
      alert('登録に失敗しました');
    }
  });
  
  updateBtn.addEventListener('click', async () => {
    const code = codeInput.value.trim();
    const name = nameInput.value.trim();
    const price = parseInt(priceInput.value, 10);

    if (!code) {
      alert('更新するコードを入力してください');
      return;
    }
    if (!name || isNaN(price)) {
      alert('名称と金額を正しく入力してください');
      return;
    }

    try {
      const resp = await fetch(`${API_BASE}/products/${code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, price })
      });
      if (!resp.ok) {
        if (resp.status === 404) {
          alert('指定されたコードは存在しません');
        } else {
          throw new Error(await resp.text());
        }
        return;
      }
      await resp.json();
      // 更新後も一覧を再取得して表示を最新化する。
      await loadProducts();

      alert('更新が完了しました');
    } catch (err) {
      console.error(err);
      alert('更新に失敗しました');
    }
  });
  
  deleteBtn.addEventListener('click', async () => {
    const code = codeInput.value.trim();
    if (!code) {
      alert('削除するコードを入力してください');
      return;
    }

    if (!confirm(`コード「${code}」を本当に削除しますか？`)) {
      return;
    }

    try {
      const resp = await fetch(`${API_BASE}/products/${code}`, {
        method: 'DELETE'
      });
      if (!resp.ok) {
        if (resp.status === 404) {
          alert('指定されたコードは存在しません');
        } else {
          throw new Error(await resp.text());
        }
        return;
      }
      // 削除後も一覧を再取得して表示整合を保つ。
      await loadProducts();

      alert('削除が完了しました');
    } catch (err) {
      console.error(err);
      alert('削除に失敗しました');
    }
  });
  
  closeBtn.addEventListener('click', () => {
    window.location.href = '../index.html';
  });
});

