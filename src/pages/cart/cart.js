import { supabase } from '../../lib/supabaseClient.js';
import { loadComponents } from '../../lib/components.js';
import { toast } from '../../lib/toast.js';

// Cart stored in localStorage (for now, until we implement database cart)
const CART_STORAGE_KEY = 'incognito_farm_cart';

// Get cart from localStorage
function getCart() {
  try {
    const cart = localStorage.getItem(CART_STORAGE_KEY);
    return cart ? JSON.parse(cart) : [];
  } catch (error) {
    console.error('Error reading cart:', error);
    return [];
  }
}

// Save cart to localStorage
function saveCart(cart) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch (error) {
    console.error('Error saving cart:', error);
  }
}

// Load cart items and display
async function loadCartItems() {
  const container = document.getElementById('cart-items-container');
  const cart = getCart();

  if (!cart || cart.length === 0) {
    container.innerHTML = `
      <div class="empty-cart">
        <i class="bi bi-cart4 fs-1"></i>
        <p class="mt-3 text-muted">Вашата каруца е празна</p>
        <a href="/products/" class="btn btn-success mt-3">
          <i class="bi bi-arrow-left"></i> Разгледайте продуктите
        </a>
      </div>
    `;
    updateCartSummary([]);
    return;
  }

  // Load product details from database
  try {
    const productIds = cart.map(item => item.productId);
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .in('product_id', productIds);

    if (error) throw error;

    // Merge cart quantities with product details
    const cartItems = cart.map(cartItem => {
      const product = products.find(p => p.product_id === cartItem.productId);
      return product ? { ...product, quantity: cartItem.quantity } : null;
    }).filter(item => item !== null);

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
    const discountedPrice = item.discount != null ? Number(item.discount) : null;
    const finalPrice = discountedPrice || price;
    const totalPrice = (finalPrice * item.quantity).toFixed(2);

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
            ${discountedPrice ? `
              <div class="cart-item-original-price">${price.toFixed(2)} лв.</div>
              <div class="cart-item-unit-price">${discountedPrice.toFixed(2)} лв. / бр.</div>
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
    const price = item.discount != null ? Number(item.discount) : Number(item.price);
    return sum + (price * item.quantity);
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
    loadCartItems();
  }
}

// Remove from cart
function removeFromCart(productId) {
  const cart = getCart();
  const updatedCart = cart.filter(item => item.productId !== productId);
  saveCart(updatedCart);
  toast.success('Продуктът е премахнат от каруцата');
  loadCartItems();
}

// Checkout
function handleCheckout() {
  const cart = getCart();
  
  if (!cart || cart.length === 0) {
    toast.error('Каруцата е празна');
    return;
  }

  // Check if user is logged in
  supabase.auth.getUser().then(({ data: { user } }) => {
    if (!user) {
      toast.error('Трябва да влезете, за да завършите поръчката');
      setTimeout(() => {
        window.location.href = '/auth/login/';
      }, 1500);
      return;
    }

    // TODO: Implement checkout process (create order, clear cart, redirect to success page)
    toast.info('Функционалността за поръчка скоро ще бъде налична');
  });
}

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
  await loadComponents();
  await loadCartItems();

  // Checkout button
  document.getElementById('checkout-btn').addEventListener('click', handleCheckout);
});

// Export functions for use in other pages
export { getCart, saveCart };
