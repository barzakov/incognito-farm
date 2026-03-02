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
    // Calculate date 5 days from now
    const fiveDaysFromNow = new Date();
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
    fiveDaysFromNow.setHours(23, 59, 59, 999); // End of day

    const [ordersRes, productsRes] = await Promise.all([
      // Fetch orders to filter by status in JavaScript
      supabase
        .from('orders')
        .select('order_id, order_status, order_done, order_archived'),
      // Fetch all products to filter by expire date in JavaScript
      supabase
        .from('products')
        .select('product_id, extra')
    ]);

    // Count waiting orders with status "Чакаща"
    let waitingCount = 0;
    if (ordersRes.data) {
      waitingCount = ordersRes.data.filter((o) => 
        o.order_status?.current_status === 'Чакаща' && 
        !o.order_done && 
        !o.order_archived
      ).length;
    }

    // Filter products expiring within 5 days
    let expiringCount = 0;
    if (productsRes.data) {
      expiringCount = productsRes.data.filter((p) => {
        const expireDate = p.extra?.expire;
        if (!expireDate) return false;
        
        // Parse YYYY-MM-DD format
        const [year, month, day] = expireDate.split('-').map(Number);
        const productExpireDate = new Date(year, month - 1, day, 23, 59, 59, 999);
        
        return productExpireDate <= fiveDaysFromNow;
      }).length;
    }

    document.getElementById('stat-waiting-orders').textContent = waitingCount;
    document.getElementById('stat-expiring-products').textContent = expiringCount;
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

function formatDateForBulgarianUsers(dateValue) {
  if (!dateValue || typeof dateValue !== 'string') return '–';

  const normalizedValue = dateValue.includes('T') ? dateValue : `${dateValue}T00:00:00`;
  const parsedDate = new Date(normalizedValue);

  if (Number.isNaN(parsedDate.getTime())) return dateValue;
  return parsedDate.toLocaleDateString('bg-BG');
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
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">Няма продукти</td></tr>';
      return;
    }

    tbody.innerHTML = products.map((p) => {
      const availabilityBadge = p.availability
        ? '<span class="badge bg-success">Налично</span>'
        : '<span class="badge bg-danger">Недостъпно</span>';
      const price = p.price != null ? `${Number(p.price).toFixed(2)} лв.` : '–';
      const discount = p.discount != null ? `${Number(p.discount).toFixed(2)} лв.` : '–';
      const productName = p.description?.name || '–';
      const expireDate = formatDateForBulgarianUsers(p.extra?.expire || null);
      
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
          <td>${expireDate}</td>
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
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-danger py-4">Грешка при зареждане</td></tr>';
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

// ─── Image management functions ──────────────────────────────

function renderEditProductGallery(existingImages, form) {
  const gallery = form.querySelector('#edit-product-images-gallery');
  if (!gallery) return;

  const tempImages = JSON.parse(form.dataset.tempImages || '[]');
  const allImages = [...existingImages, ...tempImages];

  if (allImages.length === 0) {
    gallery.innerHTML = '<div class="col-12 text-muted">Няма добавени изображения</div>';
    return;
  }

  gallery.innerHTML = allImages.map((img, index) => {
    const isTemp = index >= existingImages.length;
    const imageUrl = img.dataUrl || supabase.storage.from('products').getPublicUrl(img.path).data.publicUrl;
    const isActive = img.active;

    return `
      <div class="col-md-4 col-lg-3 position-relative">
        <div class="card border-0 shadow-sm position-relative h-100" style="overflow: hidden;">
          <img src="${imageUrl}" class="card-img-top" style="height: 150px; object-fit: cover;">
          <div class="position-absolute top-0 end-0 m-2">
            ${isActive ? '<span class="badge bg-success">Активно</span>' : ''}
          </div>
          <div class="card-body p-2 d-flex flex-column gap-1">
            ${!isActive ? `
              <button type="button" class="btn btn-sm btn-warning set-active-btn" data-index="${index}">
                <i class="bi bi-check-circle"></i> Избери
              </button>
            ` : ''}
            <button type="button" class="btn btn-sm btn-danger delete-image-btn" data-index="${index}">
              <i class="bi bi-trash"></i> Изтрий
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Attach event listeners
  form.querySelectorAll('.set-active-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const index = parseInt(btn.dataset.index);
      setActiveImage(index, form);
    });
  });

  form.querySelectorAll('.delete-image-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const index = parseInt(btn.dataset.index);
      deleteImage(index, form);
    });
  });
}

function setActiveImage(index, form) {
  const existingImages = JSON.parse(form.dataset.productImages || '[]');
  const tempImages = JSON.parse(form.dataset.tempImages || '[]');
  const allImages = [...existingImages, ...tempImages];

  // Mark all as inactive, then mark selected as active
  allImages.forEach((img, i) => {
    img.active = i === index;
  });

  // Split back
  const newExisting = allImages.slice(0, existingImages.length);
  const newTemp = allImages.slice(existingImages.length);

  form.dataset.productImages = JSON.stringify(newExisting);
  form.dataset.tempImages = JSON.stringify(newTemp);

  renderEditProductGallery(newExisting, form);
}

function deleteImage(index, form) {
  const existingImages = JSON.parse(form.dataset.productImages || '[]');
  const tempImages = JSON.parse(form.dataset.tempImages || '[]');
  const allImages = [...existingImages, ...tempImages];

  const deletedWasActive = allImages[index].active;

  // Remove image
  allImages.splice(index, 1);

  // If deleted was active, make first one active (if any exist)
  if (deletedWasActive && allImages.length > 0) {
    allImages[0].active = true;
  }

  // Clean up File map if deleting a temp image
  const deletedImage = allImages[index];
  if (deletedImage && deletedImage.id && index >= existingImages.length) {
    form._tempFiles.delete(deletedImage.id);
  }

  // Split back
  const newExisting = allImages.slice(0, existingImages.length - (index < existingImages.length ? 1 : 0));
  const newTemp = allImages.slice(newExisting.length);

  form.dataset.productImages = JSON.stringify(newExisting);
  form.dataset.tempImages = JSON.stringify(newTemp);

  renderEditProductGallery(newExisting, form);
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

  // Populate extra fields (country, size, expire)
  document.getElementById('edit-product-country').value = productData.extra?.country || '';
  
  // Convert expire date from YYYY-MM-DD to DD.MM.YYYY format
  const expireDate = productData.extra?.expire || '';
  if (expireDate) {
    const [year, month, day] = expireDate.split('-');
    document.getElementById('edit-product-expire').value = `${day}.${month}.${year}`;
  } else {
    document.getElementById('edit-product-expire').value = '';
  }
  
  // Populate size fields
  if (productData.extra?.size) {
    const sizeData = productData.extra.size;
    const activeUnit = sizeData.active;
    
    if (activeUnit === 'грамове' && sizeData.грамове !== null) {
      document.getElementById('edit-product-size-grams').checked = true;
      document.getElementById('edit-product-size-grams-value').value = sizeData.грамове;
    } else if (activeUnit === 'килограми' && sizeData.килограми !== null) {
      document.getElementById('edit-product-size-kg').checked = true;
      document.getElementById('edit-product-size-kg-value').value = sizeData.килограми;
    } else if (activeUnit === 'бройки' && sizeData.бройки !== null) {
      document.getElementById('edit-product-size-pieces').checked = true;
      document.getElementById('edit-product-size-pieces-value').value = sizeData.бройки;
    }
  }

  // Show current image if exists
  // Initialize images array from productData
  const imagesArray = productData.images || [];
  newForm.dataset.productImages = JSON.stringify(imagesArray);
  newForm.dataset.tempImages = JSON.stringify([]);
  // Map to store File objects (not serializable, so kept in memory)
  newForm._tempFiles = new Map();

  // Render existing images
  renderEditProductGallery(imagesArray, newForm);

  // Add image button listener
  const addImageBtn = newForm.querySelector('#add-edit-image-btn');
  if (addImageBtn) {
    addImageBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const imageInput = newForm.querySelector('#edit-product-image');
      if (imageInput) imageInput.click();
    });
  }

  // File input change listener
  const imageInput = newForm.querySelector('#edit-product-image');
  if (imageInput) {
    imageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Файлът е твърде голям (макс. 5MB)');
        return;
      }

      // Read file and add to temp images
      const reader = new FileReader();
      reader.onload = (event) => {
        const tempImages = JSON.parse(newForm.dataset.tempImages || '[]');
        const imageId = `${Date.now()}_${Math.random()}`;
        
        tempImages.push({
          id: imageId,
          path: null, // Will be assigned on upload
          active: tempImages.length === 0 && imagesArray.length === 0,
          dataUrl: event.target.result,
          fileName: file.name,
        });
        
        // Store the actual File object separately (not serializable)
        newForm._tempFiles.set(imageId, file);
        
        newForm.dataset.tempImages = JSON.stringify(tempImages);
        renderEditProductGallery(imagesArray, newForm);
      };
      reader.readAsDataURL(file);

      // Clear input
      imageInput.value = '';
    });
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
    const name = form.querySelector('#edit-product-name').value.trim();
    const briefInfo = form.querySelector('#edit-product-brief').value.trim();
    const info = form.querySelector('#edit-product-info').value.trim();
    const price = parseFloat(form.querySelector('#edit-product-price').value);
    const discount = form.querySelector('#edit-product-discount').value ? parseFloat(form.querySelector('#edit-product-discount').value) : null;
    const availability = form.querySelector('#edit-product-availability').value === 'true';
    const groupId = form.querySelector('#edit-product-group').value ? parseInt(form.querySelector('#edit-product-group').value) : null;

    if (!name || isNaN(price)) {
      toast.error('Моля попълнете задължителните полета.');
      return;
    }

    // Collect extra data (country, size, expire)
    const country = form.querySelector('#edit-product-country').value.trim();
    let expire = form.querySelector('#edit-product-expire').value;
    // Convert DD.MM.YYYY to YYYY-MM-DD for database
    if (expire && expire.includes('.')) {
      const [day, month, year] = expire.split('.');
      expire = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // Determine which size unit is selected and get its value
    let sizeData = {
      грамове: null,
      килограми: null,
      бройки: null,
      active: null
    };
    
    const gramsRadio = form.querySelector('#edit-product-size-grams');
    const kgRadio = form.querySelector('#edit-product-size-kg');
    const piecesRadio = form.querySelector('#edit-product-size-pieces');
    
    if (gramsRadio.checked) {
      const value = form.querySelector('#edit-product-size-grams-value').value;
      sizeData.грамове = value ? parseFloat(value) : null;
      sizeData.active = 'грамове';
    } else if (kgRadio.checked) {
      const value = form.querySelector('#edit-product-size-kg-value').value;
      sizeData.килограми = value ? parseFloat(value) : null;
      sizeData.active = 'килограми';
    } else if (piecesRadio.checked) {
      const value = form.querySelector('#edit-product-size-pieces-value').value;
      sizeData.бройки = value ? parseInt(value) : null;
      sizeData.active = 'бройки';
    }

    const extra = {
      country: country || null,
      size: sizeData,
      expire: expire || null
    };

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
      extra,
    };

    // Handle image uploads
    const existingImages = JSON.parse(form.dataset.productImages || '[]');
    const tempImages = JSON.parse(form.dataset.tempImages || '[]');
    const uploadedImages = [];

    // Upload new images
    for (const tempImg of tempImages) {
      const file = form._tempFiles.get(tempImg.id);
      if (file) {
        const fileName = `${Date.now()}_${file.name}`;
        const filePath = `products/${productId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('products')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        uploadedImages.push({
          path: filePath,
          active: tempImg.active
        });
      }
    }

    // Combine with existing images
    const finalImages = [...existingImages, ...uploadedImages];

    // Ensure at least one image is marked as active if images exist
    if (finalImages.length > 0 && !finalImages.some(img => img.active)) {
      finalImages[0].active = true;
    }

    updateData.images = finalImages;

    // Set images_location to the active image path
    const activeImage = finalImages.find(img => img.active);
    if (activeImage) {
      updateData.images_location = activeImage.path;
    }

    const { error } = await supabase
      .from('products')
      .update(updateData)
      .eq('product_id', productId);

    if (error) throw error;

    toast.success('Продуктът е обновен успешно!');
    // eslint-disable-next-line no-undef
    const modal = bootstrap.Modal.getInstance(form.closest('.modal'));
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
      // Fetch the product to get images_location
      const { data: product, error: fetchError } = await supabase
        .from('products')
        .select('images_location')
        .eq('product_id', productId)
        .single();

      if (fetchError) throw fetchError;

      // Delete storage directory if images exist
      if (product && product.images_location) {
        const filePath = product.images_location;
        const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));

        const { data: files, error: listError } = await supabase.storage
          .from('products')
          .list(folderPath);

        if (!listError && files && files.length > 0) {
          const filesToDelete = files.map((f) => `${folderPath}/${f.name}`);

          const { error: deleteError } = await supabase.storage
            .from('products')
            .remove(filesToDelete);

          if (deleteError) throw deleteError;
        }
      }

      // Delete product record
      const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .eq('product_id', productId);

      if (deleteError) throw deleteError;

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

  // Initialize images array in form (only metadata, files stored separately)
  form.dataset.tempImages = JSON.stringify([]);
  // Map to store File objects (not serializable, so kept in memory)
  form._tempFiles = new Map();

  // Add image button listener
  const addImageBtn = form.querySelector('#add-product-image-btn');
  if (addImageBtn) {
    addImageBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const imageInput = form.querySelector('#product-image');
      if (imageInput) imageInput.click();
    });
  }

  // File input change listener
  const imageInput = form.querySelector('#product-image');
  if (imageInput) {
    imageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Файлът е твърде голям (макс. 5MB)');
        return;
      }

      // Read file and add to temp images
      const reader = new FileReader();
      reader.onload = (event) => {
        const tempImages = JSON.parse(form.dataset.tempImages || '[]');
        const imageId = `${Date.now()}_${Math.random()}`;
        
        tempImages.push({
          id: imageId,
          path: null,
          active: tempImages.length === 0,
          dataUrl: event.target.result,
          fileName: file.name,
        });
        
        // Store the actual File object separately (not serializable)
        form._tempFiles.set(imageId, file);
        
        form.dataset.tempImages = JSON.stringify(tempImages);
        renderProductGallery([], form);
      };
      reader.readAsDataURL(file);

      // Clear input
      imageInput.value = '';
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Добавяне...';

    try {
      const name = form.querySelector('#product-name').value.trim();
      const briefInfo = form.querySelector('#product-brief').value.trim();
      const info = form.querySelector('#product-info').value.trim();
      const price = parseFloat(form.querySelector('#product-price').value);
      const discount = form.querySelector('#product-discount').value ? parseFloat(form.querySelector('#product-discount').value) : null;
      const availability = form.querySelector('#product-availability').value === 'true';
      const groupId = form.querySelector('#product-group').value ? parseInt(form.querySelector('#product-group').value) : null;

      // Collect extra data (country, size, expire)
      const country = form.querySelector('#product-country').value.trim();
      let expire = form.querySelector('#product-expire').value;
      // Convert DD.MM.YYYY to YYYY-MM-DD for database
      if (expire && expire.includes('.')) {
        const [day, month, year] = expire.split('.');
        expire = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      
      // Determine which size unit is selected and get its value
      let sizeData = {
        грамове: null,
        килограми: null,
        бройки: null,
        active: null
      };
      
      const gramsRadio = form.querySelector('#product-size-grams');
      const kgRadio = form.querySelector('#product-size-kg');
      const piecesRadio = form.querySelector('#product-size-pieces');
      
      if (gramsRadio.checked) {
        const value = form.querySelector('#product-size-grams-value').value;
        sizeData.грамове = value ? parseFloat(value) : null;
        sizeData.active = 'грамове';
      } else if (kgRadio.checked) {
        const value = form.querySelector('#product-size-kg-value').value;
        sizeData.килограми = value ? parseFloat(value) : null;
        sizeData.active = 'килограми';
      } else if (piecesRadio.checked) {
        const value = form.querySelector('#product-size-pieces-value').value;
        sizeData.бройки = value ? parseInt(value) : null;
        sizeData.active = 'бройки';
      }

      const extra = {
        country: country || null,
        size: sizeData,
        expire: expire || null
      };

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
            extra,
          },
        ])
        .select();

      if (insertError) throw insertError;

      const productId = insertedProduct[0].product_id;
      const tempImages = JSON.parse(form.dataset.tempImages || '[]');
      const uploadedImages = [];

      // Upload images if provided
      for (const tempImg of tempImages) {
        const file = form._tempFiles.get(tempImg.id);
        if (file) {
          const fileName = `${Date.now()}_${file.name}`;
          const filePath = `products/${productId}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('products')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          uploadedImages.push({
            path: filePath,
            active: tempImg.active
          });
        }
      }

      // Ensure at least one image is marked as active if images exist
      if (uploadedImages.length > 0 && !uploadedImages.some(img => img.active)) {
        uploadedImages[0].active = true;
      }

      // Update product with images
      if (uploadedImages.length > 0) {
        const updateImages = { images: uploadedImages };
        
        // Set images_location to the active image path
        const activeImage = uploadedImages.find(img => img.active);
        if (activeImage) {
          updateImages.images_location = activeImage.path;
        }

        const { error: updateError } = await supabase
          .from('products')
          .update(updateImages)
          .eq('product_id', productId);

        if (updateError) throw updateError;
      }

      toast.success('Продуктът е добавен успешно!');
      form.reset();
      form.dataset.tempImages = JSON.stringify([]);
      const gallery = form.querySelector('#product-images-gallery');
      if (gallery) gallery.innerHTML = '<div class="col-12 text-muted">Няма добавени изображения</div>';
      // eslint-disable-next-line no-undef
      const modal = bootstrap.Modal.getInstance(document.getElementById('addProductModal'));
      if (modal) modal.hide();
      await loadProducts();
      await loadStats();
    } catch (err) {
      console.error('Add product error:', err);
      toast.error('Грешка при добавяне на продукт.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });
}

function renderProductGallery(existingImages, form) {
  const gallery = form.querySelector('#product-images-gallery');
  if (!gallery) return;

  const tempImages = JSON.parse(form.dataset.tempImages || '[]');
  const allImages = [...existingImages, ...tempImages];

  if (allImages.length === 0) {
    gallery.innerHTML = '<div class="col-12 text-muted">Няма добавени изображения</div>';
    return;
  }

  gallery.innerHTML = allImages.map((img, index) => {
    const imageUrl = img.dataUrl || supabase.storage.from('products').getPublicUrl(img.path).data.publicUrl;
    const isActive = img.active;

    return `
      <div class="col-md-4 col-lg-3 position-relative">
        <div class="card border-0 shadow-sm position-relative h-100" style="overflow: hidden;">
          <img src="${imageUrl}" class="card-img-top" style="height: 150px; object-fit: cover;">
          <div class="position-absolute top-0 end-0 m-2">
            ${isActive ? '<span class="badge bg-success">Активно</span>' : ''}
          </div>
          <div class="card-body p-2 d-flex flex-column gap-1">
            ${!isActive ? `
              <button type="button" class="btn btn-sm btn-warning set-active-product-btn" data-index="${index}">
                <i class="bi bi-check-circle"></i> Избери
              </button>
            ` : ''}
            <button type="button" class="btn btn-sm btn-danger delete-product-image-btn" data-index="${index}">
              <i class="bi bi-trash"></i> Изтрий
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Attach event listeners
  form.querySelectorAll('.set-active-product-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const index = parseInt(btn.dataset.index);
      setActiveProductImage(index, form);
    });
  });

  form.querySelectorAll('.delete-product-image-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const index = parseInt(btn.dataset.index);
      deleteProductImage(index, form);
    });
  });
}

function setActiveProductImage(index, form) {
  const tempImages = JSON.parse(form.dataset.tempImages || '[]');

  // Mark all as inactive, then mark selected as active
  tempImages.forEach((img, i) => {
    img.active = i === index;
  });

  form.dataset.tempImages = JSON.stringify(tempImages);
  renderProductGallery([], form);
}

function deleteProductImage(index, form) {
  const tempImages = JSON.parse(form.dataset.tempImages || '[]');
  const deletedImage = tempImages[index];
  const deletedWasActive = deletedImage.active;

  // Remove from File map if it's a temp image
  if (deletedImage.id) {
    form._tempFiles.delete(deletedImage.id);
  }

  // Remove image
  tempImages.splice(index, 1);

  // If deleted was active, make first one active (if any exist)
  if (deletedWasActive && tempImages.length > 0) {
    tempImages[0].active = true;
  }

  form.dataset.tempImages = JSON.stringify(tempImages);
  renderProductGallery([], form);
}

// ─── Order statuses ──────────────────────────────────────────

const ORDER_STATUSES = [
  'Чакаща',
  'Потвърдена',
  'В обработка',
  'Изпратена',
  'Доставена',
  'Отказана',
  'Върната',
];

function getOrderStatusBadgeClass(status) {
  if (!status) return 'bg-secondary';
  const s = status.toLowerCase();
  if (s.includes('достав')) return 'bg-success';
  if (s.includes('изпрат')) return 'bg-info text-dark';
  if (s.includes('обработ')) return 'bg-primary';
  if (s.includes('потвърд')) return 'bg-success-subtle text-success';
  if (s.includes('отказ')) return 'bg-danger';
  if (s.includes('върн')) return 'bg-secondary';
  return 'bg-warning text-dark'; // pending
}

// ─── Orders table ────────────────────────────────────────────

async function loadOrders() {
  try {
    let { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .order('order_date', { ascending: false });

    if (error) throw error;

    if (!orders) {
      orders = [];
    }

    // Split orders into different categories
    const currentOrders = orders.filter(o => {
      const status = o.order_status?.current_status;
      return !o.order_done && status !== 'Доставена' && status !== 'Отказана' && status !== 'Върната';
    });
    const pendingOrders = orders.filter(o => !o.order_done && o.order_status?.current_status === 'Чакаща');
    const confirmedOrders = orders.filter(o => !o.order_done && o.order_status?.current_status === 'Потвърдена');
    const processingOrders = orders.filter(o => !o.order_done && o.order_status?.current_status === 'В обработка');
    const shippedOrders = orders.filter(o => !o.order_done && o.order_status?.current_status === 'Изпратена');
    const deliveredOrders = orders.filter(o => o.order_done || o.order_status?.current_status === 'Доставена');
    const cancelledOrders = orders.filter(o => o.order_status?.current_status === 'Отказана');
    const returnedOrders = orders.filter(o => o.order_status?.current_status === 'Върната');

    // Load all order tabs
    loadOrdersTable('orders-table-body', currentOrders, true);
    loadOrdersTable('orders-pending-table-body', pendingOrders, false);
    loadOrdersTable('orders-confirmed-table-body', confirmedOrders, false);
    loadOrdersTable('orders-processing-table-body', processingOrders, false);
    loadOrdersTable('orders-shipped-table-body', shippedOrders, false);
    loadOrdersTable('orders-delivered-table-body', deliveredOrders, false, true);
    loadOrdersTable('orders-cancelled-table-body', cancelledOrders, false);
    loadOrdersTable('orders-returned-table-body', returnedOrders, false);
  } catch (err) {
    console.error('Error loading orders:', err);
    document.getElementById('orders-table-body').innerHTML = '<tr><td colspan="8" class="text-center text-danger py-4">Грешка при зареждане</td></tr>';
  }
}

function loadOrdersTable(tableBodyId, orders, showActions, showReturnButton = false) {
  const tbody = document.getElementById(tableBodyId);

  if (!orders || orders.length === 0) {
    const colspan = showActions ? 8 : (showReturnButton ? 7 : 6);
    tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-center text-muted py-4">Няма поръчки</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map((o) => {
    const extra = o.order_extra || {};
    const items = extra.items || [];
    const address = extra.address || {};
    const orderDate = o.order_date ? new Date(o.order_date).toLocaleDateString('bg-BG', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : '–';
    const currentStatus = o.order_status?.current_status || 'Чакаща';
    const badgeClass = getOrderStatusBadgeClass(currentStatus);
    const total = ((o.price || 0) - (o.discount || 0)).toFixed(2);
    const notes = o.short_description || extra.notes || '';

    // Build items summary
    const itemsSummary = items.length > 0
      ? items.map(i => `${i.name} x${i.quantity}`).join(', ')
      : '–';

    // Address summary
    const addressSummary = address.street
      ? `${address.street}, ${address.city || ''}`
      : '–';

    // Status dropdown options (only for current orders)
    const statusSection = showActions ? `
      <td>
        <div class="d-flex gap-1 align-items-center">
          <select class="form-select form-select-sm order-status-select" data-order-id="${o.order_id}" style="width: 140px; font-size: 0.8rem;">
            ${ORDER_STATUSES.map(s =>
              `<option value="${s}" ${s === currentStatus ? 'selected' : ''}>${s}</option>`
            ).join('')}
          </select>
          <button class="btn btn-outline-success btn-sm save-status-btn" data-order-id="${o.order_id}" title="Запази статус">
            <i class="bi bi-check-lg"></i>
          </button>
        </div>
      </td>
    ` : '';

    // Return button for delivered orders
    const returnButton = showReturnButton ? `
      <td>
        <button class="btn btn-sm btn-outline-warning rounded-pill mark-returned-btn" data-order-id="${o.order_id}" title="Маркирай като върната">
          <i class="bi bi-arrow-counterclockwise"></i> Върната
        </button>
      </td>
    ` : '';

    return `
      <tr data-order-id="${o.order_id}">
        <td><strong>#${o.order_id}</strong></td>
        <td>${o.user_id}</td>
        <td>
          <small title="${itemsSummary}" style="max-width: 200px; display: inline-block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${itemsSummary}
          </small>
        </td>
        <td><strong class="text-success">${total} лв.</strong></td>
        <td><small>${orderDate}</small></td>
        <td><span class="badge ${badgeClass}">${currentStatus}</span></td>
        ${statusSection}
        ${returnButton}
      </tr>
    `;
  }).join('');

  // Only attach handlers if showing actions
  if (showActions) {
    attachOrderHandlers(orders);
  }

  // Attach return button handlers for delivered orders
  if (showReturnButton) {
    attachReturnButtonHandlers();
  }
}

function attachOrderHandlers(orders) {
  // Make entire row clickable to view order details
  document.querySelectorAll('#orders-table-body tr').forEach(row => {
    row.style.cursor = 'pointer';
    row.addEventListener('click', (e) => {
      // Don't open details if clicking on buttons or selects
      if (e.target.closest('button') || e.target.closest('select')) {
        return;
      }
      
      const orderId = parseInt(row.dataset.orderId);
      const order = orders.find(o => o.order_id === orderId);
      if (order) showOrderDetailModal(order);
    });
  });

  // Save status buttons
  document.querySelectorAll('.save-status-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const orderId = parseInt(btn.dataset.orderId);
      const select = document.querySelector(`.order-status-select[data-order-id="${orderId}"]`);
      const newStatus = select.value;
      await updateOrderStatus(orderId, newStatus, orders);
    });
  });
}

function attachReturnButtonHandlers() {
  document.querySelectorAll('.mark-returned-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation(); // Prevent row click event
      const orderId = parseInt(btn.dataset.orderId);
      await markOrderAsReturned(orderId);
    });
  });
}

async function markOrderAsReturned(orderId) {
  try {
    // Fetch current order
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('order_status')
      .eq('order_id', orderId)
      .single();

    if (fetchError) throw fetchError;

    const now = new Date().toISOString();
    const currentOrderStatus = order?.order_status || { current_status: 'Доставена', history: [] };
    const history = Array.isArray(currentOrderStatus.history) ? [...currentOrderStatus.history] : [];

    // Add history entry
    history.push({
      status: 'Върната',
      date: now,
      note: 'Поръчката е маркирана като върната от администратор'
    });

    // Update order with new status
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        order_status: {
          current_status: 'Върната',
          history
        }
      })
      .eq('order_id', orderId);

    if (updateError) throw updateError;

    toast.success(`Поръчка #${orderId} е маркирана като върната`);
    await loadOrders();
    await loadStats();
  } catch (err) {
    console.error('Error marking order as returned:', err);
    toast.error('Грешка при маркиране на поръчката като върната');
  }
}

async function updateOrderStatus(orderId, newStatus, orders) {
  try {
    const order = orders.find(o => o.order_id === orderId);
    if (!order) return;

    const now = new Date().toISOString();
    const currentOrderStatus = order.order_status || { current_status: 'Чакаща', history: [] };
    const history = currentOrderStatus.history || [];

    // Don't add duplicate entry if status hasn't changed
    if (currentOrderStatus.current_status === newStatus) {
      toast.info('Статусът не е променен');
      return;
    }

    history.push({
      status: newStatus,
      date: now,
      note: `Статусът е променен от "${currentOrderStatus.current_status}" на "${newStatus}"`
    });

    const updatedStatus = {
      current_status: newStatus,
      history
    };

    // Auto-set order_done if delivered
    const isDone = newStatus === 'Доставена';

    const { error } = await supabase
      .from('orders')
      .update({
        order_status: updatedStatus,
        order_done: isDone || order.order_done
      })
      .eq('order_id', orderId);

    if (error) throw error;

    toast.success(`Статусът на поръчка #${orderId} е променен на "${newStatus}"`);
    await loadOrders();
    await loadStats();
  } catch (err) {
    console.error('Error updating order status:', err);
    toast.error('Грешка при промяна на статуса');
  }
}

function showOrderDetailModal(order) {
  const extra = order.order_extra || {};
  const items = extra.items || [];
  const address = extra.address || {};
  const notes = order.short_description || extra.notes || '–';
  const history = order.order_status?.history || [];
  const total = ((order.price || 0) - (order.discount || 0)).toFixed(2);

  const itemsHTML = items.map(i => `
    <tr>
      <td>${i.name}</td>
      <td class="text-center">${i.quantity}</td>
      <td class="text-end">${Number(i.unit_price).toFixed(2)} лв.</td>
      <td class="text-end">${i.unit_discount != null ? Number(i.unit_discount).toFixed(2) + ' лв.' : '–'}</td>
      <td class="text-end fw-bold">${Number(i.line_total).toFixed(2)} лв.</td>
    </tr>
  `).join('');

  const historyHTML = history.map(h => {
    const d = new Date(h.date).toLocaleDateString('bg-BG', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    return `<li class="list-group-item d-flex justify-content-between"><span><strong>${h.status}</strong> ${h.note ? `<small class="text-muted">— ${h.note}</small>` : ''}</span><small class="text-muted">${d}</small></li>`;
  }).join('');

  // Create or reuse modal
  let modalEl = document.getElementById('orderDetailModal');
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'orderDetailModal';
    modalEl.className = 'modal fade';
    modalEl.tabIndex = -1;
    document.body.appendChild(modalEl);
  }

  modalEl.innerHTML = `
    <div class="modal-dialog modal-lg">
      <div class="modal-content rounded-4">
        <div class="modal-header">
          <h5 class="modal-title"><i class="bi bi-receipt"></i> Поръчка #${order.order_id}</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <div class="row mb-3">
            <div class="col-md-6">
              <strong>Потребител ID:</strong> ${order.user_id}<br>
              <strong>Дата:</strong> ${new Date(order.order_date).toLocaleDateString('bg-BG', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}<br>
              <strong>Статус:</strong> <span class="badge ${getOrderStatusBadgeClass(order.order_status?.current_status)}">${order.order_status?.current_status || '–'}</span><br>
              <strong>Завършена:</strong> ${order.order_done ? '<i class="bi bi-check-circle-fill text-success"></i> Да' : '<i class="bi bi-circle text-muted"></i> Не'}
            </div>
            <div class="col-md-6">
              <strong>Адрес:</strong> ${address.street || '–'}, ${address.city || ''} ${address.postal_code || ''}<br>
              ${address.phone ? `<strong>Телефон:</strong> ${address.phone}<br>` : ''}
              <strong>Бележки:</strong> ${notes}<br>
              <strong>Обща сума:</strong> <span class="text-success fw-bold">${total} лв.</span>
              ${order.discount ? `<br><strong>Отстъпка:</strong> <span class="text-danger">-${Number(order.discount).toFixed(2)} лв.</span>` : ''}
            </div>
          </div>

          ${items.length > 0 ? `
          <h6 class="mt-3 mb-2">Продукти</h6>
          <div class="table-responsive">
            <table class="table table-sm table-bordered">
              <thead class="table-light">
                <tr><th>Продукт</th><th class="text-center">Бройки</th><th class="text-end">Цена</th><th class="text-end">Отстъпка</th><th class="text-end">Общо</th></tr>
              </thead>
              <tbody>${itemsHTML}</tbody>
            </table>
          </div>` : ''}

          ${history.length > 0 ? `
          <h6 class="mt-3 mb-2">История на статуса</h6>
          <ul class="list-group list-group-flush">${historyHTML}</ul>` : ''}
        </div>
      </div>
    </div>
  `;

  const modal = new bootstrap.Modal(modalEl);
  modal.show();
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
      loadStats(); // Refresh stats when switching to users tab
    });
  }
  if (productsTab) {
    productsTab.addEventListener('shown.bs.tab', () => {
      loadProducts();
      initializeProductForm();
      loadStats(); // Refresh stats when switching to products tab
    });
  }
  if (ordersTab) {
    ordersTab.addEventListener('shown.bs.tab', () => {
      // Ensure the first sub-tab (Текущи поръчки) is active
      const currentOrdersTab = document.getElementById('orders-current-tab');
      const currentOrdersPanel = document.getElementById('orders-current-panel');
      
      // Remove active from all order sub-tabs
      document.querySelectorAll('#ordersTabContent .tab-pane').forEach(panel => {
        panel.classList.remove('show', 'active');
      });
      document.querySelectorAll('#ordersTabs .nav-link').forEach(tab => {
        tab.classList.remove('active');
      });
      
      // Set current orders as active
      if (currentOrdersTab) {
        currentOrdersTab.classList.add('active');
      }
      if (currentOrdersPanel) {
        currentOrdersPanel.classList.add('show', 'active');
      }
      
      loadOrders();
      loadStats(); // Refresh stats when switching to orders tab
    });
  }
  if (groupsTab) {
    groupsTab.addEventListener('shown.bs.tab', () => {
      loadGroups();
      loadStats(); // Refresh stats when switching to groups tab
    });
  }

  // Handle mobile orders dropdown
  const ordersTabSelect = document.getElementById('orders-tab-select');
  if (ordersTabSelect) {
    ordersTabSelect.addEventListener('change', (e) => {
      const targetPanelId = e.target.value;
      // Hide all order panels
      document.querySelectorAll('#ordersTabContent .tab-pane').forEach(panel => {
        panel.classList.remove('show', 'active');
      });
      // Show selected panel
      const targetPanel = document.getElementById(targetPanelId);
      if (targetPanel) {
        targetPanel.classList.add('show', 'active');
      }
    });
  }
}

function initializeForceExpiryCheckButton() {
  const forceCheckBtn = document.getElementById('force-expiry-check-btn');
  if (!forceCheckBtn) return;

  forceCheckBtn.addEventListener('click', async () => {
    const originalHTML = forceCheckBtn.innerHTML;
    forceCheckBtn.disabled = true;
    forceCheckBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Проверка...';

    try {
      const { error } = await supabase.rpc('update_expired_products');
      if (error) throw error;

      toast.success('Проверката за изтекли продукти завърши успешно.');
      await Promise.all([loadProducts(), loadStats()]);
    } catch (err) {
      console.error('Force expiry check error:', err);
      toast.error('Грешка при ръчна проверка на изтеклите продукти.');
    } finally {
      forceCheckBtn.disabled = false;
      forceCheckBtn.innerHTML = originalHTML;
    }
  });
}

// ─── Page init ───────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  await loadComponents();

  const profile = await checkAdminAccess();
  if (!profile) return;

  initializeTabListeners();
  initializeForceExpiryCheckButton();
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
