const API_URL = 'https://server-zebrabro.onrender.com/api';
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp'
]);

const list = document.querySelector('#products-list');
const actionSelect = document.querySelector('#admin-action');
const productTargetSelect = document.querySelector('#action-product-select');
const categoryTargetSelect = document.querySelector('#action-category-select');
const panels = {
  addProduct: document.querySelector('#add-product-panel'),
  addCategory: document.querySelector('#add-category-panel'),
  editProduct: document.querySelector('#edit-product-panel'),
  editCategory: document.querySelector('#edit-category-panel'),
  productTarget: document.querySelector('#product-target-panel'),
  categoryTarget: document.querySelector('#category-target-panel')
};

let categories = [];
let products = [];
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

function showMessage(element, text, state = '') {
  if (!element) {
    return;
  }

  element.textContent = text;
  if (state) {
    element.dataset.state = state;
  } else {
    element.removeAttribute('data-state');
  }
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

function renderCategories() {
  const categorySelects = [
    document.querySelector('#product-category'),
    document.querySelector('#edit-product-category'),
    categoryTargetSelect
  ];

  categorySelects.forEach((select) => {
    if (!select) {
      return;
    }

    const placeholder = select === categoryTargetSelect
      ? 'Выберите категорию'
      : 'Выберите категорию';
    select.replaceChildren(new Option(placeholder, ''));

    categories.forEach((category) => {
      select.add(new Option(category.name, category.id));
    });
  });
}

function renderProductOptions() {
  if (!productTargetSelect) {
    return;
  }

  productTargetSelect.replaceChildren(new Option('Выберите товар', ''));
  products.forEach((product) => {
    productTargetSelect.add(new Option(product.name, product.id));
  });
}

function renderProducts() {
  renderProductOptions();

  if (!list) {
    return;
  }

  if (products.length === 0) {
    list.innerHTML = `
      <div class="products-empty">
        В каталоге пока нет товаров. Добавьте первый товар с помощью формы выше.
      </div>
    `;
    return;
  }

  list.innerHTML = products.map((product) => {
    const productCategoryId = product.categoryId ?? product.category_id;
    const categoryName =
      product.category?.name ||
      (typeof product.category === 'string' ? product.category : '') ||
      categories.find(
        (category) => String(category.id) === String(productCategoryId)
      )?.name ||
      'Без категории';
    const image = product.image || product.imageUrl || product.image_url || '../images/fallback.png';
    const price = Number(product.price);
    const formattedPrice = Number.isFinite(price)
      ? `${price.toLocaleString('ru-RU')} ₽`
      : 'Цена не указана';

    return `
      <article class="admin-product-card">
        <div class="admin-product-image">
          <img
            src="${escapeHTML(image)}"
            alt="${escapeHTML(product.name)}"
            onerror="this.onerror=null; this.src='../images/fallback.png'"
          >
        </div>

        <h3 class="admin-product-name">${escapeHTML(product.name)}</h3>
        <span class="admin-product-category">${escapeHTML(categoryName)}</span>
        <p class="admin-product-description">
          ${escapeHTML(product.description || 'Описание отсутствует.')}
        </p>

        <div class="admin-product-bottom">
          <span class="admin-product-price">${formattedPrice}</span>
          <span class="admin-product-stock">
            На складе: ${escapeHTML(product.stock ?? '—')}
          </span>
        </div>

        <button
          class="admin-product-delete"
          type="button"
          data-delete-product="${escapeHTML(product.id)}"
          aria-label="Удалить товар ${escapeHTML(product.name)}"
        >
          Удалить товар
        </button>
      </article>
    `;
  }).join('');
}

async function loadCategories() {
  const result = await request('/categories');
  if (!Array.isArray(result)) {
    throw new Error('Сервер вернул некорректный список категорий.');
  }

  categories = result;
  renderCategories();
  renderProducts();
}

async function loadProducts() {
  const result = await request('/products');
  if (!Array.isArray(result)) {
    throw new Error('Сервер вернул некорректный список товаров.');
  }

  products = result;
  renderProducts();
  const count = document.querySelector('#products-count');
  if (count) {
    count.textContent = `${products.length} товаров`;
  }
}

function hideActionPanels() {
  Object.values(panels).forEach((panel) => {
    if (panel) {
      panel.hidden = true;
    }
  });
}

function resetProductForm(form, previewId, fileInputId, previewMessageId) {
  form.reset();
  showMessage(document.querySelector(previewMessageId), '');
  const fileInput = document.querySelector(fileInputId);
  if (fileInput) {
    fileInput.value = '';
  }
  setImagePreview(document.querySelector(previewId), '', '');
}

function closeAction() {
  hideActionPanels();
  if (actionSelect) {
    actionSelect.value = '';
  }
  if (productTargetSelect) {
    productTargetSelect.value = '';
  }
  if (categoryTargetSelect) {
    categoryTargetSelect.value = '';
  }
}

function setImagePreview(preview, src, caption) {
  if (!preview) {
    return;
  }

  const previousUrl = imagePreviewUrls.get(preview);
  if (previousUrl) {
    URL.revokeObjectURL(previousUrl);
    imagePreviewUrls.delete(preview);
  }

  const image = preview.querySelector('img');
  const label = preview.querySelector('.image-preview-caption');
  if (!src) {
    preview.hidden = true;
    image.removeAttribute('src');
    if (label) {
      label.textContent = '';
    }
    return;
  }

  image.src = src;
  preview.hidden = false;
  if (label) {
    label.textContent = caption;
  }
}

function validateImage(file, messageElement) {
  if (!file) {
    showMessage(messageElement, '');
    return true;
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    showMessage(messageElement, 'Допустимы только изображения JPG, PNG или WebP.', 'error');
    return false;
  }

  if (file.size > MAX_IMAGE_SIZE) {
    showMessage(messageElement, 'Размер изображения не должен превышать 5 МБ.', 'error');
    return false;
  }

  showMessage(messageElement, '');
  return true;
}

function attachImagePreview(fileInputId, previewId, messageId) {
  const input = document.querySelector(fileInputId);
  const preview = document.querySelector(previewId);
  const message = document.querySelector(messageId);
  if (!input || !preview) {
    return;
  }

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) {
      showMessage(message, '');
      return;
    }

    if (!validateImage(file, message)) {
      input.value = '';
      setImagePreview(preview, '', '');
      return;
    }

    const url = URL.createObjectURL(file);
    setImagePreview(preview, url, `Выбрано: ${file.name}`);
    imagePreviewUrls.set(preview, url);
  });
}

function fillProductForm(product) {
  const form = document.querySelector('#edit-product-form');
  form.elements.productId.value = product.id;
  form.elements.name.value = product.name ?? '';
  form.elements.price.value = product.price ?? '';
  form.elements.categoryId.value = product.categoryId ?? product.category_id ?? '';
  form.elements.image.value = product.imageUrl || product.image_url || '';

  const currentImage = product.image || product.imageUrl || product.image_url || '';
  setImagePreview(
    document.querySelector('#edit-product-image-preview'),
    currentImage,
    currentImage ? 'Текущее изображение' : 'Для товара пока не задано изображение.'
  );
  showMessage(document.querySelector('#edit-product-image-message'), '');
  document.querySelector('#edit-product-image-file').value = '';
  panels.editProduct.hidden = false;
  panels.productTarget.hidden = true;
  panels.editProduct.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function fillCategoryForm(category) {
  const form = document.querySelector('#edit-category-form');
  form.elements.categoryId.value = category.id;
  form.elements.name.value = category.name ?? '';
  panels.editCategory.hidden = false;
  panels.categoryTarget.hidden = true;
  panels.editCategory.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

actionSelect?.addEventListener('change', () => {
  hideActionPanels();
  const action = actionSelect.value;

  if (action === 'add-product') {
    resetProductForm(
      document.querySelector('#product-form'),
      '#product-image-preview',
      '#product-image-file',
      '#product-image-message'
    );
    panels.addProduct.hidden = false;
    panels.addProduct.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else if (action === 'add-category') {
    document.querySelector('#category-form').reset();
    showMessage(document.querySelector('#category-form-message'), '');
    panels.addCategory.hidden = false;
    panels.addCategory.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else if (action === 'edit-product') {
    panels.productTarget.hidden = false;
    productTargetSelect.value = '';
    panels.productTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else if (action === 'edit-category') {
    panels.categoryTarget.hidden = false;
    categoryTargetSelect.value = '';
    panels.categoryTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

productTargetSelect?.addEventListener('change', () => {
  const product = products.find(
    (item) => String(item.id) === productTargetSelect.value
  );
  if (product) {
    fillProductForm(product);
  }
});

categoryTargetSelect?.addEventListener('change', () => {
  const category = categories.find(
    (item) => String(item.id) === categoryTargetSelect.value
  );
  if (category) {
    fillCategoryForm(category);
  }
});

document.querySelectorAll('[data-close-form]').forEach((button) => {
  button.addEventListener('click', closeAction);
});

attachImagePreview(
  '#product-image-file',
  '#product-image-preview',
  '#product-image-message'
);
attachImagePreview(
  '#edit-product-image-file',
  '#edit-product-image-preview',
  '#edit-product-image-message'
);

async function submitProductForm(form, isEdit) {
  const data = new FormData(form);
  const fileInput = form.querySelector('input[type="file"]');
  const file = fileInput?.files?.[0];
  const imageMessage = document.querySelector(
    isEdit ? '#edit-product-image-message' : '#product-image-message'
  );

  if (!validateImage(file, imageMessage)) {
    return;
  }

  const name = String(data.get('name') ?? '').trim();
  const price = Number(data.get('price'));
  const categoryId = Number(data.get('categoryId'));
  const id = isEdit ? Number(data.get('productId')) : null;
  const payload = { name, price, categoryId };
  const imageUrl = String(data.get('image') ?? '').trim();

  if (!file && imageUrl) {
    payload.image = imageUrl;
  }

  const options = { method: isEdit ? 'PATCH' : 'POST' };
  if (file) {
    const uploadData = new FormData();
    if (id !== null) {
      uploadData.append('id', String(id));
    }
    uploadData.append('name', name);
    uploadData.append('price', String(price));
    uploadData.append('categoryId', String(categoryId));
    uploadData.append('imageFile', file);
    options.body = uploadData;
  } else {
    if (id !== null) {
      payload.id = id;
    }
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(payload);
  }

  const submitButton = form.querySelector('[type="submit"]');
  submitButton.disabled = true;
  const originalLabel = submitButton.textContent;
  submitButton.textContent = isEdit ? 'Сохраняем...' : 'Добавляем...';

  const message = document.querySelector(
    isEdit ? '#edit-product-message' : '#form-message'
  );
  try {
    await request('/products', options);
    showMessage(message, isEdit ? 'Изменения сохранены.' : 'Товар успешно добавлен!', 'success');
    await loadProducts();
    if (isEdit) {
      closeAction();
    } else {
      resetProductForm(
        form,
        '#product-image-preview',
        '#product-image-file',
        '#product-image-message'
      );
    }
  } catch (error) {
    console.error('Не удалось сохранить товар:', error);
    showMessage(message, `Не удалось сохранить товар. ${error.message}`, 'error');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = originalLabel;
  }
}

document.querySelector('#product-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  submitProductForm(event.currentTarget, false);
});

document.querySelector('#edit-product-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  submitProductForm(event.currentTarget, true);
});

document.querySelector('#category-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector('[type="submit"]');
  const message = document.querySelector('#category-form-message');
  submitButton.disabled = true;
  try {
    const name = String(new FormData(form).get('category') ?? '').trim();
    await request('/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    showMessage(message, 'Категория успешно добавлена.', 'success');
    form.reset();
    await loadCategories();
  } catch (error) {
    console.error('Не удалось добавить категорию:', error);
    showMessage(message, `Не удалось добавить категорию. ${error.message}`, 'error');
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector('#edit-category-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const submitButton = form.querySelector('[type="submit"]');
  const message = document.querySelector('#edit-category-message');
  submitButton.disabled = true;
  try {
    await request('/categories', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: Number(data.get('categoryId')),
        name: String(data.get('name') ?? '').trim()
      })
    });
    showMessage(message, 'Изменения категории сохранены.', 'success');
    await loadCategories();
    closeAction();
  } catch (error) {
    console.error('Не удалось изменить категорию:', error);
    showMessage(message, `Не удалось изменить категорию. ${error.message}`, 'error');
  } finally {
    submitButton.disabled = false;
  }
});

list?.addEventListener('click', async (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const deleteButton = event.target.closest('[data-delete-product]');
  if (!deleteButton) {
    return;
  }

  const product = products.find(
    (item) => String(item.id) === deleteButton.dataset.deleteProduct
  );
  if (!product || !window.confirm(`Удалить товар «${product.name}»?`)) {
    return;
  }

  const message = document.querySelector('#products-message');
  deleteButton.disabled = true;
  deleteButton.textContent = 'Удаляем...';
  try {
    await request(`/products/${encodeURIComponent(product.id)}`, {
      method: 'DELETE',
    });
    await loadProducts();
    showMessage(message, `Товар «${product.name}» удалён.`, 'success');
  } catch (error) {
    console.error('Не удалось удалить товар:', error);
    showMessage(message, `Не удалось удалить товар. ${error.message}`, 'error');
    deleteButton.disabled = false;
    deleteButton.textContent = 'Удалить товар';
  }
});

async function initializeAdmin() {
  const message = document.querySelector('#products-message');
  const count = document.querySelector('#products-count');

  try {
    const results = await Promise.allSettled([loadCategories(), loadProducts()]);
    const failures = results.filter((result) => result.status === 'rejected');
    if (failures.length) {
      const details = failures.map((result) => result.reason.message).join(' ');
      showMessage(message, `Не удалось загрузить данные админ-панели. ${details}`, 'error');
      if (count) {
        count.textContent = 'Список недоступен';
      }
    }
  } catch (error) {
    console.error('Не удалось инициализировать админ-панель:', error);
    showMessage(message, `Не удалось загрузить данные админ-панели. ${error.message}`, 'error');
  }
}

initializeAdmin();
