// =====================================================
// Sri Thendayuthapani Temple - Admin Dashboard
// =====================================================

import { createClient } from '@supabase/supabase-js';

// =====================================================
// CONFIGURATION
// =====================================================

const SUPABASE_URL = 'https://zpqnoxllhbyggyxvvpaa.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_uXC8v4RM1HHCGEZKOnpbMg_seCrVNYo';

// Simple admin password - in production, use proper auth
const ADMIN_PASSWORD = 'temple2026';

// =====================================================
// SUPABASE CLIENT
// =====================================================

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =====================================================
// STATE
// =====================================================

const state = {
    isAuthenticated: false,
    registrations: [],
    slots: [],
    selectedDateFilter: 'all',
    regIdToDelete: null
};

// =====================================================
// DOM ELEMENTS
// =====================================================

const elements = {
    authScreen: document.getElementById('authScreen'),
    adminDashboard: document.getElementById('adminDashboard'),
    authForm: document.getElementById('authForm'),
    adminPassword: document.getElementById('adminPassword'),
    authError: document.getElementById('authError'),

    totalRegistrations: document.getElementById('totalRegistrations'),
    totalSlotsFilled: document.getElementById('totalSlotsFilled'),
    slotsRemaining: document.getElementById('slotsRemaining'),

    dateFilter: document.getElementById('dateFilter'),
    refreshBtn: document.getElementById('refreshBtn'),
    exportBtn: document.getElementById('exportBtn'),

    tableBody: document.getElementById('tableBody'),
    tableEmpty: document.getElementById('tableEmpty'),

    overviewGrid: document.getElementById('overviewGrid'),

    // Edit Modal Elements
    editModal: document.getElementById('editModal'),
    editModalClose: document.getElementById('editModalClose'),
    editForm: document.getElementById('editForm'),
    editRegId: document.getElementById('editRegId'),
    editName: document.getElementById('editName'),
    editPhone: document.getElementById('editPhone'),
    editEmail: document.getElementById('editEmail'),
    editCancelBtn: document.getElementById('editCancelBtn'),

    sendRemindersBtn: document.getElementById('sendRemindersBtn'),
    remindersStatus: document.getElementById('remindersStatus'),

    // Delete Modal
    deleteModal: document.getElementById('deleteModal'),
    deleteModalClose: document.getElementById('deleteModalClose'),
    deleteCancelBtn: document.getElementById('deleteCancelBtn'),
    deleteConfirmBtn: document.getElementById('deleteConfirmBtn')
};

// =====================================================
// UTILITIES
// =====================================================

function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const day = date.getDate();
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    return `${day} ${month}`;
}

function formatDateFull(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

function formatTime(timeStr) {
    const [hours, minutes] = timeStr.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
}

function formatDateTime(dateTimeStr) {
    const date = new Date(dateTimeStr);
    return date.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit'
    });
}

function generateFestivalDates() {
    const dates = [];
    const start = new Date('2026-01-17');
    const end = new Date('2026-01-30');
    const current = new Date(start);

    while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
    }

    return dates;
}

// =====================================================
// AUTHENTICATION
// =====================================================

function handleAuth(e) {
    e.preventDefault();

    const password = elements.adminPassword.value;

    if (password === ADMIN_PASSWORD) {
        state.isAuthenticated = true;
        sessionStorage.setItem('admin_auth', 'true');
        showDashboard();
    } else {
        elements.authError.textContent = 'Incorrect password. Please try again.';
        elements.authError.classList.add('visible');
        elements.adminPassword.classList.add('form-input--error');
    }
}

function checkExistingAuth() {
    if (sessionStorage.getItem('admin_auth') === 'true') {
        state.isAuthenticated = true;
        showDashboard();
    }
}

function showDashboard() {
    elements.authScreen.hidden = true;
    elements.adminDashboard.hidden = false;
    loadData();
}

// =====================================================
// DATA LOADING
// =====================================================

async function loadData() {
    await Promise.all([
        loadSlots(),
        loadRegistrations()
    ]);

    renderStats();
    renderDateFilter();
    renderTable();
    renderOverview();
}

async function loadSlots() {
    try {
        const { data, error } = await supabase
            .from('shift_slots')
            .select('*')
            .gte('date', '2026-01-17')
            .lte('date', '2026-01-30')
            .order('date')
            .order('shift_name');

        if (error) throw error;
        state.slots = data || [];
    } catch (error) {
        console.error('Error loading slots:', error);
    }
}

async function loadRegistrations() {
    try {
        // Use secure RPC function with password
        const { data, error } = await supabase.rpc('admin_get_registrations', {
            p_password: ADMIN_PASSWORD
        });

        if (error) throw error;

        if (data.success) {
            state.registrations = data.data || [];
        } else {
            console.error('Error fetching registrations:', data.error);
        }
    } catch (error) {
        console.error('Error loading registrations:', error);
    }
}

// =====================================================
// RENDERING
// =====================================================

function renderStats() {
    const totalRegs = state.registrations.length;
    const totalFilled = state.slots.reduce((sum, slot) => sum + slot.registered_count, 0);
    const totalCapacity = state.slots.reduce((sum, slot) => sum + slot.capacity, 0);
    const remaining = totalCapacity - totalFilled;

    elements.totalRegistrations.textContent = totalRegs;
    elements.totalSlotsFilled.textContent = totalFilled;
    elements.slotsRemaining.textContent = remaining;
}

function renderDateFilter() {
    // Only render if empty to preserve selection
    if (elements.dateFilter.options.length > 1) return;

    const dates = generateFestivalDates();

    elements.dateFilter.innerHTML = `
    <option value="all">All Dates</option>
    ${dates.map(dateStr => `
      <option value="${dateStr}">${formatDateFull(dateStr)}</option>
    `).join('')}
  `;
}

function renderTable() {
    let filteredRegistrations = state.registrations;

    // Apply date filter
    if (state.selectedDateFilter !== 'all') {
        filteredRegistrations = state.registrations.filter(reg =>
            reg.shifts?.some(s => s.date === state.selectedDateFilter)
        );
    }

    if (filteredRegistrations.length === 0) {
        elements.tableBody.innerHTML = '';
        elements.tableEmpty.hidden = false;
        return;
    }

    elements.tableEmpty.hidden = true;

    elements.tableBody.innerHTML = filteredRegistrations.map(reg => {
        let shifts = reg.shifts || [];

        // If filtering by date, valid shifts are those matching filter
        if (state.selectedDateFilter !== 'all') {
            shifts = shifts.filter(s => s.date === state.selectedDateFilter);
        }

        const shiftBadges = shifts.map(s => `
      <span class="shift-badge shift-badge--${s.shift_name.toLowerCase()}">
        ${formatDate(s.date)} ${s.shift_name}
      </span>
    `).join('');

        return `
      <tr data-id="${reg.id}">
        <td><strong>${reg.full_name}</strong></td>
        <td>${reg.phone}</td>
        <td class="cell-email">${reg.email || '-'}</td>
        <td>
          <div class="shift-badges">${shiftBadges}</div>
        </td>
        <td class="cell-actions">
           <button class="action-icon-btn edit-btn" title="Edit">
             ✏️
           </button>
           <button class="action-icon-btn delete-btn" title="Delete">
             🗑️
           </button>
        </td>
      </tr>
    `;
    }).join('');

    // Attach event listeners
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tr = e.target.closest('tr');
            openEditModal(tr.dataset.id);
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tr = e.target.closest('tr');
            openDeleteModal(tr.dataset.id);
        });
    });
}

function renderOverview() {
    const dates = generateFestivalDates();

    elements.overviewGrid.innerHTML = dates.map(dateStr => {
        const dateSlots = state.slots.filter(s => s.date === dateStr);

        const shiftsHtml = dateSlots.map(slot => {
            const remaining = slot.capacity - slot.registered_count;
            let countClass = 'available';
            if (remaining === 0) countClass = 'full';
            else if (remaining === 1) countClass = 'limited';

            // Get volunteers for this slot
            const volunteers = state.registrations.filter(reg =>
                reg.shifts?.some(s => s.slot_id === slot.id)
            ).map(reg => reg.full_name);

            return `
        <div class="overview-shift">
          <span class="overview-shift-name">${slot.shift_name} (${formatTime(slot.start_time)} - ${formatTime(slot.end_time)})</span>
          <span class="overview-shift-count overview-shift-count--${countClass}">
            ${slot.registered_count}/${slot.capacity}
          </span>
        </div>
        ${volunteers.length > 0 ? `
          <div class="overview-volunteers">
            ${volunteers.map(name => `<div class="overview-volunteer">• ${name}</div>`).join('')}
          </div>
        ` : ''}
      `;
        }).join('');

        return `
      <div class="overview-card">
        <div class="overview-date">${formatDateFull(dateStr)}</div>
        <div class="overview-shifts">${shiftsHtml}</div>
      </div>
    `;
    }).join('');
}

// =====================================================
// EDIT / DELETE ACTIONS
// =====================================================

function openEditModal(regId) {
    const reg = state.registrations.find(r => r.id === regId);
    if (!reg) return;

    elements.editRegId.value = reg.id;
    elements.editName.value = reg.full_name;
    elements.editPhone.value = reg.phone;
    elements.editEmail.value = reg.email || '';

    elements.editModal.hidden = false;
}

function closeEditModal() {
    elements.editModal.hidden = true;
    elements.editForm.reset();
}

async function handleEditSubmit(e) {
    e.preventDefault();

    const id = elements.editRegId.value;
    const fullName = elements.editName.value;
    const phone = elements.editPhone.value;
    const email = elements.editEmail.value;

    const btn = elements.editForm.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = 'Saving...';
    btn.disabled = true;

    try {
        const { data, error } = await supabase.rpc('admin_update_registration', {
            p_password: ADMIN_PASSWORD,
            p_registration_id: id,
            p_full_name: fullName,
            p_phone: phone,
            p_email: email || null
        });

        if (error) throw error;

        if (data.success) {
            closeEditModal();
            await loadData(); // Refresh data
        } else {
            alert('Error updating: ' + data.error);
        }
    } catch (error) {
        console.error('Update failed:', error);
        alert('Failed to update registration');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

function openDeleteModal(regId) {
    state.regIdToDelete = regId;
    elements.deleteModal.hidden = false;
}

function closeDeleteModal() {
    state.regIdToDelete = null;
    elements.deleteModal.hidden = true;
}

async function handleConfirmDelete() {
    if (!state.regIdToDelete) return;

    const originalText = elements.deleteConfirmBtn.textContent;
    elements.deleteConfirmBtn.textContent = 'Deleting...';
    elements.deleteConfirmBtn.disabled = true;

    try {
        const { data, error } = await supabase.rpc('admin_delete_registration', {
            p_password: ADMIN_PASSWORD,
            p_registration_id: state.regIdToDelete
        });

        if (error) throw error;

        if (data.success) {
            closeDeleteModal();
            await loadData(); // Refresh data
        } else {
            alert('Error deleting: ' + data.error);
        }
    } catch (error) {
        console.error('Delete failed:', error);
        alert('Failed to delete registration');
    } finally {
        elements.deleteConfirmBtn.textContent = originalText;
        elements.deleteConfirmBtn.disabled = false;
    }
}

// =====================================================
// CSV EXPORT
// =====================================================

function exportToCSV() {
    const rows = [
        ['Name', 'Phone', 'Email', 'Date', 'Day', 'Shift', 'Start Time', 'End Time', 'Registered At']
    ];

    state.registrations.forEach(reg => {
        const shifts = reg.shifts || [];

        shifts.forEach(slot => {
            rows.push([
                reg.full_name,
                reg.phone,
                reg.email || '',
                slot.date,
                slot.day_of_week,
                slot.shift_name,
                slot.start_time,
                slot.end_time,
                new Date(reg.created_at).toISOString()
            ]);
        });
    });

    const csvContent = rows.map(row =>
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `volunteer-registrations-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

// =====================================================
// REMINDERS
// =====================================================

async function sendReminders() {
    // Prompt for date (default: tomorrow)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const defaultDate = tomorrow.toISOString().split('T')[0];

    // For testing ease, we suggest the start of festival
    const testDate = '2026-01-17';

    const targetDate = prompt('Enter date to send reminders for (YYYY-MM-DD):', testDate);
    if (!targetDate) return;

    elements.sendRemindersBtn.disabled = true;
    elements.remindersStatus.textContent = `Sending reminders for ${targetDate}...`;
    elements.remindersStatus.classList.remove('error');

    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/send-reminders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
                password: ADMIN_PASSWORD,
                targetDate: targetDate, // Send the target date
                force: true // For testing/demo purposes, force resend even if already marked
            })
        });

        const result = await response.json();

        if (result.success) {
            elements.remindersStatus.textContent = result.message || `Reminders sent for ${targetDate}!`;
            await loadData(); // Refresh to see reminder status updates if any
        } else {
            throw new Error(result.error || 'Failed to send reminders');
        }
    } catch (error) {
        console.error('Error sending reminders:', error);
        elements.remindersStatus.textContent = `Error: ${error.message}`;
        elements.remindersStatus.classList.add('error');
    } finally {
        elements.sendRemindersBtn.disabled = false;
    }
}

// =====================================================
// EVENT HANDLERS
// =====================================================

function handleDateFilterChange(e) {
    state.selectedDateFilter = e.target.value;
    renderTable();
}

async function handleRefresh() {
    elements.refreshBtn.disabled = true;
    await loadData();
    elements.refreshBtn.disabled = false;
}

// =====================================================
// INITIALIZATION
// =====================================================

function init() {
    // Check auth
    checkExistingAuth();

    // Event listeners
    elements.authForm.addEventListener('submit', handleAuth);
    elements.dateFilter.addEventListener('change', handleDateFilterChange);
    elements.refreshBtn.addEventListener('click', handleRefresh);
    elements.exportBtn.addEventListener('click', exportToCSV);
    elements.sendRemindersBtn.addEventListener('click', sendReminders);

    // Edit Modal Listeners
    elements.editModalClose.addEventListener('click', closeEditModal);
    elements.editCancelBtn.addEventListener('click', closeEditModal);
    elements.editForm.addEventListener('submit', handleEditSubmit);

    // Close modal on outside click
    window.addEventListener('click', (e) => {
        if (e.target === elements.editModal) {
            closeEditModal();
        }
        if (e.target === elements.deleteModal) {
            closeDeleteModal();
        }
    });

    // Delete Modal Listeners
    elements.deleteModalClose.addEventListener('click', closeDeleteModal);
    elements.deleteCancelBtn.addEventListener('click', closeDeleteModal);
    elements.deleteConfirmBtn.addEventListener('click', handleConfirmDelete);
}

init();
