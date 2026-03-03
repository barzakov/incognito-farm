import { supabase, fetchCurrentUserProfile, calculateBestDiscount } from '../../lib/supabaseClient.js';
import { loadComponents } from '../../lib/components.js';
import { toast } from '../../lib/toast.js';
import { getCart, saveCart, updateCartBadge } from '../../lib/cartUtils.js';

// Order status definitions
const ORDER_STATUSES = {
  PENDING: 'Чакаща',
  CONFIRMED: 'Потвърдена',
  PROCESSING: 'В обработка',
  SHIPPED: 'Изпратена',
  DELIVERED: 'Доставена',
  CANCELLED: 'Отказана',
  RETURNED: 'Върната',
};

// Cached product data for checkout
let cachedCartProducts = [];
let selectedAddressId = null;

// Load cart items and display
async function loadCartItems() {
  const container = document.getElementById('cart-items-container');
  const cart = getCart();

  if (!cart || cart.length === 0) {
    container.innerHTML = `
      <div class="empty-cart">
        <img src="/pages/cart/karuca.svg" alt="Каруца" class="cart-icon-lg" />
        <p class="mt-3 text-muted">Вашата каруца е празна</p>
        <a href="/products/" class="btn btn-success mt-3">
          <i class="bi bi-arrow-left"></i> Разгледайте продуктите
        </a>
      </div>
    `;
    updateCartSummary([]);
    return;
  }

  // Load product details from database with group discounts
  try {
    const productIds = cart.map(item => item.productId);
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
      .in('product_id', productIds);

    if (error) throw error;

    // Merge cart quantities with product details and calculate best discount
    const cartItems = cart.map(cartItem => {
      const product = products.find(p => p.product_id === cartItem.productId);
      if (!product) return null;

      const groupDiscount = product.product_group?.discount || null;
      const discountInfo = calculateBestDiscount(product.price, product.discount, groupDiscount);

      return {
        ...product,
        quantity: cartItem.quantity,
        finalPrice: discountInfo.finalPrice,
        discountApplied: discountInfo.discountApplied,
        discountSource: discountInfo.discountSource,
      };
    }).filter(item => item !== null);

    cachedCartProducts = cartItems;
    displayCartItems(cartItems);
    updateCartSummary(cartItems);
  } catch (error) {
    console.error('Error loading cart items:', error);
    container.innerHTML = `
      <div class="text-center text-danger py-5">
        <i class="bi bi-exclamation-circle fs-1"></i>
        <p class="mt-3">Грешка при зареждане на каруцата</p>
      </div>
    `;
  }
}

// Display cart items
function displayCartItems(items) {
  const container = document.getElementById('cart-items-container');
  
  container.innerHTML = items.map(item => {
    const productName = item.description?.name || 'Продукт';
    const briefInfo = item.description?.brief_info || '';
    const price = item.price != null ? Number(item.price) : 0;
    const finalPrice = item.finalPrice != null ? Number(item.finalPrice) : price;
    const totalPrice = (finalPrice * item.quantity).toFixed(2);
    const hasDiscount = finalPrice < price;

    let productImage = `
      <div class="cart-item-placeholder">
        🌾
      </div>
    `;
    if (item.images_location) {
      const publicUrl = supabase.storage.from('products').getPublicUrl(item.images_location).data.publicUrl;
      productImage = `<img src="${publicUrl}" alt="${productName}" class="cart-item-image">`;
    }

    return `
      <div class="cart-item" data-product-id="${item.product_id}">
        ${productImage}
        
        <div class="cart-item-details">
          <div>
            <h6 class="cart-item-title">${productName}</h6>
            ${briefInfo ? `<p class="cart-item-brief">${briefInfo}</p>` : ''}
          </div>
          
          <div class="cart-item-actions">
            <div class="quantity-control">
              <button class="btn-decrease" data-product-id="${item.product_id}">
                <i class="bi bi-dash"></i>
              </button>
              <input type="number" value="${item.quantity}" min="1" max="99" readonly>
              <button class="btn-increase" data-product-id="${item.product_id}">
                <i class="bi bi-plus"></i>
              </button>
            </div>
            
            <button class="btn-remove-item" data-product-id="${item.product_id}" title="Премахни">
              <i class="bi bi-trash"></i> Премахни
            </button>
          </div>
        </div>
        
        <div class="cart-item-price">
          <div>
            ${hasDiscount ? `
              <div class="cart-item-original-price">${price.toFixed(2)} лв.</div>
              <div class="cart-item-unit-price">${finalPrice.toFixed(2)} лв. / бр.</div>
              <small class="text-muted">${item.discountSource === 'group' ? '(Отстъпка на група)' : '(Специална цена)'}</small>
            ` : `
              <div class="cart-item-unit-price">${price.toFixed(2)} лв. / бр.</div>
            `}
          </div>
          <div class="cart-item-total-price">${totalPrice} лв.</div>
        </div>
      </div>
    `;
  }).join('');

  attachCartHandlers();
}

// Update cart summary
function updateCartSummary(items) {
  const subtotal = items.reduce((sum, item) => {
    const finalPrice = item.finalPrice != null ? Number(item.finalPrice) : Number(item.price);
    return sum + (finalPrice * item.quantity);
  }, 0);

  document.getElementById('cart-subtotal').textContent = `${subtotal.toFixed(2)} лв.`;
  document.getElementById('cart-total').textContent = `${subtotal.toFixed(2)} лв.`;
  
  const checkoutBtn = document.getElementById('checkout-btn');
  if (items.length > 0) {
    checkoutBtn.disabled = false;
  } else {
    checkoutBtn.disabled = true;
  }
}

// Attach event handlers
function attachCartHandlers() {
  // Increase quantity
  document.querySelectorAll('.btn-increase').forEach(btn => {
    btn.addEventListener('click', () => {
      const productId = parseInt(btn.dataset.productId);
      updateQuantity(productId, 1);
    });
  });

  // Decrease quantity
  document.querySelectorAll('.btn-decrease').forEach(btn => {
    btn.addEventListener('click', () => {
      const productId = parseInt(btn.dataset.productId);
      updateQuantity(productId, -1);
    });
  });

  // Remove item
  document.querySelectorAll('.btn-remove-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const productId = parseInt(btn.dataset.productId);
      removeFromCart(productId);
    });
  });
}

// Update quantity
function updateQuantity(productId, change) {
  const cart = getCart();
  const itemIndex = cart.findIndex(item => item.productId === productId);
  
  if (itemIndex !== -1) {
    cart[itemIndex].quantity += change;
    
    if (cart[itemIndex].quantity <= 0) {
      cart.splice(itemIndex, 1);
    }
    
    saveCart(cart);
    updateCartBadge();
    loadCartItems();
  }
}

// Remove from cart
function removeFromCart(productId) {
  const cart = getCart();
  const updatedCart = cart.filter(item => item.productId !== productId);
  saveCart(updatedCart);
  updateCartBadge();
  toast.success('Продуктът е премахнат от каруцата');
  loadCartItems();
}

// ─── Checkout Flow ───────────────────────────────────────────

async function openCheckoutModal() {
  // Check if user is logged in
  const profile = await fetchCurrentUserProfile();
  if (!profile) {
    toast.error('Трябва да влезете в профила си, за да завършите поръчката');
    setTimeout(() => { window.location.href = '/auth/login/'; }, 1500);
    return;
  }

  selectedAddressId = null;
  document.getElementById('checkout-notes').value = '';
  
  // Remove old event listener and clone button to clear listeners
  const confirmBtn = document.getElementById('confirm-checkout-btn');
  const newConfirmBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
  newConfirmBtn.disabled = true;
  
  // Add fresh event listener to cloned button
  newConfirmBtn.addEventListener('click', confirmCheckout);

  // Populate order summary
  populateCheckoutSummary();

  // Load user addresses
  await loadCheckoutAddresses(profile.user_id);

  const modal = new bootstrap.Modal(document.getElementById('checkoutModal'));
  modal.show();
}

function populateCheckoutSummary() {
  const listEl = document.getElementById('checkout-items-list');
  let totalPrice = 0;
  let totalDiscount = 0;

  listEl.innerHTML = cachedCartProducts.map(item => {
    const name = item.description?.name || 'Продукт';
    const price = item.price != null ? Number(item.price) : 0;
    const finalPrice = item.finalPrice != null ? Number(item.finalPrice) : price;
    const lineTotal = finalPrice * item.quantity;
    totalPrice += price * item.quantity;
    if (finalPrice < price) {
      totalDiscount += (price - finalPrice) * item.quantity;
    }

    return `
      <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
        <div>
          <span class="fw-semibold">${name}</span>
          <span class="text-muted ms-2">x${item.quantity}</span>
        </div>
        <span>${lineTotal.toFixed(2)} лв.</span>
      </div>
    `;
  }).join('');

  const finalTotal = totalPrice - totalDiscount;
  document.getElementById('checkout-total').textContent = `${finalTotal.toFixed(2)} лв.`;

  const discountRow = document.getElementById('checkout-discount-row');
  if (totalDiscount > 0) {
    discountRow.style.display = '';
    discountRow.classList.add('d-flex');
    document.getElementById('checkout-discount').textContent = `-${totalDiscount.toFixed(2)} лв.`;
  } else {
    discountRow.style.display = 'none !important';
    discountRow.classList.remove('d-flex');
  }
}

async function loadCheckoutAddresses(userId) {
  const container = document.getElementById('checkout-address-list');
  try {
    const { data: addresses, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;

    if (!addresses || addresses.length === 0) {
      container.innerHTML = `
        <div class="alert alert-warning mb-0">
          <i class="bi bi-exclamation-triangle"></i> Нямате запазени адреси. Моля, добавете адрес от профила си.
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="address-radio-group">
        ${addresses.map(addr => {
          const a = addr.address || {};
          const isDefault = a.is_default || false;
          return `
            <div class="form-check" data-address-id="${addr.address_id}">
              <input class="form-check-input" type="radio" name="checkoutAddress" id="addr-${addr.address_id}" value="${addr.address_id}" ${isDefault ? 'checked' : ''}>
              <label class="form-check-label" for="addr-${addr.address_id}">
                <div>
                  <strong>${a.street || '-'}</strong>, ${a.city || '-'} ${a.postal_code || ''}
                  ${a.phone ? `<br><small class="text-muted"><i class="bi bi-telephone"></i> ${a.phone}</small>` : ''}
                  ${isDefault ? '<span class="badge bg-success ms-2">По подразбиране</span>' : ''}
                </div>
              </label>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Attach radio change handlers
    container.querySelectorAll('input[name="checkoutAddress"]').forEach(radio => {
      radio.addEventListener('change', () => {
        selectedAddressId = parseInt(radio.value);
        document.getElementById('confirm-checkout-btn').disabled = false;
      });
    });

    // Auto-select default address
    const defaultAddr = addresses.find(a => a.address?.is_default);
    if (defaultAddr) {
      selectedAddressId = defaultAddr.address_id;
      document.getElementById('confirm-checkout-btn').disabled = false;
    }
  } catch (err) {
    console.error('Error loading addresses:', err);
    container.innerHTML = '<div class="alert alert-danger mb-0">Грешка при зареждане на адреси</div>';
  }
}

async function confirmCheckout() {
  const confirmBtn = document.getElementById('confirm-checkout-btn');
  confirmBtn.disabled = true;
  confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Обработване...';

  try {
    const profile = await fetchCurrentUserProfile();
    if (!profile) throw new Error('Не сте влезли в профила си');

    const cart = getCart();
    if (!cart || cart.length === 0) throw new Error('Каруцата е празна');
    if (!selectedAddressId) throw new Error('Моля, изберете адрес за доставка');

    // Get the selected address data
    const { data: addressData, error: addrError } = await supabase
      .from('addresses')
      .select('*')
      .eq('address_id', selectedAddressId)
      .single();

    if (addrError) throw addrError;

    // Calculate totals
    let totalPrice = 0;
    let totalDiscount = 0;
    const orderItems = cachedCartProducts.map(item => {
      const price = item.price != null ? Number(item.price) : 0;
      const discountedPrice = item.discount != null ? Number(item.discount) : null;
      const lineTotal = price * item.quantity;
      totalPrice += lineTotal;
      if (discountedPrice) {
        totalDiscount += (price - discountedPrice) * item.quantity;
      }

      return {
        product_id: item.product_id,
        name: item.description?.name || 'Продукт',
        brief_info: item.description?.brief_info || '',
        quantity: item.quantity,
        unit_price: price,
        unit_discount: discountedPrice,
        line_total: discountedPrice ? discountedPrice * item.quantity : lineTotal,
      };
    });

    const notes = document.getElementById('checkout-notes').value.trim();
    const now = new Date().toISOString();

    // Build order_status with history
    const orderStatus = {
      current_status: ORDER_STATUSES.PENDING,
      history: [
        { status: ORDER_STATUSES.PENDING, date: now, note: 'Поръчката е създадена' }
      ]
    };

    // Build short_description for quick display
    const shortDescription = notes || null;

    // Build order_extra with items, address and notes
    const orderExtra = {
      items: orderItems,
      address: addressData.address,
      address_id: selectedAddressId,
      notes: notes || null,
    };

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: profile.user_id,
        price: totalPrice,
        discount: totalDiscount > 0 ? totalDiscount : null,
        short_description: shortDescription,
        order_status: orderStatus,
        order_done: false,
        order_date: now,
        order_extra: orderExtra,
        order_archived: false,
        order_user_delete: false,
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // Clear cart
    saveCart([]);
    updateCartBadge();

    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('checkoutModal'));
    modal.hide();

    toast.success(`Поръчка #${order.order_id} е създадена успешно!`);

    // Reload cart (will show empty)
    setTimeout(() => loadCartItems(), 500);

  } catch (err) {
    console.error('Error creating order:', err);
    toast.error(err.message || 'Грешка при създаване на поръчката');
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = '<i class="bi bi-check-circle"></i> Потвърди поръчката';
  }
}

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
  await loadComponents();
  await loadCartItems();
  updateCartBadge();

  // Checkout button opens modal
  document.getElementById('checkout-btn').addEventListener('click', openCheckoutModal);
});

// Export functions for use in other pages
export { getCart, saveCart };
