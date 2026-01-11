// =====================================================
// Volunteer Feedback Page
// =====================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zpqnoxllhbyggyxvvpaa.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_uXC8v4RM1HHCGEZKOnpbMg_seCrVNYo';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: false
    }
});

const elements = {
    eventTitle: document.getElementById('eventTitle'),
    shiftInfo: document.getElementById('shiftInfo'),
    loadingSection: document.getElementById('loadingSection'),
    feedbackSection: document.getElementById('feedbackSection'),
    volunteerName: document.getElementById('volunteerName'),
    feedbackForm: document.getElementById('feedbackForm'),
    questionsContainer: document.getElementById('questionsContainer'),
    submitBtn: document.getElementById('submitBtn'),
    successSection: document.getElementById('successSection'),
    alreadySection: document.getElementById('alreadySection'),
    earlySection: document.getElementById('earlySection'), // New
    errorSection: document.getElementById('errorSection'),
    errorTitle: document.getElementById('errorTitle'),
    errorMessage: document.getElementById('errorMessage')
};

let feedbackToken = null;

function showSection(section) {
    elements.loadingSection.hidden = true;
    elements.feedbackSection.hidden = true;
    elements.successSection.hidden = true;
    elements.alreadySection.hidden = true;
    elements.errorSection.hidden = true;

    section.hidden = false;
}

function renderStarsInput(questionId, required) {
    return `
    <div class="stars-input" data-question-id="${questionId}">
      ${[1, 2, 3, 4, 5].map(n => `
        <button type="button" class="star-btn" data-value="${n}" title="${n} star${n > 1 ? 's' : ''}">★</button>
      `).join('')}
      <input type="hidden" name="q_${questionId}" ${required ? 'required' : ''}>
    </div>
  `;
}

function renderFreeformInput(questionId, required) {
    return `
    <textarea 
      name="q_${questionId}" 
      class="form-textarea" 
      rows="3" 
      placeholder="Your answer..."
      ${required ? 'required' : ''}
    ></textarea>
  `;
}

function renderQuestion(question) {
    let inputHtml = '';

    switch (question.question_type) {
        case 'stars':
            inputHtml = renderStarsInput(question.id, question.required);
            break;
        case 'freeform':
            inputHtml = renderFreeformInput(question.id, question.required);
            break;
        default:
            inputHtml = renderFreeformInput(question.id, question.required);
    }

    return `
    <div class="feedback-question" data-question-id="${question.id}">
      <label class="feedback-label">
        ${question.question_text}
        ${question.required ? '<span class="required">*</span>' : ''}
      </label>
      ${inputHtml}
    </div>
  `;
}

function setupStarsInteraction() {
    document.querySelectorAll('.stars-input').forEach(container => {
        const buttons = container.querySelectorAll('.star-btn');
        const hiddenInput = container.querySelector('input[type="hidden"]');

        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const value = parseInt(btn.dataset.value);
                hiddenInput.value = value;

                buttons.forEach((b, i) => {
                    b.classList.toggle('active', i < value);
                });
            });
        });
    });
}

async function init() {
    const params = new URLSearchParams(window.location.search);
    feedbackToken = params.get('token');

    if (!feedbackToken) {
        elements.errorTitle.textContent = 'Missing Token';
        elements.errorMessage.textContent = 'No feedback token provided.';
        showSection(elements.errorSection);
        return;
    }

    try {
        const { data, error } = await supabase.rpc('get_feedback_form', { p_token: feedbackToken });

        if (error) throw error;

        if (!data.success) {
            if (data.already_submitted) {
                showSection(elements.alreadySection);
            } else {
                elements.errorTitle.textContent = 'Error';
                elements.errorMessage.textContent = data.error || 'Failed to load feedback form';
                showSection(elements.errorSection);
            }
            return;
        }

        // Time Gating Check
        const shiftEndAt = new Date(data.shift_end_at);
        const now = new Date();

        if (now < shiftEndAt) {
            // Too Early
            elements.earlySection.hidden = false;
            elements.loadingSection.hidden = true;
            document.getElementById('opensAt').textContent = shiftEndAt.toLocaleString('en-SG', {
                weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true
            });
            return;
        }

        // Render form
        elements.eventTitle.textContent = data.event_title || 'Volunteer Feedback';
        elements.shiftInfo.textContent = `${data.shift_date} - ${data.shift_name}`;
        elements.volunteerName.textContent = data.volunteer_name;

        if (!data.questions || data.questions.length === 0) {
            elements.questionsContainer.innerHTML = '<p>No feedback questions configured for this event.</p>';
        } else {
            elements.questionsContainer.innerHTML = data.questions.map(renderQuestion).join('');
            setupStarsInteraction();
        }

        showSection(elements.feedbackSection);

    } catch (error) {
        console.error('Error loading feedback:', error);
        elements.errorTitle.textContent = 'Error';
        elements.errorMessage.textContent = error.message || 'Failed to load feedback form';
        showSection(elements.errorSection);
    }
}

async function handleSubmit(e) {
    e.preventDefault();

    elements.submitBtn.disabled = true;
    elements.submitBtn.textContent = 'Submitting...';

    // Collect responses
    const responses = [];
    const formData = new FormData(elements.feedbackForm);

    for (const [key, value] of formData.entries()) {
        if (key.startsWith('q_') && value) {
            const questionId = key.replace('q_', '');
            responses.push({ question_id: questionId, value: value.toString() });
        }
    }

    try {
        const { data, error } = await supabase.rpc('submit_feedback', {
            p_token: feedbackToken,
            p_responses: responses
        });

        if (error) throw error;

        if (!data.success) {
            throw new Error(data.error || 'Failed to submit feedback');
        }

        showSection(elements.successSection);

    } catch (error) {
        console.error('Submit error:', error);
        alert('Failed to submit: ' + error.message);
        elements.submitBtn.disabled = false;
        elements.submitBtn.textContent = 'Submit Feedback';
    }
}

elements.feedbackForm.addEventListener('submit', handleSubmit);

init();
