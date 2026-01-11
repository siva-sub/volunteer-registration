// Shift Report Submission - report.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// DOM Elements
const elements = {
    loadingState: document.getElementById('loadingState'),
    errorState: document.getElementById('errorState'),
    errorMessage: document.getElementById('errorMessage'),
    submittedState: document.getElementById('submittedState'),
    successState: document.getElementById('successState'),
    reportForm: document.getElementById('reportForm'),
    volunteerName: document.getElementById('volunteerName'),
    shiftName: document.getElementById('shiftName'),
    shiftDate: document.getElementById('shiftDate'),
    salesItems: document.getElementById('salesItems'),
    totalAmount: document.getElementById('totalAmount'),
    notesInput: document.getElementById('notesInput'),
    submitBtn: document.getElementById('submitBtn'),
    notRequiredNotice: document.getElementById('notRequiredNotice')
};

// State
let state = {
    token: null,
    formData: null,
    salesItems: []
};

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
    const params = new URLSearchParams(window.location.search);
    state.token = params.get('token');

    if (!state.token) {
        showError('No token provided. Please use the link from your confirmation email.');
        return;
    }

    try {
        const { data, error } = await supabase.rpc('get_report_form', { p_token: state.token });

        if (error) throw error;

        if (!data.success) {
            if (data.already_submitted) {
                showState('submittedState');
            } else {
                showError(data.error || 'Unable to load report form.');
            }
            return;
        }

        state.formData = data;
        renderForm(data);

    } catch (error) {
        console.error('Error loading form:', error);
        showError('Failed to load report form. Please try again.');
    }
}

function renderForm(data) {
    // Populate header info
    elements.volunteerName.textContent = data.volunteer_name;
    elements.shiftName.textContent = data.shift_name;
    elements.shiftDate.textContent = formatDate(data.shift_date);

    // Show optional notice if not required
    if (!data.report_required) {
        elements.notRequiredNotice.hidden = false;
    }

    // Get sales items from config
    const salesConfig = data.sales_config || {};
    const items = salesConfig.items || [];

    if (items.length === 0) {
        // Standard shift - show simple confirmation
        elements.salesItems.innerHTML = `
      <div class="not-required-notice">
        <p>This is a standard shift. No sales report required.</p>
        <p style="margin-top: 8px;">You can optionally add notes below.</p>
      </div>
    `;
        document.querySelector('.total-section').hidden = true;
    } else {
        // Sales shift - show item inputs
        state.salesItems = items.map((item, index) => ({
            ...item,
            quantity: 0,
            amount: 0
        }));

        elements.salesItems.innerHTML = items.map((item, index) => `
      <div class="sales-item" data-index="${index}">
        <div class="sales-item-header">
          <span class="sales-item-name">${item.name}</span>
          <span class="sales-item-price">$${item.unit_price.toFixed(2)} each</span>
        </div>
        <div class="sales-item-inputs">
          <div class="sales-input-group">
            <label>Quantity Sold</label>
            <input type="number" class="qty-input" data-index="${index}" min="0" value="0">
          </div>
          <div class="sales-input-group">
            <label>Amount Collected ($)</label>
            <input type="number" class="amount-input" data-index="${index}" min="0" step="0.01" value="0.00">
          </div>
        </div>
      </div>
    `).join('');

        // Add event listeners
        document.querySelectorAll('.qty-input').forEach(input => {
            input.addEventListener('input', handleQuantityChange);
        });
        document.querySelectorAll('.amount-input').forEach(input => {
            input.addEventListener('input', updateTotal);
        });
    }

    // Setup submit button
    elements.submitBtn.addEventListener('click', handleSubmit);

    // Show form
    showState('reportForm');
}

function handleQuantityChange(e) {
    const index = parseInt(e.target.dataset.index);
    const qty = parseInt(e.target.value) || 0;
    const item = state.salesItems[index];

    // Auto-calculate expected amount
    const expectedAmount = qty * item.unit_price;

    // Update amount input
    const amountInput = document.querySelector(`.amount-input[data-index="${index}"]`);
    amountInput.value = expectedAmount.toFixed(2);

    // Update state
    state.salesItems[index].quantity = qty;
    state.salesItems[index].amount = expectedAmount;

    updateTotal();
}

function updateTotal() {
    let total = 0;
    document.querySelectorAll('.amount-input').forEach((input, index) => {
        const amount = parseFloat(input.value) || 0;
        state.salesItems[index].amount = amount;
        total += amount;
    });
    elements.totalAmount.textContent = total.toFixed(2);
}

async function handleSubmit() {
    elements.submitBtn.disabled = true;
    elements.submitBtn.textContent = 'Submitting...';

    try {
        // Build report data
        const reportData = {
            items_sold: state.salesItems.map(item => ({
                name: item.name,
                quantity: item.quantity || 0,
                unit_price: item.unit_price,
                amount: item.amount || 0
            })),
            total_amount: parseFloat(elements.totalAmount.textContent) || 0
        };

        const notes = elements.notesInput.value.trim() || null;

        const { data, error } = await supabase.rpc('submit_shift_report', {
            p_token: state.token,
            p_report_data: reportData,
            p_notes: notes
        });

        if (error) throw error;

        if (!data.success) {
            throw new Error(data.error || 'Failed to submit report');
        }

        showState('successState');

    } catch (error) {
        console.error('Submit error:', error);
        alert('Failed to submit report: ' + error.message);
        elements.submitBtn.disabled = false;
        elements.submitBtn.textContent = 'Submit Report';
    }
}

function showState(stateId) {
    ['loadingState', 'errorState', 'submittedState', 'successState', 'reportForm'].forEach(id => {
        document.getElementById(id).hidden = id !== stateId;
    });
}

function showError(message) {
    elements.errorMessage.textContent = message;
    showState('errorState');
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-SG', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}
