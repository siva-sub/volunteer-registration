
function renderIntroCard() {
    if (!state.event) return;

    const event = state.event;

    // 1. Title
    elements.introTitle.textContent = `${event.title} Volunteer Sign-up`;

    // 2. Text
    const dates = event.dates_config || {};
    const dateRange = dates.start && dates.end
        ? `${formatDateLong(dates.start)} – ${formatDateLong(dates.end)}`
        : 'Upcoming Dates';

    elements.introText.innerHTML = `
    Thank you for your interest in serving at <strong>${event.organization_name || 'the temple'}</strong> 
    during <strong>${dateRange}</strong>. 
    ${event.description || 'Volunteers help serve devotees — a meaningful act of service.'}
  `;

    // 3. Shifts Details
    // Analyze slots to find unique shift patterns (Start-End)
    const shiftPatterns = new Map();
    // We want to find unique shift names + times
    state.slots.forEach(slot => {
        const key = `${slot.start_time}-${slot.end_time}`;
        if (!shiftPatterns.has(key)) {
            shiftPatterns.set(key, {
                name: slot.shift_name, // e.g., "Morning Shift"
                start: slot.start_time,
                end: slot.end_time,
                icon: getShiftIcon(slot.shift_name)
            });
        }
    });

    const patterns = Array.from(shiftPatterns.values());

    // Sort by start time
    patterns.sort((a, b) => a.start.localeCompare(b.start));

    if (patterns.length > 0) {
        elements.introDetails.innerHTML = patterns.map(p => `
        <div class="intro-detail">
          <span class="detail-icon">${p.icon}</span>
          <div>
            <strong>${p.name}</strong>
            <span>${formatTime(p.start)} – ${formatTime(p.end)}</span>
          </div>
        </div>
      `).join('');
    } else {
        elements.introDetails.innerHTML = '<p><em>No shifts configured yet.</em></p>';
    }

    // 4. Note (Capacity)
    // Find max capacity?
    const maxCap = state.slots.length > 0
        ? Math.max(...state.slots.map(s => s.capacity))
        : 0;

    elements.introNote.innerHTML = `
    Each shift can accommodate up to <strong>${maxCap} volunteers</strong>.
    You may sign up for multiple shifts across different days.
  `;
}

function formatDateLong(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(timeStr) {
    if (!timeStr) return '';
    // timeStr is HH:MM:SS
    const [h, m] = timeStr.split(':');
    const date = new Date();
    date.setHours(parseInt(h), parseInt(m));
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}
