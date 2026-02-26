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

// ─── Helper functions ───────────────────────────────────────

async function loadGroupsIntoDropdown() {
  const { data: groups } = await supabase
    .from('product_group')
    .select('group_id, name')
    .order('name', { ascending: true });

  if (groups) {
    const addGroupSelect = document.getElementById('product-group');
    const editGroupSelect = document.getElementById('edit-product-group');

    const groupOptions = groups.map((g) => `<option value="${g.group_id}">${g.name}</option>`).join('');

    if (addGroupSelect) {
      addGroupSelect.innerHTML = '<option value="">Без група</option>' + groupOptions;
    }
    if (editGroupSelect) {
      editGroupSelect.innerHTML = '<option value="">Без група</option>' + groupOptions;
    }
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
      
      let imageThumb = '🌾';
      if (p.images_location) {
        const publicUrl = supabase.storage.from('products').getPublicUrl(p.images_location).data.publicUrl;
        imageThumb = `<img src="${publicUrl}" alt="${productName}" style="width: 30px; height: 30px; object-fit: cover; border-radius: 4px;">`;
      }

      return `
        <tr>
          <td>${imageThumb}</td>
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
    btn.addEventListener('click', async () => {
      const productData = JSON.parse(btn.dataset.productData);
      await showEditProductModal(productData);
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

async function showEditProductModal(productData) {
  const form = document.getElementById('editProductForm');
  if (!form) return;

  // Load groups into dropdown
  await loadGroupsIntoDropdown();

  // Remove old listener and clone form
  const newForm = form.cloneNode(true);
  form.parentNode.replaceChild(newForm, form);

  // NOW populate form with product data (after cloning)
  document.getElementById('edit-product-id').value = productData.product_id;
  document.getElementById('edit-product-name').value = productData.description?.name || '';
  document.getElementById('edit-product-brief').value = productData.description?.brief_info || '';
  document.getElementById('edit-product-info').value = productData.description?.info || '';
  document.getElementById('edit-product-price').value = productData.price ? String(productData.price) : '';
  document.getElementById('edit-product-discount').value = productData.discount ? String(productData.discount) : '';
  document.getElementById('edit-product-availability').value = productData.availability ? 'true' : 'false';
  document.getElementById('edit-product-group').value = productData.group_id ? String(productData.group_id) : '';

  // Show current image if exists
  const previewContainer = document.getElementById('edit-product-image-preview');
  if (productData.images_location) {
    const publicUrl = supabase.storage.from('products').getPublicUrl(productData.images_location).data.publicUrl;
    previewContainer.innerHTML = `
      <div>
        <img src="${publicUrl}" class="img-fluid rounded" style="max-height: 150px;">
        <small class="d-block text-muted mt-2">Текущо изображение</small>
      </div>
    `;
  } else {
    previewContainer.innerHTML = '';
  }

  // Image preview for new upload
  const imageInput = document.getElementById('edit-product-image');
  if (imageInput) {
    imageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          previewContainer.innerHTML = `<img src="${event.target.result}" class="img-fluid rounded" style="max-height: 150px;">`;
        };
        reader.readAsDataURL(file);
      }
    }, { once: true });
  }

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
    const groupId = document.getElementById('edit-product-group').value ? parseInt(document.getElementById('edit-product-group').value) : null;
    const imageFile = document.getElementById('edit-product-image').files[0];

    if (!name || isNaN(price)) {
      toast.error('Моля попълнете задължителните полета.');
      return;
    }

    const updateData = {
      description: {
        name,
        brief_info: briefInfo,
        info,
      },
      price,
      discount,
      availability,
      group_id: groupId,
    };

    // Handle image upload if new file selected
    if (imageFile) {
      const fileName = `${Date.now()}_${imageFile.name}`;
      const filePath = `products/${productId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(filePath, imageFile);

      if (uploadError) throw uploadError;

      updateData.images_location = filePath;
    }

    const { error } = await supabase
      .from('products')
      .update(updateData)
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

  // Load groups into dropdown (no need to wait, it loads in background)
  loadGroupsIntoDropdown().catch(err => console.error('Error loading groups:', err));

  // Image preview
  const imageInput = document.getElementById('product-image');
  if (imageInput) {
    imageInput.addEventListener('change', (e) => {
      const preview = document.getElementById('product-image-preview');
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          preview.innerHTML = `<img src="${event.target.result}" class="img-fluid rounded" style="max-height: 150px;">`;
        };
        reader.readAsDataURL(file);
      } else {
        preview.innerHTML = '';
      }
    });
  }

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
      const groupId = document.getElementById('product-group').value ? parseInt(document.getElementById('product-group').value) : null;
      const imageFile = document.getElementById('product-image').files[0];

      // Insert product first to get the ID
      const { data: insertedProduct, error: insertError } = await supabase
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
            group_id: groupId,
          },
        ])
        .select();

      if (insertError) throw insertError;

      const productId = insertedProduct[0].product_id;
      let imagesLocation = null;

      // Upload image if provided
      if (imageFile) {
        const fileName = `${Date.now()}_${imageFile.name}`;
        const filePath = `products/${productId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('products')
          .upload(filePath, imageFile);

        if (uploadError) throw uploadError;

        imagesLocation = filePath;

        // Update product with image location
        const { error: updateError } = await supabase
          .from('products')
          .update({ images_location: imagesLocation })
          .eq('product_id', productId);

        if (updateError) throw updateError;
      }

      toast.success('Продуктът е добавен успешно!');
      form.reset();
      document.getElementById('product-image-preview').innerHTML = '';
      // eslint-disable-next-line no-undef
      const modal = bootstrap.Modal.getInstance(document.getElementById('addProductModal'));
      if (modal) modal.hide();
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

// ─── Groups table ────────────────────────────────────────────

async function loadGroups() {
  const tbody = document.getElementById('groups-table-body');
  try {
    const { data: groups, error } = await supabase
      .from('product_group')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    if (!groups || groups.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-4">Няма групи</td></tr>';
      return;
    }

    // Get product counts for each group
    const { data: productCounts } = await supabase
      .from('products')
      .select('group_id', { count: 'exact', head: false });

    const countMap = {};
    productCounts?.forEach((p) => {
      if (p.group_id) {
        countMap[p.group_id] = (countMap[p.group_id] || 0) + 1;
      }
    });

    tbody.innerHTML = groups.map((g) => {
      const count = countMap[g.group_id] || 0;
      return `
        <tr>
          <td><strong>${g.name || '–'}</strong></td>
          <td><span class="badge bg-info">${count}</span></td>
          <td>
            <button type="button" class="btn btn-sm btn-outline-primary edit-group-btn" data-group-id="${g.group_id}">
              <i class="bi bi-pencil"></i>
            </button>
            <button type="button" class="btn btn-sm btn-outline-danger delete-group-btn" data-group-id="${g.group_id}">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    attachGroupActions();
  } catch (err) {
    console.error('Error loading groups:', err);
    tbody.innerHTML = '<tr><td colspan="3" class="text-center text-danger py-4">Грешка при зареждане</td></tr>';
  }
}

function attachGroupActions() {
  document.querySelectorAll('.edit-group-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const groupId = parseInt(btn.dataset.groupId);
      showEditGroupModal(groupId);
    });
  });

  document.querySelectorAll('.delete-group-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const groupId = parseInt(btn.dataset.groupId);
      showDeleteGroupModal(groupId);
    });
  });
}

async function showEditGroupModal(groupId) {
  try {
    const { data: group, error } = await supabase
      .from('product_group')
      .select('*')
      .eq('group_id', groupId)
      .single();

    if (error) throw error;
    if (!group) {
      toast.error('Група не намерена');
      return;
    }

    document.getElementById('edit-group-name').value = group.name || '';
    
    // Load available products for dropdown
    await loadProductsForGroupDropdown('edit-group-product-select', groupId);
    
    // Load products in this group
    await renderGroupProducts(groupId, 'group-products-container');

    // Store groupId for form submission
    const editForm = document.getElementById('editGroupForm');
    editForm.dataset.groupId = groupId;

    // Setup add product button
    const addBtn = document.getElementById('edit-group-product-btn');
    const newAddBtn = addBtn.cloneNode(true);
    addBtn.replaceWith(newAddBtn);
    
    newAddBtn.addEventListener('click', async () => {
      const select = document.getElementById('edit-group-product-select');
      const productId = parseInt(select.value);
      if (!productId) return;

      try {
        const { error } = await supabase
          .from('products')
          .update({ group_id: groupId })
          .eq('product_id', productId);

        if (error) throw error;

        toast.success('Продукт добавен');
        await loadProductsForGroupDropdown('edit-group-product-select', groupId);
        await renderGroupProducts(groupId, 'group-products-container');
        select.value = '';
      } catch (err) {
        console.error('Error adding product to group:', err);
        toast.error('Грешка при добавяне на продукт');
      }
    });

    // Clear previous listeners
    const deleteBtn = document.getElementById('deleteGroupBtn');
    deleteBtn.removeEventListener('click', deleteGroupHandler);
    deleteBtn.addEventListener('click', deleteGroupHandler);

    // eslint-disable-next-line no-undef
    new bootstrap.Modal(document.getElementById('editGroupModal')).show();
  } catch (err) {
    console.error('Error loading group:', err);
    toast.error('Грешка при зареждане на група');
  }
}

async function deleteGroupHandler() {
  const editForm = document.getElementById('editGroupForm');
  const groupId = parseInt(editForm.dataset.groupId);
  
  // eslint-disable-next-line no-undef
  bootstrap.Modal.getInstance(document.getElementById('editGroupModal')).hide();
  
  setTimeout(() => {
    showDeleteGroupModal(groupId);
  }, 300);
}

function showDeleteGroupModal(groupId) {
  document.getElementById('deleteGroupConfirmBtn').onclick = async () => {
    try {
      const { error } = await supabase
        .from('product_group')
        .delete()
        .eq('group_id', groupId);

      if (error) throw error;

      // eslint-disable-next-line no-undef
      bootstrap.Modal.getInstance(document.getElementById('deleteGroupModal')).hide();
      
      toast.success('Група изтрита успешно');
      await loadGroups();
    } catch (err) {
      console.error('Error deleting group:', err);
      toast.error('Грешка при изтриване на група');
    }
  };

  // eslint-disable-next-line no-undef
  new bootstrap.Modal(document.getElementById('deleteGroupModal')).show();
}

// ─── Product management in groups ────────────────────────────

async function loadProductsForGroupDropdown(selectId, excludeGroupId = null) {
  const select = document.getElementById(selectId);
  if (!select) return;

  try {
    // Get products that are either not in any group or in the current group (for editing)
    const { data: products } = await supabase
      .from('products')
      .select('product_id, description, group_id')
      .or(`group_id.is.null${excludeGroupId ? `,group_id.eq.${excludeGroupId}` : ''}`)
      .order('product_id', { ascending: true });

    if (products) {
      const options = products
        .filter((p) => !excludeGroupId || p.group_id !== excludeGroupId)
        .map((p) => {
          const name = p.description?.name || `Продукт #${p.product_id}`;
          return `<option value="${p.product_id}">${name}</option>`;
        })
        .join('');
      
      select.innerHTML = '<option value="">Избери продукт...</option>' + options;
    }
  } catch (err) {
    console.error('Error loading products for dropdown:', err);
  }
}

async function renderGroupProducts(groupId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  try {
    const { data: groupProducts } = await supabase
      .from('products')
      .select('product_id, description')
      .eq('group_id', groupId);

    if (groupProducts && groupProducts.length > 0) {
      container.innerHTML = groupProducts.map((p) => {
        const name = p.description?.name || `Продукт #${p.product_id}`;
        return `
          <div class="badge bg-success me-2 mb-2 d-inline-flex align-items-center" style="font-size: 0.9rem;">
            ${name}
            <button type="button" class="btn-close btn-close-white ms-2" style="font-size: 0.6rem;" data-product-id="${p.product_id}" data-action="remove-product"></button>
          </div>
        `;
      }).join('');

      // Attach remove listeners
      container.querySelectorAll('[data-action="remove-product"]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const productId = parseInt(btn.dataset.productId);
          try {
            const { error } = await supabase
              .from('products')
              .update({ group_id: null })
              .eq('product_id', productId);

            if (error) throw error;

            toast.success('Продукт премахнат');
            await renderGroupProducts(groupId, containerId);
            
            // Reload dropdown to include the removed product
            if (containerId === 'group-products-container') {
              await loadProductsForGroupDropdown('edit-group-product-select', groupId);
            }
          } catch (err) {
            console.error('Error removing product from group:', err);
            toast.error('Грешка при премахване на продукт');
          }
        });
      });
    } else {
      container.innerHTML = '<span class="text-muted">Няма продукти в тази група</span>';
    }
  } catch (err) {
    console.error('Error rendering group products:', err);
    container.innerHTML = '<span class="text-danger">Грешка при зареждане</span>';
  }
}

// ─── Group form handlers ─────────────────────────────────────

function initializeGroupForm() {
  const form = document.getElementById('addGroupForm');
  if (!form || form.dataset.initialized === 'true') return;

  // Track products to add (when creating new group)
  let productsToAdd = [];

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('group-name').value.trim();

    if (!name) {
      toast.error('Името на група е задължително');
      return;
    }

    try {
      // Create the group first
      const { data: newGroup, error } = await supabase
        .from('product_group')
        .insert([{ name }])
        .select()
        .single();

      if (error) throw error;

      // Then add products to the new group
      if (productsToAdd.length > 0) {
        const { error: updateError } = await supabase
          .from('products')
          .update({ group_id: newGroup.group_id })
          .in('product_id', productsToAdd);

        if (updateError) throw updateError;
      }

      toast.success('Група добавена успешно');
      form.reset();
      productsToAdd = [];
      document.getElementById('add-group-products-container').innerHTML = '<span class="text-muted">Няма продукти</span>';
      
      // eslint-disable-next-line no-undef
      const modal = bootstrap.Modal.getInstance(document.getElementById('addGroupModal'));
      if (modal) modal.hide();
      
      await loadGroups();
      await loadGroupsIntoDropdown();
    } catch (err) {
      console.error('Error adding group:', err);
      toast.error('Грешка при добавяне на група');
    }
  });

  document.getElementById('addGroupBtn').addEventListener('click', async () => {
    form.reset();
    productsToAdd = [];
    document.getElementById('add-group-products-container').innerHTML = '<span class="text-muted">Няма продукти</span>';
    await loadProductsForGroupDropdown('add-group-product-select');
    // eslint-disable-next-line no-undef
    new bootstrap.Modal(document.getElementById('addGroupModal')).show();
  });

  // Add product button for new group
  document.getElementById('add-group-product-btn').addEventListener('click', async () => {
    const select = document.getElementById('add-group-product-select');
    const productId = parseInt(select.value);
    if (!productId) return;

    // Add to temp list
    if (!productsToAdd.includes(productId)) {
      productsToAdd.push(productId);

      // Get product name
      const { data: product } = await supabase
        .from('products')
        .select('description')
        .eq('product_id', productId)
        .single();

      const name = product?.description?.name || `Продукт #${productId}`;
      
      // Render products
      const container = document.getElementById('add-group-products-container');
      const existingHTML = container.innerHTML.includes('text-muted') ? '' : container.innerHTML;
      container.innerHTML = existingHTML + `
        <div class="badge bg-success me-2 mb-2 d-inline-flex align-items-center" style="font-size: 0.9rem;" data-temp-product-id="${productId}">
          ${name}
          <button type="button" class="btn-close btn-close-white ms-2" style="font-size: 0.6rem;" data-product-id="${productId}" data-action="remove-temp-product"></button>
        </div>
      `;

      // Add remove listener
      container.querySelector(`[data-temp-product-id="${productId}"] [data-action="remove-temp-product"]`).addEventListener('click', () => {
        productsToAdd = productsToAdd.filter((id) => id !== productId);
        container.querySelector(`[data-temp-product-id="${productId}"]`).remove();
        if (productsToAdd.length === 0) {
          container.innerHTML = '<span class="text-muted">Няма продукти</span>';
        }
        // Reload dropdown
        loadProductsForGroupDropdown('add-group-product-select');
      });

      // Reload dropdown to exclude added product
      await loadProductsForGroupDropdown('add-group-product-select');
      select.value = '';
    }
  });

  form.dataset.initialized = 'true';
}

function handleEditGroupSubmit() {
  const form = document.getElementById('editGroupForm');
  if (!form || form.dataset.initialized === 'true') return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const groupId = parseInt(form.dataset.groupId);
    const name = document.getElementById('edit-group-name').value.trim();

    if (!name) {
      toast.error('Името на група е задължително');
      return;
    }

    try {
      const { error } = await supabase
        .from('product_group')
        .update({ name })
        .eq('group_id', groupId);

      if (error) throw error;

      toast.success('Група обновена успешно');
      
      // eslint-disable-next-line no-undef
      const modal = bootstrap.Modal.getInstance(document.getElementById('editGroupModal'));
      if (modal) modal.hide();
      
      await loadGroups();
      await loadGroupsIntoDropdown();
    } catch (err) {
      console.error('Error updating group:', err);
      toast.error('Грешка при обновяване на група');
    }
  });

  form.dataset.initialized = 'true';
}

// ─── Tab change listeners ────────────────────────────────────

function initializeTabListeners() {
  const usersTab = document.getElementById('users-tab');
  const productsTab = document.getElementById('products-tab');
  const ordersTab = document.getElementById('orders-tab');
  const groupsTab = document.getElementById('groups-tab');

  if (usersTab) {
    usersTab.addEventListener('shown.bs.tab', () => {
      loadUsers();
    });
  }
  if (productsTab) {
    productsTab.addEventListener('shown.bs.tab', () => {
      loadProducts();
      initializeProductForm();
    });
  }
  if (ordersTab) {
    ordersTab.addEventListener('shown.bs.tab', () => loadOrders());
  }
  if (groupsTab) {
    groupsTab.addEventListener('shown.bs.tab', () => {
      loadGroups();
    });
  }
}

// ─── Page init ───────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  await loadComponents();

  const profile = await checkAdminAccess();
  if (!profile) return;

  initializeTabListeners();
  initializeProductForm();
  initializeGroupForm();
  handleEditGroupSubmit();
  await Promise.all([loadStats(), loadUsers(), loadGroupsIntoDropdown()]);
  
  // Initialize the tab system to ensure proper display
  // eslint-disable-next-line no-undef
  const userTabElement = document.getElementById('users-tab');
  if (userTabElement) {
    // eslint-disable-next-line no-undef
    const usersTab = new bootstrap.Tab(userTabElement);
    usersTab.show();
  }
});
