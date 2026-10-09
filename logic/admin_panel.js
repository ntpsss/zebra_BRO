const list = document.querySelector('#products-list');

let categories = [];
let products = [];

//получение данных с сервера
async function getCategories() {
    const response = await fetch('https://server-zebrabro.onrender.com/api/categories', {
      method: 'GET',
      headers: {
                'Content-Type': 'application/json'
            }
    });

    const result = await response.json();
    categories = result;
    console.log(categories)
    renderCategories();
    renderProducts();
}

async function getProducts() {
  const message = document.querySelector('#products-message');
  const count = document.querySelector('#products-count');

  try {
    const response = await fetch('https://server-zebrabro.onrender.com/api/products', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Сервер вернул ошибку ${response.status}.`);
    }

    const result = await response.json();
    if (!Array.isArray(result)) {
      throw new Error('Сервер вернул некорректный список товаров.');
    }

    products = result;
    renderProducts();

    if (message) {
      message.textContent = '';
      message.removeAttribute('data-state');
    }

    if (count) {
      count.textContent = `${products.length} товаров`;
    }

    return true;
  } catch (error) {
    console.error('Не удалось загрузить товары:', error);

    if (message) {
      message.textContent =
        `Не удалось загрузить товары. ${error.message}`;
      message.dataset.state = 'error';
    }

    if (count) {
      count.textContent = 'Список недоступен';
    }

    return false;
  }
}

  //рендер полученных данных
function renderCategories() {

  const selects = [
    document.querySelector('#product-category'),
    document.querySelector('#edit-category-select'),
    document.querySelector('#edit-product-category')
  ];

  selects.forEach((select) => {
    if (!select) {
      return;
    }

    select.innerHTML = '<option value="">Выберите категорию</option>';

    categories.forEach((category) => {
      const option = document.createElement('option');

      option.value = category.id;
      option.textContent = category.name;

      select.appendChild(option);
    });

  });

}

function renderProducts() {
  const select = document.querySelector('#edit-product-select');

  if (select) {
    select.innerHTML = '<option value="">Выберите товар</option>';

    products.forEach((product) => {
      const option = document.createElement('option');
      option.value = product.id;
      option.textContent = product.name;
      select.appendChild(option);
    });
  }

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

  list.innerHTML = products.map((product) => {
    const categoryName =
      product.category?.name ||
      product.category ||
      categories.find(
        (category) => Number(category.id) === Number(product.categoryId)
      )?.name ||
      'Без категории';
    const image = product.image || '../images/fallback.png';
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

list?.addEventListener('click', async (event) => {
  const deleteButton = event.target.closest('[data-delete-product]');
  if (!deleteButton) {
    return;
  }

  const productId = deleteButton.dataset.deleteProduct;
  const product = products.find(
    (item) => String(item.id) === productId
  );

  if (!product) {
    return;
  }

  if (!window.confirm(`Удалить товар «${product.name}»?`)) {
    return;
  }

  const message = document.querySelector('#products-message');
  deleteButton.disabled = true;
  deleteButton.textContent = 'Удаляем...';

  try {
    const response = await fetch(
      'https://server-zebrabro.onrender.com/api/products',
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id: product.id })
      }
    );

    if (!response.ok) {
      throw new Error(`Сервер вернул ошибку ${response.status}.`);
    }

    const refreshed = await getProducts();
    if (message) {
      message.textContent = refreshed
        ? `Товар «${product.name}» удалён.`
        : `Товар «${product.name}» удалён, но список не удалось обновить.`;
      message.dataset.state = refreshed ? 'success' : 'error';
    }
  } catch (error) {
    console.error('Не удалось удалить товар:', error);

    if (message) {
      message.textContent =
        `Не удалось удалить товар. ${error.message}`;
      message.dataset.state = 'error';
    }

    deleteButton.disabled = false;
    deleteButton.textContent = 'Удалить товар';
  }
});
    //добавление данных на сервер
document.querySelector('#category-form').addEventListener('submit', async (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  const data = new FormData(form);

  const name = data.get('category').trim();

  const category = {
    name: name
  }
  console.log(category)
  try {
    const response = await fetch('https://server-zebrabro.onrender.com/api/categories', {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(category)
    })

    const result = await response.json();

    console.log('Ответ сервера:', result);

    if (!response.ok) {
        throw new Error(result.message || 'Ошибка сервера');
    }

    console.log('Товар добавлен:', result);

  } catch (error) {
    console.error('ОШИБКА:', error);

    document.querySelector('#form-message').textContent =
        'Ошибка при добавлении товара!';
  }
  
  form.reset();
  getCategories();
});

document.querySelector('#product-form').addEventListener('submit', async (event) => {

    event.preventDefault();


    const form = event.currentTarget;

    const data = new FormData(form);


    const name = data.get('name').trim();

    const price = Number(data.get('price'));

    const categoryId = Number(data.get('categoryId'));
/*
    const stock = Number(data.get('stock'));

    const image = data.get('image').trim();

    const description = data.get('description').trim();
*/
    console.log(categoryId)
     
      const product = {
        name: name,
        price: price,
        categoryId: categoryId
      }
      try {

    console.log('Отправляем на сервер:', product);

    const response = await fetch(
        'https://server-zebrabro.onrender.com/api/products',
        {
            method: 'POST',

            headers: {
                'Content-Type': 'application/json'
            },

            body: JSON.stringify(product)
        }
    );

    const result = await response.json();

    console.log('Ответ сервера:', result);

    if (!response.ok) {
        throw new Error(result.message || 'Ошибка сервера');
    }

    console.log('Товар добавлен:', result);

    document.querySelector('#form-message').textContent =
        'Товар успешно добавлен!';

    form.reset();
    await getProducts();

} catch (error) {

    console.error('ОШИБКА:', error);

    document.querySelector('#form-message').textContent =
        'Ошибка при добавлении товара!';
}
});

      //поисковики
const categorySearch = document.querySelector('#category-search');
const categorySelect = document.querySelector('#edit-category-select');

categorySearch.addEventListener('input', () => {
    const search = categorySearch.value.toLowerCase();

    const filteredCategories = categories.filter(category =>
        category.name.toLowerCase().includes(search)
    );

    categorySelect.innerHTML = `
        <option value="">
            Выберите категорию
        </option>
    `;

    filteredCategories.forEach(category => {
        const option = document.createElement('option');

        option.value = category.id;
        option.textContent = category.name;

        categorySelect.appendChild(option);
    });
});

const productSearch = document.querySelector('#product-search');
const productSelect = document.querySelector('#edit-product-select');

productSearch.addEventListener('input', () => {
    const search = productSearch.value.toLowerCase();

    const filteredProducts = products.filter(product =>
        product.name.toLowerCase().includes(search)
    );

    productSelect.innerHTML = `
        <option value="">
            Выберите товар
        </option>
    `;

    filteredProducts.forEach(product => {
        const option = document.createElement('option');

        option.value = product.id;
        option.textContent = product.name;

        productSelect.appendChild(option);
    });
});

        //изменения значений
document.querySelector('#edit-category-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const id = Number(data.get('categoryId'));
  const newName = data.get('name').trim();

  const patсhCategory = {
    id: id,
    name: newName
  };
  try {
    const response = await fetch('https://server-zebrabro.onrender.com/api/categories', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(patсhCategory)
  });
    const result = await response.json();
  } catch (error) {
    console.error('ОШИБКА:', error);

    document.querySelector('#form-message').textContent =
        'Ошибка при изменении товара!';
  }
  getProducts();
  getCategories();
});

document.querySelector('#edit-product-form').addEventListener('submit', async (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  const data = new FormData(form);

  const id = Number(data.get('productId'));
  const newName = data.get('name').trim();
  const newPrice = Number(data.get('price'));
  const newCategoryId = Number(data.get('categoryId'));
  const patchProduct = {
    id: id,
    name: newName,
    price: newPrice,
    categoryId: newCategoryId
  }

  try {
    const response = await fetch('https://server-zebrabro.onrender.com/api/products', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(patchProduct)
    })

    const result = await response.json();
    console.log(result);
  } catch (error) {
    console.error('ОШИБКА:', error);

    document.querySelector('#form-message').textContent =
        'Ошибка при изменении товара!';
  }
  form.reset();
  getProducts();
  getCategories();
});
getProducts();
getCategories();
/*
  function renderProducts() {

    list.innerHTML = products.map((product) => `

      <article class="product-card">

        <div class="product-image">

          <img
            src="${product.image || '../images/fallback.png'}"
            alt="${product.name}"
            onerror="this.src='../images/fallback.png'"
          >

        </div>


        <h3 class="product-name">
          ${product.name}
        </h3>


        <div class="product-category">
          ${product.category}
        </div>


        <p class="product-description">
          ${product.description || 'Описание отсутствует.'}
        </p>


        <div class="product-bottom">

          <div class="product-price">
            ${product.price.toLocaleString('ru-RU')} ₽
          </div>

          <div class="product-stock">
            На складе: ${product.stock}
          </div>

        </div>

      </article>

    `).join('');

  }
*/