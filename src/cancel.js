// =====================================================
// Self-Service Cancellation Page
// =====================================================

import { createClient } from '@supabase/supabase-js';

// =====================================================
// CONFIGURATION
// =====================================================

const SUPABASE_URL = 'https://zpqnoxllhbyggyxvvpaa.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_uXC8v4RM1HHCGEZKOnpbMg_seCrVNYo';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =====================================================
// DOM ELEMENTS
// =====================================================

const elements = {
    headerTitle: document.getElementById('headerTitle'),
    headerSubtitle: document.getElementById('headerSubtitle'),
    loadingSection: document.getElementById('loadingSection'),
    errorSection: document.getElementById('errorSection'),
    errorTitle: document.getElementById('errorTitle'),
    errorMessage: document.getElementById('errorMessage'),
    registrationSection: document.getElementById('registrationSection'),
    volunteerName: document.getElementById('volunteerName'),
    cancelForm: document.getElementById('cancelForm'),
    slotsList: document.getElementById('slotsList'),
    cancelBtn: document.getElementById('cancelBtn'),
    successSection: document.getElementById('successSection'),
    successMessage: document.getElementById('successMessage')
};

// =====================================================
// UTILITIES
// =====================================================

function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
    });
}

function formatTime(timeStr) {
    const [hours, minutes] = timeStr.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
}

function showSection(section) {
    elements.loadingSection.hidden = true;
    elements.errorSection.hidden = true;
    elements.registrationSection.hidden = true;
    elements.successSection.hidden = true;

    section.hidden = false;
}

// =====================================================
// MAIN LOGIC
// =====================================================

let registrationData = null;

async function init() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
        showError('Missing Token', 'No cancellation token provided in the URL.');
        return;
    }

    try {
        const { data, error } = await supabase.rpc('get_registration_by_token', {
            p_token: token
        });

        if (error) throw error;

        if (!data.success) {
            showError('Invalid Link', data.error || 'This link is no longer valid.');
            return;
        }

        registrationData = { ...data, token };
        renderRegistration(data);

    } catch (error) {
        console.error('Error loading registration:', error);
        showError('Error', 'Failed to load registration details.');
    }
}

function showError(title, message) {
    elements.errorTitle.textContent = title;
    elements.errorMessage.textContent = message;
    showSection(elements.errorSection);
}

function renderRegistration(data) {
    elements.headerSubtitle.textContent = data.registration.event_title || 'Volunteer Registration';
    elements.volunteerName.textContent = data.registration.full_name;

    const slots = data.slots || [];

    if (slots.length === 0) {
        showError('No Active Slots', 'You have no active registrations to manage.');
        return;
    }

    elements.slotsList.innerHTML = slots.map(slot => {
        const isPast = !slot.can_cancel;

        return `
      <label class="slot-checkbox ${isPast ? 'slot-checkbox--disabled' : ''}" data-slot-id="${slot.slot_id}">
        <input type="checkbox" name="slot" value="${slot.slot_id}" ${isPast ? 'disabled' : ''}>
        <div class="slot-checkbox-content">
          <div class="slot-checkbox-info">
            <span class="slot-checkbox-date">${formatDate(slot.date)}</span>
            <span class="slot-checkbox-time">${formatTime(slot.start_time)} - ${formatTime(slot.end_time)}</span>
            ${slot.station ? `<span class="slot-checkbox-station">${slot.station}</span>` : ''}
          </div>
          ${isPast ? '<span class="slot-checkbox-badge">Past</span>' : ''}
        </div>
      </label>
    `;
    }).join('');

    showSection(elements.registrationSection);

    // Enable/disable cancel button based on selection
    elements.slotsList.addEventListener('change', updateCancelButton);
}

function updateCancelButton() {
    const checked = document.querySelectorAll('input[name="slot"]:checked');
    elements.cancelBtn.disabled = checked.length === 0;

    if (checked.length === 0) {
        elements.cancelBtn.textContent = 'Cancel Selected Shifts';
    } else if (checked.length === 1) {
        elements.cancelBtn.textContent = 'Cancel 1 Shift';
    } else {
        elements.cancelBtn.textContent = `Cancel ${checked.length} Shifts`;
    }
}

async function handleCancel(e) {
    e.preventDefault();

    const checked = document.querySelectorAll('input[name="slot"]:checked');
    if (checked.length === 0) return;

    const slotIds = Array.from(checked).map(cb => cb.value);

    const confirmMsg = slotIds.length === 1
        ? 'Are you sure you want to cancel this shift?'
        : `Are you sure you want to cancel ${slotIds.length} shifts?`;

    if (!confirm(confirmMsg)) return;

    elements.cancelBtn.disabled = true;
    elements.cancelBtn.textContent = 'Cancelling...';

    try {
        const { data, error } = await supabase.rpc('cancel_slots', {
            p_token: registrationData.token,
            p_slot_ids: slotIds
        });

        if (error) throw error;

        if (!data.success) {
            throw new Error(data.error || 'Cancellation failed');
        }

        // Show success
        if (data.registration_deleted) {
            elements.successMessage.textContent = 'All your shifts have been cancelled and your registration has been removed.';
        } else {
            elements.successMessage.textContent = `${data.cancelled_count} shift(s) have been cancelled.`;
        }

        showSection(elements.successSection);

    } catch (error) {
        console.error('Cancellation failed:', error);
        alert('Failed to cancel: ' + error.message);
        elements.cancelBtn.disabled = false;
        updateCancelButton();
    }
}

// =====================================================
// EVENT LISTENERS
// =====================================================

elements.cancelForm.addEventListener('submit', handleCancel);

// Initialize
init();
