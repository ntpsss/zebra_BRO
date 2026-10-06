const $ = (s) => document.querySelector(s);
const fmt = (n) => n.toLocaleString('ru-RU') + ' ₽';

// 1. Меню каталога
const menuItems = [
  'Мягкая мебель',
  'Спальни',
  'Гостиные',
  'Шкафы',
  'Кухни',
  'Товары для дома'
];

$('#menuItems').innerHTML = menuItems
  .map(
    (x) => `
      <a href="#" class="flex justify-between items-center px-4 py-3 rounded-xl hover:bg-brand-soft hover:text-brand-dark">
        ${x}
        <svg class="w-4 h-4"><use href="#chev"/></svg>
      </a>
    `
  )
  .join('');

const menu = $('#catalogMenu');

$('#catalogBtn').onclick = (e) => {
  e.stopPropagation();
  menu.classList.toggle('hidden');
};

document.addEventListener('click', (e) => {
  if (!$('#catalogWrap').contains(e.target)) {
    menu.classList.add('hidden');
  }
});

// 2. Очистка полей поиска
document.querySelectorAll('[data-clear]').forEach((b) => {
  b.onclick = () => {
    let i = document.getElementById(b.dataset.clear);
    i.value = '';
    i.focus();
  };
});

// 3. Категории мебели
const cats = [
  ['Гостиная', 'photo-1618221195710-dd6b41faaea6'],
  ['Спальня', 'photo-1616486338812-3dadae4b4ace'],
  ['Кухня', 'photo-1556911220-bff31c812dba'],
  ['Детская', 'photo-1586023492125-27b2c045efd7'],
  ['Текстиль', 'photo-1584100936595-c0654b55a2e2'],
  ['Новинки', 'photo-1600210492486-724fe5c67fb0']
];

const fallback =
  'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=600&q=70';

$('#quickCats').innerHTML = cats
  .map(
    ([n, id]) => `
      <a href="#" class="group text-center">
        <div class="aspect-square rounded-full overflow-hidden shadow-soft ring-4 ring-white group-hover:ring-brand transition">
          <img src="https://images.unsplash.com/${id}?auto=format&fit=crop&w=400&q=75" onerror="this.src='${fallback}'" alt="${n}" class="w-full h-full object-cover group-hover:scale-110 transition duration-500">
        </div>
        <span class="block mt-2 text-sm font-semibold group-hover:text-brand-dark">${n}</span>
      </a>
    `
  )
  .join('');

// 4. Товары и генерация карусели
const products = [
  ['Диван «Зебра»', 'photo-1555041469-a586c61ea9bc', 89990, 62990, 4.9, 148],
  ['Кровать «Аристократ» 160×200', 'photo-1550226891-ef816aed4a98', 74990, 52490, 4.8, 96],
  ['Кресло «Адель»', 'photo-1540574163026-643ea20ade25', 29990, 20990, 4.7, 183],
  ['Стул «Золотой»', 'photo-1567538096630-e0c55bd6374c', 8990, 6290, 4.6, 211],
  ['Шкаф «Версаль»', 'photo-1558997519-83ea9252edf8', 109990, 76990, 4.8, 72],
  ['Кухня «Модерн»', 'photo-1556911220-bff31c812dba', 189990, 132990, 4.9, 54],
  ['Торшер «Шампань»', 'photo-1507473885765-e6ed057f782c', 15990, 11190, 4.7, 119]
];

const stars = (r) =>
  [1, 2, 3, 4, 5]
    .map(
      (i) =>
        `<svg class="w-4 h-4 ${i <= Math.round(r) ? 'text-amber-400' : 'text-neutral-300'}"><use href="#star"/></svg>`
    )
    .join('');

$('#carousel').innerHTML = products
  .map(
    ([name, id, old, nw, r, cnt], i) => `
      <article class="snap-start shrink-0 w-[70%] sm:w-[40%] md:w-[30%] lg:w-[23.5%] bg-[#fffdf9] rounded-2xl shadow-soft hover:shadow-lift transition overflow-hidden flex flex-col border border-[#eee4cf]">
        <div class="relative aspect-[4/3] bg-neutral-100">
          <img src="https://images.unsplash.com/${id}?auto=format&fit=crop&w=600&q=75" onerror="this.src='${fallback}'" alt="${name}" class="w-full h-full object-cover">
          <span class="absolute top-3 left-3 bg-brand text-white text-xs font-bold rounded-lg px-2 py-1">-${Math.round((1 - nw / old) * 100)}%</span>
          <button data-fav="${i}" class="absolute top-3 right-3 w-9 h-9 bg-white rounded-full shadow-soft grid place-items-center text-neutral-500 hover:text-brand-dark">
            <svg class="w-5 h-5"><use href="#heart"/></svg>
          </button>
        </div>
        <div class="p-4 flex flex-col flex-1">
          <h3 class="font-semibold leading-snug min-h-[2.5rem]">${name}</h3>
          <div class="flex items-center gap-1 mt-2">
            ${stars(r)}
            <span class="text-xs text-neutral-500 ml-1">${r} (${cnt})</span>
          </div>
          <div class="mt-3 flex items-baseline gap-2">
            <span class="text-xl font-extrabold text-brand-dark">${fmt(nw)}</span>
            <span class="text-sm text-neutral-400 line-through">${fmt(old)}</span>
          </div>
          <button data-buy="${i}" class="mt-4 w-full bg-brand hover:bg-brand-dark text-white font-semibold rounded-xl py-2.5 transition">
            В корзину
          </button>
        </div>
      </article>
    `
  )
  .join('');

// 5. Обработка избранного и корзины
let fav = new Set();
let cart = { n: 0, sum: 0 };

$('#carousel').addEventListener('click', (e) => {
  let f = e.target.closest('[data-fav]');
  let b = e.target.closest('[data-buy]');

  if (f) {
    let i = +f.dataset.fav;
    fav.has(i) ? fav.delete(i) : fav.add(i);
    f.classList.toggle('text-brand-dark', fav.has(i));
    f.querySelector('svg').style.fill = fav.has(i) ? '#C9A34E' : 'none';
    $('#favBadge').textContent = fav.size;
  }

  if (b) {
    cart.n++;
    cart.sum += products[+b.dataset.buy][3];
    $('#cartBadge').textContent = cart.n;
    $('#cartSum').textContent = fmt(cart.sum);
    b.textContent = 'Добавлено ✓';
    setTimeout(() => {
      b.textContent = 'В корзину';
    }, 1200);
  }
});

// 6. Управление прокруткой карусели
const car = $('#carousel');

$('#prev').onclick = () => {
  car.scrollBy({ left: -car.clientWidth * 0.8, behavior: 'smooth' });
};

$('#next').onclick = () => {
  car.scrollBy({ left: car.clientWidth * 0.8, behavior: 'smooth' });
};

// 7. Форма подписки на рассылку
$('#subForm').onsubmit = (e) => {
  e.preventDefault();
  $('#subMsg').textContent = 'Спасибо! Вы подписались на новости.';
  e.target.reset();
};


