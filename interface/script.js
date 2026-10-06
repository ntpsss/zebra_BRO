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
   ПОЛНОЭКРАННЫЙ КАТАЛОГ
   ========================================================= */

const catalogButton = $('#catalog-button');
const catalogPanel = $('#catalog-panel');
const catalogClose = $('#catalog-close');

const openCatalog = () => {
  if (!catalogPanel) {
    return;
  }

  catalogPanel.classList.remove('hidden');
  document.body.classList.add('catalog-is-open');

  if (catalogButton) {
    catalogButton.setAttribute('aria-expanded', 'true');
  }
};

const closeCatalog = () => {
  if (!catalogPanel) {
    return;
  }

  catalogPanel.classList.add('hidden');
  document.body.classList.remove('catalog-is-open');

  if (catalogButton) {
    catalogButton.setAttribute('aria-expanded', 'false');
  }
};

if (catalogButton && catalogPanel) {
  catalogButton.addEventListener('click', (event) => {
    event.stopPropagation();

    const isCatalogClosed =
      catalogPanel.classList.contains('hidden');

    if (isCatalogClosed) {
      openCatalog();
    } else {
      closeCatalog();
    }
  });
}

if (catalogClose) {
  catalogClose.addEventListener('click', closeCatalog);
}

document.addEventListener('click', (event) => {
  const clickedInsideCatalog = event.target.closest(
    '#catalog-panel, #catalog-button'
  );

  if (!clickedInsideCatalog) {
    closeCatalog();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeCatalog();
  }
});

/* =========================================================
   ПЕРЕКЛЮЧЕНИЕ КАТЕГОРИЙ В КАТАЛОГЕ
   ========================================================= */

const categoryButtons = $$('.catalog-category');
const categoryCards = $$('[data-category-card]');
const categoryTitle = $('#catalog-category-title');

const categoryTitles = {
  all: 'Выбирайте мебель для дома',
  sale: 'Распродажа мебели',
  new: 'Новинки',
  kitchen: 'Мебель для кухни',
  kids: 'Детская мебель',
  mattresses: 'Матрасы',
  wardrobe: 'Шкафы-купе',
  living: 'Мебель для гостиной',
  hallway: 'Прихожие',
  office: 'Компьютерные и письменные столы',
  shoe: 'Обувницы',
  chests: 'Тумбы и комоды',
  wardrobes: 'Шкафы',
  bedroom: 'Спальни',
  series: 'Серии мебели',
  sets: 'Готовые комплекты',
  grace: 'Коллекция «Грэйс»',
  camellia: 'Коллекция «Камелия»',
  karina: 'КАРИНА со скидкой',
  modules: 'Каталог всех модулей',
  'karina-sale': 'КАРИНА -20%'
};

categoryButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const selectedCategory = button.dataset.category;

    categoryButtons.forEach((categoryButton) => {
      categoryButton.classList.remove('active');
    });

    button.classList.add('active');

    if (categoryTitle) {
      categoryTitle.textContent =
        categoryTitles[selectedCategory] ||
        categoryTitles.all;
    }

    categoryCards.forEach((card) => {
      const cardCategory = card.dataset.categoryCard;

      const shouldShow =
        selectedCategory === 'all' ||
        cardCategory === selectedCategory;

      card.hidden = !shouldShow;
    });
  });
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

const categories = [
  ['Гостиная', 'living-room.png'],
  ['Спальня', 'bedroom.png'],
  ['Кухня', 'kitchen.png'],
  ['Детская', 'kids-room.png'],
  ['Текстиль', 'textile.png'],
  ['Новинки', 'new.png']
];

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

const products = [
  [
    'Диван «Зебра»',
    'sofa.png',
    89990,
    62990,
    4.9,
    148
  ],
  [
    'Кровать «Аристократ» 160×200',
    'bed.png',
    74990,
    52490,
    4.8,
    96
  ],
  [
    'Кресло «Адель»',
    'chair.png',
    29990,
    20990,
    4.7,
    183
  ],
  [
    'Стул «Золотой»',
    'chair-gold.png',
    8990,
    6290,
    4.6,
    211
  ],
  [
    'Шкаф «Версаль»',
    'wardrobe.png',
    109990,
    76990,
    4.8,
    72
  ],
  [
    'Кухня «Модерн»',
    'kitchen.png',
    189990,
    132990,
    4.9,
    54
  ],
  [
    'Торшер «Шампань»',
    'lamp.png',
    15990,
    11190,
    4.7,
    119
  ]
];

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

const carousel = $('#carousel');

if (carousel) {
  carousel.innerHTML = products
    .map(
      (
        [
          name,
          fileName,
          oldPrice,
          newPrice,
          rating,
          reviews
        ],
        index
      ) => {
        const discount = Math.round(
          (1 - newPrice / oldPrice) * 100
        );

        return `
          <article class="product-card">
            <div class="product-image">
              <img
                src="${imagePath(fileName)}"
                alt="${name}"
                onerror="this.onerror=null; this.src='${fallbackImage}'"
              >

              <span class="discount">
                -${discount}%
              </span>

              <button
                class="favorite-button"
                data-fav="${index}"
                type="button"
                aria-label="Добавить в избранное"
              >
                <svg>
                  <use href="#heart"></use>
                </svg>
              </button>
            </div>

            <div class="product-body">
              <h3 class="product-title">
                ${name}
              </h3>

              <div class="rating">
                ${renderStars(rating)}

                <span class="rating-count">
                  ${rating} (${reviews})
                </span>
              </div>

              <div class="price-row">
                <span class="price">
                  ${formatPrice(newPrice)}
                </span>

                <span class="old-price">
                  ${formatPrice(oldPrice)}
                </span>
              </div>

              <button
                class="buy-button"
                data-buy="${index}"
                type="button"
              >
                В корзину
              </button>
            </div>
          </article>
        `;
      }
    )
    .join('');
}

/* =========================================================
   ИЗБРАННОЕ И КОРЗИНА
   ========================================================= */

const favorites = new Set();

const cart = {
  count: 0,
  total: 0
};

if (carousel) {
  carousel.addEventListener('click', (event) => {
    const favoriteButton =
      event.target.closest('[data-fav]');

    const buyButton =
      event.target.closest('[data-buy]');

    if (favoriteButton) {
      const productIndex = Number(
        favoriteButton.dataset.fav
      );

      if (favorites.has(productIndex)) {
        favorites.delete(productIndex);
      } else {
        favorites.add(productIndex);
      }

      favoriteButton.classList.toggle(
        'is-favorite',
        favorites.has(productIndex)
      );

      const favoriteBadge = $('#favBadge');

      if (favoriteBadge) {
        favoriteBadge.textContent = favorites.size;
      }
    }

    if (buyButton) {
      const productIndex = Number(
        buyButton.dataset.buy
      );

      cart.count += 1;
      cart.total += products[productIndex][3];

      const cartBadge = $('#cartBadge');
      const cartSum = $('#cartSum');

      if (cartBadge) {
        cartBadge.textContent = cart.count;
      }

      if (cartSum) {
        cartSum.textContent = formatPrice(cart.total);
      }

      buyButton.textContent = 'Добавлено ✓';

      window.setTimeout(() => {
        buyButton.textContent = 'В корзину';
      }, 1200);
    }
  });
}

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

const searchInputs = [
  $('#desktop-query'),
  $('#mobile-query')
].filter(Boolean);

const filterProducts = (query) => {
  const normalizedQuery = query
    .trim()
    .toLowerCase();

  const productCards = $$('.product-card');

  productCards.forEach((card) => {
    const title = card
      .querySelector('.product-title')
      ?.textContent
      .toLowerCase() || '';

    const shouldShow =
      normalizedQuery === '' ||
      title.includes(normalizedQuery);

    card.hidden = !shouldShow;
  });
};

searchInputs.forEach((input) => {
  input.addEventListener('input', () => {
    filterProducts(input.value);

    searchInputs.forEach((otherInput) => {
      if (otherInput !== input) {
        otherInput.value = input.value;
      }
    });
  });
});

$('#desktop-search')?.addEventListener(
  'submit',
  (event) => {
    event.preventDefault();

    const input = $('#desktop-query');

    if (input) {
      filterProducts(input.value);
    }
  }
);

$('#mobile-search')?.addEventListener(
  'submit',
  (event) => {
    event.preventDefault();

    const input = $('#mobile-query');

    if (input) {
      filterProducts(input.value);
    }
  }
);

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