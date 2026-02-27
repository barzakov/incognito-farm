import { supabase, fetchCurrentUserProfile, fetchAuthUser, logoutUser, getSession } from '../../lib/supabaseClient.js';
import { loadComponents } from '../../lib/components.js';
import { toast } from '../../lib/toast.js';

// ─── DOM References ──────────────────────────────────────────

const userLoading = () => document.getElementById('user-loading');
const userNotAuth = () => document.getElementById('user-not-auth');
const userContent = () => document.getElementById('user-content');

const profileFullname = () => document.getElementById('profile-fullname');
const profileEmail = () => document.getElementById('profile-email');
const profileMemberSince = () => document.getElementById('profile-member-since');

// Section toggles
const profileMenuItems = () => document.querySelectorAll('.profile-menu-item');
const profileSections = () => document.querySelectorAll('.profile-section');

// Personal Info
const displayName = () => document.getElementById('display-name');
const displaySecondName = () => document.getElementById('display-second-name');
const displayLastname = () => document.getElementById('display-lastname');
const displayEmail = () => document.getElementById('display-email');

const editPersonalBtn = () => document.getElementById('edit-personal-btn');
const personalInfoDisplay = () => document.getElementById('personal-info-display');
const personalInfoEdit = () => document.getElementById('personal-info-edit');
const editPersonalForm = () => document.getElementById('edit-personal-form');
const cancelPersonalBtn = () => document.getElementById('cancel-personal-btn');

const inputName = () => document.getElementById('input-name');
const inputSecondName = () => document.getElementById('input-second-name');
const inputLastname = () => document.getElementById('input-lastname');

// Addresses
const addAddressBtn = () => document.getElementById('add-address-btn');
const addressesList = () => document.getElementById('addresses-list');
const addAddressForm = () => document.getElementById('add-address-form');
const addressForm = () => document.getElementById('address-form');
const cancelAddressBtn = () => document.getElementById('cancel-address-btn');

const addressStreet = () => document.getElementById('address-street');
const addressCity = () => document.getElementById('address-city');
const addressPostal = () => document.getElementById('address-postal');
const addressPhone = () => document.getElementById('address-phone');
const addressEmail = () => document.getElementById('address-email');
const addressExtra = () => document.getElementById('address-extra');
const addressIsDefault = () => document.getElementById('address-is-default');

// Orders
const ordersList = () => document.getElementById('orders-list');

// Settings
const changePasswordBtn = () => document.getElementById('change-password-btn');
const deleteAccountBtn = () => document.getElementById('delete-account-btn');
const logoutBtn = () => document.getElementById('logout-btn');

const changePasswordForm = () => document.getElementById('change-password-form');
const newPassword = () => document.getElementById('new-password');
const confirmPassword = () => document.getElementById('confirm-password');

const deleteConfirmText = () => document.getElementById('delete-confirm-text');
const confirmDeleteBtn = () => document.getElementById('confirm-delete-btn');

// Current user profile
let currentUser = null;
let currentAuthUser = null;

// ─── Initialization ──────────────────────────────────────────

async function initializePage() {
  await loadComponents();
  
  currentAuthUser = await fetchAuthUser();
  
  if (!currentAuthUser) {
    userLoading().classList.add('d-none');
    userNotAuth().classList.remove('d-none');
    return;
  }

  currentUser = await fetchCurrentUserProfile();
  
  if (!currentUser) {
    userLoading().classList.add('d-none');
    userNotAuth().classList.remove('d-none');
    return;
  }

  userLoading().classList.add('d-none');
  userContent().classList.remove('d-none');

  // Populate UI
  populateUserProfile();
  await loadAddresses();
  await loadOrders();
  setupEventListeners();
}

// ─── Populate Profile ────────────────────────────────────────

function populateUserProfile() {
  const fullName = [currentUser.name, currentUser.second_name, currentUser.lastname]
    .filter(Boolean)
    .join(' ') || 'Потребител';

  profileFullname().textContent = fullName;
  profileEmail().textContent = currentAuthUser.email || '-';
  
  const createdDate = new Date(currentUser.created_on).toLocaleDateString('bg-BG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  profileMemberSince().textContent = `Член от ${createdDate}`;

  // Personal info display
  displayName().textContent = currentUser.name || '-';
  displaySecondName().textContent = currentUser.second_name || '-';
  displayLastname().textContent = currentUser.lastname || '-';
  displayEmail().textContent = currentAuthUser.email || '-';
}

// ─── Personal Info Edit ──────────────────────────────────────

editPersonalBtn().addEventListener('click', () => {
  inputName().value = currentUser.name || '';
  inputSecondName().value = currentUser.second_name || '';
  inputLastname().value = currentUser.lastname || '';

  personalInfoDisplay().classList.add('d-none');
  personalInfoEdit().classList.remove('d-none');
  editPersonalBtn().classList.add('d-none');
});

cancelPersonalBtn().addEventListener('click', () => {
  personalInfoDisplay().classList.remove('d-none');
  personalInfoEdit().classList.add('d-none');
  editPersonalBtn().classList.remove('d-none');
});

editPersonalForm().addEventListener('submit', async (e) => {
  e.preventDefault();
  
  try {
    const { error } = await supabase
      .from('users')
      .update({
        name: inputName().value || null,
        second_name: inputSecondName().value || null,
        lastname: inputLastname().value || null,
      })
      .eq('user_id', currentUser.user_id);

    if (error) throw error;

    currentUser.name = inputName().value;
    currentUser.second_name = inputSecondName().value;
    currentUser.lastname = inputLastname().value;

    populateUserProfile();
    personalInfoDisplay().classList.remove('d-none');
    personalInfoEdit().classList.add('d-none');
    editPersonalBtn().classList.remove('d-none');

    toast.success('Лични данни обновени успешно');
  } catch (err) {
    console.error('Error updating profile:', err);
    toast.error('Грешка при обновяване на профила');
  }
});

// ─── Addresses ───────────────────────────────────────────────

const MAX_ADDRESSES = 4;

addAddressBtn().addEventListener('click', () => {
  const currentCount = addressesList().querySelectorAll('.address-card').length;
  
  if (currentCount >= MAX_ADDRESSES) {
    toast.error(`Можете да добавите максимално ${MAX_ADDRESSES} адреси`);
    return;
  }

  addressForm().reset();
  addAddressForm().classList.remove('d-none');
  addAddressBtn().classList.add('d-none');
});

cancelAddressBtn().addEventListener('click', () => {
  addressForm().removeAttribute('data-editId');
  addressForm().removeAttribute('data-isEdit');
  const submitBtn = addressForm().querySelector('button[type="submit"]');
  submitBtn.innerHTML = '<i class="bi bi-check-lg"></i> Запази';
  
  addAddressForm().classList.add('d-none');
  addAddressBtn().classList.remove('d-none');
});

addressForm().addEventListener('submit', async (e) => {
  e.preventDefault();

  try {
    console.log('Form submitted. isEdit:', addressForm().dataset.isEdit);
    
    // Check if this is an edit or add operation
    if (addressForm().dataset.isEdit === 'true') {
      console.log('Updating address...');
      await updateAddress();
      return;
    }

    console.log('Adding new address...');
    const isDefault = addressIsDefault().checked;

    const addressData = {
      street: addressStreet().value,
      city: addressCity().value,
      postal_code: addressPostal().value,
      phone: addressPhone().value,
      email: addressEmail().value,
      extra_info: addressExtra().value || null,
      is_default: isDefault,
    };

    const { data, error } = await supabase
      .from('addresses')
      .insert({
        user_id: currentUser.user_id,
        address: addressData,
      })
      .select();

    if (error) throw error;

    addressForm().reset();
    addAddressForm().classList.add('d-none');
    addAddressBtn().classList.remove('d-none');

    await loadAddresses();
    toast.success('Адреса добавена успешно');
  } catch (err) {
    console.error('Error adding address:', err);
    toast.error('Грешка при добавяне на адреса');
  }
});

async function loadAddresses() {
  try {
    const { data, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', currentUser.user_id);

    if (error) throw error;

    const addressesListEl = addressesList();
    addressesListEl.innerHTML = '';

    if (!data || data.length === 0) {
      addressesListEl.innerHTML = '<div class="text-center text-muted py-5"><p>Нямате запазени адреси</p></div>';
      addAddressBtn().classList.remove('d-none');
      return;
    }

    data.forEach((addr) => {
      const card = createAddressCard(addr);
      addressesListEl.appendChild(card);
    });

    // Disable add button if max addresses reached
    if (data.length >= MAX_ADDRESSES) {
      addAddressBtn().classList.add('d-none');
    } else {
      addAddressBtn().classList.remove('d-none');
    }
  } catch (err) {
    console.error('Error loading addresses:', err);
    toast.error('Грешка при зареждане на адреси');
  }
}

function createAddressCard(addr) {
  const card = document.createElement('div');
  card.className = 'address-card';
  
  const address = addr.address || {};
  const street = address.street || '-';
  const city = address.city || '-';
  const postal = address.postal_code || '-';
  const phone = address.phone || '-';
  const email = address.email || '-';
  const extra = address.extra_info || '';
  const isDefault = address.is_default || false;

  card.innerHTML = `
    <div class="address-card-header">
      <h3 class="address-card-title"><i class="bi bi-geo-alt-fill"></i> ${street} ${isDefault ? '<span class="badge bg-success ms-2">Активен</span>' : ''}</h3>
      <div class="address-card-actions">
        <button class="edit-address-btn" type="button" data-id="${addr.address_id}">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="delete-address-btn" type="button" data-id="${addr.address_id}">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    </div>
    <div class="address-card-content">
      <div class="address-card-row">
        <strong>Град:</strong> <span>${city}</span>
      </div>
      <div class="address-card-row">
        <strong>Пощ. код:</strong> <span>${postal}</span>
      </div>
      <div class="address-card-row">
        <strong>Телефон:</strong> <span>${phone}</span>
      </div>
      <div class="address-card-row">
        <strong>Имейл:</strong> <span>${email}</span>
      </div>
      ${extra ? `<div class="address-card-row"><strong>Допълнителна информация:</strong> <span>${extra}</span></div>` : ''}
    </div>
  `;

  const editBtn = card.querySelector('.edit-address-btn');
  if (editBtn) {
    editBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Edit button clicked for address:', addr.address_id);
      openEditAddress(addr);
    });
  }

  const deleteBtn = card.querySelector('.delete-address-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      deleteAddress(addr.address_id, card);
    });
  }

  return card;
}

async function deleteAddress(addressId, cardElement) {
  if (!confirm('Сигурни ли сте, че искате да изтриете тази адреса?')) return;

  try {
    const { error } = await supabase
      .from('addresses')
      .delete()
      .eq('address_id', addressId);

    if (error) throw error;

    cardElement.remove();
    toast.success('Адреса изтрита успешно');
  } catch (err) {
    console.error('Error deleting address:', err);
    toast.error('Грешка при изтриване на адреса');
  }
}

async function openEditAddress(addr) {
  const address = addr.address || {};
  
  console.log('Opening edit for address:', addr);
  
  addressStreet().value = address.street || '';
  addressCity().value = address.city || '';
  addressPostal().value = address.postal_code || '';
  addressPhone().value = address.phone || '';
  addressEmail().value = address.email || '';
  addressExtra().value = address.extra_info || '';
  addressIsDefault().checked = address.is_default || false;

  addressForm().dataset.editId = addr.address_id;
  addressForm().dataset.isEdit = 'true';
  
  console.log('Form data set. editId:', addressForm().dataset.editId, 'isEdit:', addressForm().dataset.isEdit);
  
  const submitBtn = addressForm().querySelector('button[type="submit"]');
  submitBtn.innerHTML = '<i class="bi bi-pencil"></i> Обнови';
  
  addAddressForm().classList.remove('d-none');
  addAddressBtn().classList.add('d-none');
  
  // Scroll to form
  addAddressForm().scrollIntoView({ behavior: 'smooth' });
}

async function updateAddress() {
  const addressId = addressForm().dataset.editId;
  
  try {
    const addressData = {
      street: addressStreet().value,
      city: addressCity().value,
      postal_code: addressPostal().value,
      phone: addressPhone().value,
      email: addressEmail().value,
      extra_info: addressExtra().value || null,
      is_default: addressIsDefault().checked,
    };

    const { error } = await supabase
      .from('addresses')
      .update({ address: addressData })
      .eq('address_id', addressId);

    if (error) throw error;

    addressForm().removeAttribute('data-editId');
    addressForm().removeAttribute('data-isEdit');
    addressForm().reset();
    
    addAddressForm().classList.add('d-none');
    addAddressBtn().classList.remove('d-none');
    
    const submitBtn = addressForm().querySelector('button[type="submit"]');
    submitBtn.innerHTML = '<i class="bi bi-check-lg"></i> Запази';

    await loadAddresses();
    toast.success('Адреса обновена успешно');
  } catch (err) {
    console.error('Error updating address:', err);
    toast.error('Грешка при обновяване на адреса');
  }
}

// ─── Orders ──────────────────────────────────────────────────

async function loadOrders() {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', currentUser.user_id)
      .eq('order_user_delete', false)
      .order('order_date', { ascending: false });

    if (error) throw error;

    const ordersListEl = ordersList();
    ordersListEl.innerHTML = '';

    if (!data || data.length === 0) {
      ordersListEl.innerHTML = '<div class="text-center text-muted py-5"><p>Нямате поръчки</p></div>';
      return;
    }

    data.forEach((order) => {
      const card = createOrderCard(order);
      ordersListEl.appendChild(card);
    });
  } catch (err) {
    console.error('Error loading orders:', err);
    toast.error('Грешка при зареждане на поръчки');
  }
}

function createOrderCard(order) {
  const card = document.createElement('div');
  card.className = 'order-card';

  const orderDate = new Date(order.order_date).toLocaleDateString('bg-BG');
  const short = order.short_description || {};
  const status = order.order_status?.current_status || 'Обработка';
  const statusClass = getStatusClass(status);
  const total = (order.price || 0) - (order.discount || 0);

  card.innerHTML = `
    <div class="order-header">
      <div class="order-number">#${order.order_id}</div>
      <span class="order-status ${statusClass}">${status}</span>
    </div>
    <div class="order-details">
      <div class="order-detail-item">
        <span class="order-detail-label">Продукт</span>
        <span class="order-detail-value">${short.name || '-'}</span>
      </div>
      <div class="order-detail-item">
        <span class="order-detail-label">Дата</span>
        <span class="order-detail-value">${orderDate}</span>
      </div>
      <div class="order-detail-item">
        <span class="order-detail-label">Цена</span>
        <span class="order-detail-value">${total.toFixed(2)} лв.</span>
      </div>
      ${order.discount ? `<div class="order-detail-item">
        <span class="order-detail-label">Намаление</span>
        <span class="order-detail-value">${order.discount.toFixed(2)} лв.</span>
      </div>` : ''}
    </div>
  `;

  return card;
}

function getStatusClass(status) {
  if (!status) return 'pending';
  const lower = status.toLowerCase();
  if (lower.includes('завърш') || lower.includes('компл')) return 'completed';
  if (lower.includes('отказ') || lower.includes('отмен')) return 'cancelled';
  if (lower.includes('обработ') || lower.includes('процес')) return 'processing';
  return 'pending';
}

// ─── Section Navigation ──────────────────────────────────────

function setupEventListeners() {
  profileMenuItems().forEach((item) => {
    item.addEventListener('click', () => {
      const sectionId = item.dataset.section;
      switchSection(sectionId);
    });
  });

  // Phone validation - only numbers and optional + at the beginning
  addressPhone().addEventListener('input', (e) => {
    let value = e.target.value;
    
    // If the first character is not +, remove it
    if (value.charAt(0) !== '+' && value.includes('+')) {
      value = value.replace(/\+/g, '');
    }
    
    // Allow only the first + and numbers after that
    if (value.charAt(0) === '+') {
      value = '+' + value.substring(1).replace(/[^0-9]/g, '');
    } else {
      value = value.replace(/[^0-9]/g, '');
    }
    
    e.target.value = value;
  });
}

function switchSection(sectionId) {
  // Update menu items
  profileMenuItems().forEach((item) => {
    item.classList.toggle('active', item.dataset.section === sectionId);
  });

  // Update sections
  profileSections().forEach((section) => {
    const isTarget = section.id === `section-${sectionId}`;
    section.classList.toggle('d-none', !isTarget);
    section.classList.toggle('active', isTarget);
  });
}

// ─── Settings: Change Password ───────────────────────────────

changePasswordBtn().addEventListener('click', () => {
  const modal = new bootstrap.Modal(document.getElementById('changePasswordModal'));
  modal.show();
});

changePasswordForm().addEventListener('submit', async (e) => {
  e.preventDefault();

  const newPwd = newPassword().value;
  const confirm = confirmPassword().value;

  if (newPwd !== confirm) {
    toast.error('Паролите не съвпадат');
    return;
  }

  if (newPwd.length < 6) {
    toast.error('Паролата трябва да е поне 6 символа');
    return;
  }

  try {
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPwd,
    });

    if (updateError) throw updateError;

    changePasswordForm().reset();
    const modal = bootstrap.Modal.getInstance(document.getElementById('changePasswordModal'));
    modal.hide();

    toast.success('Парола сменена успешно');
  } catch (err) {
    console.error('Error changing password:', err);
    toast.error('Грешка при смяна на парола');
  }
});

// ─── Settings: Delete Account ────────────────────────────────

deleteAccountBtn().addEventListener('click', () => {
  const modal = new bootstrap.Modal(document.getElementById('deleteAccountModal'));
  modal.show();
  
  deleteConfirmText().value = '';
  confirmDeleteBtn().disabled = true;
});

deleteConfirmText().addEventListener('input', (e) => {
  confirmDeleteBtn().disabled = e.target.value !== 'ИЗТРИЙ';
});

confirmDeleteBtn().addEventListener('click', async () => {
  try {
    // Soft delete the user profile
    const { error: profileError } = await supabase
      .from('users')
      .update({ deleted_on: new Date().toISOString() })
      .eq('user_id', currentUser.user_id);

    if (profileError) throw profileError;

    // Delete auth user
    const { error: authError } = await supabase.auth.admin.deleteUser(currentAuthUser.id);
    
    // If admin delete fails (not available), just sign out
    if (authError) {
      await logoutUser();
    }

    toast.success('Акаунтът е успешно изтрит');
    setTimeout(() => {
      window.location.href = '/';
    }, 1500);
  } catch (err) {
    console.error('Error deleting account:', err);
    toast.error('Грешка при изтриване на акаунт. Пробвайте отново.');
  }
});

// ─── Settings: Logout ────────────────────────────────────────

logoutBtn().addEventListener('click', async () => {
  try {
    await logoutUser();
    toast.success('Успешно се излязохте');
    setTimeout(() => {
      window.location.href = '/';
    }, 1000);
  } catch (err) {
    console.error('Error logging out:', err);
    toast.error('Грешка при излизане');
  }
});

// ─── Initialize ──────────────────────────────────────────────

initializePage();
