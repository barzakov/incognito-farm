import { supabase, fetchProductsWithGroupDiscounts, calculateBestDiscount } from '../../lib/supabaseClient.js';
import { loadComponents } from '../../lib/components.js';
import { toast } from '../../lib/toast.js';

let allProducts = [];
let selectedGroupId = null;

const CART_STORAGE_KEY = 'incognito_farm_cart';

// Cart functions
function getCart() {
  try {
    const cart = localStorage.getItem(CART_STORAGE_KEY);
    return cart ? JSON.parse(cart) : [];
  } catch (error) {
    console.error('Error reading cart:', error);
    return [];
  }
}

function saveCart(cart) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    updateCartBadge();
  } catch (error) {
    console.error('Error saving cart:', error);
  }
}

function addToCart(productId, quantity = 1) {
  const cart = getCart();
  const existingItem = cart.find(item => item.productId === productId);
  
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    cart.push({ productId, quantity });
  }
  
  saveCart(cart);
}

function updateCartBadge() {
  const cart = getCart();
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const badge = document.getElementById('cart-badge');
  
  if (badge) {
    if (totalItems > 0) {
      badge.textContent = totalItems;
      badge.classList.remove('d-none');
    } else {
      badge.classList.add('d-none');
    }
  }
}

function formatDateForBulgarianUsers(dateValue) {
  if (!dateValue || typeof dateValue !== 'string') return '';

  const normalizedValue = dateValue.includes('T') ? dateValue : `${dateValue}T00:00:00`;
  const parsedDate = new Date(normalizedValue);

  if (Number.isNaN(parsedDate.getTime())) return dateValue;
  return parsedDate.toLocaleDateString('bg-BG');
}

// Load product groups and create filter buttons
async function loadGroups() {
  const filterContainer = document.getElementById('filterButtons');
  try {
    const { data: groups, error } = await supabase
      .from('product_group')
      .select('*')
      .order('group_id', { ascending: true });

    if (error) throw error;

    let buttonsHTML = '<button class="btn btn-outline-success filter-btn active" data-group-id="all">Всички</button>';
    
    if (groups && groups.length > 0) {
      buttonsHTML += groups.map(group => `
        <button class="btn btn-outline-success filter-btn" data-group-id="${group.group_id}">${group.name}</button>
      `).join('');
    }

    filterContainer.innerHTML = buttonsHTML;
    initializeFilters();
  } catch (err) {
    console.error('Error loading groups:', err);
    filterContainer.innerHTML = '<p class="text-danger">Грешка при зареждане на групи</p>';
  }
}

// Initialize filter buttons
function initializeFilters() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      
      const groupId = btn.dataset.groupId;
      selectedGroupId = groupId === 'all' ? null : parseInt(groupId);
      filterAndDisplayProducts();
    });
  });
}

// Filter and display products
function filterAndDisplayProducts() {
  const filteredProducts = selectedGroupId === null 
    ? allProducts 
    : allProducts.filter(p => p.group_id === selectedGroupId);
  
  displayProducts(filteredProducts);
}

// Load products from database
async function loadProducts() {
  try {
    const { data: productsWithDiscounts, error } = await supabase
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
      .order('product_id', { ascending: false });

    if (error) throw error;

    // Enrich products with best discount calculation
    allProducts = (productsWithDiscounts || []).map(p => {
      const groupDiscount = p.product_group?.discount || null;
      const discountInfo = calculateBestDiscount(p.price, p.discount, groupDiscount);
      
      return {
        ...p,
        finalPrice: discountInfo.finalPrice,
        discountApplied: discountInfo.discountApplied,
        discountSource: discountInfo.discountSource,
      };
    });

    filterAndDisplayProducts();
  } catch (err) {
    console.error('Error loading products:', err);
    const grid = document.getElementById('productsGrid');
    grid.innerHTML = `
      <div class="col-12 text-center text-danger py-5">
        <i class="bi bi-exclamation-circle fs-1"></i>
        <p class="mt-3">Грешка при зареждане на продукти</p>
      </div>
    `;
  }
}

// Display products in grid
function displayProducts(products) {
  const grid = document.getElementById('productsGrid');
  
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
    const finalPrice = p.finalPrice != null && p.finalPrice !== p.price ? `${Number(p.finalPrice).toFixed(2)} лв.` : null;
    
    let productImage = '🌾';
    if (p.images_location) {
      const publicUrl = supabase.storage.from('products').getPublicUrl(p.images_location).data.publicUrl;
      productImage = `<img src="${publicUrl}" alt="${productName}" style="width: 100%; height: 200px; object-fit: cover;">`;
    }

    return `
      <div class="col-md-6 col-lg-4">
        <div class="card h-100 shadow-sm rounded-4 product-item" style="cursor: pointer;" data-product-id="${p.product_id}">
          <div class="card-body text-center">
            <div class="product-img fs-1 mb-3" style="overflow: hidden; height: 200px; display: flex; align-items: center; justify-content: center; border-radius: 8px; background: #f8f9fa;">
              ${productImage}
            </div>
            <h5 class="card-title">${productName}</h5>
            <p class="product-category text-muted">${briefInfo}</p>
            <div class="product-pricing">
              ${finalPrice ? `
                <p class="product-price text-muted" style="text-decoration: line-through; font-size: 0.9rem;">${price}</p>
                <p class="product-price fw-bold text-success">${finalPrice}</p>
                <small class="text-muted">${p.discountSource === 'group' ? '(Отстъпка на група)' : '(Специална цена)'}</small>
              ` : `
                <p class="product-price fw-bold text-success">${price}</p>
              `}
            </div>
            <button class="btn btn-success btn-sm add-to-cart-btn d-inline-flex align-items-center justify-content-center gap-2" data-product-id="${p.product_id}" data-product-name="${productName}" onclick="event.stopPropagation();">
              <img src="/pages/cart/karuca.svg" alt="" class="btn-cart-icon" /> Добави в каруца
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  attachAddToCartHandlers();
  attachProductDetailHandlers();
}

function attachAddToCartHandlers() {
  document.querySelectorAll('.add-to-cart-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const productId = parseInt(btn.dataset.productId);
      const productName = btn.dataset.productName;
      addToCart(productId);
      toast.success(`"${productName}" е добавена в каруцата!`);
    });
  });
}

function attachProductDetailHandlers() {
  document.querySelectorAll('.product-item').forEach((card) => {
    card.addEventListener('click', () => {
      const productId = parseInt(card.dataset.productId);
      const product = allProducts.find(p => p.product_id === productId);
      if (product) {
        showProductDetail(product);
      }
    });
  });
}

function showProductDetail(product) {
  const productName = product.description?.name || 'Продукт';
  const fullInfo = product.description?.info || product.description?.brief_info || 'Няма описание';
  const briefInfo = product.description?.brief_info || 'Няма кратка информация';
  const price = product.price != null ? `${Number(product.price).toFixed(2)} лв.` : 'По запитване';
  const finalPrice = product.finalPrice != null && product.finalPrice !== product.price ? `${Number(product.finalPrice).toFixed(2)} лв.` : null;

  let productImage = '🌾';
  if (product.images_location) {
    const publicUrl = supabase.storage.from('products').getPublicUrl(product.images_location).data.publicUrl;
    productImage = `<img src="${publicUrl}" alt="${productName}">`;
  }

  document.getElementById('productDetailName').textContent = productName;
  document.getElementById('productDetailImage').innerHTML = productImage;
  document.getElementById('productDetailFullInfo').textContent = fullInfo;
  document.getElementById('productDetailShortInfo').textContent = briefInfo;
  
  // Update modal button with product data
  const modalBtn = document.getElementById('modalAddToCartBtn');
  modalBtn.dataset.productId = product.product_id;
  modalBtn.dataset.productName = productName;

  document.getElementById('productDetailPricing').innerHTML = finalPrice
    ? `
      <p class="original-price mb-1">Оригинална цена: ${price}</p>
      <p class="final-price mb-0">Цена: ${finalPrice}</p>
      <small class="text-muted">${product.discountSource === 'group' ? 'Отстъпка на група' : 'Специална цена'}</small>
    `
    : `
      <p class="final-price mb-0">Цена: ${price}</p>
    `;

  // Display extra information if available
  const extraContainer = document.getElementById('productDetailExtra');
  if (product.extra && typeof product.extra === 'object' && Object.keys(product.extra).length > 0) {
    // Field name translations to Bulgarian
    const fieldTranslations = {
      'expire': 'Срок на годност',
      'size': 'Размер',
      'country': 'Страна',
      'weight': 'Тегло',
      'origin': 'Произход',
      'manufacturer': 'Производител',
      'ingredients': 'Съставки'
    };
    
    // Filter out null, undefined, empty strings, and invalid values
    const validEntries = Object.entries(product.extra).filter(([key, value]) => {
      return value !== null && 
             value !== undefined && 
             value !== '' && 
             typeof value !== 'object';
    });
    
    if (validEntries.length > 0) {
      const extraHTML = validEntries
        .map(([key, value]) => {
          const displayKey = fieldTranslations[key] || key;
          const displayValue = key === 'expire'
            ? formatDateForBulgarianUsers(value)
            : value;

          return `
            <div class="extra-info-item mb-2">
              <strong>${displayKey}:</strong> ${displayValue}
            </div>
          `;
        })
        .join('');
      extraContainer.innerHTML = `
        <div class="extra-info-section">
          <h6>Допълнителна информация</h6>
          ${extraHTML}
        </div>
      `;
    } else {
      extraContainer.innerHTML = '';
    }
  } else {
    extraContainer.innerHTML = '';
  }

  const modal = new bootstrap.Modal(document.getElementById('productModal'));
  updateCartBadge();

  // Reset quantity selector
  const qtyInput = document.getElementById('modalQtyInput');
  if (qtyInput) qtyInput.value = 1;

  modal.show();
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadComponents();
  await loadGroups();
  await loadProducts();
  
  // Handle add to cart from modal
  document.getElementById('modalAddToCartBtn').addEventListener('click', function() {
    const productId = parseInt(this.dataset.productId);
    const productName = this.dataset.productName;
    const qtyInput = document.getElementById('modalQtyInput');
    const quantity = Math.max(1, parseInt(qtyInput?.value) || 1);
    addToCart(productId, quantity);
    toast.success(`"${productName}" x${quantity} е добавена в каруцата!`);
    const modal = bootstrap.Modal.getInstance(document.getElementById('productModal'));
    modal.hide();
  });

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
