import { supabase } from '../../lib/supabaseClient.js';
import { loadComponents } from '../../lib/components.js';
import { toast } from '../../lib/toast.js';

// Check authentication status
async function checkAuthStatus() {
  if (!supabase) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      console.log('User logged in:', user.email);
      // Update UI for authenticated user
      updateAuthUI(user);
    } else {
      console.log('No user logged in');
    }
  } catch (error) {
    console.error('Error checking auth status:', error);
  }
}

// Update UI for authenticated user
function updateAuthUI(user) {
  const authLinks = document.querySelector('.nav-auth');
  if (authLinks) {
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
          setTimeout(() => {
            window.location.href = '/';
          }, 1000);
        } catch (error) {
          console.error('Error logging out:', error);
          toast.error('Грешка при изход');
        }
      });
    }
  }
}

// Initialize page
async function loadFeaturedProducts() {
  const grid = document.getElementById('featuredProductsGrid');
  if (!grid) return;

  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .eq('availability', true)
      .limit(3)
      .order('product_id', { ascending: false });

    if (error) throw error;

    if (!products || products.length === 0) {
      grid.innerHTML = `
        <div class="text-center text-muted py-5">
          <i class="bi bi-inbox"></i>
          <p class="mt-3">Няма налични продукти</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = products.map((p) => {
      const productName = p.description?.name || 'Продукт';
      const briefInfo = p.description?.brief_info || '';
      const price = p.price != null ? `${Number(p.price).toFixed(2)} лв.` : 'По запитване';

      return `
        <div class="product-card card">
          <div class="product-image">🌾</div>
          <h3>${productName}</h3>
          <p>${briefInfo}</p>
          <p class="text-success fw-bold" style="margin-top: 0.5rem;">${price}</p>
          <a href="/products/" class="btn btn-secondary">Виж всички</a>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading featured products:', err);
    grid.innerHTML = `
      <div class="text-center text-danger py-5">
        <i class="bi bi-exclamation-circle"></i>
        <p class="mt-3">Грешка при зареждане</p>
      </div>
    `;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadComponents();
  checkAuthStatus();
  loadFeaturedProducts();
});
