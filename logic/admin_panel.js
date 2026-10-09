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
}

async function getProducts() {
  const response = await fetch('https://server-zebrabro.onrender.com/api/products', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  const result = await response.json();
  products = result;
  renderProducts();
  console.log(products);
}

  //рендер полученных данных
function renderCategories() {

  const selects = [
    document.querySelector('#product-category'),
    document.querySelector('#edit-category-select'),
    document.querySelector('#edit-product-category')
  ];

  selects.forEach((select) => {

        categories.forEach((category) => {

            const option = document.createElement('option');

            option.value = category.id;
            option.textContent = category.name;

            select.appendChild(option);
        });

    });

}

function renderProducts() {
  const selectsProduct = [
    document.querySelector('#edit-product-select')
  ];
    
  selectsProduct.forEach((select) => {

    products.forEach((product) => {

      const option = document.createElement('option');

      option.value = product.id;
      option.textContent = product.name;

      select.appendChild(option);

    });
  });
}
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