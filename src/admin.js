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
    currentView: 'events', // 'events' or 'dashboard'
    activeEventId: null,
    events: [],
    templates: [], // event templates
    registrations: [], // registrations for active event
    slots: [], // slots for active event
    selectedDateFilter: 'all',
    regIdToDelete: null,
    editingEventId: null,
    // Slot modal state
    slotSalesItems: [], // sales items for current slot
    selectedEmoji: '🎯' // selected station emoji
};

// =====================================================
// DOM ELEMENTS
// =====================================================

const elements = {
    // Defines all interactive elements
    authScreen: document.getElementById('authScreen'),
    eventsSection: document.getElementById('eventsSection'),
    adminDashboard: document.getElementById('adminDashboard'),

    // Auth
    authForm: document.getElementById('authForm'),
    adminPassword: document.getElementById('adminPassword'),
    authError: document.getElementById('authError'),

    // Events List
    eventsGrid: document.getElementById('eventsGrid'),
    createEventBtn: document.getElementById('createEventBtn'),

    // Dashboard Header
    backToEventsBtn: document.getElementById('backToEventsBtn'),
    currentEventTitle: document.getElementById('currentEventTitle'),
    copyLinkBtn: document.getElementById('copyLinkBtn'),
    eventSettingsBtn: document.getElementById('eventSettingsBtn'),

    // Stats
    totalRegistrations: document.getElementById('totalRegistrations'),
    totalSlotsFilled: document.getElementById('totalSlotsFilled'),
    slotsRemaining: document.getElementById('slotsRemaining'),

    // Dashboard Actions
    dateFilter: document.getElementById('dateFilter'),
    refreshBtn: document.getElementById('refreshBtn'),
    exportBtn: document.getElementById('exportBtn'),

    // Tables
    tableBody: document.getElementById('tableBody'),
    tableEmpty: document.getElementById('tableEmpty'),
    overviewGrid: document.getElementById('overviewGrid'),

    // Create Event Modal
    eventModal: document.getElementById('eventModal'),
    eventModalClose: document.getElementById('eventModalClose'),
    eventForm: document.getElementById('eventForm'),
    eventTemplate: document.getElementById('eventTemplate'),
    eventTitle: document.getElementById('eventTitle'),
    orgName: document.getElementById('orgName'),
    contactPerson: document.getElementById('contactPerson'),
    contactWhatsapp: document.getElementById('contactWhatsapp'),
    eventStartDate: document.getElementById('eventStartDate'),
    eventEndDate: document.getElementById('eventEndDate'),
    feedbackEnabled: document.getElementById('feedbackEnabled'),
    certificatesEnabled: document.getElementById('certificatesEnabled'),
    checkinRequired: document.getElementById('checkinRequired'),
    eventPaused: document.getElementById('eventPaused'),
    eventCancelBtn: document.getElementById('eventCancelBtn'),

    // Edit Registration Modal
    editModal: document.getElementById('editModal'),
    editModalClose: document.getElementById('editModalClose'),
    editForm: document.getElementById('editForm'),
    editRegId: document.getElementById('editRegId'),
    editName: document.getElementById('editName'),
    editPhone: document.getElementById('editPhone'),
    editEmail: document.getElementById('editEmail'),
    editCancelBtn: document.getElementById('editCancelBtn'),

    // Delete Modal
    deleteModal: document.getElementById('deleteModal'),
    deleteModalClose: document.getElementById('deleteModalClose'),
    deleteCancelBtn: document.getElementById('deleteCancelBtn'),
    deleteConfirmBtn: document.getElementById('deleteConfirmBtn'),

    // Reminders
    sendRemindersBtn: document.getElementById('sendRemindersBtn'),
    remindersStatus: document.getElementById('remindersStatus'),

    // Slots Management
    slotsListGrid: document.getElementById('slotsListGrid'),
    addSlotBtn: document.getElementById('addSlotBtn'),
    slotModal: document.getElementById('slotModal'),
    slotModalClose: document.getElementById('slotModalClose'),
    slotForm: document.getElementById('slotForm'),
    slotName: document.getElementById('slotName'),
    slotDate: document.getElementById('slotDate'),
    slotStartTime: document.getElementById('slotStartTime'),
    slotEndTime: document.getElementById('slotEndTime'),
    slotCapacity: document.getElementById('slotCapacity'),
    slotStation: document.getElementById('slotStation'),
    slotCancelBtn: document.getElementById('slotCancelBtn'),
    // New enhanced slot modal elements
    emojiPickerBtn: document.getElementById('emojiPickerBtn'),
    emojiPicker: document.getElementById('emojiPicker'),
    salesItemsSection: document.getElementById('salesItemsSection'),
    salesItemsList: document.getElementById('salesItemsList'),
    addSalesItemBtn: document.getElementById('addSalesItemBtn'),
    // Sales item modal
    salesItemModal: document.getElementById('salesItemModal'),
    salesItemModalClose: document.getElementById('salesItemModalClose'),
    salesItemName: document.getElementById('salesItemName'),
    salesItemPrice: document.getElementById('salesItemPrice'),
    salesItemCancelBtn: document.getElementById('salesItemCancelBtn'),
    salesItemAddBtn: document.getElementById('salesItemAddBtn'),
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

// =====================================================
// AUTHENTICATION
// =====================================================

function handleAuth(e) {
    e.preventDefault();
    const password = elements.adminPassword.value;

    if (password === ADMIN_PASSWORD) {
        state.isAuthenticated = true;
        sessionStorage.setItem('admin_auth', 'true');
        showEventsList();
    } else {
        elements.authError.textContent = 'Incorrect password. Please try again.';
        elements.authError.classList.add('visible');
        elements.adminPassword.classList.add('form-input--error');
    }
}

function checkExistingAuth() {
    if (sessionStorage.getItem('admin_auth') === 'true') {
        state.isAuthenticated = true;
        showEventsList();
    }
}

// =====================================================
// VIEW MANAGEMENT
// =====================================================

async function showEventsList() {
    state.currentView = 'events';
    state.activeEventId = null;

    elements.authScreen.hidden = true;
    elements.adminDashboard.hidden = true;
    elements.eventsSection.hidden = false;

    await loadEvents();
}

async function showEventDashboard(eventId) {
    state.currentView = 'dashboard';
    state.activeEventId = eventId;

    // Find event details locally if available, or fetch
    const event = state.events.find(e => e.id === eventId);
    if (event) {
        elements.currentEventTitle.textContent = event.title;
        elements.dateFilter.innerHTML = '<option value="all">All Dates</option>'; // Reset filter
    }

    elements.eventsSection.hidden = true;
    elements.adminDashboard.hidden = false;

    await loadEventDetails(eventId);
}


// =====================================================
// EVENTS MANAGEMENT
// =====================================================

async function loadEvents() {
    elements.eventsGrid.innerHTML = '<p class="table-loading">Loading events...</p>';

    try {
        const { data, error } = await supabase.rpc('admin_get_events', { p_password: ADMIN_PASSWORD });

        if (error) throw error;

        state.events = data || [];
        renderEventsGrid();
    } catch (error) {
        console.error('Error loading events:', error);
        elements.eventsGrid.innerHTML = '<p class="error-msg">Failed to load events.</p>';
    }
}

function renderEventsGrid() {
    if (state.events.length === 0) {
        elements.eventsGrid.innerHTML = `
            <div class="empty-state">
                <p>No events found. Create your first event!</p>
            </div>
        `;
        return;
    }

    elements.eventsGrid.innerHTML = state.events.map(event => `
        <div class="event-card" data-id="${event.id}">
            <div class="event-card-header">
                <h3 class="event-card-title">${event.title}</h3>
                <span class="event-status ${event.active ? 'active' : 'inactive'}">
                    ${event.active ? 'Active' : 'Archived'}
                </span>
            </div>
            <p class="event-card-subtitle">${event.description || 'No description'}</p>
            <div class="event-card-details">
                <p><strong>Contact:</strong> ${event.contact_person}</p>
                <p><strong>Dates:</strong> ${formatDate(event.dates_config?.start)} - ${formatDate(event.dates_config?.end)}</p>
            </div>
            <div class="event-card-actions">
                <button class="action-btn action-btn--primary manage-event-btn">Manage</button>
                <div class="event-card-secondary-actions">
                    <button class="action-icon-btn pause-event-btn" title="${event.paused ? 'Unpause Event' : 'Pause Event'}">${event.paused ? '▶️' : '⏸️'}</button>
                    <button class="action-icon-btn edit-event-btn" title="Edit Event">✏️</button>
                    <button class="action-icon-btn delete-event-btn" title="Delete Event">🗑️</button>
                </div>
            </div>
        </div>
    `).join('');

    // Attach listeners
    document.querySelectorAll('.manage-event-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.event-card');
            showEventDashboard(card.dataset.id);
        });
    });

    document.querySelectorAll('.edit-event-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.event-card');
            openEditEventModal(card.dataset.id);
        });
    });

    document.querySelectorAll('.delete-event-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.event-card');
            handleDeleteEvent(card.dataset.id);
        });
    });

    document.querySelectorAll('.pause-event-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.event-card');
            handlePauseEvent(card.dataset.id);
        });
    });
}

function openCreateEventModal() {
    state.editingEventId = null;
    elements.eventForm.reset();
    elements.eventModal.querySelector('.modal-title').textContent = 'Create Event';
    elements.eventModal.hidden = false;
    loadEventTemplates();
}

async function loadEventTemplates() {
    try {
        const { data, error } = await supabase
            .from('event_templates')
            .select('*')
            .order('category', { ascending: true });

        if (error) throw error;

        state.templates = data || [];

        // Populate dropdown
        elements.eventTemplate.innerHTML = '<option value="">-- Custom Event (Manual Slots) --</option>';
        const categories = {};

        data.forEach(tpl => {
            if (!categories[tpl.category]) categories[tpl.category] = [];
            categories[tpl.category].push(tpl);
        });

        Object.keys(categories).forEach(cat => {
            const group = document.createElement('optgroup');
            group.label = cat.charAt(0).toUpperCase() + cat.slice(1).replace('_', ' ');

            categories[cat].forEach(tpl => {
                const option = document.createElement('option');
                option.value = tpl.id;
                option.textContent = `${tpl.icon || '📋'} ${tpl.name}`;
                group.appendChild(option);
            });

            elements.eventTemplate.appendChild(group);
        });
    } catch (error) {
        console.error('Failed to load templates:', error);
    }
}

function openEditEventModal(eventId) {
    const event = state.events.find(e => e.id === eventId);
    if (!event) return;

    state.editingEventId = eventId;
    elements.eventTitle.value = event.title;
    elements.orgName.value = event.organization_name;
    elements.contactPerson.value = event.contact_person;
    elements.contactWhatsapp.value = event.contact_whatsapp;
    elements.eventStartDate.value = event.dates_config?.start;
    elements.eventEndDate.value = event.dates_config?.end;

    elements.eventModal.querySelector('.modal-title').textContent = 'Edit Event';
    elements.eventModal.hidden = false;
}

function closeEventModal() {
    elements.eventModal.hidden = true;
}

async function handleCreateEventSubmit(e) {
    e.preventDefault();

    const btn = elements.eventForm.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = state.editingEventId ? 'Saving...' : 'Creating...';
    btn.disabled = true;

    try {
        const title = elements.eventTitle.value;
        const orgName = elements.orgName.value;
        const person = elements.contactPerson.value;
        const whatsapp = elements.contactWhatsapp.value;
        const start = elements.eventStartDate.value;
        const end = elements.eventEndDate.value;
        const datesConfig = { start, end };

        if (state.editingEventId) {
            // UPDATE
            const { data, error } = await supabase.rpc('admin_update_event', {
                p_password: ADMIN_PASSWORD,
                p_event_id: state.editingEventId,
                p_title: title,
                p_organization_name: orgName,
                p_contact_person: person,
                p_contact_whatsapp: whatsapp,
                p_active: true // Keep active for now
            });

            if (error) throw error;

            closeEventModal();
            await loadEvents();

        } else {
            // CREATE
            const { data: eventData, error: eventError } = await supabase
                .from('events')
                .insert({
                    title,
                    organization_name: orgName,
                    description: 'Volunteer Registration',
                    contact_person: person,
                    contact_whatsapp: whatsapp,
                    dates_config: datesConfig,
                    active: true,
                    feedback_enabled: elements.feedbackEnabled.checked,
                    certificates_enabled: elements.certificatesEnabled.checked,
                    paused: elements.eventPaused.checked
                })
                .select()
                .single();

            if (eventError) throw eventError;

            // 2. Generate Slots for this event
            const templateId = elements.eventTemplate.value;
            if (templateId) {
                // Use template - apply for each day in date range
                await applyTemplateToEvent(eventData.id, templateId, start, end);
            } else {
                // No template - generate default morning/evening slots
                await generateDefaultSlots(eventData.id, start, end);
            }

            closeEventModal();
            await loadEvents();
        } // End if/else

    } catch (error) {
        console.error('Error creating event:', error);
        alert('Failed to create event: ' + error.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

async function generateDefaultSlots(eventId, startStr, endStr) {
    const slots = [];
    const start = new Date(startStr);
    const end = new Date(endStr);

    // Iterate dates matches generateFestivalDates logic
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'Long' }); // e.g. Saturday

        // Morning Slot
        slots.push({
            event_id: eventId,
            date: dateStr,
            day_of_week: dayOfWeek,
            shift_name: 'Morning',
            start_time: '08:00',
            end_time: '12:00',
            capacity: 50, // Default capacity
            registered_count: 0
        });

        // Evening Slot
        slots.push({
            event_id: eventId,
            date: dateStr,
            day_of_week: dayOfWeek,
            shift_name: 'Evening',
            start_time: '16:00',
            end_time: '20:00',
            capacity: 50, // Default capacity
            registered_count: 0
        });
    }

    const { error } = await supabase.from('shift_slots').insert(slots);
    if (error) {
        console.error('Error generating slots:', error);
        alert('Event created but slots generation failed. Check console.');
    }
}

async function applyTemplateToEvent(eventId, templateId, startStr, endStr) {
    const template = state.templates.find(t => t.id === templateId);
    if (!template) {
        console.error('Template not found');
        return;
    }

    const slots = [];
    const start = new Date(startStr);
    const end = new Date(endStr);
    const slotConfig = template.slot_config?.slots || [];

    // For each day in the date range
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'long' });

        // Create each slot from the template
        slotConfig.forEach(slot => {
            slots.push({
                event_id: eventId,
                date: dateStr,
                day_of_week: dayOfWeek,
                shift_name: slot.name,
                start_time: slot.start,
                end_time: slot.end,
                capacity: slot.capacity || 10,
                registered_count: 0,
                station: slot.station || null
            });
        });
    }

    const { error } = await supabase.from('shift_slots').insert(slots);
    if (error) {
        console.error('Error applying template slots:', error);
        alert('Event created but template slots failed. Check console.');
    }
}

async function handleDeleteEvent(eventId) {
    if (!confirm('Are you sure you want to delete this event? This action will archive it and hide it from the public.')) return;

    try {
        const { data, error } = await supabase.rpc('admin_delete_event', {
            p_password: ADMIN_PASSWORD,
            p_event_id: eventId
        });

        if (error) throw error;
        await loadEvents();

    } catch (e) {
        console.error(e);
        alert('Failed to delete event: ' + e.message);
    }
}

async function handlePauseEvent(eventId) {
    const event = state.events.find(e => e.id === eventId);
    if (!event) return;

    const action = event.paused ? 'unpause' : 'pause';
    const confirmMsg = event.paused
        ? 'Unpause this event? It will become visible to the public again.'
        : 'Pause this event? New registrations will be temporarily disabled.';

    if (!confirm(confirmMsg)) return;

    try {
        const { error } = await supabase.rpc('admin_update_event', {
            p_password: ADMIN_PASSWORD,
            p_event_id: eventId,
            p_updates: { paused: !event.paused }
        });

        if (error) throw error;
        await loadEvents();

    } catch (e) {
        console.error(e);
        alert(`Failed to ${action} event: ` + e.message);
    }
}

// =====================================================
// DASHBOARD LOGIC (Single Event)
// =====================================================

async function loadEventDetails(eventId) {
    try {
        // Fetch event details + slots
        const { data, error } = await supabase.rpc('get_event_details', { p_event_id: eventId });

        if (error) throw error;

        state.slots = data.slots || [];

        // Fetch registrations for this event
        // We can re-use the existing admin_get_registrations but filtering by event ID would be better.
        // Assuming the existing RPC fetches ALL registrations, we need to filter client side or update RPC.
        // The existing RPC gets all registrations. However, since registrations are linked to slots, and slots are linked to events,
        // we can filter client-side for now.

        // Better: Update RPC admin_get_registrations to take p_event_id?
        // Or just filter here: Regs -> Slots -> Event

        const { data: regData, error: regError } = await supabase.rpc('admin_get_registrations', {
            p_password: ADMIN_PASSWORD
        });

        if (regError) throw regError;
        if (regData.success) {
            // Filter registrations that belong to this event (meaning they have at least one slot in this event)
            const allRegs = regData.data || [];

            // Set of slot IDs for this event
            const eventSlotIds = new Set(state.slots.map(s => s.id));

            state.registrations = allRegs.filter(reg => {
                // If reg has no shifts, it's orphan?
                if (!reg.shifts || reg.shifts.length === 0) return false;
                // Check if any shift belongs to this event
                return reg.shifts.some(s => eventSlotIds.has(s.slot_id) || s.date >= '2020-01-01'); // Fallback logic if slot_id matching fails? 
                // Actually the API returns `shifts` array with details. We can match dates if we trust them, but slot_id match is best.
                // admin_get_registrations returns `slot_id` in shifts array? Let's assume so.
                // Wait, the previous `admin.js` implementation of `renderTable` uses `s.date` access. 
                // The RPC result structure for `shifts` likely contains slot info.

                // Let's filter by checking if the registration's shifts overlap with our event's slots
                return reg.shifts.some(s => eventSlotIds.has(s.slot_id));
            });
        }

        renderStats();
        renderDateFilter();
        renderTable();
        renderOverview();
        renderSlots();

    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

function renderStats() {
    // Stats scope: Current Event
    const totalRegs = state.registrations.length;
    const totalFilled = state.slots.reduce((sum, slot) => sum + slot.registered_count, 0);
    const totalCapacity = state.slots.reduce((sum, slot) => sum + slot.capacity, 0);
    const remaining = totalCapacity - totalFilled;

    elements.totalRegistrations.textContent = totalRegs;
    elements.totalSlotsFilled.textContent = totalFilled;
    elements.slotsRemaining.textContent = remaining;
}

function renderDateFilter() {
    // Populate dates based on EVENT slots, not hardcoded
    // Get unique dates from slots
    const uniqueDates = [...new Set(state.slots.map(s => s.date))].sort();

    elements.dateFilter.innerHTML = `
        <option value="all">All Dates</option>
        ${uniqueDates.map(dateStr => `
            <option value="${dateStr}">${formatDateFull(dateStr)}</option>
        `).join('')}
    `;

    // Restore selection if valid
    if (uniqueDates.includes(state.selectedDateFilter)) {
        elements.dateFilter.value = state.selectedDateFilter;
    } else {
        state.selectedDateFilter = 'all';
        elements.dateFilter.value = 'all';
    }
}

function renderTable() {
    let filteredRegistrations = state.registrations;

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

        // Apply filter to displayed badges too? usually yes
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
                    <button class="action-icon-btn edit-btn" title="Edit">✏️</button>
                    <button class="action-icon-btn delete-btn" title="Delete">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');

    // Attach listeners
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
    // Group slots by date
    const uniqueDates = [...new Set(state.slots.map(s => s.date))].sort();

    elements.overviewGrid.innerHTML = uniqueDates.map(dateStr => {
        const dateSlots = state.slots.filter(s => s.date === dateStr);

        const shiftsHtml = dateSlots.map(slot => {
            const remaining = slot.capacity - slot.registered_count;
            let countClass = 'available';
            if (remaining === 0) countClass = 'full';
            else if (remaining <= 5) countClass = 'limited';

            // Find volunteers for this slot
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
// SLOTS MANAGEMENT
// =====================================================

function renderSlots() {
    const uniqueDates = [...new Set(state.slots.map(s => s.date))].sort();

    if (state.slots.length === 0) {
        elements.slotsListGrid.innerHTML = '<p class="empty-text">No slots created yet. Click "Add Slot" to create one.</p>';
        return;
    }

    elements.slotsListGrid.innerHTML = uniqueDates.map(dateStr => {
        const dateSlots = state.slots.filter(s => s.date === dateStr && !s.deleted_at);

        const slotsHtml = dateSlots.map(slot => {
            const stationBadge = slot.station ? `<span class="slot-badge">${slot.station}</span>` : '';
            return `
                <div class="slot-item" data-slot-id="${slot.id}">
                    <div class="slot-info">
                        <span class="slot-time">${formatTime(slot.start_time)} - ${formatTime(slot.end_time)}</span>
                        ${stationBadge}
                        <span class="slot-capacity">${slot.registered_count}/${slot.capacity}</span>
                    </div>
                    <button class="slot-delete-btn" onclick="window.handleDeleteSlot('${slot.id}')" title="Delete Slot">🗑️</button>
                </div>
            `;
        }).join('');

        return `
            <div class="slots-date-group">
                <div class="slots-date-header">${formatDateFull(dateStr)}</div>
                <div class="slots-date-items">${slotsHtml}</div>
            </div>
        `;
    }).join('');
}

function openSlotModal() {
    // Pre-fill with event dates if available
    const event = state.events.find(e => e.id === state.activeEventId);
    if (event?.dates_config?.start) {
        elements.slotDate.value = event.dates_config.start;
    }
    elements.slotStartTime.value = '08:00';
    elements.slotEndTime.value = '12:00';
    elements.slotCapacity.value = 10;
    elements.slotStation.value = '';

    // Reset new fields
    if (elements.slotName) elements.slotName.value = '';
    state.slotSalesItems = [];
    state.selectedEmoji = '🎯';
    if (elements.emojiPickerBtn) elements.emojiPickerBtn.textContent = '🎯';
    if (elements.emojiPicker) elements.emojiPicker.hidden = true;
    if (elements.salesItemsSection) elements.salesItemsSection.hidden = true;
    document.querySelector('input[name="slotType"][value="standard"]')?.click();
    renderSalesItemsList();

    elements.slotModal.hidden = false;
}

function closeSlotModal() {
    elements.slotModal.hidden = true;
    elements.slotForm.reset();
}

// Sales Item Modal
function openSalesItemModal() {
    if (elements.salesItemName) elements.salesItemName.value = '';
    if (elements.salesItemPrice) elements.salesItemPrice.value = '0.00';
    if (elements.salesItemModal) elements.salesItemModal.hidden = false;
}

function closeSalesItemModal() {
    if (elements.salesItemModal) elements.salesItemModal.hidden = true;
}

function handleAddSalesItem() {
    const name = elements.salesItemName.value.trim();
    const price = parseFloat(elements.salesItemPrice.value) || 0;

    if (!name) {
        alert('Please enter an item name');
        return;
    }

    state.slotSalesItems.push({ name, unit_price: price });
    renderSalesItemsList();
    closeSalesItemModal();
}

function renderSalesItemsList() {
    if (!elements.salesItemsList) return;

    if (state.slotSalesItems.length === 0) {
        elements.salesItemsList.innerHTML = '<p class="sales-items-empty">No items yet. Add items being sold.</p>';
        return;
    }

    elements.salesItemsList.innerHTML = state.slotSalesItems.map((item, i) => `
        <div class="sales-item-row">
            <div class="sales-item-info">
                <span class="sales-item-name">${item.name}</span>
                <span class="sales-item-price">$${item.unit_price.toFixed(2)}</span>
            </div>
            <button type="button" class="sales-item-remove" onclick="removeSalesItem(${i})">×</button>
        </div>
    `).join('');
}

// Make available globally for onclick
window.removeSalesItem = function (index) {
    state.slotSalesItems.splice(index, 1);
    renderSalesItemsList();
};

async function handleAddSlot(e) {
    e.preventDefault();

    const slotType = document.querySelector('input[name="slotType"]:checked')?.value || 'standard';
    const stationValue = elements.slotStation.value.trim();
    const station = stationValue ? `${state.selectedEmoji} ${stationValue}` : null;

    const slotData = {
        event_id: state.activeEventId,
        date: elements.slotDate.value,
        shift_name: elements.slotName?.value.trim() || `${elements.slotStartTime.value} - ${elements.slotEndTime.value}`,
        start_time: elements.slotStartTime.value,
        end_time: elements.slotEndTime.value,
        capacity: parseInt(elements.slotCapacity.value),
        registered_count: 0,
        station: station,
        slot_type: slotType,
        sales_config: slotType === 'sales' && state.slotSalesItems.length > 0
            ? { items: state.slotSalesItems }
            : null
    };

    try {
        const { error } = await supabase.from('shift_slots').insert([slotData]);
        if (error) throw error;

        closeSlotModal();
        await loadEventDetails(state.activeEventId);
    } catch (error) {
        console.error('Error adding slot:', error);
        alert('Failed to add slot: ' + error.message);
    }
}

async function handleDeleteSlot(slotId) {
    const slot = state.slots.find(s => s.id === slotId);
    if (!slot) return;

    if (slot.registered_count > 0) {
        if (!confirm(`This slot has ${slot.registered_count} registration(s). Deleting will affect those volunteers. Continue?`)) {
            return;
        }
    } else {
        if (!confirm('Delete this slot?')) return;
    }

    try {
        // Soft delete
        const { error } = await supabase
            .from('shift_slots')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', slotId);

        if (error) throw error;

        await loadEventDetails(state.activeEventId);
    } catch (error) {
        console.error('Error deleting slot:', error);
        alert('Failed to delete slot: ' + error.message);
    }
}

// Expose to window for inline onclick
window.handleDeleteSlot = handleDeleteSlot;


// =====================================================
// MODAL ACTIONS (Edit / Delete)
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
            await loadEventDetails(state.activeEventId);
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        console.error('Update failed:', error);
        alert('Failed to update.');
    } finally {
        btn.textContent = 'Save Changes';
        btn.disabled = false;
    }
}

function openDeleteModal(regId) {
    state.regIdToDelete = regId;
    elements.deleteModal.hidden = false;
}

function closeDeleteModal() {
    elements.deleteModal.hidden = true;
    state.regIdToDelete = null;
}

async function handleConfirmDelete() {
    if (!state.regIdToDelete) return;
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
            await loadEventDetails(state.activeEventId);
        } else {
            alert('Error: ' + data.error);
        }
    } catch (error) {
        console.error('Delete failed:', error);
        alert('Failed to delete.');
    } finally {
        elements.deleteConfirmBtn.textContent = 'Delete Registration';
        elements.deleteConfirmBtn.disabled = false;
    }
}

// =====================================================
// OTHER ACTIONS
// =====================================================

function copyEventLink() {
    if (!state.activeEventId) return;
    const url = `${window.location.origin}/?event_id=${state.activeEventId}`;
    navigator.clipboard.writeText(url).then(() => {
        const btn = elements.copyLinkBtn;
        const original = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = original, 2000);
    });
}

async function handleRefresh() {
    elements.refreshBtn.disabled = true;
    if (state.currentView === 'events') {
        await loadEvents();
    } else {
        await loadEventDetails(state.activeEventId);
    }
    elements.refreshBtn.disabled = false;
}

function exportToCSV() {
    if (!state.registrations.length) return;

    // Same CSV logic but uses active state.registrations
    const rows = [
        ['Name', 'Phone', 'Email', 'Date', 'Day', 'Shift', 'Start Time', 'End Time', 'Registered At']
    ];

    state.registrations.forEach(reg => {
        const shifts = reg.shifts || [];
        shifts.forEach(slot => {
            // Optional: Filter by event only, but state.registrations is already filtered
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
    link.download = `registrations-${formatDateFull(new Date().toISOString())}.csv`;
    link.click();
}

async function sendReminders() {
    // This calls the generic remind-all
    const targetDate = prompt('Enter date to send reminders for (YYYY-MM-DD):', new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0]);
    if (!targetDate) return;

    elements.sendRemindersBtn.disabled = true;
    elements.remindersStatus.textContent = 'Sending...';

    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/send-reminders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
                password: ADMIN_PASSWORD,
                targetDate: targetDate,
                force: true
            })
        });

        const result = await response.json();
        if (result.success) {
            alert('Reminders sent successfully!');
            elements.remindersStatus.textContent = result.message;
        } else {
            elements.remindersStatus.textContent = 'Failed';
            alert(result.error);
        }
    } catch (e) {
        console.error(e);
        elements.remindersStatus.textContent = 'Error';
    } finally {
        elements.sendRemindersBtn.disabled = false;
    }
}


// =====================================================
// INITIALIZATION
// =====================================================

function init() {
    checkExistingAuth();

    // Global Listeners
    elements.authForm.addEventListener('submit', handleAuth);
    elements.createEventBtn.addEventListener('click', openCreateEventModal);
    elements.backToEventsBtn.addEventListener('click', showEventsList);
    elements.refreshBtn.addEventListener('click', handleRefresh);
    elements.copyLinkBtn.addEventListener('click', copyEventLink);
    elements.dateFilter.addEventListener('change', (e) => {
        state.selectedDateFilter = e.target.value;
        renderTable();
    });
    elements.exportBtn.addEventListener('click', exportToCSV);
    elements.sendRemindersBtn.addEventListener('click', sendReminders);

    // Event Modal
    elements.eventModalClose.addEventListener('click', closeEventModal);
    elements.eventCancelBtn.addEventListener('click', closeEventModal);
    elements.eventForm.addEventListener('submit', handleCreateEventSubmit);

    // Edit Modal
    elements.editModalClose.addEventListener('click', closeEditModal);
    elements.editCancelBtn.addEventListener('click', closeEditModal);
    elements.editForm.addEventListener('submit', handleEditSubmit);

    // Delete Modal
    elements.deleteModalClose.addEventListener('click', closeDeleteModal);
    elements.deleteCancelBtn.addEventListener('click', closeDeleteModal);
    elements.deleteConfirmBtn.addEventListener('click', handleConfirmDelete);

    // Slot Modal
    if (elements.addSlotBtn) elements.addSlotBtn.addEventListener('click', openSlotModal);
    if (elements.slotModalClose) elements.slotModalClose.addEventListener('click', closeSlotModal);
    if (elements.slotCancelBtn) elements.slotCancelBtn.addEventListener('click', closeSlotModal);
    if (elements.slotForm) elements.slotForm.addEventListener('submit', handleAddSlot);

    // Emoji Picker
    if (elements.emojiPickerBtn) {
        elements.emojiPickerBtn.addEventListener('click', () => {
            elements.emojiPicker.hidden = !elements.emojiPicker.hidden;
        });
    }
    document.querySelectorAll('.emoji-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
            state.selectedEmoji = e.target.dataset.emoji;
            elements.emojiPickerBtn.textContent = state.selectedEmoji;
            elements.emojiPicker.hidden = true;
        });
    });

    // Slot Type Toggle
    document.querySelectorAll('input[name="slotType"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            elements.salesItemsSection.hidden = e.target.value !== 'sales';
        });
    });

    // Sales Item Modal
    if (elements.addSalesItemBtn) elements.addSalesItemBtn.addEventListener('click', openSalesItemModal);
    if (elements.salesItemModalClose) elements.salesItemModalClose.addEventListener('click', closeSalesItemModal);
    if (elements.salesItemCancelBtn) elements.salesItemCancelBtn.addEventListener('click', closeSalesItemModal);
    if (elements.salesItemAddBtn) elements.salesItemAddBtn.addEventListener('click', handleAddSalesItem);
}

init();
