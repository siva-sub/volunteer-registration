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

// Festival dates: 17-30 January 2026
const FESTIVAL_START = new Date('2026-01-17');
const FESTIVAL_END = new Date('2026-01-30');

// Shift definitions
const SHIFTS = {
  Morning: { icon: '☀️', start: '8:00 AM', end: '12:00 PM' },
  Evening: { icon: '🌙', start: '5:30 PM', end: '8:30 PM' }
};

// =====================================================
// SUPABASE CLIENT
// =====================================================

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =====================================================
// STATE
// =====================================================

const state = {
  slots: [],
  selectedSlotIds: new Set(),
  selectedDate: null,
  isLoading: true,
  isSubmitting: false
};

// =====================================================
// DOM ELEMENTS
// =====================================================

const elements = {
  dateStrip: document.getElementById('dateStrip'),
  datePrev: document.getElementById('datePrev'),
  dateNext: document.getElementById('dateNext'),
  shiftsTitle: document.getElementById('shiftsTitle'),
  shiftsGrid: document.getElementById('shiftsGrid'),
  summarySection: document.getElementById('summarySection'),
  summaryList: document.getElementById('summaryList'),
  summaryCount: document.getElementById('summaryCount'),
  formSection: document.getElementById('formSection'),
  registrationForm: document.getElementById('registrationForm'),
  fullNameInput: document.getElementById('fullName'),
  fullNameError: document.getElementById('fullNameError'),
  phoneInput: document.getElementById('phone'),
  phoneError: document.getElementById('phoneError'),
  emailInput: document.getElementById('email'),
  emailError: document.getElementById('emailError'),
  reviewSection: document.getElementById('reviewSection'),
  reviewContent: document.getElementById('reviewContent'),
  formGlobalError: document.getElementById('formGlobalError'),
  formGlobalErrorText: document.getElementById('formGlobalErrorText'),
  submitBtn: document.getElementById('submitBtn'),
  successSection: document.getElementById('successSection'),
  successDetails: document.getElementById('successDetails'),
  successEmailNote: document.getElementById('successEmailNote'),
  registerAnotherBtn: document.getElementById('registerAnotherBtn')
};

// =====================================================
// UTILITIES
// =====================================================

/**
 * Format date for display
 */
function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const day = date.getDate();
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Get day of week abbreviation
 */
function getDayAbbr(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

/**
 * Get day of week full name
 */
function getDayFull(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

/**
 * Get date number
 */
function getDateNum(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.getDate();
}

/**
 * Generate all festival dates
 */
function generateFestivalDates() {
  const dates = [];
  const current = new Date(FESTIVAL_START);
  while (current <= FESTIVAL_END) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/**
 * Get availability text and class
 */
function getAvailabilityInfo(slot) {
  const remaining = slot.capacity - slot.registered_count;

  if (remaining === 0) {
    return {
      text: 'FULL',
      class: 'full',
      dots: [false, false]
    };
  } else if (remaining === 1) {
    return {
      text: '1 spot left',
      class: 'limited',
      dots: [true, false]
    };
  } else {
    return {
      text: '2 spots available',
      class: 'available',
      dots: [true, true]
    };
  }
}

/**
 * Check if slot is full
 */
function isSlotFull(slot) {
  return slot.registered_count >= slot.capacity;
}

/**
 * Get slot by ID
 */
function getSlotById(id) {
  return state.slots.find(s => s.id === id);
}

/**
 * Get slots for a specific date
 */
function getSlotsForDate(dateStr) {
  return state.slots.filter(s => s.date === dateStr);
}

// =====================================================
// DATA FETCHING
// =====================================================

/**
 * Fetch all shift slots from Supabase
 */
async function fetchSlots() {
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
    state.isLoading = false;

    return data;
  } catch (error) {
    console.error('Error fetching slots:', error);
    state.isLoading = false;
    showGlobalError('Unable to load shift availability. Please refresh the page.');
    return [];
  }
}

// =====================================================
// RENDERING
// =====================================================

/**
 * Render the date strip
 */
function renderDateStrip() {
  const dates = generateFestivalDates();

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

  // Scroll active date into view
  setTimeout(() => {
    const activeBtn = elements.dateStrip.querySelector('.date-btn--active');
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, 50);
}

/**
 * Render shift cards for selected date
 */
function renderShiftCards() {
  if (state.isLoading) {
    renderSkeletonCards();
    return;
  }

  const dateSlots = getSlotsForDate(state.selectedDate);
  elements.shiftsTitle.textContent = `Shifts for ${getDayFull(state.selectedDate)}, ${formatDate(state.selectedDate)}`;

  if (dateSlots.length === 0) {
    elements.shiftsGrid.innerHTML = `
      <p class="no-shifts">No shifts available for this date.</p>
    `;
    return;
  }

  elements.shiftsGrid.innerHTML = dateSlots.map(slot => {
    const shiftInfo = SHIFTS[slot.shift_name];
    const availability = getAvailabilityInfo(slot);
    const isSelected = state.selectedSlotIds.has(slot.id);
    const isFull = isSlotFull(slot);

    return `
      <div 
        class="shift-card ${isSelected ? 'shift-card--selected' : ''} ${isFull ? 'shift-card--full' : ''}"
        data-slot-id="${slot.id}"
        role="checkbox"
        aria-checked="${isSelected}"
        aria-disabled="${isFull}"
        tabindex="${isFull ? -1 : 0}"
      >
        <span class="shift-icon">${shiftInfo.icon}</span>
        <span class="shift-name">${slot.shift_name} Shift</span>
        <span class="shift-time">${shiftInfo.start} – ${shiftInfo.end}</span>
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

  // Attach click handlers
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

/**
 * Render skeleton loading state
 */
function renderSkeletonCards() {
  elements.shiftsTitle.textContent = 'Loading shifts...';
  elements.shiftsGrid.innerHTML = `
    <div class="shift-card skeleton">
      <div class="skeleton-icon"></div>
      <div class="skeleton-text"></div>
      <div class="skeleton-text short"></div>
      <div class="skeleton-badge"></div>
    </div>
    <div class="shift-card skeleton">
      <div class="skeleton-icon"></div>
      <div class="skeleton-text"></div>
      <div class="skeleton-text short"></div>
      <div class="skeleton-badge"></div>
    </div>
  `;
}

/**
 * Render selected shifts summary
 */
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
      return a.shift_name === 'Morning' ? -1 : 1;
    });

  elements.summaryList.innerHTML = selectedSlots.map(slot => {
    const shiftInfo = SHIFTS[slot.shift_name];
    return `
      <li class="summary-item" data-slot-id="${slot.id}">
        <div class="summary-item-info">
          <span class="summary-item-date">${getDayFull(slot.date)}, ${formatDate(slot.date)}</span>
          <span class="summary-item-shift">${slot.shift_name} Shift (${shiftInfo.start} – ${shiftInfo.end})</span>
        </div>
        <button class="summary-item-remove" aria-label="Remove ${slot.shift_name} shift on ${formatDate(slot.date)}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </li>
    `;
  }).join('');

  elements.summaryCount.textContent = selectedSlots.length;

  // Attach remove handlers
  elements.summaryList.querySelectorAll('.summary-item-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const item = e.target.closest('.summary-item');
      const slotId = item.dataset.slotId;
      state.selectedSlotIds.delete(slotId);
      renderShiftCards();
      renderSummary();
      updateReviewSection();
    });
  });

  updateReviewSection();
  updateSubmitButton();
}

/**
 * Update the review section
 */
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
      return a.shift_name === 'Morning' ? -1 : 1;
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
          ${getDayFull(slot.date)}, ${formatDate(slot.date)} — ${slot.shift_name} Shift
        </li>
      `).join('')}
    </ul>
  `;
}

/**
 * Update submit button state
 */
function updateSubmitButton() {
  const name = elements.fullNameInput.value.trim();
  const phone = elements.phoneInput.value.trim();
  const hasValidEmail = !elements.emailInput.value.trim() || isValidEmail(elements.emailInput.value);
  const hasSlots = state.selectedSlotIds.size > 0;

  const isValid = name && phone && hasSlots && hasValidEmail && !state.isSubmitting;
  elements.submitBtn.disabled = !isValid;
}

/**
 * Show success state
 */
function showSuccessState(registrationData) {
  elements.formSection.hidden = true;
  elements.summarySection.hidden = true;
  elements.successSection.hidden = false;

  const selectedSlots = Array.from(state.selectedSlotIds)
    .map(id => getSlotById(id))
    .filter(Boolean)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.shift_name === 'Morning' ? -1 : 1;
    });

  elements.successDetails.innerHTML = `
    <p class="success-details-title">You're signed up for:</p>
    <ul class="success-details-list">
      ${selectedSlots.map(slot => `
        <li class="success-details-item">
          ${getDayFull(slot.date)}, ${formatDate(slot.date)} — ${slot.shift_name} Shift
        </li>
      `).join('')}
    </ul>
  `;

  if (registrationData.email) {
    elements.successEmailNote.hidden = false;
  } else {
    elements.successEmailNote.hidden = true;
  }

  // Scroll to success section
  elements.successSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Show global error message
 */
function showGlobalError(message) {
  elements.formGlobalError.hidden = false;
  elements.formGlobalErrorText.textContent = message;
}

/**
 * Hide global error message
 */
function hideGlobalError() {
  elements.formGlobalError.hidden = true;
  elements.formGlobalErrorText.textContent = '';
}

/**
 * Show field error
 */
function showFieldError(inputEl, errorEl, message) {
  inputEl.classList.add('form-input--error');
  errorEl.textContent = message;
  errorEl.classList.add('visible');
}

/**
 * Hide field error
 */
function hideFieldError(inputEl, errorEl) {
  inputEl.classList.remove('form-input--error');
  errorEl.textContent = '';
  errorEl.classList.remove('visible');
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// =====================================================
// EVENT HANDLERS
// =====================================================

/**
 * Handle date button click
 */
function handleDateClick(e) {
  const btn = e.target.closest('.date-btn');
  if (!btn) return;

  const newDate = btn.dataset.date;
  if (newDate === state.selectedDate) return;

  state.selectedDate = newDate;
  renderDateStrip();
  renderShiftCards();
}

/**
 * Handle shift card click
 */
function handleShiftCardClick(e) {
  const card = e.target.closest('.shift-card');
  if (!card) return;

  const slotId = card.dataset.slotId;
  const slot = getSlotById(slotId);

  if (!slot || isSlotFull(slot)) return;

  if (state.selectedSlotIds.has(slotId)) {
    state.selectedSlotIds.delete(slotId);
  } else {
    state.selectedSlotIds.add(slotId);
  }

  renderShiftCards();
  renderSummary();
}

/**
 * Handle date navigation
 */
function handleDateNav(direction) {
  const dates = generateFestivalDates();
  const currentIndex = dates.indexOf(state.selectedDate);
  const newIndex = currentIndex + direction;

  if (newIndex >= 0 && newIndex < dates.length) {
    state.selectedDate = dates[newIndex];
    renderDateStrip();
    renderShiftCards();
  }
}

/**
 * Handle form input changes
 */
function handleFormInput() {
  updateReviewSection();
  updateSubmitButton();
}

/**
 * Handle form submission
 */
async function handleFormSubmit(e) {
  e.preventDefault();

  if (state.isSubmitting) return;

  // Clear previous errors
  hideGlobalError();
  hideFieldError(elements.fullNameInput, elements.fullNameError);
  hideFieldError(elements.phoneInput, elements.phoneError);
  hideFieldError(elements.emailInput, elements.emailError);

  // Validate
  const fullName = elements.fullNameInput.value.trim();
  const phone = elements.phoneInput.value.trim();
  const email = elements.emailInput.value.trim();

  let hasErrors = false;

  if (!fullName) {
    showFieldError(elements.fullNameInput, elements.fullNameError, 'Please enter your full name');
    hasErrors = true;
  }

  if (!phone) {
    showFieldError(elements.phoneInput, elements.phoneError, 'Please enter your phone number');
    hasErrors = true;
  }

  if (email && !isValidEmail(email)) {
    showFieldError(elements.emailInput, elements.emailError, 'Please enter a valid email address');
    hasErrors = true;
  }

  if (state.selectedSlotIds.size === 0) {
    showGlobalError('Please select at least one shift before registering.');
    hasErrors = true;
  }

  if (hasErrors) return;

  // Submit
  state.isSubmitting = true;
  elements.submitBtn.disabled = true;
  elements.submitBtn.querySelector('.submit-text').hidden = true;
  elements.submitBtn.querySelector('.submit-loading').hidden = false;

  try {
    const slotIds = Array.from(state.selectedSlotIds);

    // Call the atomic registration function
    const { data, error } = await supabase.rpc('register_volunteer', {
      p_full_name: fullName,
      p_phone: phone,
      p_email: email || null,
      p_slot_ids: slotIds
    });

    if (error) throw error;

    const result = data;

    if (!result.success) {
      // Handle specific error cases
      if (result.unavailable_slots && result.unavailable_slots.length > 0) {
        const unavailableText = result.unavailable_slots
          .map(s => `${s.date} (${s.shift})`)
          .join(', ');
        showGlobalError(
          `The following shift(s) are no longer available: ${unavailableText}. Please remove them and try again.`
        );

        // Refresh slots to get current availability
        await fetchSlots();

        // Remove unavailable slots from selection
        result.unavailable_slots.forEach(unavailable => {
          const slot = state.slots.find(s =>
            s.date === unavailable.date && s.shift_name === unavailable.shift
          );
          if (slot) {
            state.selectedSlotIds.delete(slot.id);
          }
        });

        renderShiftCards();
        renderSummary();
      } else {
        showGlobalError(result.error || 'Registration failed. Please try again.');
      }
    } else {
      // Success! Send confirmation email if email provided
      if (email) {
        await sendConfirmationEmail(fullName, email, slotIds);
      }

      showSuccessState({ fullName, phone, email });
    }
  } catch (error) {
    console.error('Registration error:', error);
    showGlobalError('Something went wrong. Please try again or contact the temple for assistance.');
  } finally {
    state.isSubmitting = false;
    elements.submitBtn.querySelector('.submit-text').hidden = false;
    elements.submitBtn.querySelector('.submit-loading').hidden = true;
    updateSubmitButton();
  }
}

/**
 * Send confirmation email via Edge Function
 */
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
        type: 'confirmation',
        name,
        email,
        slots: slots.map(s => ({
          date: s.date,
          day_of_week: s.day_of_week,
          shift_name: s.shift_name,
          start_time: s.start_time,
          end_time: s.end_time
        }))
      })
    });
  } catch (error) {
    console.error('Error sending confirmation email:', error);
    // Don't fail the registration if email fails
  }
}

/**
 * Handle register another button
 */
function handleRegisterAnother() {
  // Reset state
  state.selectedSlotIds.clear();

  // Reset form
  elements.registrationForm.reset();

  // Hide success, show form
  elements.successSection.hidden = true;
  elements.formSection.hidden = false;
  elements.reviewSection.hidden = true;

  // Refresh slots and re-render
  fetchSlots().then(() => {
    renderDateStrip();
    renderShiftCards();
    renderSummary();
  });

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =====================================================
// INITIALIZATION
// =====================================================

async function init() {
  // Set initial date to first festival date
  state.selectedDate = '2026-01-17';

  // Render initial UI
  renderDateStrip();
  renderSkeletonCards();

  // Attach event listeners
  elements.dateStrip.addEventListener('click', handleDateClick);
  elements.datePrev.addEventListener('click', () => handleDateNav(-1));
  elements.dateNext.addEventListener('click', () => handleDateNav(1));

  elements.fullNameInput.addEventListener('input', handleFormInput);
  elements.phoneInput.addEventListener('input', handleFormInput);
  elements.emailInput.addEventListener('input', handleFormInput);

  elements.registrationForm.addEventListener('submit', handleFormSubmit);
  elements.registerAnotherBtn.addEventListener('click', handleRegisterAnother);

  // Fetch data
  await fetchSlots();

  // Render with data
  renderShiftCards();
  renderSummary();
}

// Start the app
init();
