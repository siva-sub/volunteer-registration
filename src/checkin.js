// =====================================================
// Volunteer Check-in Page
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
    shiftInfo: document.getElementById('shiftInfo'),
    loadingSection: document.getElementById('loadingSection'),
    successSection: document.getElementById('successSection'),
    volunteerName: document.getElementById('volunteerName'),
    checkInTime: document.getElementById('checkInTime'),
    earlySection: document.getElementById('earlySection'),
    earlyName: document.getElementById('earlyName'),
    opensAt: document.getElementById('opensAt'),
    lateSection: document.getElementById('lateSection'),
    lateName: document.getElementById('lateName'),
    closedAt: document.getElementById('closedAt'),
    alreadySection: document.getElementById('alreadySection'),
    alreadyName: document.getElementById('alreadyName'),
    alreadyTime: document.getElementById('alreadyTime'),
    errorSection: document.getElementById('errorSection'),
    errorTitle: document.getElementById('errorTitle'),
    errorMessage: document.getElementById('errorMessage')
};

function showSection(section) {
    elements.loadingSection.hidden = true;
    elements.successSection.hidden = true;
    elements.earlySection.hidden = true;
    elements.lateSection.hidden = true;
    elements.alreadySection.hidden = true;
    elements.errorSection.hidden = true;

    section.hidden = false;
}

function formatDateTime(timestamp) {
    return new Date(timestamp).toLocaleString('en-SG', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

async function init() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
        elements.errorTitle.textContent = 'Missing Token';
        elements.errorMessage.textContent = 'No check-in token provided.';
        showSection(elements.errorSection);
        return;
    }

    try {
        const { data, error } = await supabase.rpc('check_in', { p_token: token });

        if (error) throw error;

        switch (data.status) {
            case 'success':
                elements.volunteerName.textContent = `Welcome, ${data.volunteer_name}!`;
                elements.checkInTime.textContent = `Checked in at ${formatDateTime(data.checked_in_at)}`;
                elements.shiftInfo.textContent = `${data.shift_date} - ${data.shift_name}`;
                addFeedbackButton(elements.successSection, token, data); // Add button
                renderSalesInfo(data);
                showSection(elements.successSection);
                break;

            case 'already_checked_in':
                elements.alreadyName.textContent = data.volunteer_name;
                elements.alreadyTime.textContent = `You checked in at ${formatDateTime(data.checked_in_at)}`;
                addFeedbackButton(elements.alreadySection, token, data); // Add button
                renderSalesInfo(data);
                showSection(elements.alreadySection);
                break;

            case 'too_early':
                elements.earlyName.textContent = `Hello, ${data.volunteer_name}`;
                elements.opensAt.textContent = formatDateTime(data.opens_at);
                showSection(elements.earlySection);
                break;

            case 'too_late':
                elements.lateName.textContent = data.volunteer_name;
                elements.closedAt.textContent = formatDateTime(data.closed_at);
                addFeedbackButton(elements.lateSection, token, data); // Add button (in case they worked but forgot to check in)
                showSection(elements.lateSection);
                break;

            case 'not_required':
                elements.shiftInfo.textContent = 'Check-in Not Required';
                elements.volunteerName.textContent = 'This shift does not require check-in.';
                elements.checkInTime.textContent = '';
                addFeedbackButton(elements.successSection, token, data);
                renderSalesInfo(data);
                showSection(elements.successSection);
                break;

            default:
                elements.errorTitle.textContent = 'Error';
                elements.errorMessage.textContent = data.error || 'Unknown error occurred';
                showSection(elements.errorSection);
        }

    } catch (error) {
        console.error('Check-in error:', error);
        elements.errorTitle.textContent = 'Error';
        elements.errorMessage.textContent = error.message || 'Failed to process check-in';
        showSection(elements.errorSection);
    }
}

function renderSalesInfo(data) {
    const section = document.getElementById('salesSection');
    const list = document.getElementById('salesList');
    if (!section || !list) return;

    if (data.sales_config && data.sales_config.items && data.sales_config.items.length > 0) {
        section.hidden = false;
        list.innerHTML = data.sales_config.items.map(item => `
            <div style="display: flex; justify-content: space-between; padding: 8px; background: #fff; border-radius: 4px; border: 1px solid #eee;">
                <span style="font-weight: 500;">${item.name}</span>
                <span style="font-weight: 600; color: var(--color-primary);">$${parseFloat(item.price).toFixed(2)}</span>
            </div>
        `).join('');
    } else {
        section.hidden = true;
    }
}

function addFeedbackButton(container, token, data) {
    const card = container.querySelector('.success-card, .info-card, .warning-card');
    if (!card) return;

    // Avoid duplicates
    if (card.querySelector('.feedback-link-btn')) return;

    // 1. Report Button (If required & allowed)
    // Show if: (Report Required) AND ( (I am Leader) OR (No Leader Exists) )
    const canSubmitReport = data && data.report_required && (data.is_shift_leader || !data.leader_exists);

    if (canSubmitReport) {
        const reportBtn = document.createElement('a');
        reportBtn.href = `/volunteer-registration/report.html?token=${token}`;
        reportBtn.className = 'action-btn action-btn--primary'; // Stand out
        reportBtn.style.marginTop = '20px';
        reportBtn.textContent = '📝 Submit Shift Report';
        card.appendChild(reportBtn);
    }

    // 2. Feedback Button
    const feedbackBtn = document.createElement('a');
    feedbackBtn.href = `/volunteer-registration/feedback.html?token=${token}`;
    feedbackBtn.className = 'action-btn action-btn--outline feedback-link-btn';
    feedbackBtn.style.marginTop = '10px';
    feedbackBtn.style.display = 'block'; // Ensure separate line
    feedbackBtn.textContent = 'Give Feedback (opens after shift)';

    card.appendChild(feedbackBtn);
}

init();
