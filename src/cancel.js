// =====================================================
// Self-Service Cancellation Page
// =====================================================

import { createClient } from '@supabase/supabase-js';

// =====================================================
// CONFIGURATION
// =====================================================

const SUPABASE_URL = 'https://zpqnoxllhbyggyxvvpaa.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_uXC8v4RM1HHCGEZKOnpbMg_seCrVNYo';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: false
    }
});

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
    successMessage: document.getElementById('successMessage'),
    // Phone Search
    searchSection: document.getElementById('searchSection'),
    phoneSearchForm: document.getElementById('phoneSearchForm'),
    searchPhone: document.getElementById('searchPhone'),
    searchSubmitBtn: document.getElementById('searchSubmitBtn'),
    resultsSection: document.getElementById('resultsSection'),
    resultsCount: document.getElementById('resultsCount'),
    resultsList: document.getElementById('resultsList'),
    backToSearchBtn: document.getElementById('backToSearchBtn'),
    // Confirmation modal
    confirmModal: document.getElementById('confirmModal'),
    cancelCount: document.getElementById('cancelCount'),
    confirmCancelNo: document.getElementById('confirmCancelNo'),
    confirmCancelYes: document.getElementById('confirmCancelYes')
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
    elements.searchSection.hidden = true;
    elements.resultsSection.hidden = true;

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
        showSection(elements.searchSection);
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

    // Build Table HTML
    const tableHTML = `
        <div class="cancel-table-container">
            <table class="cancel-table">
                <thead>
                    <tr>
                        <th class="checkbox-col">
                            <input type="checkbox" id="selectAllIds">
                        </th>
                        <th>Date</th>
                        <th>Shift / Station</th>
                        <th>Time</th>
                        <th class="action-col">Action</th>
                    </tr>
                </thead>
                <tbody id="cancelTableBody">
                    ${slots.map(slot => {
        const isPast = !slot.can_cancel;
        return `
                        <tr class="${isPast ? 'past-row' : ''}">
                            <td class="checkbox-col">
                                <input type="checkbox" name="slot" value="${slot.slot_id}" class="slot-selection-input" ${isPast ? 'disabled' : ''}>
                            </td>
                            <td>
                                <strong>${formatDate(slot.date)}</strong>
                                ${isPast ? '<div class="past-badge">Past</div>' : ''}
                            </td>
                            <td>
                                <div>${slot.shift_name}</div>
                                <div style="font-size: 0.85em; color: var(--color-text-muted);">${slot.station || ''}</div>
                            </td>
                            <td>${formatTime(slot.start_time)} – ${formatTime(slot.end_time)}</td>
                            <td class="action-col">
                                <button type="button" class="cancel-btn-sm" 
                                    onclick="handleSingleCancel('${slot.slot_id}')" 
                                    ${isPast ? 'disabled' : ''}>
                                    Cancel
                                </button>
                            </td>
                        </tr>
                        `;
    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    elements.slotsList.innerHTML = tableHTML;
    elements.slotsList.style.display = 'block'; // Override grid style if present

    showSection(elements.registrationSection);

    // Attach Listeners
    const selectAllCheckbox = document.getElementById('selectAllIds');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('input[name="slot"]:not(:disabled)');
            checkboxes.forEach(cb => cb.checked = e.target.checked);
            updateCancelButton();
        });
    }

    // Delegation for checkboxes
    elements.slotsList.addEventListener('change', (e) => {
        if (e.target.name === 'slot') {
            updateCancelButton();
            // Update Select All state
            const all = document.querySelectorAll('input[name="slot"]:not(:disabled)');
            const checked = document.querySelectorAll('input[name="slot"]:checked');
            if (selectAllCheckbox) {
                selectAllCheckbox.checked = all.length > 0 && all.length === checked.length;
                selectAllCheckbox.indeterminate = checked.length > 0 && checked.length < all.length;
            }
        }
    });

    // Initial button state
    updateCancelButton();
}

window.handleSingleCancel = function (slotId) {
    const cb = document.querySelector(`input[name="slot"][value="${slotId}"]`);
    if (cb && !cb.disabled) {
        cb.checked = true;
        updateCancelButton(); // Ensure button text updates

        // Trigger modal directly for single item
        elements.cancelCount.textContent = "1";
        elements.confirmModal.hidden = false;
    }
};

async function handlePhoneSearch(e) {
    e.preventDefault();
    const phone = elements.searchPhone.value.trim();
    if (!phone) return;

    elements.searchSubmitBtn.disabled = true;
    elements.searchSubmitBtn.textContent = 'Searching...';

    try {
        const { data, error } = await supabase.rpc('get_registrations_by_phone', {
            p_phone: phone
        });

        if (error) throw error;

        if (!data || data.length === 0) {
            alert('No registrations found for this phone number.');
            return;
        }

        if (data.length === 1) {
            // Jump directly to management
            window.location.href = `?token=${data[0].cancel_token}`;
            return;
        }

        // Show multiple results
        renderResults(data);
    } catch (error) {
        console.error('Search failed:', error);
        alert('Search failed. Please try again.');
    } finally {
        elements.searchSubmitBtn.disabled = false;
        elements.searchSubmitBtn.textContent = 'Search Registrations';
    }
}

function renderResults(registrations) {
    elements.resultsCount.textContent = `Found ${registrations.length} Registrations`;
    elements.resultsList.innerHTML = registrations.map(reg => {
        const dateStr = new Date(reg.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        return `
            <div class="result-card" onclick="window.location.href='?token=${reg.cancel_token}'">
                <div class="result-card-header">
                    <strong>${reg.full_name}</strong>
                    <span class="result-card-date">Registered ${dateStr}</span>
                </div>
                <div class="result-card-event">${reg.event_title}</div>
                <div class="result-card-slots">
                    ${reg.slots.length} shift(s)
                </div>
                <div class="result-card-action">Manage Shifts &rarr;</div>
            </div>
        `;
    }).join('');
    showSection(elements.resultsSection);
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

// State for cancellation
let pendingCancellationIds = [];

async function handleCancel(e) {
    e.preventDefault();

    const checked = document.querySelectorAll('input[name="slot"]:checked');
    if (checked.length === 0) return;

    pendingCancellationIds = Array.from(checked).map(cb => cb.value);

    // Show confirmation modal
    elements.cancelCount.textContent = pendingCancellationIds.length;
    elements.confirmModal.hidden = false;
}

window.handleSingleCancel = function (slotId) {
    // Explicitly set pending ID for this action, ignoring checkboxes for the operation
    // (though we might want to check it visually? No, safer to just target correct ID)
    pendingCancellationIds = [slotId];

    elements.cancelCount.textContent = "1";
    elements.confirmModal.hidden = false;
};

// =====================================================
// EVENT LISTENERS
// =====================================================

elements.cancelForm.addEventListener('submit', handleCancel);

// Phone search
elements.phoneSearchForm.addEventListener('submit', handlePhoneSearch);
elements.backToSearchBtn.addEventListener('click', () => {
    showSection(elements.searchSection);
});

// Modal event handlers
elements.confirmCancelNo.addEventListener('click', () => {
    elements.confirmModal.hidden = true;
    pendingCancellationIds = []; // Clear state
});

elements.confirmCancelYes.addEventListener('click', async () => {
    elements.confirmModal.hidden = true;

    // Use the explicit list
    const slotIds = pendingCancellationIds;
    if (!slotIds || slotIds.length === 0) return;

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

        if (data.registration_deleted) {
            elements.successMessage.textContent = 'All your shifts have been cancelled.';
        } else {
            elements.successMessage.textContent = `${data.cancelled_count} shift(s) cancelled.`;
        }

        // Trigger Cancellation Email
        const cancelledSlots = registrationData.slots.filter(s => slotIds.includes(s.slot_id));
        if (registrationData.registration.email) {
            fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({
                    type: 'cancellation',
                    name: registrationData.registration.full_name,
                    email: registrationData.registration.email,
                    slots: cancelledSlots.map(s => ({
                        date: s.date,
                        shift_name: s.shift_name
                    })),
                    event_details: {
                        title: registrationData.registration.event_title,
                        organization_name: registrationData.registration.organization_name || 'Sri Thendayuthapani Temple'
                    }
                })
            }).catch(err => console.error('Cancellation email failed', err));
        }

        showSection(elements.successSection);

    } catch (error) {
        console.error('Cancellation failed:', error);
        alert('Failed to cancel: ' + error.message);
        elements.cancelBtn.disabled = false;
        updateCancelButton();
    }
});

// Initialize
init();
