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
  const API_BASE = window.API_BASE_URL || 'http://localhost:3000';
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

  async function fillByCodeFromDb() {
    const code = codeInput.value.trim();
    if (!code) {
      nameInput.value = '';
      priceInput.value = '';
      showOnlyClose();
      return;
    }

    try {
      const resp = await fetch(`${API_BASE}/products/${code}`);
      if (resp.status === 404) {
        // 存在しない場合は名称・金額を初期化
        nameInput.value = '';
        priceInput.value = '';
        existingCodes.delete(code);
        showNewMode();
        return;
      }
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const item = await resp.json();
      nameInput.value = item.name ?? '';
      priceInput.value = item.price ?? '';
      existingCodes.add(String(item.code));
      showExistingMode();
    } catch (err) {
      console.error('コード検索失敗', err);
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
      const created = await resp.json();

      // テーブルに追加
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="code">${created.code}</td><td class="name">${created.name}</td><td class="price">${created.price}</td>`;
      bindRowClick(tr);
      productTable.appendChild(tr);
      existingCodes.add(String(created.code));
      syncProductTableScrollLayout();

      alert('登録が完了しました');
      resetInputs();
      showOnlyClose();
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
      const updated = await resp.json();

      // テーブルの該当行を更新
      const rows = productTable.querySelectorAll('tr');
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells[0].textContent.trim() === code) {
          cells[1].textContent = updated.name;
          cells[2].textContent = updated.price;
        }
      });

      alert('更新が完了しました');
      resetInputs();
      showOnlyClose();
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

      // テーブルから該当行を削除
      const rows = productTable.querySelectorAll('tr');
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells[0].textContent.trim() === code) {
          row.remove();
        }
      });
      existingCodes.delete(code);
      syncProductTableScrollLayout();

      alert('削除が完了しました');
      resetInputs();
      showOnlyClose();
    } catch (err) {
      console.error(err);
      alert('削除に失敗しました');
    }
  });
  
  closeBtn.addEventListener('click', () => {
    // 開かれ方によって window.close が無効な場合があるため、メニューへ戻るフォールバックを用意する。
    window.close();
    setTimeout(() => {
      if (!window.closed) {
        window.location.href = '../index.html';
      }
    }, 100);
  });
});

