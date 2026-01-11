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
    selectedEmoji: '🎯', // selected station emoji
    reports: [],
    feedbackSummary: null,
    eventQuestions: [], // Questions for the currently editing event
    waitlist: [] // Waitlist for active event
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
    waitlistEnabled: document.getElementById('waitlistEnabled'),
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

    // Reports Table
    reportsTableBody: document.getElementById('reportsTableBody'),
    reportsEmpty: document.getElementById('reportsEmpty'),
    totalReportsCount: document.getElementById('totalReportsCount'),
    verifiedReportsCount: document.getElementById('verifiedReportsCount'),
    flaggedReportsCount: document.getElementById('flaggedReportsCount'),
    totalSalesAmount: document.getElementById('totalSalesAmount'),
    refreshReportsBtn: document.getElementById('refreshReportsBtn'),
    exportReportsBtn: document.getElementById('exportReportsBtn'),

    // Feedback
    feedbackSummarySection: document.getElementById('feedbackSummarySection'),
    feedbackResults: document.getElementById('feedbackResults'),
    refreshFeedbackBtn: document.getElementById('refreshFeedbackBtn'),
    totalFeedbackCount: document.getElementById('totalFeedbackCount'),

    // Question Editor
    questionsEditor: document.getElementById('questionsEditor'),
    addQuestionBtn: document.getElementById('addQuestionBtn'),
    coordinatorEmail: document.getElementById('coordinatorEmail'),
    checkinOpenOffset: document.getElementById('checkinOpenOffset'),
    checkinCloseOffset: document.getElementById('checkinCloseOffset'),

    // Waitlist
    waitlistSection: document.getElementById('waitlistSection'),
    waitlistTableBody: document.getElementById('waitlistTableBody'),
    waitlistStats: document.getElementById('waitlistStats'),

    // Manual Add & Leaders
    addVolunteerModal: document.getElementById('addVolunteerModal'),
    addVolunteerForm: document.getElementById('addVolunteerForm'),
    addVolunteerSlotName: document.getElementById('addVolunteerSlotName'),

    // Template Preview
    templatePreview: document.getElementById('templatePreview'),
    templateIcon: document.querySelector('.template-icon'),
    templateName: document.querySelector('.template-name'),
    templateDesc: document.querySelector('.template-desc'),
    templateSlotCount: document.querySelector('.slot-count'),
    templateStationCount: document.querySelector('.station-count'),

    // Schedule Builder
    modeCustomBtn: document.getElementById('modeCustomBtn'),
    modeTemplateBtn: document.getElementById('modeTemplateBtn'),
    customModeSection: document.getElementById('customModeSection'),
    templateModeSection: document.getElementById('templateModeSection'),
    stationsContainer: document.getElementById('stationsContainer'),
    addStationBtn: document.getElementById('addStationBtn'),
    customizeTemplateBtn: document.getElementById('customizeTemplateBtn'),
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
    state.eventQuestions = [];
    elements.eventForm.reset();
    elements.eventModal.querySelector('.modal-title').textContent = 'Create Event';
    elements.eventModal.hidden = false;

    // Reset Radio Buttons
    const defaultReg = document.querySelector('input[name="registrationMode"][value="instant"]');
    const defaultWl = document.querySelector('input[name="waitlistMode"][value="manual"]');
    if (defaultReg) defaultReg.checked = true;
    if (defaultWl) defaultWl.checked = true;

    // Default Questions
    state.eventQuestions = [
        {
            question_text: 'How would you rate your experience?',
            question_type: 'stars',
            display_order: 1,
            is_required: true
        },
        {
            question_text: 'Any feedback or suggestions?',
            question_type: 'text',
            display_order: 2,
            is_required: false
        }
    ];

    renderQuestionEditor();
    loadEventTemplates();
}

async function openEditEventModal(eventId) {
    const event = state.events.find(e => e.id === eventId);
    if (!event) return;

    state.editingEventId = eventId;
    elements.eventTitle.value = event.title;
    elements.orgName.value = event.organization_name;
    elements.contactPerson.value = event.contact_person;
    elements.contactWhatsapp.value = event.contact_whatsapp;
    elements.eventStartDate.value = event.dates_config?.start;
    elements.eventEndDate.value = event.dates_config?.end;

    // Set settings
    elements.feedbackEnabled.checked = event.feedback_enabled !== false;
    elements.certificatesEnabled.checked = event.certificates_enabled === true;
    elements.eventPaused.checked = event.paused === true;
    elements.waitlistEnabled.checked = event.waitlist_enabled === true;
    elements.checkinRequired.checked = event.checkin_required !== false;
    elements.coordinatorEmail.value = event.coordinator_email || '';
    elements.checkinOpenOffset.value = event.checkin_open_offset_minutes || 30;
    elements.checkinCloseOffset.value = event.checkin_close_offset_minutes || 120;

    // Advanced Settings
    const regMode = event.registration_mode || 'instant';
    const wlMode = event.waitlist_mode || 'manual';
    const regRadio = document.querySelector(`input[name="registrationMode"][value="${regMode}"]`);
    const wlRadio = document.querySelector(`input[name="waitlistMode"][value="${wlMode}"]`);
    if (regRadio) regRadio.checked = true;
    if (wlRadio) wlRadio.checked = true;

    // Load questions
    await loadEventQuestions(eventId);

    elements.eventModal.querySelector('.modal-title').textContent = 'Edit Event';
    elements.eventModal.hidden = false;
}

async function loadEventQuestions(eventId) {
    try {
        const { data, error } = await supabase.rpc('admin_get_event_questions', {
            p_password: ADMIN_PASSWORD,
            p_event_id: eventId
        });
        if (error) throw error;
        state.eventQuestions = data || [];
        renderQuestionEditor();
    } catch (e) {
        console.error('Error loading questions:', e);
    }
}

function renderQuestionEditor() {
    if (!elements.questionsEditor) return;

    if (state.eventQuestions.length === 0) {
        elements.questionsEditor.innerHTML = '<p class="empty-state-text">No custom feedback questions yet.</p>';
        return;
    }

    elements.questionsEditor.innerHTML = state.eventQuestions.map((q, i) => `
        <div class="question-card" data-index="${i}" style="border: 1px solid var(--color-border); padding: 12px; border-radius: 8px; margin-bottom: 8px; background: #fff;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                <span class="section-header-text">Question ${i + 1}</span>
                <button type="button" class="remove-btn" title="Remove Question" onclick="removeQuestion(${i})" ${state.eventQuestions.length === 1 ? 'disabled' : ''}>×</button>
            </div>
            <div class="question-body" style="display: flex; flex-direction: column; gap: 8px;">
                <div class="question-input-main" style="width: 100%;">
                    <input type="text" class="form-input q-text" value="${q.question_text}" placeholder="e.g., How was the crowd control?" required style="width: 100%;">
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div class="question-input-type" style="flex: 1; margin-right: 12px;">
                        <select class="form-select q-type" style="width: 100%;">
                            <option value="stars" ${q.question_type === 'stars' ? 'selected' : ''}>Star Rating (1-5)</option>
                            <option value="rating" ${q.question_type === 'rating' ? 'selected' : ''}>Numeric Rating (1-10)</option>
                            <option value="text" ${q.question_type === 'text' ? 'selected' : ''}>Text Response</option>
                        </select>
                    </div>
                    <div class="question-options">
                        <label class="checkbox-label" style="font-size: 0.85rem;">
                            <input type="checkbox" class="q-required" ${q.is_required ? 'checked' : ''}>
                            <span>Required</span>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    `).join('');

    // Attach local listeners to inputs to update state
    elements.questionsEditor.querySelectorAll('.question-card').forEach(card => {
        const index = card.dataset.index;
        card.querySelector('.q-text').addEventListener('input', (e) => {
            state.eventQuestions[index].question_text = e.target.value;
        });
        card.querySelector('.q-type').addEventListener('change', (e) => {
            state.eventQuestions[index].question_type = e.target.value;
        });
        card.querySelector('.q-required').addEventListener('change', (e) => {
            state.eventQuestions[index].is_required = e.target.checked;
        });
    });
}

window.removeQuestion = function (index) {
    state.eventQuestions.splice(index, 1);
    renderQuestionEditor();
};

function addQuestion() {
    state.eventQuestions.push({
        question_text: '',
        question_type: 'stars',
        display_order: state.eventQuestions.length + 1,
        is_required: true
    });
    renderQuestionEditor();
}

async function saveEventQuestions(eventId) {
    if (state.eventQuestions.length === 0) return;

    try {
        const { error } = await supabase.rpc('admin_update_event_questions', {
            p_password: ADMIN_PASSWORD,
            p_event_id: eventId,
            p_questions: state.eventQuestions
        });
        if (error) throw error;
    } catch (e) {
        console.error('Error saving questions:', e);
        alert('Failed to save feedback questions');
    }
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
                p_active: true,
                p_feedback_enabled: elements.feedbackEnabled?.checked || false,
                p_certificates_enabled: elements.certificatesEnabled?.checked || false,
                p_paused: elements.eventPaused?.checked || false,
                p_waitlist_enabled: elements.waitlistEnabled?.checked || false,
                p_checkin_required: elements.checkinRequired?.checked || false,
                p_coordinator_email: elements.coordinatorEmail?.value || null,
                p_checkin_open_offset_minutes: parseInt(elements.checkinOpenOffset?.value) || 60,
                p_checkin_close_offset_minutes: parseInt(elements.checkinCloseOffset?.value) || 30,
                p_registration_mode: document.querySelector('input[name="registrationMode"]:checked')?.value || 'instant',
                p_waitlist_mode: document.querySelector('input[name="waitlistMode"]:checked')?.value || 'manual',
                p_advanced_reporting_enabled: document.getElementById('advancedReportingEnabled')?.checked || false
            });

            if (error) throw error;

            // Update questions
            await saveEventQuestions(state.editingEventId);

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
                    feedback_enabled: elements.feedbackEnabled?.checked || false,
                    certificates_enabled: elements.certificatesEnabled?.checked || false,
                    checkin_required: elements.checkinRequired?.checked || false,
                    waitlist_enabled: elements.waitlistEnabled?.checked || false,
                    paused: elements.eventPaused?.checked || false,
                    coordinator_email: elements.coordinatorEmail?.value || null,
                    checkin_open_offset_minutes: parseInt(elements.checkinOpenOffset?.value) || 60,
                    checkin_close_offset_minutes: parseInt(elements.checkinCloseOffset?.value) || 30,
                    registration_mode: document.querySelector('input[name="registrationMode"]:checked')?.value || 'instant',
                    waitlist_mode: document.querySelector('input[name="waitlistMode"]:checked')?.value || 'manual',
                    advanced_reporting_enabled: document.getElementById('advancedReportingEnabled')?.checked || false
                })
                .select()
                .single();

            if (eventError) throw eventError;

            // Auto-create default feedback questions if enabled
            const feedbackEnabled = elements.feedbackEnabled?.checked || false;
            if (feedbackEnabled) {
                await supabase.rpc('create_default_feedback_questions', { p_event_id: eventData.id });
            }

            // 2. Generate Slots for this event
            const isCustomMode = elements.modeCustomBtn?.classList?.contains('active') ?? true;

            if (isCustomMode) {
                // Parse Custom Schedule Builder
                await generateCustomSlots(eventData.id, start, end);
            } else {
                // Use template
                const templateId = elements.eventTemplate.value;
                if (templateId) {
                    await applyTemplateToEvent(eventData.id, templateId, start, end);
                } else {
                    // Fallback if checked template but didn't select one -> do nothing or warn.
                    // Ideally validate before submit.
                    console.warn("No template selected, no slots generated.");
                }
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

async function generateCustomSlots(eventId, startStr, endStr) {
    const slots = [];
    const start = new Date(startStr);
    const end = new Date(endStr);

    // Get all stations
    const stationCards = elements.stationsContainer.querySelectorAll('.station-card');

    // Iterate dates
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'Long' });

        stationCards.forEach(card => {
            const stationNameInput = card.querySelector('.station-title-input');
            const stationName = stationNameInput.value.trim();
            const station = (stationName === '' || stationName === 'General Volunteers') ? null : stationName;

            const shiftRows = card.querySelectorAll('.shift-row:not(:first-child)'); // Skip header

            shiftRows.forEach(row => {
                const name = row.querySelector('.shift-name').value;
                const startTime = row.querySelector('.shift-start').value;
                const endTime = row.querySelector('.shift-end').value;
                const capacity = parseInt(row.querySelector('.shift-capacity').value) || 10;

                // Parse sales config
                let salesConfig = null;
                const isSales = row.querySelector('.shift-sales-toggle')?.checked;
                if (isSales) {
                    const items = [];
                    row.querySelectorAll('.sales-item-row').forEach(itemRow => {
                        const iName = itemRow.querySelector('.sales-item-name').value;
                        const iPrice = parseFloat(itemRow.querySelector('.sales-item-price').value);
                        if (iName) items.push({ name: iName, price: iPrice || 0 });
                    });
                    if (items.length > 0) salesConfig = { items };
                }

                if (name && startTime && endTime) {
                    slots.push({
                        event_id: eventId,
                        date: dateStr,
                        day_of_week: dayOfWeek,
                        shift_name: name,
                        start_time: startTime,
                        end_time: endTime,
                        capacity: capacity,
                        station: station,
                        registered_count: 0,
                        sales_config: salesConfig
                    });
                }
            });
        });
    }

    if (slots.length > 0) {
        const { error } = await supabase.from('shift_slots').insert(slots);
        if (error) {
            console.error('Error generating custom slots:', error);
            alert('Event created but slots generation failed.');
        }
    }
}

// Initialize Schedule Builder Event Listeners
function initScheduleBuilder() {
    if (!elements.modeCustomBtn) return;

    // Mode Switch
    elements.modeCustomBtn.addEventListener('click', () => {
        elements.modeCustomBtn.classList.add('active');
        elements.modeTemplateBtn.classList.remove('active');
        elements.customModeSection.hidden = false;
        elements.templateModeSection.hidden = true;
    });

    elements.modeTemplateBtn.addEventListener('click', () => {
        elements.modeTemplateBtn.classList.add('active');
        elements.modeCustomBtn.classList.remove('active');
        elements.customModeSection.hidden = true;
        elements.templateModeSection.hidden = false;
    });

    // Add Station
    if (elements.addStationBtn) {
        elements.addStationBtn.addEventListener('click', () => {
            const clone = elements.stationsContainer.querySelector('.station-card').cloneNode(true);
            clone.querySelector('.station-title-input').value = '';
            clone.querySelector('.station-title-input').placeholder = 'New Station Name';

            // Reset shifts to just one default empty one? Or clear them?
            // Let's clear and add one default
            const shiftList = clone.querySelector('.shift-list');
            // Keep header (first child)
            const header = shiftList.firstElementChild;
            shiftList.innerHTML = '';
            shiftList.appendChild(header);

            // Add one default shift row
            addShiftRow(shiftList);

            // Show remove station btn
            clone.querySelector('.remove-station-btn').hidden = false;

            elements.stationsContainer.appendChild(clone);
            attachStationListeners(clone);
        });
    }

    // Customize Template listener is now handled in init() with populateScheduleBuilderFromTemplate
    // Removed duplicate logic here to prevent conflicts.

    // Initial listeners for default station
    const defaultStation = elements.stationsContainer.querySelector('.station-card');
    if (defaultStation) attachStationListeners(defaultStation);
}



// Helper to toggle sales section
function toggleSalesSection(btn) {
    const container = btn.closest('.shift-row').querySelector('.sales-config-container');
    const isHidden = container.hidden;
    container.hidden = !isHidden;

    // Toggle state style if needed
    btn.style.opacity = isHidden ? '1' : '0.5';
}

window.toggleSalesSection = toggleSalesSection; // Expose global
window.addSalesItemRow = function (btn) {
    const list = btn.closest('.sales-config-container').querySelector('.sales-items-list');
    const itemRow = document.createElement('div');
    itemRow.className = 'sales-item-row';
    itemRow.style.cssText = "display: flex; gap: 4px; margin-bottom: 4px;";
    itemRow.innerHTML = `
        <input type="text" class="form-input form-input--sm sales-item-name" placeholder="Item Name" style="flex: 2;">
        <input type="number" class="form-input form-input--sm sales-item-price" placeholder="Price" step="0.1" style="flex: 1;">
        <button type="button" class="remove-btn" onclick="this.parentElement.remove()">×</button>
    `;
    list.appendChild(itemRow);
};

function addShiftRowWithData(shiftList, data = {}) {
    // If data comes from template, check for sales_config
    const salesConfig = data.sales_config || null;
    const hasSales = salesConfig && salesConfig.items && salesConfig.items.length > 0;

    const row = document.createElement('div');
    row.className = 'shift-row';
    // Use flex column to stack the input row and the sales config row
    row.style.display = 'flex';
    row.style.flexDirection = 'column';
    row.style.alignItems = 'stretch';
    row.style.gap = '0';

    row.innerHTML = `
        <div style="display: flex; gap: var(--space-2); align-items: center; width: 100%;">
            <input type="text" class="shift-input shift-name" value="${data.name || ''}" placeholder="Shift Name" style="flex: 2;">
            <input type="time" class="shift-input shift-start" value="${data.start || '09:00'}" style="flex: 1.5;">
            <input type="time" class="shift-input shift-end" value="${data.end || '12:00'}" style="flex: 1.5;">
            <input type="number" class="shift-input shift-capacity" value="${data.capacity || 10}" min="1" style="flex: 1;">
            <button type="button" class="action-btn action-btn--sm sales-config-btn" title="Toggle Sales Config" onclick="toggleSalesSection(this)" style="background: ${hasSales ? 'var(--color-success-light)' : 'var(--color-surface)'}; border-color: ${hasSales ? 'var(--color-success)' : 'var(--color-border)'}; color: ${hasSales ? 'var(--color-success)' : 'var(--color-text)'}; flex-shrink: 0;">💲 Sales</button>
            <button type="button" class="remove-btn" title="Remove Shift" style="flex-shrink: 0;">×</button>
        </div>
        
        <!-- Sales Config Section -->
        <div class="sales-config-container" ${hasSales ? '' : 'hidden'} style="width: 100%; margin-top: 8px; padding: 12px; background: var(--color-background); border-radius: 8px; border: 1px dashed var(--color-border);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <label class="checkbox-label" style="font-size: 0.9rem; font-weight: 500;">
                    <input type="checkbox" class="shift-sales-toggle" ${hasSales ? 'checked' : ''} style="transform: scale(1.2); margin-right: 8px;"> Enable Sales
                </label>
                <button type="button" class="action-btn action-btn--secondary" style="font-size: 0.85rem; padding: 4px 10px;" onclick="addSalesItemRow(this)">+ Add Item</button>
            </div>
            <div class="sales-items-list">
                ${hasSales ? salesConfig.items.map(item => `
                    <div class="sales-item-row" style="display: flex; gap: 4px; margin-bottom: 4px;">
                        <input type="text" class="form-input form-input--sm sales-item-name" placeholder="Item Name" value="${item.name}" style="flex: 2;">
                        <input type="number" class="form-input form-input--sm sales-item-price" placeholder="Price" step="0.1" value="${item.price}" style="flex: 1;">
                        <button type="button" class="remove-btn" onclick="this.parentElement.remove()">×</button>
                    </div>
                `).join('') : ''}
            </div>
        </div>
    `;
    shiftList.appendChild(row);
    row.querySelector('.remove-btn').addEventListener('click', () => row.remove());
}

function addShiftRow(shiftList) {
    addShiftRowWithData(shiftList, {});
}

function attachStationListeners(stationCard) {
    // Add Shift Btn
    const addBtn = stationCard.querySelector('.add-shift-btn');
    addBtn.onclick = () => { // use onclick to avoid multiple bindings if re-attached
        addShiftRow(stationCard.querySelector('.shift-list'));
    };

    // Remove Station Btn
    const removeStationBtn = stationCard.querySelector('.remove-station-btn');
    removeStationBtn.onclick = () => {
        if (elements.stationsContainer.querySelectorAll('.station-card').length > 1) {
            stationCard.remove();
        }
    };

    // Existing shift rows
    stationCard.querySelectorAll('.remove-btn').forEach(btn => {
        btn.onclick = function () { this.closest('.shift-row').remove(); };
    });
}

// Call init on load
document.addEventListener('DOMContentLoaded', () => {
    initScheduleBuilder();
});

// Replaces generateDefaultSlots - Removed
// async function generateDefaultSlots(eventId, startStr, endStr) { ... }

async function loadEventTemplates() {
    try {
        const { data, error } = await supabase
            .from('event_templates')
            .select('*')
            .order('category')
            .order('name');

        if (error) throw error;

        state.templates = data;

        // Group by category
        const categories = {};
        data.forEach(t => {
            if (!categories[t.category]) categories[t.category] = [];
            categories[t.category].push(t);
        });

        // Render options
        elements.eventTemplate.innerHTML = '<option value="">-- Select Event Template --</option>';
        Object.keys(categories).forEach(cat => {
            const group = document.createElement('optgroup');
            group.label = cat.charAt(0).toUpperCase() + cat.slice(1);
            categories[cat].forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.id;
                opt.textContent = `${t.icon || ''} ${t.name}`;
                group.appendChild(opt);
            });
            elements.eventTemplate.appendChild(group);
        });
    } catch (e) {
        console.error('Error loading templates:', e);
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
                station: slot.station || null,
                slot_type: template.slot_config?.slot_type || 'standard',
                sales_config: template.slot_config?.sales_config || null,
                report_required: template.slot_config?.report_required || false
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

        // Load all data concurrently
        await Promise.all([
            loadSlots(),
            loadRegistrations(),
            loadReports(),
            loadFeedbackSummary(),
            loadWaitlist()
        ]);

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
        // Filter and Sort slots by time
        const dateSlots = state.slots
            .filter(s => s.date === dateStr)
            .sort((a, b) => a.start_time.localeCompare(b.start_time));

        // Helper to render a list of slots
        const renderSlotGroup = (slots) => slots.map(slot => {
            const remaining = slot.capacity - slot.registered_count;
            let countClass = 'available';
            if (remaining === 0) countClass = 'full';
            else if (remaining <= 5) countClass = 'limited';

            // Find volunteers for this slot
            // We need to fetch 'is_shift_leader' which is on the join table.
            // Currently state.registrations is a flat list of registrations with 'shifts' array.
            // We might need to ensure 'shifts' array in registrations includes 'is_shift_leader'.
            // For now, assuming the backend for 'admin_get_registrations' returns it.
            // Let's verify admin_get_registrations RPC return structure or if we need to update it.
            // Actually, admin_get_event_details returns registrations with shifts.

            const volunteers = state.registrations.filter(reg =>
                reg.shifts?.some(s => s.slot_id === slot.id)
            ).map(reg => {
                const shiftInfo = reg.shifts.find(s => s.slot_id === slot.id);
                const isLeader = shiftInfo?.is_shift_leader;
                return { ...reg, isLeader };
            });

            return `
                <div class="overview-shift">
                    <div class="overview-shift-header">
                        <span class="overview-shift-name">${slot.shift_name}</span>
                        ${slot.station ? `<span class="status-badge status-badge--flagged">${slot.station}</span>` : ''}
                        <button class="icon-btn-small" onclick="window.openAddVolunteerModal('${slot.id}')" title="Manual Add Volunteer">➕</button>
                    </div>
                    <div class="overview-shift-time">
                        ${formatTime(slot.start_time)} - ${formatTime(slot.end_time)}
                    </div>
                    <span class="overview-shift-count overview-shift-count--${countClass}">
                        ${slot.registered_count}/${slot.capacity}
                    </span>
                 
                    ${volunteers.length > 0 ? `
                        <div class="overview-volunteers">
                            ${volunteers.map(v => `
                                <div class="overview-volunteer">
                                    <span class="volunteer-name">• ${v.full_name}</span>
                                    <span class="leader-toggle ${v.isLeader ? 'active' : ''}" 
                                          title="${v.isLeader ? 'Remove Leader' : 'Make Shift Leader'}"
                                          onclick="window.toggleShiftLeader('${v.id}', '${slot.id}')">
                                        ${v.isLeader ? '👑' : '☆'}
                                    </span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        // Group by station
        const stations = {};
        let hasStations = false;
        dateSlots.forEach(slot => {
            const st = slot.station || 'General';
            if (slot.station) hasStations = true;
            if (!stations[st]) stations[st] = [];
            stations[st].push(slot);
        });

        let contentHtml = '';
        if (!hasStations) {
            contentHtml = renderSlotGroup(dateSlots);
        } else {
            const stationKeys = Object.keys(stations).sort();
            contentHtml = stationKeys.map(st => `
                <div class="station-overview-group">
                    <h4 class="station-title text-small">${st === 'General' ? 'General Shifts' : st}</h4>
                    <div class="overview-shifts">
                        ${renderSlotGroup(stations[st])}
                    </div>
                </div>
            `).join('');
        }

        return `
            <div class="overview-card">
                <div class="overview-date">${formatDateFull(dateStr)}</div>
                <div class="overview-shifts-container">${contentHtml}</div>
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
            const typeBadge = slot.slot_type === 'sales' ? '<span class="slot-badge slot-badge--sales">Sales</span>' : '';
            return `
                <div class="slot-item" data-slot-id="${slot.id}">
                    <div class="slot-info">
                        <span class="slot-time">${formatTime(slot.start_time)} - ${formatTime(slot.end_time)}</span>
                        ${stationBadge}
                        ${typeBadge}
                        <span class="slot-capacity">${slot.registered_count}/${slot.capacity}</span>
                    </div>
                    <div class="slot-actions-row">
                        <button class="icon-btn-small" onclick="window.openAddVolunteerModal('${slot.id}')" title="Manual Add Volunteer">➕ Add Vol</button>
                        <button class="slot-delete-btn" onclick="window.handleDeleteSlot('${slot.id}')" title="Delete Slot">🗑️</button>
                    </div>
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
// REPORTS & FEEDBACK LOGIC
// =====================================================

// Feedback Summary
async function loadFeedbackSummary() {
    if (!state.activeEventId) return;

    // Check if feedback is enabled for this event
    const event = state.events.find(e => e.id === state.activeEventId);
    if (!event || !event.feedback_enabled) {
        if (elements.feedbackResults) elements.feedbackResults.innerHTML = '<p class="text-muted">Feedback is disabled for this event.</p>';
        return;
    }

    if (elements.feedbackResults) elements.feedbackResults.innerHTML = '<p class="table-loading">Loading feedback...</p>';

    try {
        const { data, error } = await supabase.rpc('get_feedback_summary', {
            p_password: ADMIN_PASSWORD,
            p_event_id: state.activeEventId
        });

        if (error) throw error;

        renderFeedbackSummary(data || { total_responses: 0, questions: [] });
    } catch (e) {
        console.error('Feedback error:', e);
        if (elements.feedbackResults) elements.feedbackResults.innerHTML = '<p class="error-msg">Failed to load feedback.</p>';
    }
}

function renderFeedbackSummary(summary) {
    if (!elements.feedbackResults) return;

    const totalCountEl = document.getElementById('totalFeedbackCount');
    if (totalCountEl) totalCountEl.textContent = summary.total_responses;

    if (summary.total_responses === 0) {
        elements.feedbackResults.innerHTML = '<p class="table-empty">No feedback responses yet.</p>';
        return;
    }

    elements.feedbackResults.innerHTML = summary.questions.map(q => {
        let content = '';

        if (q.question_type === 'stars' || q.question_type === 'rating') {
            const avg = parseFloat(q.average_rating || 0).toFixed(1);
            const max = q.question_type === 'stars' ? 5 : 10;
            const icon = q.question_type === 'stars' ? '★' : '📊';
            content = `
                <div class="feedback-metric">
                    <span class="metric-value">${avg}<span class="metric-max">/${max}</span></span>
                    <span class="metric-icon">${icon}</span>
                </div>
            `;
        } else {
            // Freeform text
            const responses = q.responses || [];
            const validResponses = responses.filter(r => r); // Remove nulls
            if (validResponses.length === 0) {
                content = '<p class="text-muted text-small">No text responses.</p>';
            } else {
                content = `
                    <div class="feedback-comments">
                        ${validResponses.map(r => `<div class="comment-bubble">"${r}"</div>`).join('')}
                    </div>
                `;
            }
        }

        return `
            <div class="feedback-card">
                <h4 class="feedback-question">${q.question_text}</h4>
                ${content}
            </div>
        `;
    }).join('');
}


async function loadReports() {
    if (!state.activeEventId) return;
    elements.reportsTableBody.innerHTML = '<tr><td colspan="6" class="table-loading">Loading reports...</td></tr>';

    try {
        const { data, error } = await supabase.rpc('admin_get_shift_reports', {
            p_password: ADMIN_PASSWORD,
            p_event_id: state.activeEventId
        });

        if (error) throw error;

        state.reports = (data.success ? data.data : []) || [];
        renderReports();
    } catch (e) {
        console.error('Reports error:', e);
        elements.reportsTableBody.innerHTML = '<tr><td colspan="6" class="error-msg">Failed to load reports.</td></tr>';
    }
}

function renderReports() {
    if (state.reports.length === 0) {
        elements.reportsTableBody.innerHTML = '';
        elements.reportsEmpty.hidden = false;
        return;
    }

    elements.reportsEmpty.hidden = true;

    // Stats
    const total = state.reports.length;
    const verified = state.reports.filter(r => r.status === 'verified').length;
    const flagged = state.reports.filter(r => r.status === 'flagged').length;
    const amount = state.reports.reduce((sum, r) => sum + (r.report_data?.total_amount || 0), 0);

    elements.totalReportsCount.textContent = total;
    elements.verifiedReportsCount.textContent = verified;
    elements.flaggedReportsCount.textContent = flagged;
    elements.totalSalesAmount.textContent = `$${amount.toFixed(2)}`;

    elements.reportsTableBody.innerHTML = state.reports.map(report => {
        const items = report.report_data?.items_sold || [];
        const itemsHtml = items.map(i => `<div>${i.name}: ${i.quantity} ($${i.amount.toFixed(2)})</div>`).join('');

        return `
            <tr>
                <td><strong>${formatDate(report.shift_date)}</strong><br>${report.shift_name}</td>
                <td>${report.volunteer_name}</td>
                <td><div class="report-items-cell">${itemsHtml}</div></td>
                <td><strong>$${(report.report_data?.total_amount || 0).toFixed(2)}</strong></td>
                <td><span class="status-badge status-badge--${report.status}">${report.status}</span></td>
                <td><button class="action-icon-btn" onclick="alert('Verification logic coming soon')">👁️</button></td>
            </tr>
        `;
    }).join('');
}

// =====================================================
// WAITLIST LOGIC
// =====================================================

async function loadWaitlist() {
    if (!state.activeEventId) return;
    elements.waitlistTableBody.innerHTML = '<tr><td colspan="6" class="table-loading">Loading waitlist...</td></tr>';
    elements.waitlistSection.hidden = false;

    try {
        const { data, error } = await supabase.rpc('admin_get_waitlist', {
            p_password: ADMIN_PASSWORD,
            p_event_id: state.activeEventId
        });

        if (error) throw error;

        state.waitlist = (data.success ? data.data : []) || [];
        renderWaitlist();
    } catch (e) {
        console.error('Waitlist error:', e);
        elements.waitlistTableBody.innerHTML = '<tr><td colspan="6" class="error-msg">Failed to load waitlist.</td></tr>';
    }
}

function renderWaitlist() {
    const summaryCard = (title, value, icon) => `
        <div class="stats-card">
            <div class="stats-card-value">${value}</div>
            <div class="stats-card-label">${title}</div>
            <div class="stats-card-icon">${icon}</div>
        </div>
    `;

    // Render Stats
    elements.waitlistStats.innerHTML = `
        ${summaryCard('Total Waiting', state.waitlist.length, '⏳')}
        ${summaryCard("Today's Shifts", state.waitlist.filter(w => w.date === new Date().toISOString().split('T')[0]).length, '📅')}
        `;

    if (state.waitlist.length === 0) {
        elements.waitlistTableBody.innerHTML = '<tr><td colspan="6" class="empty-text">No one on the waitlist.</td></tr>';
        return;
    }

    elements.waitlistTableBody.innerHTML = state.waitlist.map(w => `
        < tr >
            <td>#${w.position}</td>
            <td><strong>${w.full_name}</strong></td>
            <td>
                <div>${w.phone}</div>
                <div class="subtitle text-small">${w.email || ''}</div>
            </td>
            <td>
                <div class="shift-badge shift-badge--waitlist">
                    ${w.shift_name}
                </div>
                <div class="subtitle text-small">${formatDate(w.date)} • ${formatTime(w.start_time)}</div>
            </td>
            <td>${new Date(w.created_at).toLocaleDateString()}</td>
            <td>
                <button class="action-icon-btn" title="Promote to Slot" onclick="window.promoteFromWaitlist('${w.id}')">✅</button>
                <button class="action-icon-btn delete-btn" title="Remove" onclick="window.removeFromWaitlist('${w.id}')">🗑️</button>
            </td>
        </tr >
        `).join('');
}

// -----------------------------------------------------
// Waitlist Actions
// -----------------------------------------------------

window.promoteFromWaitlist = async function (waitlistId) {
    if (!confirm('Promote this volunteer to the slot? They will be registered immediately.')) return;

    try {
        const { data, error } = await supabase.rpc('admin_promote_waitlist_entry', {
            p_password: ADMIN_PASSWORD,
            p_waitlist_id: waitlistId
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error);

        alert('Success: ' + data.message);
        loadWaitlist(); // Refresh list
    } catch (e) {
        console.error('Promote error:', e);
        alert('Failed to promote: ' + e.message);
    }
};

window.removeFromWaitlist = async function (waitlistId) {
    if (!confirm('Remove this person from the waitlist? This cannot be undone.')) return;

    try {
        const { data, error } = await supabase.rpc('admin_remove_waitlist_entry', {
            p_password: ADMIN_PASSWORD,
            p_waitlist_id: waitlistId
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error);

        loadWaitlist(); // Refresh list
    } catch (e) {
        console.error('Remove error:', e);
        alert('Failed to remove: ' + e.message);
    }
};

// -----------------------------------------------------
// Manual Registration & Shift Leaders
// -----------------------------------------------------

window.openAddVolunteerModal = function (slotId) {
    state.activeSlotId = slotId;
    const slot = state.slots.find(s => s.id === slotId);

    // Create modal if not exists (or we can just reuse a simple prompt for now to be fast?)
    // User requested "prepopulate", usually implies a form.
    // Let's reuse the existing simple prompt approach or append a modal to DOM dynamically if easier.
    // For better UX, let's inject a modal HTML if missing, or use a simple prompt for V1.
    // Given the "WOW" factor requirement, let's look for a modal structure in index.html.
    // We haven't added one yet. Let's add it via JS for now or just trust `elements` has it if we add to HTML.

    // Let's assume we will add the modal HTML next.
    if (elements.addVolunteerModal) {
        elements.addVolunteerModal.hidden = false;
        elements.addVolunteerSlotName.textContent = slot ? slot.shift_name : '';
        elements.addVolunteerForm.reset();
    } else {
        alert('Modal not found. Please refresh.');
    }
};

window.closeAddVolunteerModal = function () {
    if (elements.addVolunteerModal) elements.addVolunteerModal.hidden = true;
};

window.handleManualAddSubmit = async function (e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const name = formData.get('fullName');
    const phone = formData.get('phone');
    const email = formData.get('email');

    try {
        const { data, error } = await supabase.rpc('admin_create_registration', {
            p_password: ADMIN_PASSWORD,
            p_event_id: state.activeEventId,
            p_slot_id: state.activeSlotId,
            p_full_name: name,
            p_phone: phone,
            p_email: email || null
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error);

        alert('Success: ' + data.message);
        window.closeAddVolunteerModal();
        loadEventDetails(state.activeEventId); // Refresh all data
    } catch (e) {
        console.error('Manual Add error:', e);
        alert('Failed: ' + e.message);
    }
};


window.toggleShiftLeader = async function (regId, slotId) {
    try {
        const { data, error } = await supabase.rpc('admin_toggle_shift_leader', {
            p_password: ADMIN_PASSWORD,
            p_registration_id: regId,
            p_slot_id: slotId
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error);

        // Optimistic update or reload
        loadEventDetails(state.activeEventId);
    } catch (e) {
        console.error('Leader toggle error:', e);
        alert('Failed to toggle leader: ' + e.message);
    }
};

// =====================================================
// INITIALIZATION
// =====================================================

function init() {
    checkExistingAuth();

    // Global Listeners
    if (elements.authForm) elements.authForm.addEventListener('submit', handleAuth);
    if (elements.createEventBtn) elements.createEventBtn.addEventListener('click', openCreateEventModal);
    if (elements.logoutBtn) elements.logoutBtn.addEventListener('click', handleLogout);
    if (elements.eventForm) elements.eventForm.addEventListener('submit', handleCreateEventSubmit);

    // ... existing listeners ...

    // Add Volunteer Modal
    if (elements.addVolunteerForm) {
        elements.addVolunteerForm.addEventListener('submit', window.handleManualAddSubmit);
    }
    const closeAddVol = document.getElementById('closeAddVolunteerModal');
    if (closeAddVol) closeAddVol.addEventListener('click', window.closeAddVolunteerModal);
    elements.createEventBtn.addEventListener('click', openCreateEventModal);
    if (elements.backToEventsBtn) elements.backToEventsBtn.addEventListener('click', showEventsList);
    if (elements.refreshBtn) elements.refreshBtn.addEventListener('click', handleRefresh);
    if (elements.copyLinkBtn) elements.copyLinkBtn.addEventListener('click', copyEventLink);
    if (elements.dateFilter) elements.dateFilter.addEventListener('change', (e) => {
        state.selectedDateFilter = e.target.value;
        renderTable();
    });
    if (elements.exportBtn) elements.exportBtn.addEventListener('click', exportToCSV);
    if (elements.sendRemindersBtn) elements.sendRemindersBtn.addEventListener('click', sendReminders);

    // Reports & Feedback
    if (elements.refreshReportsBtn) elements.refreshReportsBtn.addEventListener('click', loadReports);
    if (elements.exportReportsBtn) elements.exportReportsBtn.addEventListener('click', () => alert('Exporting reports logic coming soon'));

    // Feedback Listeners
    if (elements.refreshFeedbackBtn) elements.refreshFeedbackBtn.addEventListener('click', loadFeedbackSummary);
    if (elements.refreshWaitlistBtn) elements.refreshWaitlistBtn.addEventListener('click', loadWaitlist);

    // Event Modal
    if (elements.eventModalClose) elements.eventModalClose.addEventListener('click', closeEventModal);
    if (elements.eventCancelBtn) elements.eventCancelBtn.addEventListener('click', closeEventModal);
    if (elements.eventForm) elements.eventForm.addEventListener('submit', handleCreateEventSubmit);
    if (elements.addQuestionBtn) elements.addQuestionBtn.addEventListener('click', addQuestion);

    // Template change listener
    if (elements.eventTemplate) elements.eventTemplate.addEventListener('change', (e) => {
        const templateId = e.target.value;
        console.log('[Template Debug] Selected templateId:', templateId);
        console.log('[Template Debug] state.templates:', state.templates);

        if (!templateId) {
            elements.templatePreview.hidden = true;
            return;
        }

        const template = state.templates.find(t => t.id === templateId);
        console.log('[Template Debug] Found template:', template);

        if (!template) {
            console.warn('[Template Debug] Template not found in state.templates!');
            return;
        }

        // Show Preview
        elements.templatePreview.hidden = false;
        elements.templateIcon.textContent = template.icon || '📅';
        elements.templateName.textContent = template.name;
        elements.templateDesc.textContent = template.description || '';

        const slotConfig = template.slot_config?.slots || [];
        elements.templateSlotCount.textContent = slotConfig.length;

        const uniqueStations = [...new Set(slotConfig.map(s => s.station).filter(Boolean))];
        elements.templateStationCount.textContent = uniqueStations.length;

        // Render slots preview list
        const previewList = elements.templatePreview.querySelector('.template-slots-preview') ||
            (function () {
                const div = document.createElement('div');
                div.className = 'template-slots-preview';
                div.style.marginTop = '12px';
                div.style.maxHeight = '200px';
                div.style.overflowY = 'auto';
                div.style.border = '1px solid var(--color-border)';
                div.style.borderRadius = '8px';
                div.style.background = '#fafafa';
                elements.templatePreview.insertBefore(div, elements.customizeTemplateBtn);
                return div;
            })();

        previewList.innerHTML = slotConfig.length ? slotConfig.map(s => `
            <div style="padding: 8px; border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; font-size: 0.8em;">
                <span style="font-weight: 500;">${s.station || 'General'}</span>
                <span>${s.name || s.shift_name} (${s.start}-${s.end})</span>
                <div class="shift-badges">
                    ${s.sales_config ? '<span class="shift-badge" style="background: #e0f2f1; color: #00695c;">💰 Sales</span>' : ''}
                </div>
            </div>
        `).join('') : '<p style="padding:8px; font-style:italic; font-size:0.8em">No slots config found.</p>';

        // Auto-fill settings
        const settings = template.default_settings || {};
        if (settings.feedback_enabled !== undefined && elements.feedbackEnabled) elements.feedbackEnabled.checked = settings.feedback_enabled;
        if (settings.certificates_enabled !== undefined && elements.certificatesEnabled) elements.certificatesEnabled.checked = settings.certificates_enabled;
        if (settings.checkin_required !== undefined && elements.checkinRequired) elements.checkinRequired.checked = settings.checkin_required;
        if (settings.paused !== undefined && elements.eventPaused) elements.eventPaused.checked = settings.paused;
        if (settings.waitlist_enabled !== undefined && elements.waitlistEnabled) elements.waitlistEnabled.checked = settings.waitlist_enabled;
    });

    // Edit Modal
    if (elements.editModalClose) elements.editModalClose.addEventListener('click', closeEditModal);
    if (elements.editCancelBtn) elements.editCancelBtn.addEventListener('click', closeEditModal);
    if (elements.editForm) elements.editForm.addEventListener('submit', handleEditSubmit);

    // Delete Modal
    if (elements.deleteModalClose) elements.deleteModalClose.addEventListener('click', closeDeleteModal);
    if (elements.deleteCancelBtn) elements.deleteCancelBtn.addEventListener('click', closeDeleteModal);
    if (elements.deleteConfirmBtn) elements.deleteConfirmBtn.addEventListener('click', handleConfirmDelete);

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

    // Template Customization Listener - FIX for "Customize Schedule" button not working
    if (elements.customizeTemplateBtn) {
        elements.customizeTemplateBtn.addEventListener('click', () => {
            const templateId = elements.eventTemplate.value;
            if (templateId) {
                populateScheduleBuilderFromTemplate(templateId);
                // Switch tab to custom mode
                if (elements.modeCustomBtn) elements.modeCustomBtn.click();
            }
        });
    }

    // Sales Item Modal
    if (elements.addSalesItemBtn) elements.addSalesItemBtn.addEventListener('click', openSalesItemModal);
    if (elements.salesItemModalClose) elements.salesItemModalClose.addEventListener('click', closeSalesItemModal);
    if (elements.salesItemCancelBtn) elements.salesItemCancelBtn.addEventListener('click', closeSalesItemModal);
    if (elements.salesItemAddBtn) elements.salesItemAddBtn.addEventListener('click', handleAddSalesItem);
}

function populateScheduleBuilderFromTemplate(templateId) {
    const template = state.templates.find(t => t.id === templateId);
    if (!template) return;

    // Clear existing stations
    elements.stationsContainer.innerHTML = '';

    const slotConfig = template.slot_config?.slots || [];

    // Group slots by station from template
    const stationsMap = {};
    const generalSlots = [];

    slotConfig.forEach(slot => {
        if (slot.station) {
            if (!stationsMap[slot.station]) stationsMap[slot.station] = [];
            stationsMap[slot.station].push(slot);
        } else {
            generalSlots.push(slot);
        }
    });

    // 1. Create General Station if there are general slots or if no slots at all
    if (generalSlots.length > 0 || (Object.keys(stationsMap).length === 0 && generalSlots.length === 0)) {
        addStationWithShifts('General Volunteers', generalSlots); // We need to ensure addStationWithShifts exists or create it
    }

    // 2. Create named stations
    Object.keys(stationsMap).forEach(stationName => {
        addStationWithShifts(stationName, stationsMap[stationName]);
    });
}

// Helper to create a station card with pre-filled shifts
function addStationWithShifts(stationName, shifts) {
    // Determine ID (random or incremental)
    const stationId = Date.now() + Math.random().toString(36).substr(2, 5);

    const div = document.createElement('div');
    div.className = 'station-card';
    div.dataset.stationId = stationId;
    div.innerHTML = `
        <div class="station-header">
            <input type="text" class="station-title-input" value="${stationName}" placeholder="Station Name">
            <div class="station-actions">
                <button type="button" class="remove-station-btn">Remove Station</button>
            </div>
        </div>
        <div class="shift-list">
             <div class="shift-row" style="background: transparent; border: none; padding: 0;">
                <span class="table-header-text">Shift Name</span>
                <span class="table-header-text">Start</span>
                <span class="table-header-text">End</span>
                <span class="table-header-text">Slots</span>
                <span></span>
            </div>
        </div>
        <button type="button" class="add-shift-btn">+ Add Shift</button>
    `;

    const shiftList = div.querySelector('.shift-list');

    // Add shifts
    if (shifts && shifts.length > 0) {
        shifts.forEach(s => {
            // Map template slot to data format expected by addShiftRowWithData
            // Template slot: { name: "Morning", start: "07:00", end: "12:00", capacity: 5, sales_config: {...} }
            const shiftData = {
                name: s.name || s.shift_name,
                start: s.start || s.start_time,
                end: s.end || s.end_time,
                capacity: s.capacity,
                sales_config: s.sales_config // Pass sales config through
            };
            addShiftRowWithData(shiftList, shiftData);
        });
    } else {
        // Add default empty row if no shifts
        addShiftRowWithData(shiftList);
    }

    elements.stationsContainer.appendChild(div);
    attachStationListeners(div);
}

init();
