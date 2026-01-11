// Shift Report Submission - report.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        persistSession: false
    }
});

// DOM Elements
const elements = {
    loadingState: document.getElementById('loadingState'),
    errorState: document.getElementById('errorState'),
    errorMessage: document.getElementById('errorMessage'),
    submittedState: document.getElementById('submittedState'),
    successState: document.getElementById('successState'),
    reportForm: document.getElementById('reportForm'),

    // Header
    volunteerName: document.getElementById('volunteerName'),
    shiftName: document.getElementById('shiftName'),
    shiftDate: document.getElementById('shiftDate'),
    notRequiredNotice: document.getElementById('notRequiredNotice'),

    // Sales
    salesItems: document.getElementById('salesItems'),

    // Cash
    startFloat: document.getElementById('startFloat'),
    expectedSalesDisplay: document.getElementById('expectedSalesDisplay'),
    expectedTotal: document.getElementById('expectedTotal'),
    actualCash: document.getElementById('actualCash'),
    reconcileStatus: document.getElementById('reconcileStatus'),

    // Footer
    notesInput: document.getElementById('notesInput'),
    submitBtn: document.getElementById('submitBtn')
};

// State
let state = {
    token: null,
    formData: null,
    salesItems: [],
    startFloat: 0,
    expectedSales: 0,
    actualCash: 0,
    discrepancy: 0
};

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

        // 1. Check Leader Permission Block
        if (data.is_non_leader_block) {
            showError('Restricted: designated Shift Leaders must submit the report.');
            return;
        }

        if (!data.success) {
            if (data.already_submitted) {
                showState('submittedState');
            } else {
                showError(data.error || 'Unable to load report form.');
            }
            return;
        }

        // 2. Time Gating Check (Reuse feedback logic)
        const shiftEndAt = new Date(data.shift_end_at);
        const now = new Date();
        // Allow reports 15 mins BEFORE shift ends (unlike feedback) or strict?
        // Let's stick to strict end check to be safe, or maybe allow if it's close.
        // User requested "same time gated"
        if (now < shiftEndAt) {
            // Re-use error state for simplicity or create new one
            elements.errorState.innerHTML = `
                <div class="error-card">
                    <div class="error-icon">⏰</div>
                    <h3>Report Not Open Yet</h3>
                    <p class="error-details">Please return after your shift ends at ${formatTime(shiftEndAt)}.</p>
                     <a href="/" class="register-another-btn" style="display:inline-block;margin-top:20px;text-decoration:none;">Return Home</a>
                </div>
            `;
            showState('errorState');
            return;
        }

        state.formData = data;
        state.startFloat = data.float_amount || 0;

        renderForm(data);

    } catch (error) {
        console.error('Error loading form:', error);
        showError('Failed to load report form. Please try again.');
    }
}

function renderForm(data) {
    elements.volunteerName.textContent = data.volunteer_name;
    elements.shiftName.textContent = data.shift_name;
    elements.shiftDate.textContent = formatDate(data.shift_date);

    if (!data.report_required) {
        elements.notRequiredNotice.hidden = false;
    }

    // Init Values
    elements.startFloat.value = state.startFloat.toFixed(2);

    // Sales Items
    const salesConfig = data.sales_config || {};
    const items = salesConfig.items || [];

    if (items.length === 0) {
        elements.salesItems.innerHTML = '<p class="text-muted">No sales items configured for this shift.</p>';
        state.salesItems = [];
    } else {
        state.salesItems = items.map(item => ({ ...item, quantity: 0, amount: 0 }));

        elements.salesItems.innerHTML = items.map((item, index) => `
            <div class="report-sales-item" data-index="${index}">
                <div class="report-sales-header">
                    <span class="report-item-name">${item.name}</span>
                    <span class="report-item-price">$${item.unit_price.toFixed(2)}</span>
                </div>
                <div class="report-item-inputs">
                    <div class="report-input-group">
                        <label>Qty Sold</label>
                        <input type="number" class="qty-input" data-index="${index}" min="0" value="0">
                    </div>
                    <div class="report-input-group">
                        <label>Total ($)</label>
                        <input type="number" class="amount-input" data-index="${index}" min="0" step="0.01" value="0.00">
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Event Listeners
    elements.startFloat.addEventListener('input', (e) => {
        state.startFloat = parseFloat(e.target.value) || 0;
        recalculate();
    });

    elements.salesItems.addEventListener('input', (e) => {
        if (e.target.classList.contains('qty-input')) {
            const idx = e.target.dataset.index;
            const qty = parseInt(e.target.value) || 0;
            const item = state.salesItems[idx];

            // Auto-calc amount
            const amt = qty * item.unit_price;
            document.querySelector(`.amount-input[data-index="${idx}"]`).value = amt.toFixed(2);

            state.salesItems[idx].quantity = qty;
            state.salesItems[idx].amount = amt;
            recalculate();
        }
        else if (e.target.classList.contains('amount-input')) {
            const idx = e.target.dataset.index;
            const amt = parseFloat(e.target.value) || 0;
            state.salesItems[idx].amount = amt;
            recalculate();
        }
    });

    elements.actualCash.addEventListener('input', (e) => {
        state.actualCash = parseFloat(e.target.value) || 0;
        recalculate();
    });

    elements.submitBtn.addEventListener('click', handleSubmit);

    recalculate(); // Initial state
    showState('reportForm');
}

function recalculate() {
    // 1. Calc Sales Total
    state.expectedSales = state.salesItems.reduce((sum, item) => sum + item.amount, 0);
    elements.expectedSalesDisplay.textContent = `$${state.expectedSales.toFixed(2)}`;

    // 2. Calc Expected Total (Float + Sales)
    const expectedTotal = state.startFloat + state.expectedSales;
    elements.expectedTotal.textContent = `$${expectedTotal.toFixed(2)}`;

    // 3. Calc Discrepancy
    state.discrepancy = state.actualCash - expectedTotal;

    // 4. Update UI Status
    updateReconcileStatus(state.discrepancy, expectedTotal);
}

function updateReconcileStatus(diff, total) {
    const statusEl = elements.reconcileStatus;
    statusEl.hidden = false;

    // Tolerance for floating point math
    const isMatch = Math.abs(diff) < 0.01;

    if (total === 0 && state.actualCash === 0) {
        statusEl.innerHTML = 'Please enter amounts.';
        statusEl.className = 'info-note';
        return;
    }

    if (isMatch) {
        statusEl.className = 'success-note'; // Define css or inline
        statusEl.style.backgroundColor = '#e6fffa';
        statusEl.style.color = '#047857';
        statusEl.style.border = '1px solid #a7f3d0';
        statusEl.innerHTML = '✅ <strong>Perfect Match!</strong> Amounts tally.';
    } else {
        const isShort = diff < 0;
        const color = Math.abs(diff) > 10 ? '#ef4444' : '#f59e0b'; // Red if big error, yellow if small
        const bg = Math.abs(diff) > 10 ? '#fef2f2' : '#fffbeb';

        statusEl.className = 'warning-note';
        statusEl.style.backgroundColor = bg;
        statusEl.style.color = '#b45309'; // text-amber-700
        statusEl.style.border = `1px solid ${color}`;

        statusEl.innerHTML = `
            <div style="font-weight:600; color: ${color}">
                ⚠️ Discrepancy: ${isShort ? 'Short' : 'Over'} by $${Math.abs(diff).toFixed(2)}
            </div>
            <div style="font-size: 0.9em; margin-top: 4px;">
                Please re-count or explain the difference in the notes below. 
                (You can still submit)
            </div>
        `;
    }
}

async function handleSubmit() {
    elements.submitBtn.disabled = true;
    elements.submitBtn.textContent = 'Submitting...';

    try {
        const reportData = {
            items_sold: state.salesItems.map(i => ({
                name: i.name,
                quantity: i.quantity,
                unit_price: i.unit_price,
                amount: i.amount
            })),
            total_sales: state.expectedSales
        };

        const notes = elements.notesInput.value.trim();

        const { data, error } = await supabase.rpc('submit_shift_report', {
            p_token: state.token,
            p_report_data: reportData,
            p_notes: notes,
            p_start_float: state.startFloat,
            p_end_cash: state.actualCash,
            p_discrepancy: state.discrepancy
        });

        if (error) throw error;

        // Success
        showState('successState');

    } catch (error) {
        console.error('Submit error:', error);
        alert('Error: ' + error.message);
        elements.submitBtn.disabled = false;
        elements.submitBtn.textContent = 'Submit Report';
    }
}

function showState(stateId) {
    [
        elements.loadingState,
        elements.errorState,
        elements.submittedState,
        elements.successState,
        elements.reportForm
    ].forEach(el => {
        if (el) el.hidden = true;
    });

    const el = document.getElementById(stateId);
    if (el) el.hidden = false;
}

function showError(msg) {
    elements.errorMessage.textContent = msg;
    showState('errorState');
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-SG', {
        weekday: 'short', day: 'numeric', month: 'short'
    });
}

function formatTime(date) {
    return date.toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit' });
}
