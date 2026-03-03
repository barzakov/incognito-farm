import { supabase, calculateBestDiscount } from '../../lib/supabaseClient.js';
import { loadComponents } from '../../lib/components.js';
import { toast } from '../../lib/toast.js';
import { getCart, saveCart, addToCart, updateCartBadge } from '../../lib/cartUtils.js';

let discountedProducts = [];

// ── Auth status ──────────────────────────────────────────────

function toggleGuestCta(isLoggedIn) {
  const ctaSection = document.querySelector('.cta-section');
  if (!ctaSection) return;

  ctaSection.classList.toggle('d-none', Boolean(isLoggedIn));
}

async function checkAuthStatus() {
  if (!supabase) {
    toggleGuestCta(false);
    return;
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    toggleGuestCta(Boolean(user));
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
  if (!supabase) {
    carousel.innerHTML = `
      <div class="text-center text-danger py-5 w-100">
        <i class="bi bi-exclamation-circle fs-1"></i>
        <p class="mt-3">Липсва връзка с базата данни</p>
      </div>`;
    return;
  }

  try {
    // Fetch available products and prioritize discounted ones.
    // If discounted products are less than 3, fill with regular products.
    const { data: products, error } = await supabase
      .from('products')
      .select(`
        product_id,
        images_location,
        description,
        extra,
        group_id,
        price,
        discount,
        availability,
        created_on,
        product_group!left(
          group_id,
          name,
          group_discount,
          discount!left(
            discount_id,
            discount_percentage,
            start_date,
            end_date
          )
        )
      `)
      .eq('availability', true)
      .order('created_on', { ascending: false })
      .limit(30);

    if (error) throw error;

    const withCalculatedDiscounts = (products || []).map((p) => {
      const groupDiscount = p.product_group?.discount || null;
      const discountInfo = calculateBestDiscount(p.price, p.discount, groupDiscount);
      return {
        ...p,
        finalPrice: discountInfo.finalPrice,
        discountApplied: discountInfo.discountApplied,
        discountSource: discountInfo.discountSource,
      };
    });

    // Discounted products sorted by biggest discount percentage first.
    const discounted = withCalculatedDiscounts
      .filter(p => p.discountApplied != null && Number(p.discountApplied) > 0 && Number(p.finalPrice) < Number(p.price))
      .sort((a, b) => {
        const pctDiff = Number(b.discountApplied) - Number(a.discountApplied);
        if (pctDiff !== 0) return pctDiff;

        const bSaving = Number(b.price) - Number(b.finalPrice);
        const aSaving = Number(a.price) - Number(a.finalPrice);
        return bSaving - aSaving;
      });

    const discountedIds = new Set(discounted.map(p => p.product_id));
    const regular = withCalculatedDiscounts.filter(p => !discountedIds.has(p.product_id));

    const minimumItems = 6;
    const prioritizedProducts = discounted.length >= minimumItems
      ? discounted
      : [...discounted, ...regular].slice(0, Math.min((products || []).length, minimumItems));

    discountedProducts = prioritizedProducts;

    if (prioritizedProducts.length === 0) {
      carousel.innerHTML = `
        <div class="text-center text-muted py-5 w-100">
          <i class="bi bi-inbox fs-1"></i>
          <p class="mt-3">Няма налични продукти</p>
        </div>`;
      return;
    }

    carousel.innerHTML = prioritizedProducts.map(p => {
      const name = p.description?.name || 'Продукт';
      const brief = p.description?.brief_info || '';
      const hasDiscount = p.discountApplied != null && Number(p.discountApplied) > 0 && Number(p.finalPrice) < Number(p.price);
      const price = p.price != null ? Number(p.price).toFixed(2) : null;
      const discountedPrice = hasDiscount ? Number(p.finalPrice).toFixed(2) : null;
      const savePct = hasDiscount ? Math.round(Number(p.discountApplied)) : 0;

      let img = '<span class="carousel-emoji">🌾</span>';
      if (p.images_location) {
        const url = supabase.storage.from('products').getPublicUrl(p.images_location).data.publicUrl;
        img = `<img src="${url}" alt="${name}" loading="lazy">`;
      }

      return `
        <div class="carousel-card" data-product-id="${p.product_id}">
          ${hasDiscount ? `<div class="carousel-badge">-${savePct}%</div>` : ''}
          <div class="carousel-card-image">${img}</div>
          <div class="carousel-card-body">
            <h5 class="carousel-card-title">${name}</h5>
            <p class="carousel-card-brief">${brief}</p>
            <div class="carousel-card-pricing">
              ${hasDiscount
    ? `<span class="old-price">${price} лв.</span>
              <span class="new-price">${discountedPrice} лв.</span>`
    : `<span class="new-price">${price ? `${price} лв.` : 'По запитване'}</span>`}
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
  const discounted = product.finalPrice != null && Number(product.finalPrice) < Number(product.price)
    ? `${Number(product.finalPrice).toFixed(2)} лв.`
    : null;

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

  // Reset quantity selector
  const qtyInput = document.getElementById('modalQtyInput');
  if (qtyInput) qtyInput.value = 1;

  modal.show();
}

// ── Init ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  await loadComponents();
  await checkAuthStatus();

  if (supabase) {
    supabase.auth.onAuthStateChange((_event, session) => {
      toggleGuestCta(Boolean(session?.user));
    });
  }

  await loadDiscountCarousel();

  // Modal add-to-cart handler
  const modalBtn = document.getElementById('modalAddToCartBtn');
  if (modalBtn) {
    modalBtn.addEventListener('click', function () {
      const productId = parseInt(this.dataset.productId);
      const productName = this.dataset.productName;
      const qtyInput = document.getElementById('modalQtyInput');
      const quantity = Math.max(1, parseInt(qtyInput?.value) || 1);
      addToCart(productId, quantity);
      toast.success(`"${productName}" x${quantity} е добавена в каруцата!`);
      const modal = bootstrap.Modal.getInstance(document.getElementById('productModal'));
      modal.hide();
    });
  }

  // Quantity selector buttons
  document.getElementById('modalQtyMinus')?.addEventListener('click', () => {
    const input = document.getElementById('modalQtyInput');
    const val = parseInt(input.value) || 1;
    if (val > 1) input.value = val - 1;
  });
  document.getElementById('modalQtyPlus')?.addEventListener('click', () => {
    const input = document.getElementById('modalQtyInput');
    const val = parseInt(input.value) || 1;
    if (val < 99) input.value = val + 1;
  });
});
