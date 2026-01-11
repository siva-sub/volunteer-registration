# Remaining Implementation Work - Phases 2B-4N

## Completed ✅
- Event templates seed SQL (`event_templates_seed.sql`)
- Template dropdown in Create Event modal
- `eventTemplate` DOM element in admin.js
- Build verification passed

## Remaining Tasks

### 1. Admin.js - Template Functionality
**File:** `src/admin.js`

Add after line 300 (in EVENTS MANAGEMENT section):
```javascript
// Load event templates
async function loadEventTemplates() {
  try {
    const { data, error } = await supabase
      .from('event_templates')
      .select('*')
      .order('category', { ascending: true });
    
    if (error) throw error;
    
    state.templates = data || [];
    
    // Populate dropdown
    elements.eventTemplate.innerHTML = '<option value="">-- Custom Event --</option>';
    data.forEach(tpl => {
      const option = document.createElement('option');
      option.value = tpl.id;
      option.textContent = `${tpl.icon || ''} ${tpl.name}`;
      option.dataset.category = tpl.category;
      elements.eventTemplate.appendChild(option);
    });
  } catch (error) {
    console.error('Failed to load templates:', error);
  }
}

// Template selection handler
elements.eventTemplate.addEventListener('change', async (e) => {
  const templateId = e.target.value;
  if (!templateId) return;
  
  const template = state.templates.find(t => t.id === templateId);
  if (!template) return;
  
  // Apply template default settings
  const settings = template.default_settings || {};
  elements.feedbackEnabled.checked = settings.feedback_enabled !== false;
  elements.certificatesEnabled.checked = settings.certificates_enabled !== false;
  elements.eventPaused.checked = settings.paused === true;
});
```

Call `loadEventTemplates()` in `openCreateEventModal()` function.

Modify `handleCreateEventSubmit()` to apply template after event creation:
```javascript
// After event created successfully
if (elements.eventTemplate.value) {
  // Get date range
  const startDate = elements.eventStartDate.value;
  const endDate = elements.eventEndDate.value;
  const dates = getDateRange(startDate, endDate);
  
  // Apply template for each date
  for (const date of dates) {
    await supabase.rpc('apply_event_template', {
      p_event_id: eventData.id,
      p_template_id: elements.eventTemplate.value,
      p_date: date
    });
  }
}
```

Add helper function:
```javascript
function getDateRange(start, end) {
  const dates = [];
  const current = new Date(start);
  const last = new Date(end);
  
  while (current <= last) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}
```

---

### 2. Public Form - Station Display
**File:** `src/main.js`

Find `renderShiftCards()` function (around line 250-300).

Update shift card HTML to include station badge if present:
```javascript
${slot.station ? `<span class="shift-badge shift-badge--station">${slot.station}</span>` : ''}
```

Add to CSS (`src/styles.css`):
```css
.shift-badge--station {
  background: var(--color-accent);
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}
```

---

### 3. Public Form - Waitlist Button
**File:** `src/main.js`

Update shift card to show "Join Waitlist" when full:
```javascript
const isFull = slot.registered_count >= slot.capacity;

// In render function
${isFull ? `
  <button class="join-waitlist-btn" data-slot-id="${slot.id}">
    Join Waitlist
  </button>
` : `
  <input type="checkbox"...>
`}
```

Add waitlist modal HTML to `index.html`:
```html
<div id="waitlistModal" class="modal" hidden>
  <div class="modal-content">
    <h3>Join Waitlist</h3>
    <form id="waitlistForm">
      <input type="text" id="waitlistName" placeholder="Full Name" required>
      <input type="tel" id="waitlistPhone" placeholder="Phone" required>
      <input type="email" id="waitlistEmail" placeholder="Email (optional)">
      <button type="submit">Join Waitlist</button>
    </form>
  </div>
</div>
```

Add handler in `main.js`:
```javascript
async function handleJoinWaitlist(slotId) {
  // Show modal, collect details
  const { data, error } = await supabase.rpc('join_waitlist', {
    p_slot_id: slotId,
    p_name: name,
    p_phone: phone,
    p_email: email
  });
  
  if (data.success) {
    alert(`You're #${data.position} on the waitlist!`);
  }
}
```

---

### 4. Email Function - Add Links
**File:** `supabase/functions/send-email/index.ts`

Update confirmation email template to include:
```typescript
const cancelLink = `${SITE_URL}/cancel.html?token=${registration.cancel_token}`;
const checkinLinks = slots.map(s => 
  `${SITE_URL}/checkin.html?token=${s.checkin_token}`
);

// Add to email body
<p><a href="${cancelLink}">Cancel Registration</a></p>
<p>Check-in links: ...</p>
```

---

### 5. Admin - Check-in Settings
**File:** `admin/index.html`, `src/admin.js`

Add to slot modal:
```html
<div class="form-group">
  <label>
    <input type="checkbox" id="slotCheckinRequired">
    Require volunteer check-in
  </label>
</div>
```

---

### 6. Admin - Feedback Questions Manager
**File:** `admin/index.html`, `src/admin.js`

Add new section to event dashboard:
```html
<section id="feedbackSection">
  <h3>Feedback Questions</h3>
  <button id="addQuestionBtn">Add Question</button>
  <div id="questionsList"></div>
</section>
```

Implement CRUD for feedback_questions table.

---

## Database Migration
Apply to Supabase SQL Editor:
1. `supabase/migration_phase3_4.sql` (remaining RPCs)
2. `supabase/event_templates_seed.sql`

---

## Testing Checklist
- [ ] Create event from template → verify slots generated
- [ ] Full slot shows waitlist button
- [ ] Station badge displays on shift cards
- [ ] Email includes cancel/check-in links
- [ ] Feedback questions can be configured

---

## Priority Order
1. Apply database migrations first
2. Complete admin template functionality
3. Add station display (quick win)
4. Waitlist UI
5. Email updates
6. Check-in/feedback admin UI
