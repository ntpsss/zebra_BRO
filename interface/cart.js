const api = window.ZebraApi;
const content = document.querySelector('#cart-page-content');
const authLink = document.querySelector('#cart-auth-link');
let products = [];
let productsPromise = null;
let actionError = '';
const removedItems = new Map();
const removalTimeouts = new Map();

const escapeHTML = (value) => String(value ?? '').replace(
  /[&<>"']/g,
  (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]
);

const formatPrice = (price) =>
  `${Number(price).toLocaleString('ru-RU')} ₽`;

const loadProducts = () => {
  if (!productsPromise) {
    productsPromise = api.request('/products')
      .then((result) => {
        if (!Array.isArray(result)) {
          throw new Error('Сервер вернул некорректный список товаров.');
        }
        products = result;
        return products;
      })
      .catch((error) => {
        productsPromise = null;
        throw error;
      });
  }
  return productsPromise;
};

const productForItem = (item) =>
  products.find((product) => String(product.id) === String(item.productId));

const itemNeedsCatalog = (item) =>
  !item.name || item.price === null || item.price === undefined;

const renderUndoNotice = () =>
  Array.from(removedItems.entries())
    .map(([productId, item]) => `
      <div class="cart-undo" role="status" aria-live="polite">
        <span>${escapeHTML(item.name)} удалён из корзины.</span>
        <button data-restore="${escapeHTML(productId)}" type="button">Вернуть</button>
      </div>
    `)
    .join('');

const render = (state = api.getState()) => {
  content.setAttribute('aria-busy', String(
    state.authStatus === 'checking' ||
    state.cartStatus === 'loading'
  ));

  if (authLink) {
    authLink.toggleAttribute(
      'aria-disabled',
      state.authStatus === 'checking' || state.authStatus === 'unknown'
    );
    authLink.textContent = state.authStatus === 'authenticated'
      ? `${state.user.email} · Выйти`
      : state.authStatus === 'error'
        ? 'Повторить проверку'
        : 'Войти';
    authLink.href = state.authStatus === 'authenticated'
      ? '#logout'
      : './index.html?auth=login';
    authLink.setAttribute('aria-label', state.authStatus === 'authenticated'
      ? `Выйти из аккаунта ${state.user.email}`
      : state.authStatus === 'error'
        ? 'Повторить проверку авторизации'
        : 'Войти');
  }

  if (state.authStatus === 'checking' || state.authStatus === 'unknown') {
    content.innerHTML = '<p class="products-status">Проверяем авторизацию...</p>';
    return;
  }
  if (state.authStatus === 'error') {
    content.innerHTML = `
      <div class="empty-cart" role="alert">
        <h2>Не удалось проверить авторизацию</h2>
        <p>${escapeHTML(state.authError)}</p>
        <button class="catalog-button" type="button" data-retry-auth>Попробовать ещё раз</button>
      </div>
    `;
    return;
  }
  if (state.authStatus !== 'authenticated') {
    content.innerHTML = `
      <div class="empty-cart">
        <h2>Войдите, чтобы открыть корзину</h2>
        <p>Корзина хранится в аккаунте и будет доступна после входа.</p>
        <a class="catalog-button" href="./index.html?auth=login">Войти</a>
        ${state.authError ? `<p role="status">${escapeHTML(state.authError)}</p>` : ''}
      </div>
    `;
    return;
  }
  if (state.cartStatus === 'loading' || state.cartStatus === 'idle') {
    content.innerHTML = '<p class="products-status">Загружаем корзину...</p>';
    return;
  }
  if (state.cartStatus === 'error') {
    content.innerHTML = `
      <div class="empty-cart" role="alert">
        <h2>Не удалось загрузить корзину</h2>
        <p>${escapeHTML(state.cartError)}</p>
        <button class="catalog-button" type="button" data-retry-cart>Попробовать ещё раз</button>
      </div>
    `;
    return;
  }

  const items = state.cart.items;
  const needsCatalog = items.some(itemNeedsCatalog);
  if (needsCatalog && !products.length) {
    content.innerHTML = '<p class="products-status">Загружаем данные товаров...</p>';
    void loadProducts().then(() => render()).catch((error) => {
      content.innerHTML = `
        <div class="empty-cart" role="alert">
          <h2>Не удалось загрузить данные товаров</h2>
          <p>${escapeHTML(error.message)}</p>
          <button class="catalog-button" type="button" data-retry-cart>Попробовать ещё раз</button>
        </div>
      `;
    });
    return;
  }

  const resolvedItems = items.map((item) => {
    const product = productForItem(item);
    return {
      ...item,
      name: item.name || product?.name,
      price: item.price ?? (product ? Number(product.price) : null),
      image: item.image || product?.image || product?.imageUrl ||
        product?.image_url || '../images/fallback.png'
    };
  });
  const totalPrice = Number.isFinite(state.cart.totalPrice)
    ? state.cart.totalPrice
    : resolvedItems.reduce((total, item) => total + item.price * item.quantity, 0);

  if (resolvedItems.some((item) => !item.name || !Number.isFinite(item.price))) {
    content.innerHTML = `
      <div class="empty-cart" role="alert">
        <h2>Не удалось отобразить товары корзины</h2>
        <p>Для одной или нескольких позиций нет данных в серверной корзине или каталоге.</p>
        <button class="catalog-button" type="button" data-retry-cart>Обновить корзину</button>
      </div>
    `;
    return;
  }

  if (!resolvedItems.length) {
    content.innerHTML = `
      ${renderUndoNotice()}
      <div class="empty-cart">
        <h2>Корзина пока пуста</h2>
        <p>Добавьте понравившиеся товары, и они появятся здесь.</p>
        <a class="catalog-button" href="./index.html#hits">Перейти к товарам</a>
      </div>
    `;
    return;
  }

  const rows = resolvedItems.map((item) => {
    const productId = String(item.productId);
    const disabled = api.isMutating(item.productId) ? 'disabled' : '';
    return `
      <article class="cart-item" data-cart-item="${escapeHTML(productId)}">
        <div class="cart-item-image">
          <img
            src="${escapeHTML(item.image)}"
            alt="${escapeHTML(item.name)}"
            onerror="this.onerror=null; this.src='../images/fallback.png'"
          >
        </div>
        <div>
          <h2 class="cart-item-title">${escapeHTML(item.name)}</h2>
          <div class="cart-item-price">${formatPrice(item.price)}</div>
        </div>
        <div class="cart-item-actions">
          <div class="cart-quantity">
            <button data-minus="${escapeHTML(productId)}" type="button" aria-label="Уменьшить количество" ${disabled}>−</button>
            <span>${item.quantity}</span>
            <button data-plus="${escapeHTML(productId)}" type="button" aria-label="Увеличить количество" ${disabled}>+</button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  content.innerHTML = `
    ${actionError ? `<p class="products-status" role="alert">${escapeHTML(actionError)}</p>` : ''}
    <div class="cart-layout">
      <div class="cart-items">${rows}</div>
      <aside class="cart-summary">
        <h2>Ваш заказ</h2>
        <div class="summary-row">
          <span>Товары</span>
          <span>${state.cart.totalQuantity} шт.</span>
        </div>
        <div class="summary-row">
          <span>Доставка</span>
          <span>Рассчитаем позже</span>
        </div>
        <div class="summary-total">
          <span>Итого</span>
          <span>${formatPrice(totalPrice)}</span>
        </div>
        <button class="checkout-button" id="checkout" type="button">
          Перейти к оформлению
        </button>
      </aside>
    </div>
    ${renderUndoNotice()}
  `;
};

const reportMutationError = (error) => {
  if (error.type !== 'unauthorized') {
    actionError = error.message;
    render();
  }
};

content.addEventListener('click', async (event) => {
  if (event.target.closest('[data-retry-auth]')) {
    void api.checkAuth();
    return;
  }
  if (event.target.closest('[data-retry-cart]')) {
    actionError = '';
    try {
      await api.refreshCart();
    } catch {
      // The API state contains the retryable error shown by render().
    }
    if (!api.getState().cartError) {
      productsPromise = null;
      render();
    }
    return;
  }
  if (event.target.closest('#checkout')) {
    window.alert('Оформление заказа будет доступно после подключения соответствующего серверного API.');
    return;
  }

  const plus = event.target.closest('[data-plus]');
  const minus = event.target.closest('[data-minus]');
  const restore = event.target.closest('[data-restore]');

  try {
    if (plus || minus) {
      const productId = (plus || minus).dataset[plus ? 'plus' : 'minus'];
      const item = api.getState().cart.items.find(
        (cartItem) => String(cartItem.productId) === productId
      );
      if (!item) {
        return;
      }
      const quantity = item.quantity + (plus ? 1 : -1);
      await api.setCartItemQuantity(item.productId, Math.max(0, quantity));
      actionError = '';
      if (quantity <= 0) {
        removedItems.set(productId, item);
        window.clearTimeout(removalTimeouts.get(productId));
        removalTimeouts.set(productId, window.setTimeout(() => {
          removedItems.delete(productId);
          removalTimeouts.delete(productId);
          render();
        }, 5000));
      }
      render();
      return;
    }

    if (restore) {
      const productId = restore.dataset.restore;
      const item = removedItems.get(productId);
      if (!item) {
        return;
      }
      await api.addCartItem(item.productId, item.quantity);
      window.clearTimeout(removalTimeouts.get(productId));
      removalTimeouts.delete(productId);
      removedItems.delete(productId);
      actionError = '';
      render();
    }
  } catch (error) {
    reportMutationError(error);
  }
});

authLink?.addEventListener('click', async (event) => {
  const state = api.getState();
  if (state.authStatus === 'checking' || state.authStatus === 'unknown') {
    event.preventDefault();
  } else if (state.authStatus === 'authenticated') {
    event.preventDefault();
    try {
      await api.logout();
    } catch (error) {
      window.alert(error.message);
    }
  } else if (state.authStatus === 'error') {
    event.preventDefault();
    void api.checkAuth();
  }
});

api.subscribe((state) => {
  actionError = state.authStatus === 'unauthenticated' ? '' : actionError;
  render(state);
});
void api.checkAuth();
