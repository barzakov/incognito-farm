import { supabase } from '../../lib/supabaseClient.js';
import { loadComponents } from '../../lib/components.js';
import { toast } from '../../lib/toast.js';

const CART_STORAGE_KEY = 'incognito_farm_cart';
let discountedProducts = [];

// ── Cart helpers ──────────────────────────────────────────────

function getCart() {
  try {
    const cart = localStorage.getItem(CART_STORAGE_KEY);
    return cart ? JSON.parse(cart) : [];
  } catch { return []; }
}

function saveCart(cart) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    updateCartBadge();
  } catch (e) { console.error('Error saving cart:', e); }
}

function addToCart(productId) {
  const cart = getCart();
  const existing = cart.find(i => i.productId === productId);
  if (existing) { existing.quantity += 1; } else { cart.push({ productId, quantity: 1 }); }
  saveCart(cart);
}

function updateCartBadge() {
  const cart = getCart();
  const total = cart.reduce((s, i) => s + i.quantity, 0);
  const badge = document.getElementById('cart-badge');
  if (badge) {
    if (total > 0) { badge.textContent = total; badge.classList.remove('d-none'); }
    else { badge.classList.add('d-none'); }
  }
}

// ── Auth status ──────────────────────────────────────────────

async function checkAuthStatus() {
  if (!supabase) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) updateAuthUI(user);
  } catch (error) { console.error('Error checking auth:', error); }
}

function updateAuthUI(user) {
  const authLinks = document.querySelector('.nav-auth');
  if (!authLinks) return;
  authLinks.innerHTML = `
    <a href="/profile/" class="nav-link">Профил</a>
    <button id="logoutBtn" class="btn btn-danger btn-sm">Изход</button>
  `;
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await supabase.auth.signOut();
        toast.success('Успешно излязохте');
        setTimeout(() => { window.location.href = '/'; }, 1000);
      } catch { toast.error('Грешка при изход'); }
    });
  }
}

// ── Date formatting ──────────────────────────────────────────

function formatDateBG(dateValue) {
  if (!dateValue || typeof dateValue !== 'string') return '';
  const d = new Date(dateValue.includes('T') ? dateValue : `${dateValue}T00:00:00`);
  return Number.isNaN(d.getTime()) ? dateValue : d.toLocaleDateString('bg-BG');
}

// ── Discount carousel ────────────────────────────────────────

async function loadDiscountCarousel() {
  const carousel = document.getElementById('discountCarousel');
  if (!carousel) return;

  try {
    // Fetch available products that have a discount (discount < price)
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .eq('availability', true)
      .not('discount', 'is', null)
      .order('discount', { ascending: true })
      .limit(10);

    if (error) throw error;

    // Sort by biggest saving (price - discount) descending
    const sorted = (products || [])
      .filter(p => p.price != null && p.discount != null && Number(p.discount) < Number(p.price))
      .sort((a, b) => (Number(b.price) - Number(b.discount)) - (Number(a.price) - Number(a.discount)));

    discountedProducts = sorted;

    if (sorted.length === 0) {
      carousel.innerHTML = `
        <div class="text-center text-muted py-5 w-100">
          <i class="bi bi-inbox fs-1"></i>
          <p class="mt-3">Няма намалени продукти</p>
        </div>`;
      return;
    }

    carousel.innerHTML = sorted.map(p => {
      const name = p.description?.name || 'Продукт';
      const brief = p.description?.brief_info || '';
      const price = Number(p.price).toFixed(2);
      const discounted = Number(p.discount).toFixed(2);
      const savePct = Math.round(((p.price - p.discount) / p.price) * 100);

      let img = '<span class="carousel-emoji">🌾</span>';
      if (p.images_location) {
        const url = supabase.storage.from('products').getPublicUrl(p.images_location).data.publicUrl;
        img = `<img src="${url}" alt="${name}" loading="lazy">`;
      }

      return `
        <div class="carousel-card" data-product-id="${p.product_id}">
          <div class="carousel-badge">-${savePct}%</div>
          <div class="carousel-card-image">${img}</div>
          <div class="carousel-card-body">
            <h5 class="carousel-card-title">${name}</h5>
            <p class="carousel-card-brief">${brief}</p>
            <div class="carousel-card-pricing">
              <span class="old-price">${price} лв.</span>
              <span class="new-price">${discounted} лв.</span>
            </div>
          </div>
        </div>`;
    }).join('');

    attachCarouselClickHandlers();
    initCarouselControls();
  } catch (err) {
    console.error('Error loading discount carousel:', err);
    carousel.innerHTML = `
      <div class="text-center text-danger py-5 w-100">
        <i class="bi bi-exclamation-circle fs-1"></i>
        <p class="mt-3">Грешка при зареждане</p>
      </div>`;
  }
}

// ── Carousel scrolling ───────────────────────────────────────

function initCarouselControls() {
  const carousel = document.getElementById('discountCarousel');
  const prevBtn = document.getElementById('carouselPrev');
  const nextBtn = document.getElementById('carouselNext');
  if (!carousel || !prevBtn || !nextBtn) return;

  const scrollAmount = () => {
    const card = carousel.querySelector('.carousel-card');
    return card ? card.offsetWidth + 20 : 300;
  };

  prevBtn.addEventListener('click', () => {
    carousel.scrollBy({ left: -scrollAmount(), behavior: 'smooth' });
  });
  nextBtn.addEventListener('click', () => {
    carousel.scrollBy({ left: scrollAmount(), behavior: 'smooth' });
  });

  // Auto-scroll every 4 seconds
  let autoScroll = setInterval(() => {
    const maxScroll = carousel.scrollWidth - carousel.clientWidth;
    if (carousel.scrollLeft >= maxScroll - 5) {
      carousel.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      carousel.scrollBy({ left: scrollAmount(), behavior: 'smooth' });
    }
  }, 4000);

  // Pause auto-scroll on hover
  carousel.addEventListener('mouseenter', () => clearInterval(autoScroll));
  carousel.addEventListener('mouseleave', () => {
    autoScroll = setInterval(() => {
      const maxScroll = carousel.scrollWidth - carousel.clientWidth;
      if (carousel.scrollLeft >= maxScroll - 5) {
        carousel.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        carousel.scrollBy({ left: scrollAmount(), behavior: 'smooth' });
      }
    }, 4000);
  });
}

// ── Click → product detail modal ─────────────────────────────

function attachCarouselClickHandlers() {
  document.querySelectorAll('.carousel-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = parseInt(card.dataset.productId);
      const product = discountedProducts.find(p => p.product_id === id);
      if (product) showProductDetail(product);
    });
  });
}

function showProductDetail(product) {
  const name = product.description?.name || 'Продукт';
  const fullInfo = product.description?.info || product.description?.brief_info || 'Няма описание';
  const brief = product.description?.brief_info || 'Няма кратка информация';
  const price = product.price != null ? `${Number(product.price).toFixed(2)} лв.` : 'По запитване';
  const discounted = product.discount != null ? `${Number(product.discount).toFixed(2)} лв.` : null;

  let img = '🌾';
  if (product.images_location) {
    const url = supabase.storage.from('products').getPublicUrl(product.images_location).data.publicUrl;
    img = `<img src="${url}" alt="${name}">`;
  }

  document.getElementById('productDetailName').textContent = name;
  document.getElementById('productDetailImage').innerHTML = img;
  document.getElementById('productDetailFullInfo').textContent = fullInfo;
  document.getElementById('productDetailShortInfo').textContent = brief;

  const modalBtn = document.getElementById('modalAddToCartBtn');
  modalBtn.dataset.productId = product.product_id;
  modalBtn.dataset.productName = name;

  document.getElementById('productDetailPricing').innerHTML = discounted
    ? `<p class="original-price mb-1">Оригинална цена: ${price}</p>
       <p class="final-price mb-0">Цена: ${discounted}</p>`
    : `<p class="final-price mb-0">Цена: ${price}</p>`;

  // Extra info
  const extraContainer = document.getElementById('productDetailExtra');
  if (product.extra && typeof product.extra === 'object' && Object.keys(product.extra).length > 0) {
    const translations = {
      expire: 'Срок на годност', size: 'Размер', country: 'Страна',
      weight: 'Тегло', origin: 'Произход', manufacturer: 'Производител',
      ingredients: 'Съставки'
    };
    const entries = Object.entries(product.extra)
      .filter(([, v]) => v != null && v !== '' && typeof v !== 'object');
    if (entries.length > 0) {
      extraContainer.innerHTML = `
        <div class="extra-info-section">
          <h6>Допълнителна информация</h6>
          ${entries.map(([k, v]) => `
            <div class="extra-info-item mb-2">
              <strong>${translations[k] || k}:</strong> ${k === 'expire' ? formatDateBG(v) : v}
            </div>`).join('')}
        </div>`;
    } else { extraContainer.innerHTML = ''; }
  } else { extraContainer.innerHTML = ''; }

  const modal = new bootstrap.Modal(document.getElementById('productModal'));
  updateCartBadge();
  modal.show();
}

// ── Init ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  await loadComponents();
  checkAuthStatus();
  await loadDiscountCarousel();

  // Modal add-to-cart handler
  const modalBtn = document.getElementById('modalAddToCartBtn');
  if (modalBtn) {
    modalBtn.addEventListener('click', function () {
      const productId = parseInt(this.dataset.productId);
      const productName = this.dataset.productName;
      addToCart(productId);
      toast.success(`"${productName}" е добавена в каруцата!`);
      const modal = bootstrap.Modal.getInstance(document.getElementById('productModal'));
      modal.hide();
    });
  }
});
