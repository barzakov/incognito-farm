import { supabase, fetchCurrentUserProfile } from '../../lib/supabaseClient.js';
import { loadComponents } from '../../lib/components.js';
import { toast } from '../../lib/toast.js';

// ─── DOM references ──────────────────────────────────────────
const adminLoading = () => document.getElementById('admin-loading');
const adminDenied = () => document.getElementById('admin-denied');
const adminContent = () => document.getElementById('admin-content');

// ─── Access guard ────────────────────────────────────────────

/**
 * Check if current user is boss. Show denied or content accordingly.
 * @returns {Promise<object|null>} profile if boss, null otherwise
 */
async function checkAdminAccess() {
  const profile = await fetchCurrentUserProfile();

  if (!profile || !profile.boss) {
    adminLoading().classList.add('d-none');
    adminDenied().classList.remove('d-none');
    return null;
  }

  adminLoading().classList.add('d-none');
  adminContent().classList.remove('d-none');
  return profile;
}

// ─── Load stats ──────────────────────────────────────────────

async function loadStats() {
  try {
    const [usersRes, productsRes, ordersRes] = await Promise.all([
      supabase.from('users').select('user_id', { count: 'exact', head: true }),
      supabase.from('products').select('product_id', { count: 'exact', head: true }),
      supabase.from('orders').select('order_id', { count: 'exact', head: true }),
    ]);

    document.getElementById('stat-users').textContent = usersRes.count ?? 0;
    document.getElementById('stat-products').textContent = productsRes.count ?? 0;
    document.getElementById('stat-orders').textContent = ordersRes.count ?? 0;
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

// ─── Users table ─────────────────────────────────────────────

async function loadUsers() {
  const tbody = document.getElementById('users-table-body');
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .order('user_id', { ascending: true });

    if (error) throw error;

    if (!users || users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">Няма потребители</td></tr>';
      return;
    }

    tbody.innerHTML = users.map((u) => {
      const isDeleted = !!u.deleted_on;
      const roleBadge = u.boss
        ? '<span class="badge badge-boss">Админ</span>'
        : '<span class="badge badge-user">Потребител</span>';
      const statusBadge = isDeleted
        ? '<span class="badge badge-deleted">Изтрит</span>'
        : '<span class="badge badge-active">Активен</span>';
      const createdDate = u.created_on ? new Date(u.created_on).toLocaleDateString('bg-BG') : '–';

      const toggleBossLabel = u.boss ? 'Премахни админ' : 'Направи админ';
      const toggleBossClass = u.boss ? 'btn-outline-secondary' : 'btn-outline-warning';

      return `
        <tr>
          <td>${u.user_id}</td>
          <td>${u.name || '–'}</td>
          <td>${u.second_name || '–'}</td>
          <td>${u.lastname || '–'}</td>
          <td>${roleBadge}</td>
          <td>${createdDate}</td>
          <td>${statusBadge}</td>
          <td>
            <button class="btn btn-action ${toggleBossClass}" data-user-id="${u.user_id}" data-is-boss="${u.boss}" data-action="toggle-boss">
              <i class="bi bi-shield"></i> ${toggleBossLabel}
            </button>
            ${!isDeleted ? `
              <button class="btn btn-action btn-outline-danger ms-1" data-user-id="${u.user_id}" data-action="soft-delete">
                <i class="bi bi-trash"></i>
              </button>` : ''}
          </td>
        </tr>
      `;
    }).join('');

    // Attach event listeners
    attachUserActions();
  } catch (err) {
    console.error('Error loading users:', err);
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-danger py-4">Грешка при зареждане</td></tr>';
  }
}

function attachUserActions() {
  // Toggle boss role
  document.querySelectorAll('[data-action="toggle-boss"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const userId = parseInt(btn.dataset.userId);
      const currentlyBoss = btn.dataset.isBoss === 'true';
      showToggleBossModal(userId, currentlyBoss);
    });
  });

  // Soft delete
  document.querySelectorAll('[data-action="soft-delete"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const userId = parseInt(btn.dataset.userId);
      if (!confirm('Сигурни ли сте, че искате да изтриете този потребител?')) return;

      try {
        const { error } = await supabase
          .from('users')
          .update({ deleted_on: new Date().toISOString() })
          .eq('user_id', userId);

        if (error) throw error;
        toast.success('Потребителят е маркиран като изтрит.');
        await loadUsers();
        await loadStats();
      } catch (err) {
        console.error('Soft delete error:', err);
        toast.error('Грешка при изтриване.');
      }
    });
  });
}

function showToggleBossModal(userId, currentlyBoss) {
  const title = document.getElementById('toggleBossModalTitle');
  const message = document.getElementById('toggleBossModalMessage');
  const confirmBtn = document.getElementById('toggleBossConfirmBtn');

  title.textContent = currentlyBoss ? 'Премахване на админ права' : 'Предоставяне на админ права';
  message.textContent = currentlyBoss
    ? `Сигурни ли сте, че искате да премахнете админ правата на потребител #${userId}?`
    : `Сигурни ли сте, че искате да направите потребител #${userId} администратор?`;

  // eslint-disable-next-line no-undef
  const modal = new bootstrap.Modal(document.getElementById('toggleBossModal'));
  modal.show();

  // Remove old listeners
  const newBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

  newBtn.addEventListener('click', async () => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ boss: !currentlyBoss })
        .eq('user_id', userId);

      if (error) throw error;
      toast.success(currentlyBoss ? 'Админ правата са премахнати.' : 'Потребителят вече е администратор.');
      modal.hide();
      await loadUsers();
      await loadStats();
    } catch (err) {
      console.error('Toggle boss error:', err);
      toast.error('Грешка при промяна на ролята.');
    }
  });
}

// ─── Products table ──────────────────────────────────────────

async function loadProducts() {
  const tbody = document.getElementById('products-table-body');
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .order('product_id', { ascending: false });

    if (error) throw error;

    if (!products || products.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Няма продукти</td></tr>';
      return;
    }

    tbody.innerHTML = products.map((p) => {
      const availabilityBadge = p.availability
        ? '<span class="badge bg-success">Налично</span>'
        : '<span class="badge bg-danger">Недостъпно</span>';
      const price = p.price != null ? `${Number(p.price).toFixed(2)} лв.` : '–';
      const discount = p.discount != null ? `${Number(p.discount).toFixed(2)} лв.` : '–';
      const productName = p.description?.name || '–';

      return `
        <tr>
          <td>${p.product_id}</td>
          <td>${productName}</td>
          <td>${price}</td>
          <td>${discount}</td>
          <td>${availabilityBadge}</td>
          <td>
            <button class="btn btn-action btn-outline-primary btn-sm" data-product-id="${p.product_id}" data-action="edit-product" data-product-data='${JSON.stringify(p)}'>
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-action btn-outline-danger btn-sm" data-product-id="${p.product_id}" data-action="delete-product">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    attachProductActions();
  } catch (err) {
    console.error('Error loading products:', err);
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">Грешка при зареждане</td></tr>';
  }
}

function attachProductActions() {
  // Edit product
  document.querySelectorAll('[data-action="edit-product"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const productData = JSON.parse(btn.dataset.productData);
      showEditProductModal(productData);
    });
  });

  // Delete product
  document.querySelectorAll('[data-action="delete-product"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const productId = parseInt(btn.dataset.productId);
      showDeleteProductModal(productId);
    });
  });
}

function showEditProductModal(productData) {
  const form = document.getElementById('editProductForm');
  if (!form) return;

  // Populate form with product data
  document.getElementById('edit-product-id').value = productData.product_id;
  document.getElementById('edit-product-name').value = productData.description?.name || '';
  document.getElementById('edit-product-brief').value = productData.description?.brief_info || '';
  document.getElementById('edit-product-info').value = productData.description?.info || '';
  document.getElementById('edit-product-price').value = productData.price || '';
  document.getElementById('edit-product-discount').value = productData.discount || '';
  document.getElementById('edit-product-availability').value = productData.availability ? 'true' : 'false';

  // Remove old listener
  const newForm = form.cloneNode(true);
  form.parentNode.replaceChild(newForm, form);

  // Add submit listener to new form
  newForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleEditProductSubmit(productData.product_id, newForm);
  });

  // eslint-disable-next-line no-undef
  const modal = new bootstrap.Modal(document.getElementById('editProductModal'));
  modal.show();
}

async function handleEditProductSubmit(productId, form) {
  const submitBtn = form.querySelector('button[type="submit"]');
  if (!submitBtn) {
    toast.error('Грешка: не намерихме бутона за запазване.');
    return;
  }

  const originalText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Запазване...';

  try {
    const name = document.getElementById('edit-product-name').value.trim();
    const briefInfo = document.getElementById('edit-product-brief').value.trim();
    const info = document.getElementById('edit-product-info').value.trim();
    const price = parseFloat(document.getElementById('edit-product-price').value);
    const discount = document.getElementById('edit-product-discount').value ? parseFloat(document.getElementById('edit-product-discount').value) : null;
    const availability = document.getElementById('edit-product-availability').value === 'true';

    if (!name || isNaN(price)) {
      toast.error('Моля попълнете задължителните полета.');
      return;
    }

    const { error } = await supabase
      .from('products')
      .update({
        description: {
          name,
          brief_info: briefInfo,
          info,
        },
        price,
        discount,
        availability,
      })
      .eq('product_id', productId);

    if (error) throw error;

    toast.success('Продуктът е обновен успешно!');
    // eslint-disable-next-line no-undef
    const modal = bootstrap.Modal.getInstance(document.getElementById('editProductModal'));
    if (modal) modal.hide();
    await loadProducts();
    await loadStats();
  } catch (err) {
    console.error('Edit product error:', err);
    toast.error('Грешка при обновяване.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
}

function showDeleteProductModal(productId) {
  const message = document.getElementById('deleteProductModalMessage');
  const confirmBtn = document.getElementById('deleteProductConfirmBtn');

  message.textContent = `Сигурни ли сте, че искате да изтриете продукт #${productId}?`;

  // eslint-disable-next-line no-undef
  const modal = new bootstrap.Modal(document.getElementById('deleteProductModal'));
  modal.show();

  const newBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

  newBtn.addEventListener('click', async () => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('product_id', productId);

      if (error) throw error;
      toast.success('Продуктът е изтрит.');
      modal.hide();
      await loadProducts();
      await loadStats();
    } catch (err) {
      console.error('Delete product error:', err);
      toast.error('Грешка при изтриване.');
    }
  });
}

function initializeProductForm() {
  const form = document.getElementById('addProductForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Добавяне...';

    try {
      const name = document.getElementById('product-name').value.trim();
      const briefInfo = document.getElementById('product-brief').value.trim();
      const info = document.getElementById('product-info').value.trim();
      const price = parseFloat(document.getElementById('product-price').value);
      const discount = document.getElementById('product-discount').value ? parseFloat(document.getElementById('product-discount').value) : null;
      const availability = document.getElementById('product-availability').value === 'true';

      const { error } = await supabase
        .from('products')
        .insert([
          {
            description: {
              name,
              brief_info: briefInfo,
              info,
            },
            price,
            discount,
            availability,
          },
        ]);

      if (error) throw error;

      toast.success('Продуктът е добавен успешно!');
      form.reset();
      await loadProducts();
      await loadStats();
    } catch (err) {
      console.error('Add product error:', err);
      toast.error('Грешка при добавяне на продукта.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });
}

// ─── Orders table ────────────────────────────────────────────

async function loadOrders() {
  const tbody = document.getElementById('orders-table-body');
  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .order('order_date', { ascending: false })
      .limit(50);

    if (error) throw error;

    if (!orders || orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Няма поръчки</td></tr>';
      return;
    }

    tbody.innerHTML = orders.map((o) => {
      const productName = o.short_description?.name || '–';
      const orderDate = o.order_date ? new Date(o.order_date).toLocaleDateString('bg-BG') : '–';
      const status = o.order_done
        ? '<span class="badge bg-success">Завършена</span>'
        : '<span class="badge bg-warning text-dark">В процес</span>';
      const price = o.price != null ? `${Number(o.price).toFixed(2)} лв.` : '–';

      return `
        <tr>
          <td>#${o.order_id}</td>
          <td>${o.user_id}</td>
          <td>${productName}</td>
          <td>${price}</td>
          <td>${orderDate}</td>
          <td>${status}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading orders:', err);
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">Грешка при зареждане</td></tr>';
  }
}

// ─── Tab change listeners ────────────────────────────────────

function initializeTabListeners() {
  const productsTab = document.getElementById('products-tab');
  const ordersTab = document.getElementById('orders-tab');

  if (productsTab) {
    productsTab.addEventListener('shown.bs.tab', () => {
      loadProducts();
      initializeProductForm();
    });
  }
  if (ordersTab) {
    ordersTab.addEventListener('shown.bs.tab', () => loadOrders());
  }
}

// ─── Page init ───────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  await loadComponents();

  const profile = await checkAdminAccess();
  if (!profile) return;

  initializeTabListeners();
  await Promise.all([loadStats(), loadUsers()]);
});
