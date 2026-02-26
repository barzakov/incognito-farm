import { supabase } from '../../lib/supabaseClient.js';
import { loadComponents } from '../../lib/components.js';
import { toast } from '../../lib/toast.js';

// Initialize filter buttons
function initializeFilters() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

// Load products from database
async function loadProducts() {
  const grid = document.getElementById('productsGrid');
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .eq('availability', true)
      .order('product_id', { ascending: false });

    if (error) throw error;

    if (!products || products.length === 0) {
      grid.innerHTML = `
        <div class="col-12 text-center text-muted py-5">
          <i class="bi bi-inbox fs-1"></i>
          <p class="mt-3">Няма налични продукти</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = products.map((p) => {
      const productName = p.description?.name || 'Продукт';
      const briefInfo = p.description?.brief_info || '';
      const price = p.price != null ? `${Number(p.price).toFixed(2)} лв.` : 'По запитване';
      const discountedPrice = p.discount != null ? `${Number(p.discount).toFixed(2)} лв.` : null;
      
      let productImage = '🌾';
      if (p.images_location) {
        const publicUrl = supabase.storage.from('products').getPublicUrl(p.images_location).data.publicUrl;
        productImage = `<img src="${publicUrl}" alt="${productName}" style="width: 100%; height: 200px; object-fit: cover;">`;
      }

      return `
        <div class="col-md-6 col-lg-4">
          <div class="card h-100 shadow-sm rounded-4 product-item">
            <div class="card-body text-center">
              <div class="product-img fs-1 mb-3" style="overflow: hidden; height: 200px; display: flex; align-items: center; justify-content: center; border-radius: 8px; background: #f8f9fa;">
                ${productImage}
              </div>
              <h5 class="card-title">${productName}</h5>
              <p class="product-category text-muted">${briefInfo}</p>
              <div class="product-pricing">
                ${discountedPrice ? `
                  <p class="product-price text-muted" style="text-decoration: line-through; font-size: 0.9rem;">${price}</p>
                  <p class="product-price fw-bold text-success">${discountedPrice}</p>
                ` : `
                  <p class="product-price fw-bold text-success">${price}</p>
                `}
              </div>
              <button class="btn btn-success btn-sm" data-product-id="${p.product_id}" data-product-name="${productName}">
                <i class="bi bi-cart-plus"></i> Добави в кошница
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    attachAddToCartHandlers();
  } catch (err) {
    console.error('Error loading products:', err);
    grid.innerHTML = `
      <div class="col-12 text-center text-danger py-5">
        <i class="bi bi-exclamation-circle fs-1"></i>
        <p class="mt-3">Грешка при зареждане на продукти</p>
      </div>
    `;
  }
}

function attachAddToCartHandlers() {
  document.querySelectorAll('[data-product-id]').forEach((btn) => {
    if (btn.className.includes('btn')) {
      btn.addEventListener('click', () => {
        const productName = btn.dataset.productName;
        toast.success(`"${productName}" е добавена в кошницата!`);
      });
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadComponents();
  initializeFilters();
  await loadProducts();
});
