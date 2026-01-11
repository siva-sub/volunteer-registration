// =====================================================
// Volunteer Check-in Page
// =====================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zpqnoxllhbyggyxvvpaa.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_uXC8v4RM1HHCGEZKOnpbMg_seCrVNYo';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
                showSection(elements.successSection);
                break;

            case 'already_checked_in':
                elements.alreadyName.textContent = data.volunteer_name;
                elements.alreadyTime.textContent = `You checked in at ${formatDateTime(data.checked_in_at)}`;
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
                showSection(elements.lateSection);
                break;

            case 'not_required':
                elements.shiftInfo.textContent = 'Check-in Not Required';
                elements.volunteerName.textContent = 'This shift does not require check-in.';
                elements.checkInTime.textContent = '';
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

init();
