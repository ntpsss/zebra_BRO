const API_URL = 'https://server-zebrabro.onrender.com/api';
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp'
]);
let products = [];
let categories = [];
let client;
const imagePreviewUrls = new WeakMap();

function escapeHTML(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]
  );
}


async function readResponse(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 240) };
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, options);
  const result = await readResponse(response);

  if (!response.ok) {
    const detail = typeof result?.message === 'string'
      ? result.message
      : typeof result?.error === 'string'
        ? result.error
        : `Сервер вернул ошибку ${response.status}.`;
    throw new Error(detail);
  }

  return result;
}
async function loadProducts() {
  const result = await request('/products');
  if(!Array.isArray(result)){
    throw new Error('Сервер вернул некорректный список товаров.');
  }

  products = result;
}
async function loadCategories() {
  const result = await request('/categories');
  if(!Array.isArray(result)){
    throw new Error('Сервер вернул некорректный список категорий.');
  }
  
  categories = result;
}

const $ = (selector) => {
  return document.querySelector(selector);
};

const $$ = (selector) => {
  return document.querySelectorAll(selector);
};

const formatPrice = (price) => {
  return `${price.toLocaleString('ru-RU')} ₽`;
};

const imagePath = (fileName) => {
  return `../images/${fileName}`;
};

const fallbackImage = imagePath('fallback.png');

/* =========================================================
   ПЕРЕКЛЮЧЕНИЕ ПАНЕЛИ КАТАЛОГА
   ========================================================= */

const catalogButton = $('#catalog-button');
const mobileCatalogButton = $('#mobile-catalog-button');
const catalogPanel = $('#catalog-panel');
const catalogClose = $('#catalog-close');
const catalogIcon = $('[data-catalog-icon]');
const siteHeader = $('.site-header');
const mobileNav = $('.mobile-nav');

const syncCatalogBounds = () => {
  const headerHeight = siteHeader?.getBoundingClientRect().height || 0;
  const mobileNavHeight = mobileNav && getComputedStyle(mobileNav).display !== 'none'
    ? mobileNav.getBoundingClientRect().height
    : 0;

  document.documentElement.style.setProperty('--site-header-height', `${headerHeight}px`);
  document.documentElement.style.setProperty('--catalog-top', `${headerHeight}px`);
  document.documentElement.style.setProperty('--catalog-bottom', `${mobileNavHeight}px`);
};

syncCatalogBounds();
window.addEventListener('resize', syncCatalogBounds);

if ('ResizeObserver' in window) {
  const catalogBoundsObserver = new ResizeObserver(syncCatalogBounds);
  if (siteHeader) {
    catalogBoundsObserver.observe(siteHeader);
  }
  if (mobileNav) {
    catalogBoundsObserver.observe(mobileNav);
  }
}

const setCatalogOpen = (isOpen) => {
  if (!catalogPanel) return;

  catalogPanel.classList.toggle('hidden', !isOpen);
  catalogPanel.setAttribute('aria-hidden', String(!isOpen));
  document.body.classList.toggle('catalog-is-open', isOpen);

  [catalogButton, mobileCatalogButton].forEach((button) => {
    if (button) {
      button.setAttribute('aria-expanded', String(isOpen));
    }
  });

  if (catalogIcon) {
    catalogIcon.setAttribute('href', isOpen ? '#x' : '#grid');
  }

  if (catalogButton) {
    catalogButton.classList.toggle('is-open', isOpen);
  }
};

const toggleCatalog = (event) => {
  event.stopPropagation();
  setCatalogOpen(catalogPanel.classList.contains('hidden'));
};

if (catalogButton && catalogPanel) {
  catalogButton.addEventListener('click', toggleCatalog);
}

if (mobileCatalogButton && catalogPanel) {
  mobileCatalogButton.addEventListener('click', toggleCatalog);
}

if (catalogClose) {
  catalogClose.addEventListener('click', () => setCatalogOpen(false));
}

if (catalogPanel) {
  catalogPanel.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      setCatalogOpen(false);
    }
  });
}

document.addEventListener('click', (event) => {
  if (
    catalogPanel &&
    !catalogPanel.classList.contains('hidden') &&
    !event.target.closest('#catalog-panel, #catalog-button, #mobile-catalog-button')
  ) {
    setCatalogOpen(false);
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    setCatalogOpen(false);
  }
});

/* =========================================================
   ПЕРЕКЛЮЧЕНИЕ КАТЕГОРИЙ В КАТАЛОГЕ
   ========================================================= */

const categorySidebar = $('#catalog-sidebar');
const catalogProducts = $('#catalog-products');
const categoryTitle = $('#catalog-category-title');
const emptyCatalogMessage = $('#catalog-empty');
let selectedCatalogCategory = 'all';
let categoriesLoaded = false;
let productsLoaded = false;
let categoryLoadFailed = false;
let productLoadFailed = false;
const searchResultsPage = $('#search-results');
const initialSearchQuery = searchResultsPage
  ? new URLSearchParams(window.location.search).get('q') ?? ''
  : '';
let productSearchQuery = initialSearchQuery;

const normalizeSearchText = (value) =>
  String(value ?? '')
    .toLocaleLowerCase('ru-RU')
    .replaceAll('ё', 'е')
    .trim();

const matchesProductSearch = (product) => {
  const query = normalizeSearchText(productSearchQuery);
  if (!query) {
    return true;
  }

  const productCategoryId = getProductCategoryId(product);
  const categoryName = categories.find(
    (category) => String(category.id) === String(productCategoryId)
  )?.name;
  const searchableText = normalizeSearchText([
    product.name,
    product.description,
    categoryName,
    product.category?.name,
    typeof product.category === 'string' ? product.category : ''
  ].join(' '));

  return query.split(/\s+/).every((term) => searchableText.includes(term));
};

const getProductCategoryId = (product) =>
  product.categoryId ??
  product.category_id ??
  product.category?.id;

const renderProductDetail = () => {
  const productDetail = $('#product-detail');
  if (!productDetail || !productsLoaded) {
    return;
  }
  productDetail.setAttribute('aria-busy', 'false');

  const productId = new URLSearchParams(window.location.search).get('id');
  const productIndex = products.findIndex(
    (product) => String(product.id) === productId
  );
  const product = products[productIndex];

  if (!product) {
    productDetail.innerHTML = `
      <section class="product-detail-message" role="status">
        <h1>Товар не найден</h1>
        <p>Возможно, товар был удалён или ссылка устарела.</p>
        <a class="catalog-button" href="./index.html#hits">Вернуться к товарам</a>
      </section>
    `;
    return;
  }

  const name = escapeHTML(product.name);
  const image = product.image || product.imageUrl || product.image_url;
  const imageSource = image ? escapeHTML(image) : fallbackImage;
  const price = Number(product.price);
  const oldPrice = Number(product.oldPrice ?? product.old_price);
  const hasDiscount = Number.isFinite(oldPrice) && oldPrice > price;
  const category = product.category?.name ||
    (typeof product.category === 'string' ? product.category : '') ||
    categories.find((item) => String(item.id) === String(getProductCategoryId(product)))?.name ||
    '';
  const description = String(product.description ?? '').trim();
  const stock = product.stock ?? product.quantity;
  const quantity = cartItems.get(productIndex) || 0;

  document.title = `${product.name} — Золотая зебра`;
  productDetail.innerHTML = `
    <a class="product-detail-back" href="./index.html#hits">← Все товары</a>
    <article class="product-detail-card">
      <div class="product-detail-image">
        <img
          src="${imageSource}"
          alt="${name}"
          onerror="this.onerror=null; this.src='${fallbackImage}'"
        >
        ${hasDiscount ? `<span class="discount">-${Math.round((1 - price / oldPrice) * 100)}%</span>` : ''}
      </div>
      <div class="product-detail-info">
        ${category ? `<p class="eyebrow">${escapeHTML(category)}</p>` : ''}
        <h1>${name}</h1>
        ${description
          ? `<p class="product-detail-description">${escapeHTML(description)}</p>`
          : '<p class="product-detail-description">Подробности о товаре можно уточнить у консультанта магазина.</p>'}
        ${stock !== undefined && stock !== null
          ? `<p class="product-detail-stock">Наличие: ${escapeHTML(stock)}</p>`
          : ''}
        <div class="product-detail-price">
          <span class="price">${formatPrice(price)}</span>
          ${hasDiscount ? `<span class="old-price">${formatPrice(oldPrice)}</span>` : ''}
        </div>
        <div class="product-detail-actions">
          <div class="quantity-control" data-quantity-control="${productIndex}" ${quantity > 0 ? '' : 'hidden'}>
            <button class="quantity-button" data-quantity-minus="${productIndex}" type="button" aria-label="Уменьшить количество">−</button>
            <span class="quantity-value" data-quantity-value="${productIndex}">${quantity}</span>
            <button class="quantity-button" data-quantity-plus="${productIndex}" type="button" aria-label="Увеличить количество">+</button>
          </div>
          <button class="buy-button" data-buy="${productIndex}" type="button" ${quantity > 0 ? 'hidden' : ''}>В корзину</button>
          <button class="favorite-button product-detail-favorite${favorites.has(productIndex) ? ' is-favorite' : ''}" data-fav="${productIndex}" type="button" aria-label="${favorites.has(productIndex) ? 'Убрать из избранного' : 'Добавить в избранное'}" aria-pressed="${favorites.has(productIndex)}">
            <svg aria-hidden="true"><use href="#heart"></use></svg>
          </button>
        </div>
      </div>
    </article>
  `;
  updateProductQuantity(productIndex);
};

const renderCatalog = () => {
  if (categorySidebar) {
    categorySidebar.setAttribute('aria-busy', String(!categoriesLoaded));
    if (categoriesLoaded) {
      categorySidebar.innerHTML = categoryLoadFailed
        ? '<p class="products-status">Не удалось загрузить категории.</p>'
        : [
            `<button class="catalog-category${selectedCatalogCategory === 'all' ? ' active' : ''}" type="button" data-category="all"><span>Вся мебель</span><strong>${productsLoaded ? products.length : '—'}</strong></button>`,
            ...categories.map((category) => {
              const categoryId = String(category.id);
              const count = productsLoaded
                ? products.filter(
                    (product) => String(getProductCategoryId(product)) === categoryId
                  ).length
                : '—';
              return `<button class="catalog-category${selectedCatalogCategory === categoryId ? ' active' : ''}" type="button" data-category="${escapeHTML(categoryId)}"><span>${escapeHTML(category.name)}</span><strong>${count}</strong></button>`;
            })
          ].join('');
    }
  }

  if (categoryTitle) {
    const selectedCategory = categories.find(
      (category) => String(category.id) === selectedCatalogCategory
    );
    categoryTitle.textContent = searchResultsPage
      ? (productSearchQuery
          ? `Результаты поиска: ${productSearchQuery}`
          : 'Все товары')
      : selectedCategory?.name ||
        (selectedCatalogCategory === 'all' ? 'Выбирайте мебель для дома' : 'Категория');
  }
  if (searchResultsPage) {
    document.title = productSearchQuery
      ? `Поиск: ${productSearchQuery} — Золотая зебра`
      : 'Каталог товаров — Золотая зебра';
  }

  if (!catalogProducts) {
    return;
  }

  catalogProducts.setAttribute('aria-busy', String(!productsLoaded));
  if (productLoadFailed) {
    catalogProducts.innerHTML = '<p class="products-status">Не удалось загрузить товары. Попробуйте обновить страницу.</p>';
    if (emptyCatalogMessage) {
      emptyCatalogMessage.classList.add('hidden');
    }
    return;
  }

  if (!productsLoaded) {
    catalogProducts.innerHTML = '<p class="products-status">Загружаем товары...</p>';
    if (emptyCatalogMessage) {
      emptyCatalogMessage.classList.add('hidden');
    }
    return;
  }

  const visibleProducts = products
    .map((product, index) => ({ product, index }))
    .filter(({ product }) =>
      (
        selectedCatalogCategory === 'all' ||
        String(getProductCategoryId(product)) === selectedCatalogCategory
      ) &&
      matchesProductSearch(product)
    );

  catalogProducts.innerHTML = visibleProducts
    .map(({ product, index }) => renderProductCard(product, index))
    .join('');

  if (emptyCatalogMessage) {
    emptyCatalogMessage.classList.toggle('hidden', visibleProducts.length > 0);
    emptyCatalogMessage.textContent = productSearchQuery
      ? 'По вашему запросу товары не найдены.'
      : 'В выбранной категории пока нет товаров.';
  }
};

categorySidebar?.addEventListener('click', (event) => {
  const button = event.target instanceof Element
    ? event.target.closest('[data-category]')
    : null;
  if (!button) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  selectedCatalogCategory = button.dataset.category;
  renderCatalog();
});

/* =========================================================
   ОЧИСТКА ПОЛЕЙ ПОИСКА
   ========================================================= */

$$('[data-clear]').forEach((button) => {
  button.addEventListener('click', () => {
    const input = document.getElementById(
      button.dataset.clear
    );

    if (!input) {
      return;
    }

    input.value = '';
    input.focus();
  });
});

/* =========================================================
   КАТЕГОРИИ НА ГЛАВНОЙ
   ========================================================= */


const quickCategories = $('#quickCats');

if (quickCategories) {
  quickCategories.innerHTML = categories
    .map(([name, fileName]) => {
      return `
        <a
          href="#hits"
          class="category-card"
        >
          <span class="category-image">
            <img
              src="${imagePath(fileName)}"
              alt="${name}"
              onerror="this.onerror=null; this.src='${fallbackImage}'"
            >
          </span>

          <span class="category-name">
            ${name}
          </span>
        </a>
      `;
    })
    .join('');
}

/* =========================================================
   ТОВАРЫ
   ========================================================= */

const favorites = new Set(
  JSON.parse(localStorage.getItem('zebraFavorites') || '[]')
    .map(Number)
    .filter(Number.isInteger)
);

const favoritesGrid = $('#favorites-grid');

const saveFavorites = () => {
  localStorage.setItem(
    'zebraFavorites',
    JSON.stringify(Array.from(favorites))
  );
};

const updateFavoritesCount = () => {
  const count = favorites.size;
  const badge = $('#favBadge');
  const pageCount = $('#favorite-count');

  if (badge) {
    badge.textContent = count;
  }

  if (pageCount) {
    const countForm = new Intl.PluralRules('ru').select(count);
    const unit = {
      one: 'товар',
      few: 'товара',
      many: 'товаров',
      other: 'товара'
    }[countForm];

    pageCount.textContent =
      `${count} ${unit}`;
  }
};

const renderStars = (rating) => {
  return [1, 2, 3, 4, 5]
    .map((star) => {
      const starClass =
        star <= Math.round(rating)
          ? 'star-filled'
          : 'star-empty';

      return `
        <svg class="${starClass}">
          <use href="#star"></use>
        </svg>
      `;
    })
    .join('');
};

const renderProductCard = (product, index) => {
  const name = escapeHTML(product.name);
  const price = Number(product.price);
  const image = product.image || product.imageUrl || product.image_url;
  const imageSource = image ? escapeHTML(image) : fallbackImage;
  const productUrl = `./product.html?id=${encodeURIComponent(product.id)}`;
  const isFavorite = favorites.has(index);
  const rating = Number(product.rating);
  const reviews = Number(product.reviews);
  const oldPrice = Number(product.oldPrice ?? product.old_price);
  const hasRating = Number.isFinite(rating) && rating > 0;
  const hasDiscount = Number.isFinite(oldPrice) && oldPrice > price;

  return `
    <article class="product-card">
      <div class="product-image">
        <a class="product-detail-link" href="${productUrl}" aria-label="Подробнее: ${name}">
          <img
            src="${imageSource}"
            alt="${name}"
            onerror="this.onerror=null; this.src='${fallbackImage}'"
          >
        </a>

        ${hasDiscount ? `<span class="discount">-${Math.round((1 - price / oldPrice) * 100)}%</span>` : ''}

        <button
          class="favorite-button${isFavorite ? ' is-favorite' : ''}"
          data-fav="${index}"
          type="button"
          aria-label="${isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}"
          aria-pressed="${isFavorite}"
        >
          <svg aria-hidden="true">
            <use href="#heart"></use>
          </svg>
        </button>
      </div>

      <div class="product-body">
        <h3 class="product-title"><a class="product-title-link" href="${productUrl}">${name}</a></h3>
        <a class="product-card-more" href="${productUrl}">Подробнее о товаре →</a>

        ${hasRating ? `
          <div class="rating">
            ${renderStars(rating)}
            <span class="rating-count">${rating}${Number.isFinite(reviews) ? ` (${reviews})` : ''}</span>
          </div>
        ` : ''}

        <div class="price-row">
          <span class="price">${formatPrice(price)}</span>
          ${hasDiscount ? `<span class="old-price">${formatPrice(oldPrice)}</span>` : ''}
        </div>

        <div
          class="quantity-control"
          data-quantity-control="${index}"
          hidden
        >
          <button
            class="quantity-button"
            data-quantity-minus="${index}"
            type="button"
            aria-label="Уменьшить количество"
          >−</button>

          <span
            class="quantity-value"
            data-quantity-value="${index}"
          >0</span>

          <button
            class="quantity-button"
            data-quantity-plus="${index}"
            type="button"
            aria-label="Увеличить количество"
          >+</button>
        </div>

        <button
          class="buy-button"
          data-buy="${index}"
          type="button"
        >В корзину</button>
      </div>
    </article>
  `;
};

const renderFavoritesPage = () => {
  if (!favoritesGrid) {
    return;
  }

  const favoriteProducts = Array.from(favorites)
    .filter((index) => products[index])
    .map((index) => renderProductCard(products[index], index));

  favoritesGrid.innerHTML = favoriteProducts.join('');

  const emptyMessage = $('#favorites-empty');
  if (emptyMessage) {
    emptyMessage.hidden = favoriteProducts.length > 0;
  }

  updateFavoritesCount();
  updateAllProductQuantities();
};

const carousel = $('#carousel');

/* =========================================================
   ИЗБРАННОЕ И КОРЗИНА
   ========================================================= */

const savedCart = JSON.parse(
  localStorage.getItem('zebraCart') || '{}'
);

const cartItems = new Map(
  Object.entries(savedCart).map(
    ([productIndex, quantity]) => [
      Number(productIndex),
      Number(quantity)
    ]
  )
);

const cart = {
  count: 0,
  total: 0
};

const recalculateCart = () => {
  cart.count = 0;
  cart.total = 0;

  cartItems.forEach((quantity, productIndex) => {
    const product = products[productIndex];
    if (!product || quantity <= 0) {
      return;
    }

    cart.count += quantity;
    cart.total += Number(product.price) * quantity;
  });
};

const saveCart = () => {
  const cartObject = {};

  cartItems.forEach((quantity, productIndex) => {
    cartObject[productIndex] = quantity;
  });

  localStorage.setItem(
    'zebraCart',
    JSON.stringify(cartObject)
  );
};

const updateCartHeader = () => {
  const cartBadge = $('#cartBadge');
  const cartSum = $('#cartSum');

  if (cartBadge) {
    cartBadge.textContent = cart.count;
  }

  if (cartSum) {
    cartSum.textContent = formatPrice(cart.total);
  }
};

const updateProductQuantity = (productIndex) => {
  const quantity =
    cartItems.get(productIndex) || 0;

  const quantityControls = $$(
    `[data-quantity-control="${productIndex}"]`
  );

  const quantityValues = $$(
    `[data-quantity-value="${productIndex}"]`
  );

  const buyButtons = $$(
    `[data-buy="${productIndex}"]`
  );

  if (!quantityControls.length || !quantityValues.length || !buyButtons.length) {
    return;
  }

  quantityValues.forEach((quantityValue) => {
    quantityValue.textContent = quantity;
  });

  if (quantity > 0) {
    quantityControls.forEach((quantityControl) => {
      quantityControl.hidden = false;
    });
    buyButtons.forEach((buyButton) => {
      buyButton.hidden = true;
    });
  } else {
    quantityControls.forEach((quantityControl) => {
      quantityControl.hidden = true;
    });
    buyButtons.forEach((buyButton) => {
      buyButton.hidden = false;
    });
  }
};

const updateAllProductQuantities = () => {
  products.forEach((_, productIndex) => {
    updateProductQuantity(productIndex);
  });
};

const addProductToCart = (productIndex) => {
  const product = products[productIndex];
  if (!product) {
    return;
  }

  const currentQuantity =
    cartItems.get(productIndex) || 0;

  cartItems.set(
    productIndex,
    currentQuantity + 1
  );

  cart.count += 1;
  cart.total += Number(product.price);

  saveCart();
  updateProductQuantity(productIndex);
  updateCartHeader();
};

const bounceCartIcon = () => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  const cartBadge = $('#cartBadge');
  const cartLink = cartBadge?.closest('a') ||
    document.querySelector('header a[href="./cart.html"]');
  const cartIcon = cartLink?.querySelector('svg');

  if (!cartIcon) {
    return;
  }

  cartIcon.getAnimations().forEach((animation) => animation.cancel());
  cartIcon.animate(
    [
      { transform: 'translateY(0) scale(1)' },
      { transform: 'translateY(-7px) scale(1.12)', offset: 0.4 },
      { transform: 'translateY(0) scale(1)' }
    ],
    {
      duration: 420,
      easing: 'cubic-bezier(.2, .7, .25, 1)'
    }
  );
};

const removeProductFromCart = (productIndex) => {
  const product = products[productIndex];
  if (!product) {
    return;
  }

  const currentQuantity =
    cartItems.get(productIndex) || 0;

  if (currentQuantity <= 0) {
    return;
  }

  const newQuantity = currentQuantity - 1;

  if (newQuantity <= 0) {
    cartItems.delete(productIndex);
  } else {
    cartItems.set(productIndex, newQuantity);
  }

  cart.count -= 1;
  cart.total -= Number(product.price);

  if (cart.count < 0) {
    cart.count = 0;
  }

  if (cart.total < 0) {
    cart.total = 0;
  }

  saveCart();
  updateProductQuantity(productIndex);
  updateCartHeader();
};

updateAllProductQuantities();
updateCartHeader();
updateFavoritesCount();
renderFavoritesPage();

if (carousel) {
  carousel.setAttribute('aria-busy', 'true');
  carousel.innerHTML = '<p class="products-status">Загружаем товары...</p>';
}

loadCategories()
  .then(() => {
    categoriesLoaded = true;
    renderProductSearchResults();
    renderSearchSuggestions();
    renderProductDetail();
  })
  .catch((error) => {
    console.error('Не удалось загрузить категории:', error);
    categoryLoadFailed = true;
    categoriesLoaded = true;
    renderCatalog();
  });

loadProducts()
  .then(() => {
    productsLoaded = true;
    if (carousel) {
      carousel.setAttribute('aria-busy', 'false');
    }
    renderProductSearchResults();
    renderSearchSuggestions();
    renderCatalog();

    for (const productIndex of favorites) {
      if (!products[productIndex]) {
        favorites.delete(productIndex);
      }
    }

    recalculateCart();
    updateAllProductQuantities();
    updateCartHeader();
    renderFavoritesPage();
    renderProductDetail();
  })
  .catch((error) => {
    console.error('Не удалось загрузить товары:', error);
    productLoadFailed = true;
    productsLoaded = true;
    renderCatalog();
    const productDetail = $('#product-detail');
    if (productDetail) {
      productDetail.setAttribute('aria-busy', 'false');
      productDetail.innerHTML = `
        <section class="product-detail-message" role="alert">
          <h1>Не удалось загрузить товар</h1>
          <p>Проверьте подключение и попробуйте обновить страницу.</p>
          <a class="catalog-button" href="./index.html#hits">Вернуться к товарам</a>
        </section>
      `;
    }
    if (carousel) {
      carousel.setAttribute('aria-busy', 'false');
      carousel.innerHTML = '<p class="products-status">Не удалось загрузить товары. Попробуйте обновить страницу.</p>';
    }
  });

const productContainers = [
  carousel,
  favoritesGrid,
  catalogProducts,
  $('#product-detail')
]
  .filter(Boolean);

productContainers.forEach((productContainer) => {
  productContainer.addEventListener('click', (event) => {
    const favoriteButton =
      event.target.closest('[data-fav]');

    const buyButton =
      event.target.closest('[data-buy]');

    const plusButton =
      event.target.closest('[data-quantity-plus]');

    const minusButton =
      event.target.closest('[data-quantity-minus]');

    if (favoriteButton) {
      const productIndex = Number(
        favoriteButton.dataset.fav
      );

      if (favorites.has(productIndex)) {
        favorites.delete(productIndex);
      } else {
        favorites.add(productIndex);
      }

      saveFavorites();
      updateFavoritesCount();

      $$('[data-fav]').forEach((button) => {
        const isFavorite = favorites.has(
          Number(button.dataset.fav)
        );

        button.classList.toggle('is-favorite', isFavorite);
        button.setAttribute('aria-pressed', String(isFavorite));
        button.setAttribute(
          'aria-label',
          isFavorite
            ? 'Убрать из избранного'
            : 'Добавить в избранное'
        );
      });

      renderFavoritesPage();

      return;
    }

    if (buyButton) {
      const productIndex = Number(
        buyButton.dataset.buy
      );

      bounceCartIcon();
      addProductToCart(productIndex);
      return;
    }

    if (plusButton) {
      const productIndex = Number(
        plusButton.dataset.quantityPlus
      );

      bounceCartIcon();
      addProductToCart(productIndex);
      return;
    }

    if (minusButton) {
      const productIndex = Number(
        minusButton.dataset.quantityMinus
      );

      removeProductFromCart(productIndex);
    }
  });
});
/* =========================================================
   ПРОКРУТКА КАРУСЕЛИ
   ========================================================= */

const previousButton = $('#prev');
const nextButton = $('#next');

if (carousel && previousButton) {
  previousButton.addEventListener('click', () => {
    carousel.scrollBy({
      left: -carousel.clientWidth * 0.8,
      behavior: 'smooth'
    });
  });
}

if (carousel && nextButton) {
  nextButton.addEventListener('click', () => {
    carousel.scrollBy({
      left: carousel.clientWidth * 0.8,
      behavior: 'smooth'
    });
  });
}

/* =========================================================
   ПОИСК ПО ТОВАРАМ
   ========================================================= */

const desktopSearchInput = $('#desktop-query');
const searchSuggestions = $('#search-suggestions');
let activeSearchSuggestion = -1;

const closeSearchSuggestions = () => {
  if (!searchSuggestions || !desktopSearchInput) {
    return;
  }

  searchSuggestions.hidden = true;
  searchSuggestions.replaceChildren();
  desktopSearchInput.setAttribute('aria-expanded', 'false');
  desktopSearchInput.removeAttribute('aria-activedescendant');
  activeSearchSuggestion = -1;
};

const updateActiveSearchSuggestion = () => {
  if (!searchSuggestions || !desktopSearchInput) {
    return;
  }

  const options = searchSuggestions.querySelectorAll('[role="option"]');
  options.forEach((option, index) => {
    const isActive = index === activeSearchSuggestion;
    option.setAttribute('aria-selected', String(isActive));
    if (isActive) {
      desktopSearchInput.setAttribute('aria-activedescendant', option.id);
      option.scrollIntoView({ block: 'nearest' });
    }
  });

  if (activeSearchSuggestion < 0 || activeSearchSuggestion >= options.length) {
    desktopSearchInput.removeAttribute('aria-activedescendant');
  }
};

const renderSearchSuggestions = () => {
  if (!desktopSearchInput || !searchSuggestions) {
    return;
  }

  const query = normalizeSearchText(desktopSearchInput.value);
  if (!query || !productsLoaded) {
    closeSearchSuggestions();
    return;
  }

  const suggestions = products
    .map((product, index) => ({ product, index }))
    .filter(({ product }) => matchesProductSearch(product))
    .sort((left, right) => {
      const leftName = normalizeSearchText(left.product.name);
      const rightName = normalizeSearchText(right.product.name);
      const leftStartsWithQuery = leftName.startsWith(query);
      const rightStartsWithQuery = rightName.startsWith(query);
      return Number(rightStartsWithQuery) - Number(leftStartsWithQuery) ||
        leftName.localeCompare(rightName, 'ru');
    })
    .slice(0, 7);

  if (!suggestions.length) {
    closeSearchSuggestions();
    return;
  }

  searchSuggestions.innerHTML = suggestions.map(({ product, index }) => `
    <button
      class="search-suggestion"
      id="search-suggestion-${index}"
      type="button"
      role="option"
      aria-selected="false"
      data-search-suggestion="${index}"
    >
      <span class="search-suggestion-name">${escapeHTML(product.name)}</span>
      <span class="search-suggestion-price">${formatPrice(Number(product.price))}</span>
    </button>
  `).join('');
  searchSuggestions.hidden = false;
  desktopSearchInput.setAttribute('aria-expanded', 'true');
  activeSearchSuggestion = -1;
};

const selectSearchSuggestion = (productIndex) => {
  const product = products[productIndex];
  if (!product || !desktopSearchInput) {
    return;
  }

  closeSearchSuggestions();
  window.location.href = `./search.html?q=${encodeURIComponent(product.name)}`;
};

const renderProductSearchResults = () => {
  if (carousel && productsLoaded) {
    const matchingProducts = products
      .map((product, index) => ({ product, index }))
      .filter(({ product }) => matchesProductSearch(product));

    carousel.innerHTML = matchingProducts.length
      ? matchingProducts
          .map(({ product, index }) => renderProductCard(product, index))
          .join('')
      : `<p class="products-status">${products.length
          ? 'По вашему запросу товары не найдены.'
          : 'Товары пока не добавлены.'}</p>`;
    updateAllProductQuantities();
  }

  renderCatalog();
};

if (desktopSearchInput) {
  desktopSearchInput.addEventListener('input', () => {
    renderSearchSuggestions();
  });

  desktopSearchInput.addEventListener('keydown', (event) => {
    const optionCount = searchSuggestions?.querySelectorAll('[role="option"]').length || 0;

    if (event.key === 'ArrowDown' && optionCount) {
      event.preventDefault();
      activeSearchSuggestion = (activeSearchSuggestion + 1) % optionCount;
      updateActiveSearchSuggestion();
    } else if (event.key === 'ArrowUp' && optionCount) {
      event.preventDefault();
      activeSearchSuggestion = activeSearchSuggestion <= 0
        ? optionCount - 1
        : activeSearchSuggestion - 1;
      updateActiveSearchSuggestion();
    } else if (event.key === 'Enter' && activeSearchSuggestion >= 0) {
      event.preventDefault();
      const activeOption = searchSuggestions.querySelectorAll('[role="option"]')[
        activeSearchSuggestion
      ];
      if (activeOption) {
        selectSearchSuggestion(Number(activeOption.dataset.searchSuggestion));
      }
    } else if (event.key === 'Escape') {
      closeSearchSuggestions();
    }
  });

  desktopSearchInput.addEventListener('focus', renderSearchSuggestions);
}

searchSuggestions?.addEventListener('click', (event) => {
  const option = event.target.closest('[data-search-suggestion]');
  if (option) {
    selectSearchSuggestion(Number(option.dataset.searchSuggestion));
  }
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('#desktop-search')) {
    closeSearchSuggestions();
  }
});

$('#desktop-search')?.addEventListener(
  'submit',
  (event) => {
    event.preventDefault();
    const query = desktopSearchInput?.value.trim() ?? '';
    closeSearchSuggestions();
    if (!query) {
      desktopSearchInput?.focus();
      return;
    }
    window.location.href = `./search.html?q=${encodeURIComponent(query)}`;
  }
);

if (searchResultsPage && desktopSearchInput) {
  desktopSearchInput.value = initialSearchQuery;
}

/* =========================================================
   ПОДПИСКА
   ========================================================= */

const subscriptionForm = $('#subForm');

if (subscriptionForm) {
  subscriptionForm.addEventListener(
    'submit',
    (event) => {
      event.preventDefault();

      const message = $('#subMsg');

      if (message) {
        message.textContent =
          'Спасибо! Вы подписались на новости.';
      }

      subscriptionForm.reset();
    }
  );
}
/* =========================================================
   АВТОРИЗАЦИЯ И РЕГИСТРАЦИЯ
   ========================================================= */

const loginButton = $('#login-button');
const loginButtonText = $('#login-button-text');

const authOverlay = $('#auth-overlay');
const authClose = $('#auth-close');

const loginView = $('#login-view');
const registerView = $('#register-view');

const openRegisterButton = $('#open-register');
const openLoginButton = $('#open-login');

const loginForm = $('#login-form');
const registerForm = $('#register-form');
const loginMessage = $('#login-message');
const registerMessage = $('#register-message');
const registerPasswordInput = $('#register-password');
const registerPasswordConfirmInput = $('#register-password-confirm');
const authTitle = $('#auth-title');

const openContactButton = $('#open-contact');
const contactOverlay = $('#contact-overlay');
const contactCloseButton = $('#contact-close');
const contactForm = $('#contact-form');
const contactNameInput = $('#contact-name');
const contactSubmitNote = $('#contact-submit-note');
const clientName = document.querySelector('#login-button-text');

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(loginForm);
  const username = data.get('username').trim();
  const userpassword = data.get('password').trim();
  const datalogin = {
    name: username,
    password: userpassword,
    registration: false
  };
  try {
    const result = await request(`/auth`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(datalogin)
    });
    client = result;
    clientName.textContent = client.name;
    console.log(client);
  } catch (error) {
    console.log('Ошибка:', error);
  }
});

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(registerForm);
  const username = data.get('username').trim();
  const useremail = data.get('email').trim();
  const userpassword = data.get('password').trim();

  const datareg = {
    name: username,
    email: useremail,
    password: userpassword,
    registration: true
  };

  try {
    await request(`/auth`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(datareg)
    })
    const result = await request('auth');
    client = result;
    clientName.textContent = client.name;
    console.log(client);
  } catch (error) {
    console.log(error);
  }
});


const openContactModal = () => {
  if (!contactOverlay) {
    return;
  }

  contactOverlay.classList.remove('hidden');
  contactOverlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('contact-is-open');
  contactNameInput?.focus();
};

const closeContactModal = () => {
  if (!contactOverlay) {
    return;
  }

  contactOverlay.classList.add('hidden');
  contactOverlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('contact-is-open');
  openContactButton?.focus();
};

if (openContactButton) {
  openContactButton.addEventListener('click', (event) => {
    event.preventDefault();
    openContactModal();
  });
}

if (contactCloseButton) {
  contactCloseButton.addEventListener('click', closeContactModal);
}

if (contactOverlay) {
  contactOverlay.addEventListener('click', (event) => {
    if (event.target === contactOverlay) {
      closeContactModal();
    }
  });
}

if (contactForm && contactSubmitNote) {
  contactForm.addEventListener('submit', (event) => {
    event.preventDefault();
    contactSubmitNote.textContent =
      'Обращение не отправлено: онлайн-отправка пока не подключена. ' +
      'Позвоните нам по номеру +7 (473) 207-20-78.';
    contactSubmitNote.focus();
  });
}

const openAuthModal = () => {
  if (!authOverlay) {
    return;
  }

  authOverlay.classList.remove('hidden');
  authOverlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('auth-is-open');
  showLoginView();

  const usernameInput = $('#login-username');

  if (usernameInput) {
    window.setTimeout(() => {
      usernameInput.focus();
    }, 100);
  }
};

const closeAuthModal = () => {
  if (!authOverlay) {
    return;
  }

  authOverlay.classList.add('hidden');
  authOverlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('auth-is-open');
};

const showLoginView = () => {
  if (loginView) {
    loginView.hidden = false;
  }

  if (registerView) {
    registerView.hidden = true;
  }

  if (authTitle) {
    authTitle.textContent = 'Вход';
  }
  if (loginMessage) {
    loginMessage.textContent = '';
  }
};

const showRegisterView = () => {
  if (loginView) {
    loginView.hidden = true;
  }

  if (registerView) {
    registerView.hidden = false;
  }

  if (authTitle) {
    authTitle.textContent = 'Регистрация';
  }
  if (registerMessage) {
    registerMessage.textContent = '';
  }
};

if (loginButton) {
  loginButton.addEventListener('click', (event) => {
    event.preventDefault();
    openAuthModal();
  });
}

if (authClose) {
  authClose.addEventListener('click', closeAuthModal);
}

if (authOverlay) {
  authOverlay.addEventListener('click', (event) => {
    if (event.target === authOverlay) {
      closeAuthModal();
    }
  });
}

if (openRegisterButton) {
  openRegisterButton.addEventListener(
    'click',
    showRegisterView
  );
}

if (openLoginButton) {
  openLoginButton.addEventListener(
    'click',
    showLoginView
  );
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeAuthModal();
    closeContactModal();
  }
});

if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (loginMessage) {
      loginMessage.textContent = '';
    }

    try {
      const username = $('#login-username').value.trim();
      const account = getSavedAuthAccount(username);
      const password = $('#login-password').value;

      if (!account || account.username !== normalizeUsername(username)) {
        throw new Error('Неверный логин или пароль.');
      }

      const passwordHash = await hashPassword(password, account.salt);
      if (passwordHash !== account.passwordHash) {
        throw new Error('Неверный логин или пароль.');
      }

      localStorage.setItem(
        'zebraUser',
        JSON.stringify({ username: account.username, isLoggedIn: true })
      );
      updateLoginState();
      closeAuthModal();
      loginForm.reset();
    } catch (error) {
      if (loginMessage) {
        loginMessage.textContent = error.message ||
          'Не удалось выполнить вход. Попробуйте еще раз.';
      }
    }
  });
}

if (registerForm) {
  const validatePasswordMatch = () => {
    if (registerPasswordInput && registerPasswordConfirmInput) {
      registerPasswordConfirmInput.setCustomValidity(
        registerPasswordConfirmInput.value &&
          registerPasswordInput.value !== registerPasswordConfirmInput.value
          ? 'Пароли не совпадают'
          : ''
      );
    }
  };

  registerPasswordInput?.addEventListener('input', validatePasswordMatch);
  registerPasswordConfirmInput?.addEventListener('input', validatePasswordMatch);

  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (registerMessage) {
      registerMessage.textContent = '';
    }

    validatePasswordMatch();

    if (!registerForm.reportValidity()) {
      return;
    }

    try {
      const username = normalizeUsername($('#register-username').value);
      const email = $('#register-email').value.trim().toLocaleLowerCase('ru-RU');
      const password = registerPasswordInput.value;

      if (getSavedAuthAccount(username)) {
        throw new Error('Такой логин уже зарегистрирован в этом браузере.');
      }

      const salt = createPasswordSalt();
      const passwordHash = await hashPassword(password, salt);
      localStorage.setItem(
        `zebraAccount:${encodeURIComponent(username)}`,
        JSON.stringify({ username, email, salt, passwordHash })
      );
      localStorage.setItem(
        'zebraUser',
        JSON.stringify({ username, isLoggedIn: true })
      );

      updateLoginState();
      closeAuthModal();
      registerForm.reset();
    } catch (error) {
      if (registerMessage) {
        registerMessage.textContent = error.message ||
          'Не удалось зарегистрировать аккаунт. Попробуйте еще раз.';
      }
    }
  });
}

const AUTH_PASSWORD_ITERATIONS = 120000;

const normalizeUsername = (username) =>
  username.trim().toLocaleLowerCase('ru-RU');

const getSavedAuthAccount = (username) => {
  const accountKey = `zebraAccount:${encodeURIComponent(normalizeUsername(username))}`;
  const savedAccount = localStorage.getItem(accountKey);
  if (!savedAccount) {
    return null;
  }

  try {
    const account = JSON.parse(savedAccount);
    if (
      typeof account.username === 'string' &&
      normalizeUsername(account.username) === normalizeUsername(username) &&
      typeof account.salt === 'string' &&
      /^[\da-f]{32}$/i.test(account.salt) &&
      typeof account.passwordHash === 'string' &&
      /^[\da-f]{64}$/i.test(account.passwordHash)
    ) {
      return account;
    }
  } catch (error) {
    throw new Error('Не удалось прочитать сохраненные данные аккаунта.');
  }

  throw new Error('Сохраненные данные аккаунта повреждены.');
};

const bytesToHex = (bytes) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

const createPasswordSalt = () => {
  if (!window.crypto?.subtle) {
    throw new Error('Безопасная регистрация недоступна в этом браузере. Откройте сайт по HTTPS.');
  }

  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  return bytesToHex(salt);
};

const hashPassword = async (password, salt) => {
  if (!window.crypto?.subtle) {
    throw new Error('Безопасный вход недоступен в этом браузере. Откройте сайт по HTTPS.');
  }

  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const passwordHash = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: Uint8Array.from(salt.match(/.{2}/g), (byte) => parseInt(byte, 16)),
      iterations: AUTH_PASSWORD_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );

  return bytesToHex(new Uint8Array(passwordHash));
};

const updateLoginState = () => {
  if (!loginButtonText) {
    return;
  }

  const savedUser = localStorage.getItem('zebraUser');

  if (!savedUser) {
    loginButtonText.textContent = 'Войти';
    return;
  }

  try {
    const user = JSON.parse(savedUser);
    if (user.isLoggedIn && typeof user.username === 'string') {
      loginButtonText.textContent = user.username;
    } else {
      localStorage.removeItem('zebraUser');
      loginButtonText.textContent = 'Войти';
    }
  } catch (error) {
    localStorage.removeItem('zebraUser');
    loginButtonText.textContent = 'Войти';
  }
};

updateLoginState();