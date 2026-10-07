const { response } = require("express");


  const products = [
    {
      id: 1,
      name: 'Диван «Милан»',
      price: 59990,
      categoryId: 1,
      category: 'Диваны',
      stock: 5,
      description: 'Современный мягкий диван для гостиной.',
      image: '../images/sofa.png'
    },

    {
      id: 2,
      name: 'Кровать «Nordic»',
      price: 74990,
      categoryId: 3,
      category: 'Кровати',
      stock: 3,
      description: 'Удобная кровать в скандинавском стиле.',
      image: '../images/bedroom.png'
    }
  ];


  const list = document.querySelector('#products-list');


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


  renderProducts();


  document
    .querySelector('#product-form')
    .addEventListener('submit', async (event) => {

    event.preventDefault();


    const form = event.currentTarget;

    const data = new FormData(form);


    const name = data.get('name').trim();

    const price = Number(data.get('price'));

    const categoryId = Number(data.get('categoryId'));

    const stock = Number(data.get('stock'));

    const image = data.get('image').trim();

    const description = data.get('description').trim();

    console.log(categoryId)
      const categoryNames = {
        1: 'Диваны',
        2: 'Кресла',
        3: 'Столы',
        4: 'Шкафы',
        5: 'Кровати',
        6: 'Стулья'
      };
      const product = {
        name: name,
        price: price,
        categoryId: categoryId
      }
      try {
        const response = await fetch('https://server-zebrabro.onrender.com/api/products', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },

            body: JSON.stringify(product)
        });

        const result = await response.json();
        
        if(!response.ok) {
            throw new Error(result.message || 'Ошибка добавления товара');
        }

        console.log('Товар добавлен:', result);

        document.querySelector('#form-message').textContent =
        'Товар успешно добавлен!';

        form.reset();
      } catch (error) {
        console.error(error);

        document.querySelector('#form-message').textContent =
        'Ошибка при добалении товара!';
      }

      products.push({

        id: products.length + 1,

        name,

        price,

        categoryId,

        category: categoryNames[categoryId],

        stock,

        image: image || '../images/fallback.png',

        description:
          description ||
          'Описание товара пока не добавлено.'

      });


      renderProducts();


      form.reset();


      document.querySelector('#form-message').textContent =
        'Товар успешно добавлен.';

    });

