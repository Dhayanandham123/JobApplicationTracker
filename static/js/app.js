// Job & Internship Application Tracker JavaScript Logic

document.addEventListener('DOMContentLoaded', () => {
    initSearchFilter();
    initModalEvents();
    recalculateCounters();
});

// --------------------------------------------------------------------------
// 1. Search Filter Functionality
// --------------------------------------------------------------------------
function initSearchFilter() {
    const searchInput = document.getElementById('search-input');
    const searchClear = document.getElementById('search-clear');

    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        
        if (query.length > 0) {
            searchClear.classList.remove('hidden');
        } else {
            searchClear.classList.add('hidden');
        }

        filterCards(query);
    });

    searchClear.addEventListener('click', () => {
        searchInput.value = '';
        searchClear.classList.add('hidden');
        filterCards('');
    });
}

function filterCards(query) {
    const cards = document.querySelectorAll('.app-card');

    cards.forEach(card => {
        const company = card.dataset.company || '';
        const title = card.dataset.title || '';

        if (company.includes(query) || title.includes(query)) {
            card.classList.remove('hidden');
        } else {
            card.classList.add('hidden');
        }
    });

    updateEmptyStates();
}

function updateEmptyStates() {
    const columns = ['Applied', 'Interviewing', 'Offered', 'Rejected'];

    columns.forEach(col => {
        const container = document.getElementById(`cards-${col}`);
        if (!container) return;

        const visibleCards = container.querySelectorAll('.app-card:not(.hidden)');
        const emptyState = container.querySelector('.empty-state');

        if (emptyState) {
            if (visibleCards.length === 0) {
                emptyState.classList.remove('hidden');
            } else {
                emptyState.classList.add('hidden');
            }
        }
    });
}

// --------------------------------------------------------------------------
// 2. Status Dropdown Inline Update
// --------------------------------------------------------------------------
async function updateApplicationStatus(appId, newStatus) {
    const card = document.querySelector(`.app-card[data-id="${appId}"]`);
    if (!card) return;

    try {
        const response = await fetch(`/applications/${appId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (!response.ok) {
            throw new Error('Failed to update status');
        }

        const updatedApp = await response.json();

        // Update dataset attribute
        card.dataset.status = updatedApp.status;

        // Update dropdown class for status pill coloring
        const selectElem = card.querySelector('.status-dropdown');
        if (selectElem) {
            selectElem.className = `status-dropdown status-pill-${updatedApp.status.toLowerCase()}`;
        }

        // Move card to target column container
        const targetContainer = document.getElementById(`cards-${updatedApp.status}`);
        if (targetContainer) {
            targetContainer.appendChild(card);
        }

        // Recalculate dynamic status counters across board
        recalculateCounters();
        updateEmptyStates();

    } catch (err) {
        console.error('Error updating status:', err);
        alert('Error updating status. Please try again.');
    }
}

// --------------------------------------------------------------------------
// 3. Notes Panel Functions
// --------------------------------------------------------------------------
function toggleNotesPanel(appId) {
    const content = document.getElementById(`notes-content-${appId}`);
    const toggleBtn = content.previousElementSibling;

    if (content) {
        content.classList.toggle('hidden');
        if (toggleBtn) {
            toggleBtn.classList.toggle('expanded');
        }
    }
}

async function saveNotes(appId) {
    const textarea = document.getElementById(`notes-text-${appId}`);
    if (!textarea) return;

    const notesText = textarea.value;

    try {
        const response = await fetch(`/applications/${appId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ notes: notesText })
        });

        if (!response.ok) {
            throw new Error('Failed to save notes');
        }

        // Brief visual confirmation
        const saveBtn = textarea.nextElementSibling.querySelector('button');
        if (saveBtn) {
            const originalText = saveBtn.innerText;
            saveBtn.innerText = 'Saved!';
            saveBtn.style.backgroundColor = '#10b981';
            setTimeout(() => {
                saveBtn.innerText = originalText;
                saveBtn.style.backgroundColor = '';
            }, 1800);
        }
    } catch (err) {
        console.error('Error saving notes:', err);
        alert('Could not save notes. Please try again.');
    }
}

// --------------------------------------------------------------------------
// 4. Application Counters Calculation
// --------------------------------------------------------------------------
function recalculateCounters() {
    const cards = document.querySelectorAll('.app-card');
    
    let counts = {
        total: cards.length,
        Applied: 0,
        Interviewing: 0,
        Offered: 0,
        Rejected: 0,
        needs_followup: 0
    };

    cards.forEach(card => {
        const status = card.dataset.status;
        if (counts[status] !== undefined) {
            counts[status]++;
        }
        if (card.classList.contains('stale-highlight')) {
            counts.needs_followup++;
        }
    });

    // Update Header Counter Bar
    document.getElementById('count-total').innerText = counts.total;
    document.getElementById('count-applied').innerText = counts.Applied;
    document.getElementById('count-interviewing').innerText = counts.Interviewing;
    document.getElementById('count-offered').innerText = counts.Offered;
    document.getElementById('count-rejected').innerText = counts.Rejected;
    
    const followupElem = document.getElementById('count-followup');
    if (followupElem) {
        followupElem.innerText = counts.needs_followup;
        const followupBadge = followupElem.closest('.counter-badge');
        if (followupBadge) {
            if (counts.needs_followup > 0) {
                followupBadge.classList.add('active-alert');
            } else {
                followupBadge.classList.remove('active-alert');
            }
        }
    }

    // Update Column Header Count Badges
    ['Applied', 'Interviewing', 'Offered', 'Rejected'].forEach(col => {
        const badge = document.getElementById(`col-count-${col}`);
        if (badge) {
            badge.innerText = counts[col];
        }
    });
}

// --------------------------------------------------------------------------
// 5. Add Application & Delete Modals
// --------------------------------------------------------------------------
let targetDeleteId = null;

function initModalEvents() {
    // Add Modal Elements
    const addModal = document.getElementById('add-modal');
    const openBtn = document.getElementById('btn-open-modal');
    const closeBtn = document.getElementById('modal-close-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    const addForm = document.getElementById('add-app-form');

    if (openBtn && addModal) {
        openBtn.addEventListener('click', () => addModal.classList.remove('hidden'));
    }

    const closeAddModal = () => {
        if (addModal) addModal.classList.add('hidden');
        if (addForm) addForm.reset();
    };

    if (closeBtn) closeBtn.addEventListener('click', closeAddModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeAddModal);

    // Form Submit Listener
    if (addForm) {
        addForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(addForm);
            const payload = Object.fromEntries(formData.entries());

            try {
                const response = await fetch('/applications', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const err = await response.json();
                    alert(err.error || 'Failed to add application');
                    return;
                }

                // Refresh page to load newly created application card
                window.location.reload();
            } catch (err) {
                console.error('Error creating application:', err);
                alert('Error connecting to server.');
            }
        });
    }

    // Delete Modal Elements
    const deleteModal = document.getElementById('delete-modal');
    const deleteClose = document.getElementById('delete-modal-close');
    const deleteCancel = document.getElementById('delete-cancel-btn');
    const deleteConfirm = document.getElementById('delete-confirm-btn');

    const closeDeleteModal = () => {
        if (deleteModal) deleteModal.classList.add('hidden');
        targetDeleteId = null;
    };

    if (deleteClose) deleteClose.addEventListener('click', closeDeleteModal);
    if (deleteCancel) deleteCancel.addEventListener('click', closeDeleteModal);

    if (deleteConfirm) {
        deleteConfirm.addEventListener('click', async () => {
            if (!targetDeleteId) return;

            try {
                const response = await fetch(`/applications/${targetDeleteId}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    const card = document.querySelector(`.app-card[data-id="${targetDeleteId}"]`);
                    if (card) {
                        card.remove();
                    }
                    recalculateCounters();
                    updateEmptyStates();
                    closeDeleteModal();
                } else {
                    alert('Failed to delete application.');
                }
            } catch (err) {
                console.error('Error deleting application:', err);
                alert('Error connecting to server.');
            }
        });
    }
}

function confirmDelete(appId, companyName) {
    targetDeleteId = appId;
    const deleteModal = document.getElementById('delete-modal');
    const companySpan = document.getElementById('delete-company-name');

    if (companySpan) {
        companySpan.innerText = `"${companyName}"`;
    }

    if (deleteModal) {
        deleteModal.classList.remove('hidden');
    }
}

// --------------------------------------------------------------------------
// 6. Google One Tap / Sign-In Callback Handler
// --------------------------------------------------------------------------
async function handleGoogleCredentialResponse(response) {
    if (!response || !response.credential) return;

    try {
        const res = await fetch('/auth/google', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ credential: response.credential })
        });

        const data = await res.json();

        if (res.ok && data.success) {
            window.location.href = data.redirect || '/';
        } else {
            alert(data.error || 'Google login failed.');
        }
    } catch (err) {
        console.error('Error during Google authentication:', err);
        alert('Could not authenticate with Google.');
    }
}

// --------------------------------------------------------------------------
// 7. Manual Email Reminder Action Handler
// --------------------------------------------------------------------------
async function sendReminderEmail(appId) {
    const btn1 = document.getElementById(`stale-email-btn-${appId}`);
    const btn2 = document.getElementById(`footer-email-btn-${appId}`);

    const setBtnState = (text, disabled, bg) => {
        [btn1, btn2].forEach(btn => {
            if (btn) {
                btn.disabled = disabled;
                if (text) btn.innerText = text;
                if (bg !== undefined) btn.style.backgroundColor = bg;
            }
        });
    };

    setBtnState('Sending...', true);

    try {
        const response = await fetch(`/applications/${appId}/send-reminder`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (response.ok && data.success) {
            setBtnState('Email Sent! ✓', true, '#10b981');
            setTimeout(() => {
                setBtnState('Send Email Reminder', false, '');
            }, 3000);
        } else {
            alert(data.error || 'Failed to send email reminder.');
            setBtnState('Send Email Reminder', false, '');
        }
    } catch (err) {
        console.error('Error sending reminder email:', err);
        alert('Error connecting to server.');
        setBtnState('Send Email Reminder', false, '');
    }
}
