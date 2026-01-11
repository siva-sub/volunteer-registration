// =====================================================
// Sri Thendayuthapani Temple - Volunteer Registration
// Main Application Logic
// =====================================================

import { createClient } from '@supabase/supabase-js';

// =====================================================
// CONFIGURATION
// =====================================================

const SUPABASE_URL = 'https://zpqnoxllhbyggyxvvpaa.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_uXC8v4RM1HHCGEZKOnpbMg_seCrVNYo';

// =====================================================
// SUPABASE CLIENT
// =====================================================

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =====================================================
// STATE
// =====================================================

const state = {
  eventId: null,
  event: null,
  slots: [],
  selectedSlotIds: new Set(),
  selectedDate: null,
  isLoading: true,
  isSubmitting: false,
  shiftDefinitions: {} // Dynamic cache of shift metadata like icons
};

// =====================================================
// DOM ELEMENTS
// =====================================================

const elements = {
  // Common sections
  appContainer: document.getElementById('app'),
  eventListSection: document.getElementById('eventListSection'),
  registrationSection: document.getElementById('registrationSection'),
  publicEventsList: document.getElementById('publicEventsList'),
  backToEventsLink: document.getElementById('backToEventsLink'),
  headerTitle: document.querySelector('#registrationSection .header-title'),
  headerSubtitle: document.querySelector('#registrationSection .header-subtitle'),

  // Navigation
  dateStrip: document.getElementById('dateStrip'),
  datePrev: document.getElementById('datePrev'),
  dateNext: document.getElementById('dateNext'),

  // Shifts
  shiftsTitle: document.getElementById('shiftsTitle'),
  shiftsGrid: document.getElementById('shiftsGrid'),

  // Summary
  summarySection: document.getElementById('summarySection'),
  summaryList: document.getElementById('summaryList'),
  summaryCount: document.getElementById('summaryCount'),

  // Form
  formSection: document.getElementById('formSection'),
  registrationForm: document.getElementById('registrationForm'),
  fullNameInput: document.getElementById('fullName'),
  fullNameError: document.getElementById('fullNameError'),
  phoneInput: document.getElementById('phone'),
  phoneError: document.getElementById('phoneError'),
  emailInput: document.getElementById('email'),
  emailError: document.getElementById('emailError'),

  // Review
  reviewSection: document.getElementById('reviewSection'),
  reviewContent: document.getElementById('reviewContent'),

  // Feedback
  formGlobalError: document.getElementById('formGlobalError'),
  formGlobalErrorText: document.getElementById('formGlobalErrorText'),
  submitBtn: document.getElementById('submitBtn'),

  // Success
  successSection: document.getElementById('successSection'),
  successDetails: document.getElementById('successDetails'),
  successEmailNote: document.getElementById('successEmailNote'),
  registerAnotherBtn: document.getElementById('registerAnotherBtn')
};

// =====================================================
// UTILITIES
// =====================================================

function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const day = date.getDate();
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

function getDayAbbr(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

function getDayFull(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

function getDateNum(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.getDate();
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
}

/**
 * Generate dates based on event range or slots availability
 */
function getEventDates() {
  if (!state.slots.length) return [];
  // Extract unique dates from slots
  const dates = [...new Set(state.slots.map(s => s.date))].sort();
  return dates;
}

function getAvailabilityInfo(slot) {
  const remaining = slot.capacity - slot.registered_count;
  if (remaining <= 0) {
    return { text: 'FULL', class: 'full', dots: [false, false] };
  } else if (remaining === 1) {
    return { text: '1 spot left', class: 'limited', dots: [true, false] };
  } else {
    // Dynamic remaining count if not full
    const countText = remaining > 5 ? 'Available' : `${remaining} spots left`;
    return { text: countText, class: 'available', dots: [true, true] };
  }
}

function isSlotFull(slot) {
  return slot.registered_count >= slot.capacity;
}

function getSlotById(id) {
  return state.slots.find(s => s.id === id);
}

function getSlotsForDate(dateStr) {
  return state.slots.filter(s => s.date === dateStr).sort((a, b) => a.start_time.localeCompare(b.start_time));
}

function getShiftIcon(shiftName) {
  const lower = shiftName.toLowerCase();
  if (lower.includes('morning')) return '☀️';
  if (lower.includes('evening') || lower.includes('night')) return '🌙';
  if (lower.includes('afternoon')) return '🌤️';
  return '⏰';
}

// =====================================================
// EVENT LIST (No event_id in URL)
// =====================================================

async function loadAndShowEventList() {
  // Show event list section, hide registration
  elements.eventListSection.hidden = false;
  elements.registrationSection.hidden = true;

  try {
    const { data: events, error } = await supabase
      .from('events')
      .select('id, title, organization_name, dates_config, contact_person')
      .eq('active', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!events || events.length === 0) {
      elements.publicEventsList.innerHTML = `
        <div class="empty-state">
          <p>No upcoming volunteer opportunities at this time.</p>
          <p>Please check back later!</p>
        </div>`;
      return;
    }

    renderEventList(events);

  } catch (error) {
    console.error('Failed to load events:', error);
    elements.publicEventsList.innerHTML = `
      <div class="error-state">
        <p>Unable to load events. Please try again later.</p>
      </div>`;
  }
}

function renderEventList(events) {
  elements.publicEventsList.innerHTML = events.map(event => {
    const dates = event.dates_config || {};
    const dateRange = dates.start && dates.end
      ? `${formatDate(dates.start)} – ${formatDate(dates.end)}`
      : 'Dates TBA';

    return `
      <div class="event-list-card">
        <div class="event-list-content">
          <h3 class="event-list-title">${event.title}</h3>
          <p class="event-list-org">${event.organization_name || 'Temple'}</p>
          <p class="event-list-dates">📅 ${dateRange}</p>
        </div>
        <a href="?event_id=${event.id}" class="event-list-btn">Register →</a>
      </div>
    `;
  }).join('');
}

// =====================================================
// DATA FETCHING
// =====================================================

async function loadEventData() {
  state.isLoading = true;
  renderSkeletonCards(); // Show loading state

  try {
    let eventId = new URLSearchParams(window.location.search).get('event_id');

    if (!eventId) {
      // Show event list instead of registration form
      await loadAndShowEventList();
      return;
    }

    state.eventId = eventId;

    // Fetch details
    const { data, error } = await supabase.rpc('get_event_details', { p_event_id: eventId });
    if (error) throw error;

    // Bind data
    state.event = data.event;
    state.slots = data.slots || [];

    updatePageMetadata();

    state.isLoading = false;

    // Set initial selected date
    const dates = getEventDates();
    if (dates.length > 0) {
      state.selectedDate = dates[0];
    }

    renderDateStrip();
    renderShiftCards();

  } catch (error) {
    console.error('Failed to load event:', error);
    state.isLoading = false;
    elements.shiftsGrid.innerHTML = `<div class="error-state">
            <h3>Unable to load event</h3>
            <p>${error.message || 'Please check the link or contact the temple.'}</p>
        </div>`;
    elements.headerTitle.textContent = 'Volunteer Registration';
    elements.headerSubtitle.textContent = '';
  }
}

function updatePageMetadata() {
  if (!state.event) return;

  document.title = `${state.event.title} | Volunteer Registration`;
  elements.headerTitle.textContent = 'Volunteer Registration'; // Keep generic or use event title?
  // Design choice: Use Header Title for "Volunteer Registration" and Subtitle for Event Name?
  // Or Header Title = Event Name?
  // Admin HTML uses H1 "Volunteer Management", P "Sri Thendayuthapani Temple — Festival 2026"

  // Let's use:
  elements.headerTitle.textContent = state.event.title;
  elements.headerSubtitle.textContent = state.event.organization_name || 'Sri Thendayuthapani Temple';
}

// =====================================================
// RENDERING
// =====================================================

function renderDateStrip() {
  const dates = getEventDates();

  if (dates.length <= 1) {
    elements.dateStrip.parentElement.hidden = true; // Hide strip if 1 or 0 dates? 
    // Actually usually user wants to see the date context even if single. 
    // But if 0 dates, hide.
    if (dates.length === 0) return;
  }
  elements.dateStrip.parentElement.hidden = false;

  elements.dateStrip.innerHTML = dates.map(dateStr => {
    const isActive = dateStr === state.selectedDate;
    return `
      <button 
        class="date-btn ${isActive ? 'date-btn--active' : ''}"
        data-date="${dateStr}"
        role="tab"
        aria-selected="${isActive}"
        aria-label="${getDayFull(dateStr)}, ${formatDate(dateStr)}"
      >
        <span class="date-day">${getDayAbbr(dateStr)}</span>
        <span class="date-num">${getDateNum(dateStr)}</span>
      </button>
    `;
  }).join('');

  setTimeout(() => {
    const activeBtn = elements.dateStrip.querySelector('.date-btn--active');
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, 50);
}

function renderShiftCards() {
  if (state.isLoading) return; // Handled in loading state

  const dates = getEventDates();
  if (dates.length === 0) {
    elements.shiftsTitle.textContent = 'No shifts available.';
    elements.shiftsGrid.innerHTML = '';
    return;
  }

  const dateSlots = getSlotsForDate(state.selectedDate);
  elements.shiftsTitle.textContent = `Shifts for ${getDayFull(state.selectedDate)}, ${formatDate(state.selectedDate)}`;

  if (dateSlots.length === 0) {
    elements.shiftsGrid.innerHTML = `<p class="no-shifts">No shifts configured for this date.</p>`;
    return;
  }

  elements.shiftsGrid.innerHTML = dateSlots.map(slot => {
    const availability = getAvailabilityInfo(slot);
    const isSelected = state.selectedSlotIds.has(slot.id);
    const isFull = isSlotFull(slot) && !isSelected; // Allows unchecking if full but already selected (unlikely edge case but good UX)

    // Dynamic Icon
    const icon = getShiftIcon(slot.shift_name);
    const timeRange = `${formatTime(slot.start_time)} – ${formatTime(slot.end_time)}`;

    return `
      <div 
        class="shift-card ${isSelected ? 'shift-card--selected' : ''} ${isFull ? 'shift-card--full' : ''}"
        data-slot-id="${slot.id}"
        role="checkbox"
        aria-checked="${isSelected}"
        aria-disabled="${isFull}"
        tabindex="${isFull ? -1 : 0}"
      >
        <span class="shift-icon">${icon}</span>
        <span class="shift-name">${slot.shift_name}</span>
        <span class="shift-time">${timeRange}</span>
        <div class="shift-availability shift-availability--${availability.class}">
          <div class="availability-dots">
            ${availability.dots.map(filled =>
      `<span class="availability-dot ${!filled ? 'availability-dot--empty' : ''}"></span>`
    ).join('')}
          </div>
          <span>${availability.text}</span>
        </div>
        <div class="shift-check">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20,6 9,17 4,12"></polyline>
          </svg>
        </div>
      </div>
    `;
  }).join('');

  elements.shiftsGrid.querySelectorAll('.shift-card').forEach(card => {
    card.addEventListener('click', handleShiftCardClick);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleShiftCardClick(e);
      }
    });
  });
}

function renderSkeletonCards() {
  elements.shiftsTitle.textContent = 'Loading shifts...';
  elements.shiftsGrid.innerHTML = `
    <div class="shift-card skeleton">
      <div class="skeleton-icon"></div>
      <div class="skeleton-text"></div>\t
      <div class="skeleton-badge"></div>
    </div>
    <div class="shift-card skeleton">
      <div class="skeleton-icon"></div>
      <div class="skeleton-text"></div>
      <div class="skeleton-badge"></div>
    </div>
  `;
}

function renderSummary() {
  if (state.selectedSlotIds.size === 0) {
    elements.summarySection.hidden = true;
    elements.reviewSection.hidden = true;
    updateSubmitButton();
    return;
  }

  elements.summarySection.hidden = false;

  const selectedSlots = Array.from(state.selectedSlotIds)
    .map(id => getSlotById(id))
    .filter(Boolean)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.start_time.localeCompare(b.start_time);
    });

  elements.summaryList.innerHTML = selectedSlots.map(slot => {
    const timeRange = `${formatTime(slot.start_time)} – ${formatTime(slot.end_time)}`;
    return `
      <li class="summary-item" data-slot-id="${slot.id}">
        <div class="summary-item-info">
          <span class="summary-item-date">${getDayFull(slot.date)}, ${formatDate(slot.date)}</span>
          <span class="summary-item-shift">${slot.shift_name} (${timeRange})</span>
        </div>
        <button class="summary-item-remove" aria-label="Remove ${slot.shift_name} shift">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </li>
    `;
  }).join('');

  elements.summaryCount.textContent = selectedSlots.length;

  elements.summaryList.querySelectorAll('.summary-item-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const item = e.target.closest('.summary-item');
      state.selectedSlotIds.delete(item.dataset.slotId);
      renderShiftCards();
      renderSummary();
    });
  });

  updateReviewSection();
  updateSubmitButton();
}


function updateReviewSection() {
  const name = elements.fullNameInput.value.trim();
  const phone = elements.phoneInput.value.trim();
  const email = elements.emailInput.value.trim();

  if (state.selectedSlotIds.size === 0 || !name || !phone) {
    elements.reviewSection.hidden = true;
    return;
  }

  elements.reviewSection.hidden = false;

  const selectedSlots = Array.from(state.selectedSlotIds)
    .map(id => getSlotById(id))
    .filter(Boolean)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.start_time.localeCompare(b.start_time);
    });

  elements.reviewContent.innerHTML = `
    <p class="review-name">${name}</p>
    <p class="review-contact">
      📞 ${phone}
      ${email ? `<br>✉️ ${email}` : ''}
    </p>
    <p class="review-shifts-title">Selected Shifts:</p>
    <ul class="review-shifts-list">
      ${selectedSlots.map(slot => `
        <li class="review-shift-item">
          ${getDayFull(slot.date)}, ${formatDate(slot.date)} — ${slot.shift_name}
        </li>
      `).join('')}
    </ul>
  `;
}

function updateSubmitButton() {
  const name = elements.fullNameInput.value.trim();
  const phone = elements.phoneInput.value.trim();
  const hasValidEmail = !elements.emailInput.value.trim() || isValidEmail(elements.emailInput.value);
  const hasSlots = state.selectedSlotIds.size > 0;

  const isValid = name && phone && hasSlots && hasValidEmail && !state.isSubmitting;
  elements.submitBtn.disabled = !isValid;
}

function showSuccessState(registrationData) {
  elements.formSection.hidden = true;
  elements.summarySection.hidden = true;
  elements.successSection.hidden = false;

  const selectedSlots = Array.from(state.selectedSlotIds)
    .map(id => getSlotById(id))
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));

  elements.successDetails.innerHTML = `
    <p class="success-details-title">You're signed up for:</p>
    <ul class="success-details-list">
      ${selectedSlots.map(slot => `
        <li class="success-details-item">
          ${getDayFull(slot.date)}, ${formatDate(slot.date)} — ${slot.shift_name}
        </li>
      `).join('')}
    </ul>
  `;

  if (registrationData.email) {
    elements.successEmailNote.hidden = false;
  } else {
    elements.successEmailNote.hidden = true;
  }

  elements.successSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showGlobalError(message) {
  elements.formGlobalError.hidden = false;
  elements.formGlobalErrorText.textContent = message;
}

function hideGlobalError() {
  elements.formGlobalError.hidden = true;
  elements.formGlobalErrorText.textContent = '';
}

function showFieldError(inputEl, errorEl, message) {
  inputEl.classList.add('form-input--error');
  errorEl.textContent = message;
  errorEl.classList.add('visible');
}

function hideFieldError(inputEl, errorEl) {
  inputEl.classList.remove('form-input--error');
  errorEl.textContent = '';
  errorEl.classList.remove('visible');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}


// =====================================================
// EVENT HANDLERS
// =====================================================

function handleDateClick(e) {
  const btn = e.target.closest('.date-btn');
  if (!btn) return;

  const newDate = btn.dataset.date;
  if (newDate === state.selectedDate) return;

  state.selectedDate = newDate;
  renderDateStrip();
  renderShiftCards();
}

function handleShiftCardClick(e) {
  const card = e.target.closest('.shift-card');
  if (!card) return;

  const slotId = card.dataset.slotId;
  const slot = getSlotById(slotId);

  if (!slot || (isSlotFull(slot) && !state.selectedSlotIds.has(slotId))) return;

  if (state.selectedSlotIds.has(slotId)) {
    state.selectedSlotIds.delete(slotId);
  } else {
    state.selectedSlotIds.add(slotId);
  }

  renderShiftCards();
  renderSummary();
}

function handleDateNav(direction) {
  const dates = getEventDates();
  const currentIndex = dates.indexOf(state.selectedDate);
  const newIndex = currentIndex + direction;

  if (newIndex >= 0 && newIndex < dates.length) {
    state.selectedDate = dates[newIndex];
    renderDateStrip();
    renderShiftCards();
  }
}

function handleFormInput() {
  updateReviewSection();
  updateSubmitButton();
}

async function handleFormSubmit(e) {
  e.preventDefault();
  if (state.isSubmitting) return;

  hideGlobalError();
  // ... basic validation ...
  const name = elements.fullNameInput.value.trim();
  const phone = elements.phoneInput.value.trim();
  const email = elements.emailInput.value.trim();

  if (!name || !phone || state.selectedSlotIds.size === 0) return; // Should be handled by disable btn

  state.isSubmitting = true;
  elements.submitBtn.disabled = true;
  elements.submitBtn.querySelector('.submit-text').hidden = true; // Use existing loaders
  // Note: Check existing loader HTML structure in index.html to be safe
  // Assuming it exists as per previous code
  const loadingEl = elements.submitBtn.querySelector('.submit-loading');
  if (loadingEl) loadingEl.hidden = false;

  try {
    const slotIds = Array.from(state.selectedSlotIds);
    const { data, error } = await supabase.rpc('register_volunteer', {
      p_full_name: name,
      p_phone: phone,
      p_email: email || null,
      p_slot_ids: slotIds
    });

    if (error) throw error;

    if (!data.success) {
      if (data.unavailable_slots) {
        showGlobalError('Some selected slots are no longer available. Please review.');
        await loadEventData(); // Refresh to show current status
        // Remove bad slots
        data.unavailable_slots.forEach(u => {
          // Logic to find slot by custom matcher if needed
          // But here we rely on refresh. 
          const slot = state.slots.find(s => s.date === u.date && s.shift_name === u.shift);
          if (slot) state.selectedSlotIds.delete(slot.id);
        });
        renderShiftCards();
        renderSummary();
      } else {
        showGlobalError(data.error || 'Registration failed.');
      }
    } else {
      // Success
      if (email) {
        // Pass complete event details
        await sendConfirmationEmail(name, email, slotIds);
      }
      showSuccessState({ fullName: name, email });
      // Ideally we shouldn't rely on 'data.event_id' from RPC if we have it in state
    }

  } catch (e) {
    console.error(e);
    showGlobalError('An error occurred. Please try again.');
  } finally {
    state.isSubmitting = false;
    const loadingEl = elements.submitBtn.querySelector('.submit-loading');
    if (loadingEl) loadingEl.hidden = true;
    elements.submitBtn.querySelector('.submit-text').hidden = false;
    updateSubmitButton();
  }
}

async function sendConfirmationEmail(name, email, slotIds) {
  try {
    const slots = slotIds.map(id => getSlotById(id)).filter(Boolean);

    await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        type: 'confirmation', // function should handle this
        name,
        email,
        slots: slots.map(s => ({
          date: s.date,
          day_of_week: s.day_of_week || getDayAbbr(s.date),
          shift_name: s.shift_name,
          start_time: s.start_time,
          end_time: s.end_time
        })),
        event_details: {
          title: state.event.title,
          organization_name: state.event.organization_name,
          contact_person: state.event.contact_person,
          contact_whatsapp: state.event.contact_whatsapp
        }
      })
    });
  } catch (e) {
    console.error('Email error', e);
  }
}

function handleRegisterAnother() {
  state.selectedSlotIds.clear();
  elements.registrationForm.reset();
  elements.successSection.hidden = true;
  elements.formSection.hidden = false;
  elements.reviewSection.hidden = true;

  loadEventData(); // Refresh slots
  window.scrollTo({ top: 0, behavior: 'smooth' });
}


// =====================================================
// INITIALIZATION
// =====================================================

function init() {
  // Global Listeners
  elements.dateStrip.addEventListener('click', handleDateClick);
  elements.datePrev.addEventListener('click', () => handleDateNav(-1));
  elements.dateNext.addEventListener('click', () => handleDateNav(1));
  elements.fullNameInput.addEventListener('input', handleFormInput);
  elements.phoneInput.addEventListener('input', handleFormInput);
  elements.emailInput.addEventListener('input', handleFormInput);
  elements.registrationForm.addEventListener('submit', handleFormSubmit);
  elements.registerAnotherBtn.addEventListener('click', handleRegisterAnother);

  loadEventData();
}

init();
