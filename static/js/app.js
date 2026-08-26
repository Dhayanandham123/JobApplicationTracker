// Job & Internship Application Tracker JavaScript Logic

document.addEventListener('DOMContentLoaded', () => {
    initNavigationEvents();
    initSearchFilter();
    initModalEvents();
    initCalendarEvents();
    initAnalyticsEvents();
    initDetailsEvents();
    initAutoFillEvents();
    initModalDismissibility();
    initChatbot();
    initProfileAndSettingsEvents();
    initFitScoreEvents();
    initResumeVersionsEvents();
    populateResumeVersionSelects();
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

        // Refresh if moving to or from Interviewing to sync Upcoming Interviews row
        if (newStatus === 'Interviewing' || card.dataset.status === 'Interviewing') {
            window.location.reload();
        }

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
// 8. Smart Calendar Generator & Interactivity
// --------------------------------------------------------------------------
// 7. Full-Page View Controller (Dashboard, Analytics, Calendar)
// --------------------------------------------------------------------------
function switchView(viewName) {
    // Hide all full-page views
    document.querySelectorAll('.app-view-page').forEach(v => v.classList.add('hidden'));

    // Deactivate all sidebar items
    document.querySelectorAll('.sidebar-item').forEach(item => item.classList.remove('active'));

    if (viewName === 'dashboard') {
        const v = document.getElementById('view-dashboard');
        const nav = document.getElementById('nav-dashboard');
        if (v) v.classList.remove('hidden');
        if (nav) nav.classList.add('active');
    } else if (viewName === 'analytics') {
        const v = document.getElementById('view-analytics');
        const nav = document.getElementById('btn-sidebar-analytics');
        if (v) v.classList.remove('hidden');
        if (nav) nav.classList.add('active');
        loadAnalyticsData();
    } else if (viewName === 'calendar') {
        const v = document.getElementById('view-calendar');
        const nav = document.getElementById('btn-sidebar-calendar');
        if (v) v.classList.remove('hidden');
        if (nav) nav.classList.add('active');
        renderSmartCalendar(calendarCurrentDate.getFullYear(), calendarCurrentDate.getMonth());
    } else if (viewName === 'fit-score') {
        const v = document.getElementById('view-fit-score');
        const nav = document.getElementById('btn-sidebar-fit-score');
        if (v) v.classList.remove('hidden');
        if (nav) nav.classList.add('active');
        loadFitScorePage();
    } else if (viewName === 'resume-versions') {
        const v = document.getElementById('view-resume-versions');
        const nav = document.getElementById('btn-sidebar-resume-versions');
        if (v) v.classList.remove('hidden');
        if (nav) nav.classList.add('active');
        loadResumeVersionsPage();
    } else if (viewName === 'profile') {
        const v = document.getElementById('view-profile');
        const nav = document.getElementById('btn-sidebar-profile');
        if (v) v.classList.remove('hidden');
        if (nav) nav.classList.add('active');
    } else if (viewName === 'settings') {
        const v = document.getElementById('view-settings');
        const nav = document.getElementById('btn-sidebar-settings');
        if (v) v.classList.remove('hidden');
        if (nav) nav.classList.add('active');
    }
}

function initNavigationEvents() {
    const navDashboard = document.getElementById('nav-dashboard');
    const navAnalytics = document.getElementById('btn-sidebar-analytics');
    const navCalendar = document.getElementById('btn-sidebar-calendar');
    const navFitScore = document.getElementById('btn-sidebar-fit-score');
    const navResumeVersions = document.getElementById('btn-sidebar-resume-versions');
    const navProfile = document.getElementById('btn-sidebar-profile');
    const navSettings = document.getElementById('btn-sidebar-settings');

    if (navDashboard) {
        navDashboard.addEventListener('click', (e) => {
            e.preventDefault();
            switchView('dashboard');
        });
    }

    if (navAnalytics) {
        navAnalytics.addEventListener('click', () => switchView('analytics'));
    }

    if (navCalendar) {
        navCalendar.addEventListener('click', () => switchView('calendar'));
    }

    if (navFitScore) {
        navFitScore.addEventListener('click', () => switchView('fit-score'));
    }

    if (navResumeVersions) {
        navResumeVersions.addEventListener('click', () => switchView('resume-versions'));
    }

    if (navProfile) {
        navProfile.addEventListener('click', () => switchView('profile'));
    }

    if (navSettings) {
        navSettings.addEventListener('click', () => switchView('settings'));
    }
}

// --------------------------------------------------------------------------
// 8. Smart Calendar Generator & Interactivity
// --------------------------------------------------------------------------
let calendarCurrentDate = new Date();

function initCalendarEvents() {
    const prevBtn = document.getElementById('cal-prev-month');
    const nextBtn = document.getElementById('cal-next-month');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() - 1);
            renderSmartCalendar(calendarCurrentDate.getFullYear(), calendarCurrentDate.getMonth());
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() + 1);
            renderSmartCalendar(calendarCurrentDate.getFullYear(), calendarCurrentDate.getMonth());
        });
    }

    const grid = document.getElementById('calendar-grid');
    if (grid) {
        grid.addEventListener('click', (e) => {
            const eventPill = e.target.closest('.event-pill');
            if (!eventPill) return;

            const appId = eventPill.dataset.appId;
            if (!appId) return;

            // Switch back to dashboard view to highlight card
            switchView('dashboard');

            const targetCard = document.querySelector(`.app-card[data-id="${appId}"]`);
            if (targetCard) {
                targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetCard.classList.remove('app-card-highlight-pulse');
                void targetCard.offsetWidth; // Trigger reflow for re-animation
                targetCard.classList.add('app-card-highlight-pulse');
                setTimeout(() => {
                    targetCard.classList.remove('app-card-highlight-pulse');
                }, 2600);
            }
        });
    }
}

async function renderSmartCalendar(year, month) {
    const monthTitleElem = document.getElementById('calendar-month-title');
    const gridElem = document.getElementById('calendar-grid');
    if (!gridElem) return;

    const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
    if (monthTitleElem) {
        monthTitleElem.innerText = `${monthNames[month]} ${year}`;
    }

    gridElem.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-muted);">Loading events...</div>';

    let events = [];
    try {
        const response = await fetch('/api/calendar-events');
        if (response.ok) {
            events = await response.json();
        }
    } catch (err) {
        console.error('Error fetching calendar events:', err);
    }

    const eventsByDate = {};
    events.forEach(evt => {
        if (!evt.date) return;
        if (!eventsByDate[evt.date]) {
            eventsByDate[evt.date] = [];
        }
        eventsByDate[evt.date].push(evt);
    });

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const todayObj = new Date();
    const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;

    gridElem.innerHTML = '';

    // Render Previous Month Padding Days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const dayNum = prevMonthDays - i;
        const cell = document.createElement('div');
        cell.className = 'calendar-day-cell other-month';
        cell.innerHTML = `<span class="calendar-day-number">${dayNum}</span>`;
        gridElem.appendChild(cell);
    }

    // Render Current Month Days
    for (let day = 1; day <= totalDaysInMonth; day++) {
        const cell = document.createElement('div');
        const monthStr = String(month + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        const dateKey = `${year}-${monthStr}-${dayStr}`;

        cell.className = 'calendar-day-cell';
        if (dateKey === todayStr) {
            cell.classList.add('today-cell');
        }

        const dayEvents = eventsByDate[dateKey] || [];

        // Apply Heat Map background density shading
        if (dayEvents.length === 1) {
            cell.classList.add('heatmap-level-1');
        } else if (dayEvents.length === 2) {
            cell.classList.add('heatmap-level-2');
        } else if (dayEvents.length >= 3) {
            cell.classList.add('heatmap-level-3');
        }

        let innerHTML = `<span class="calendar-day-number">${day}</span>`;

        dayEvents.forEach(evt => {
            const statusStr = evt.status || evt.label || 'Applied';
            const statusLower = statusStr.toLowerCase();
            const companyName = evt.company_name || 'Company';

            innerHTML += `
                <div class="event-pill event-pill-${statusLower}" data-app-id="${evt.app_id}" title="${companyName} - ${evt.job_title || ''} (${statusStr})">
                    <span>${companyName}</span>
                </div>
            `;
        });

        cell.innerHTML = innerHTML;
        gridElem.appendChild(cell);
    }

    // Render Next Month Padding Days
    const totalRendered = firstDayIndex + totalDaysInMonth;
    const remaining = (totalRendered % 7 === 0) ? 0 : (7 - (totalRendered % 7));
    for (let i = 1; i <= remaining; i++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day-cell other-month';
        cell.innerHTML = `<span class="calendar-day-number">${i}</span>`;
        gridElem.appendChild(cell);
    }
}

// --------------------------------------------------------------------------
// 9. Analytics & Performance Insights Data Handler
// --------------------------------------------------------------------------
function initAnalyticsEvents() {
    const analyticsModal = document.getElementById('analytics-modal');
    const openBtn = document.getElementById('btn-open-analytics') || document.getElementById('btn-sidebar-analytics');
    const sidebarBtn = document.getElementById('btn-sidebar-analytics');
    const closeBtn = document.getElementById('analytics-close-btn');

    const handleAnalyticsOpen = () => {
        if (analyticsModal) {
            analyticsModal.classList.remove('hidden');
            loadAnalyticsData();
        }
    };

    if (openBtn) openBtn.addEventListener('click', handleAnalyticsOpen);
    if (sidebarBtn && sidebarBtn !== openBtn) sidebarBtn.addEventListener('click', handleAnalyticsOpen);

    if (closeBtn && analyticsModal) {
        closeBtn.addEventListener('click', () => analyticsModal.classList.add('hidden'));
    }
}

async function loadAnalyticsData() {
    try {
        const response = await fetch('/api/analytics');
        if (!response.ok) return;

        const data = await response.json();

        // Update Top KPI Metric Cards
        const totalElem = document.getElementById('kpi-total-apps');
        const interviewRateElem = document.getElementById('kpi-interview-rate');
        const interviewSubtext = document.getElementById('kpi-interview-subtext');
        const offerRateElem = document.getElementById('kpi-offer-rate');
        const offerSubtext = document.getElementById('kpi-offer-subtext');
        const rejectionRateElem = document.getElementById('kpi-rejection-rate');
        const rejectionSubtext = document.getElementById('kpi-rejection-subtext');

        if (totalElem) totalElem.innerText = data.total;
        if (interviewRateElem) interviewRateElem.innerText = `${data.interview_rate}%`;
        if (interviewSubtext) interviewSubtext.innerText = `${data.interviewing} interviews`;
        if (offerRateElem) offerRateElem.innerText = `${data.offer_rate}%`;
        if (offerSubtext) offerSubtext.innerText = `${data.offered} offers`;
        if (rejectionRateElem) rejectionRateElem.innerText = `${data.rejection_rate}%`;
        if (rejectionSubtext) rejectionSubtext.innerText = `${data.rejected} rejections`;

        // Update Status Funnel Breakdown Progress Bars
        const statuses = ['Applied', 'Interviewing', 'Offered', 'Rejected'];
        statuses.forEach(status => {
            const countElem = document.getElementById(`funnel-count-${status.toLowerCase()}`);
            const barFillElem = document.getElementById(`funnel-bar-${status.toLowerCase()}`);

            const info = data.funnel[status] || { count: 0, percentage: 0 };
            if (countElem) countElem.innerText = `${info.count} applications`;
            if (barFillElem) barFillElem.style.width = `${info.percentage}%`;
        });

        // Update Status Proportion Donut Chart Center & Segments
        const donutTotal = document.getElementById('donut-total');
        if (donutTotal) donutTotal.innerText = data.total;

        let accumulatedPct = 0;
        statuses.forEach(status => {
            const segElem = document.getElementById(`donut-segment-${status.toLowerCase()}`);
            const info = data.funnel[status] || { percentage: 0 };
            const pct = info.percentage || 0;

            if (segElem) {
                segElem.setAttribute('stroke-dasharray', `${pct} ${100 - pct}`);
                segElem.setAttribute('stroke-dashoffset', `${-accumulatedPct}`);
            }
            accumulatedPct += pct;
        });

    } catch (err) {
        console.error('Error loading analytics data:', err);
    }
}

// --------------------------------------------------------------------------
// 10. Application Details Modal Handler
// --------------------------------------------------------------------------
function handleCardClick(e, appId) {
    if (e.target.closest('select, button, a, textarea, input')) {
        return;
    }
    openApplicationDetails(appId);
}

function initDetailsEvents() {
    const detailsModal = document.getElementById('details-modal');
    const closeBtn = document.getElementById('details-close-btn');
    const form = document.getElementById('details-app-form');
    const deleteBtn = document.getElementById('details-delete-btn');
    const statusSelect = document.getElementById('details-status-select');

    if (closeBtn && detailsModal) {
        closeBtn.addEventListener('click', () => detailsModal.classList.add('hidden'));
    }

    if (statusSelect) {
        statusSelect.addEventListener('change', (e) => {
            statusSelect.className = `status-dropdown status-pill-${e.target.value.toLowerCase()}`;
        });
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const appId = document.getElementById('details-app-id').value;
            if (!appId) return;

            const payload = {
                company_name: document.getElementById('details-company').value,
                job_title: document.getElementById('details-title').value,
                status: document.getElementById('details-status-select').value,
                date_applied: document.getElementById('details-date-applied').value,
                interview_date: document.getElementById('details-interview-date').value,
                assessment_date: document.getElementById('details-assessment-date').value,
                job_url: document.getElementById('details-job-url').value,
                salary: document.getElementById('details-salary').value,
                location: document.getElementById('details-location').value,
                notes: document.getElementById('details-notes').value
            };

            try {
                const response = await fetch(`/applications/${appId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    window.location.reload();
                } else {
                    const err = await response.json();
                    alert(err.error || 'Failed to update application details.');
                }
            } catch (err) {
                console.error('Error saving application details:', err);
                alert('Error connecting to server.');
            }
        });
    }


    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            const appId = document.getElementById('details-app-id').value;
            const companyName = document.getElementById('details-company-title').innerText;
            if (detailsModal) detailsModal.classList.add('hidden');
            if (appId) confirmDelete(appId, companyName);
        });
    }
}

async function openApplicationDetails(appId) {
    const detailsModal = document.getElementById('details-modal');
    if (!detailsModal) return;

    try {
        const response = await fetch(`/applications/${appId}`);
        if (!response.ok) {
            alert('Could not fetch application details.');
            return;
        }

        const app = await response.json();

        document.getElementById('details-app-id').value = app.id;
        document.getElementById('details-company-title').innerText = app.company_name;
        document.getElementById('details-job-subtitle').innerText = app.job_title;

        const statusSelect = document.getElementById('details-status-select');
        if (statusSelect) {
            statusSelect.value = app.status;
            statusSelect.className = `status-dropdown status-pill-${app.status.toLowerCase()}`;
        }

        document.getElementById('details-company').value = app.company_name;
        document.getElementById('details-title').value = app.job_title;

        const jobTypeElem = document.getElementById('details-job-type');
        if (jobTypeElem) jobTypeElem.value = app.job_type || 'Full-time';

        document.getElementById('details-job-url').value = app.job_url || '';
        document.getElementById('details-salary').value = app.salary || '';
        document.getElementById('details-location').value = app.location || '';
        document.getElementById('details-date-applied').value = app.date_applied || '';
        document.getElementById('details-interview-date').value = app.interview_date || '';
        document.getElementById('details-assessment-date').value = app.assessment_date || '';
        document.getElementById('details-notes').value = app.notes || '';

        detailsModal.classList.remove('hidden');
    } catch (err) {
        console.error('Error opening details modal:', err);
    }
}

// --------------------------------------------------------------------------
// 11. URL Auto-Fill Event Handlers
// --------------------------------------------------------------------------
function initAutoFillEvents() {
    const btnAdd = document.getElementById('btn-autofill-add');
    const btnDetails = document.getElementById('btn-autofill-details');

    if (btnAdd) {
        btnAdd.addEventListener('click', () => {
            autoFillFromUrl('job_url', 'company_name', 'job_title', 'location', 'salary', 'job_type', 'btn-autofill-add');
        });
    }

    if (btnDetails) {
        btnDetails.addEventListener('click', () => {
            autoFillFromUrl('details-job-url', 'details-company', 'details-title', 'details-location', 'details-salary', 'details-job-type', 'btn-autofill-details');
        });
    }
}

async function autoFillFromUrl(urlInputId, companyInputId, titleInputId, locationInputId, salaryInputId, jobTypeInputId, btnId) {
    const urlElem = document.getElementById(urlInputId);
    const btn = document.getElementById(btnId);
    if (!urlElem || !btn) return;

    const url = urlElem.value.trim();
    if (!url) {
        alert('Please paste or type a job URL first.');
        return;
    }

    const origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Fetching...';

    try {
        const response = await fetch('/api/autofill-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: url })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            if (data.company_name) document.getElementById(companyInputId).value = data.company_name;
            if (data.job_title) document.getElementById(titleInputId).value = data.job_title;
            if (data.location && document.getElementById(locationInputId)) document.getElementById(locationInputId).value = data.location;
            if (data.salary && document.getElementById(salaryInputId)) document.getElementById(salaryInputId).value = data.salary;
            if (data.job_type && document.getElementById(jobTypeInputId)) document.getElementById(jobTypeInputId).value = data.job_type;

            btn.innerHTML = 'Auto-Filled!';
            setTimeout(() => {
                btn.disabled = false;
                btn.innerHTML = origText;
            }, 2000);
        } else {
            alert(data.error || 'Could not auto-fill details from URL.');
            btn.disabled = false;
            btn.innerHTML = origText;
        }
    } catch (err) {
        console.error('Error auto-filling from URL:', err);
        alert('Error connecting to auto-fill service.');
        btn.disabled = false;
        btn.innerHTML = origText;
    }
}

// --------------------------------------------------------------------------
// 12. Modal Dismissibility (Backdrop Click & Escape Key)
// --------------------------------------------------------------------------
function initModalDismissibility() {
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-backdrop').forEach(modal => {
                modal.classList.add('hidden');
            });
        }
    });
}

// --------------------------------------------------------------------------
// 13. Floating AI Career Assistant Chatbot Handler
// --------------------------------------------------------------------------
let chatHistory = [];

function initChatbot() {
    const toggleBtn = document.getElementById('chatbot-toggle-btn');
    const minimizeBtn = document.getElementById('chatbot-minimize-btn');
    const clearBtn = document.getElementById('chatbot-clear-btn');
    const windowElem = document.getElementById('chatbot-window');
    const form = document.getElementById('chatbot-form');
    const input = document.getElementById('chatbot-input');
    const messagesContainer = document.getElementById('chatbot-messages');
    const sendBtn = document.getElementById('chatbot-send-btn');

    if (!toggleBtn || !windowElem) return;

    toggleBtn.addEventListener('click', () => {
        windowElem.classList.toggle('hidden');
        if (!windowElem.classList.contains('hidden')) {
            if (input) input.focus();
            scrollToBottom();
        }
    });

    if (minimizeBtn) {
        minimizeBtn.addEventListener('click', () => {
            windowElem.classList.add('hidden');
        });
    }

    if (clearBtn && messagesContainer) {
        clearBtn.addEventListener('click', () => {
            chatHistory = [];
            messagesContainer.innerHTML = `
                <div class="chat-bubble bot-bubble">
                    <div class="bubble-avatar">AI</div>
                    <div class="bubble-content">
                        <p>Chat history cleared. How else can I assist your job search today?</p>
                    </div>
                </div>
            `;
        });
    }

    // Quick Prompt Pills
    document.querySelectorAll('.quick-prompt-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            const prompt = pill.dataset.prompt;
            if (prompt && input) {
                input.value = prompt;
                sendChatMessage(prompt);
            }
        });
    });

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const msg = input.value.trim();
            if (msg) {
                sendChatMessage(msg);
            }
        });
    }

    async function sendChatMessage(userText) {
        if (!userText || sendBtn.disabled) return;

        input.value = '';
        appendBubble('user', userText);
        scrollToBottom();

        sendBtn.disabled = true;
        showTypingIndicator();

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userText,
                    history: chatHistory
                })
            });

            removeTypingIndicator();
            sendBtn.disabled = false;

            const data = await response.json();

            if (response.ok && data.reply) {
                appendBubble('assistant', data.reply);
                chatHistory.push({ role: 'user', content: userText });
                chatHistory.push({ role: 'assistant', content: data.reply });
            } else {
                appendBubble('assistant', data.error || 'Sorry, I hit an unexpected issue. Please try again.');
            }
        } catch (err) {
            console.error('Chatbot fetch error:', err);
            removeTypingIndicator();
            sendBtn.disabled = false;
            appendBubble('assistant', 'Error connecting to AI chatbot service. Please try again.');
        }

        scrollToBottom();
    }

    function appendBubble(role, content) {
        if (!messagesContainer) return;

        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${role === 'user' ? 'user-bubble' : 'bot-bubble'}`;

        const avatar = role === 'user' ? 'You' : 'AI';
        const formattedText = formatMarkdownMessage(content);

        bubble.innerHTML = `
            <div class="bubble-avatar">${avatar}</div>
            <div class="bubble-content">${formattedText}</div>
        `;

        messagesContainer.appendChild(bubble);
        scrollToBottom();
    }

    function showTypingIndicator() {
        if (!messagesContainer) return;
        const typingElem = document.createElement('div');
        typingElem.id = 'chatbot-typing-indicator';
        typingElem.className = 'chat-bubble bot-bubble';
        typingElem.innerHTML = `
            <div class="bubble-avatar">AI</div>
            <div class="bubble-content">
                <div class="typing-dots">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;
        messagesContainer.appendChild(typingElem);
        scrollToBottom();
    }

    function removeTypingIndicator() {
        const typingElem = document.getElementById('chatbot-typing-indicator');
        if (typingElem) typingElem.remove();
    }

    function scrollToBottom() {
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    function formatMarkdownMessage(text) {
        if (!text) return '';
        let html = text
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
        return html;
    }
}

// --------------------------------------------------------------------------
// 14. Enhanced Profile & Comprehensive Settings Handlers
// --------------------------------------------------------------------------
function initProfileAndSettingsEvents() {
    // 1. Settings Tab Navigation
    document.querySelectorAll('.settings-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;
            document.querySelectorAll('.settings-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.settings-tab-content').forEach(c => c.classList.add('hidden'));

            btn.classList.add('active');
            const targetElem = document.getElementById(targetTab);
            if (targetElem) targetElem.classList.remove('hidden');
        });
    });

    // 2. Profile Form Submission
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const statusElem = document.getElementById('profile-save-status');
            if (statusElem) {
                statusElem.className = 'save-status-text';
                statusElem.innerText = 'Saving...';
            }

            const payload = {
                full_name: document.getElementById('profile-full-name').value.trim(),
                phone: document.getElementById('profile-phone').value.trim(),
                location: document.getElementById('profile-location').value.trim(),
                headline: document.getElementById('profile-headline').value.trim(),
                university: document.getElementById('profile-university').value.trim(),
                grad_year: document.getElementById('profile-grad-year').value.trim(),
                avatar_url: document.getElementById('profile-avatar-url').value.trim()
            };

            try {
                const response = await fetch('/api/profile', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();
                if (response.ok && data.success) {
                    if (statusElem) {
                        statusElem.className = 'save-status-text save-status-success';
                        statusElem.innerText = 'Saved Profile Changes!';
                        setTimeout(() => statusElem.innerText = '', 2500);
                    }

                    // Update UI preview header
                    const user = data.user || {};
                    const headerName = document.getElementById('profile-header-name');
                    const headerHeadline = document.getElementById('profile-header-headline');
                    const avatarPreview = document.getElementById('profile-avatar-preview');

                    if (headerName) headerName.innerText = user.full_name || user.username || 'User';
                    if (headerHeadline) headerHeadline.innerText = user.headline || 'Computer Science Student | Python & AI/ML';
                    if (avatarPreview && user.avatar_url) {
                        avatarPreview.innerHTML = `<img src="${user.avatar_url}" alt="Avatar" class="avatar-img">`;
                    }
                } else {
                    if (statusElem) {
                        statusElem.className = 'save-status-text save-status-error';
                        statusElem.innerText = data.error || 'Failed to update profile.';
                    }
                }
            } catch (err) {
                console.error('Error saving profile:', err);
                if (statusElem) {
                    statusElem.className = 'save-status-text save-status-error';
                    statusElem.innerText = 'Error connecting to server.';
                }
            }
        });
    }

    // 3. Settings Form Auto-Save
    const settingsInputs = [
        'setting-notify-followup', 'setting-notify-interview', 'setting-reminder-time',
        'setting-email-notifications', 'setting-theme', 'setting-dashboard-view',
        'setting-card-density', 'setting-show-stats', 'setting-show-warnings', 'setting-show-interview-dates'
    ];

    settingsInputs.forEach(id => {
        const elem = document.getElementById(id);
        if (elem) {
            elem.addEventListener('change', saveUserSettings);
        }
    });

    async function saveUserSettings() {
        const payload = {
            notify_followup: document.getElementById('setting-notify-followup')?.checked,
            notify_interview: document.getElementById('setting-notify-interview')?.checked,
            reminder_time: document.getElementById('setting-reminder-time')?.value,
            email_notifications: document.getElementById('setting-email-notifications')?.checked,
            theme: document.getElementById('setting-theme')?.value,
            dashboard_view: document.getElementById('setting-dashboard-view')?.value,
            card_density: document.getElementById('setting-card-density')?.value,
            show_stats: document.getElementById('setting-show-stats')?.checked,
            show_warnings: document.getElementById('setting-show-warnings')?.checked,
            show_interview_dates: document.getElementById('setting-show-interview-dates')?.checked
        };

        // Apply density class live
        if (payload.card_density === 'compact') {
            document.body.classList.add('density-compact');
            document.body.classList.remove('density-spacious');
        } else if (payload.card_density === 'spacious') {
            document.body.classList.add('density-spacious');
            document.body.classList.remove('density-compact');
        } else {
            document.body.classList.remove('density-compact', 'density-spacious');
        }

        try {
            await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (err) {
            console.error('Error saving user settings:', err);
        }
    }

    // 4. Change Password Form
    const pwForm = document.getElementById('change-password-form');
    if (pwForm) {
        pwForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const statusElem = document.getElementById('password-status-text');
            const current_password = document.getElementById('current-password').value;
            const new_password = document.getElementById('new-password').value;
            const confirm_password = document.getElementById('confirm-new-password').value;

            if (statusElem) {
                statusElem.className = 'save-status-text';
                statusElem.innerText = 'Updating password...';
            }

            try {
                const response = await fetch('/api/account/change-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ current_password, new_password, confirm_password })
                });

                const data = await response.json();
                if (response.ok && data.success) {
                    pwForm.reset();
                    if (statusElem) {
                        statusElem.className = 'save-status-text save-status-success';
                        statusElem.innerText = 'Password updated successfully!';
                        setTimeout(() => statusElem.innerText = '', 3000);
                    }
                } else {
                    if (statusElem) {
                        statusElem.className = 'save-status-text save-status-error';
                        statusElem.innerText = data.error || 'Failed to update password.';
                    }
                }
            } catch (err) {
                console.error('Error updating password:', err);
                if (statusElem) {
                    statusElem.className = 'save-status-text save-status-error';
                    statusElem.innerText = 'Error connecting to server.';
                }
            }
        });
    }

    // 5. Logout All Devices
    const btnLogoutAll = document.getElementById('btn-logout-all');
    if (btnLogoutAll) {
        btnLogoutAll.addEventListener('click', () => {
            if (confirm('Are you sure you want to log out from all devices?')) {
                window.location.href = '/logout';
            }
        });
    }

    // 6. Delete Account
    const btnDeleteAcc = document.getElementById('btn-delete-account-trigger');
    if (btnDeleteAcc) {
        btnDeleteAcc.addEventListener('click', async () => {
            const confirmed = confirm('WARNING: Are you sure you want to permanently delete your account and all application data? This action CANNOT be undone.');
            if (!confirmed) return;

            try {
                const response = await fetch('/api/account/delete', { method: 'POST' });
                const data = await response.json();
                if (response.ok && data.success) {
                    window.location.href = data.redirect || '/welcome';
                } else {
                    alert(data.error || 'Failed to delete account.');
                }
            } catch (err) {
                console.error('Error deleting account:', err);
                alert('Error connecting to server.');
            }
        });
    }
}

// --------------------------------------------------------------------------
// 15. Fit Score & Skill Gap Analysis Handlers
// --------------------------------------------------------------------------
function toggleMissingSkills(e, appId) {
    if (e) e.stopPropagation();
    const drawer = document.getElementById(`missing-skills-drawer-${appId}`);
    if (drawer) {
        drawer.classList.toggle('hidden');
    }
}

function initFitScoreEvents() {
    const btnNavFitScore = document.getElementById('btn-sidebar-fit-score');
    if (btnNavFitScore) {
        btnNavFitScore.addEventListener('click', () => switchView('fit-score'));
    }

    const dropzone = document.getElementById('resume-dropzone');
    const fileInput = document.getElementById('resume-file-input');
    const btnUploadNew = document.getElementById('btn-fit-score-upload-new');
    const btnDelete = document.getElementById('btn-delete-resume');
    const btnTogglePreview = document.getElementById('btn-toggle-extracted-text');
    const versionSelect = document.getElementById('fit-score-version-select');

    if (btnUploadNew && dropzone) {
        btnUploadNew.addEventListener('click', () => {
            dropzone.classList.toggle('hidden');
        });
    }

    if (versionSelect) {
        versionSelect.addEventListener('change', async (e) => {
            const versionId = e.target.value;
            const statusElem = document.getElementById('resume-upload-status');
            if (statusElem) {
                statusElem.className = 'save-status-text';
                statusElem.innerText = 'Switching active resume version & recalculating fit scores...';
            }

            try {
                const res = await fetch('/api/fit-score/select-version', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ version_id: versionId })
                });

                if (res.ok) {
                    if (statusElem) {
                        statusElem.className = 'save-status-text save-status-success';
                        statusElem.innerText = 'Fit scores updated for selected resume version!';
                        setTimeout(() => statusElem.innerText = '', 3000);
                    }
                    loadFitScorePage();
                }
            } catch (err) {
                console.error('Error selecting resume version:', err);
            }
        });
    }

    if (dropzone && fileInput) {
        dropzone.addEventListener('click', (e) => {
            if (!e.target.closest('input[type="text"]')) {
                fileInput.click();
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                uploadResumeFile(e.target.files[0]);
            }
        });

        // Drag and Drop Events
        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.add('drag-active');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.remove('drag-active');
            }, false);
        });

        dropzone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            if (dt && dt.files && dt.files[0]) {
                uploadResumeFile(dt.files[0]);
            }
        });
    }

    if (btnDelete) {
        btnDelete.addEventListener('click', async () => {
            if (!confirm('Are you sure you want to remove your master resume? This will reset application fit scores.')) return;
            try {
                const res = await fetch('/api/resume', { method: 'DELETE' });
                if (res.ok) {
                    loadFitScorePage();
                }
            } catch (err) {
                console.error('Error deleting resume:', err);
            }
        });
    }

    if (btnTogglePreview) {
        btnTogglePreview.addEventListener('click', () => {
            const drawer = document.getElementById('extracted-text-drawer');
            if (drawer) {
                drawer.classList.toggle('hidden');
            }
        });
    }
}

async function uploadResumeFile(file) {
    const statusElem = document.getElementById('resume-upload-status');
    const fileInput = document.getElementById('resume-file-input');
    const quickVersionNameElem = document.getElementById('quick-version-name-input');
    const versionName = quickVersionNameElem ? quickVersionNameElem.value.trim() : '';

    if (statusElem) {
        statusElem.className = 'save-status-text';
        statusElem.innerText = 'Extracting document text & computing fit scores...';
    }

    const formData = new FormData();
    formData.append('resume_file', file);
    if (versionName) {
        formData.append('version_name', versionName);
    }

    try {
        const endpoint = versionName ? '/api/resume-versions' : '/api/resume/upload';
        const res = await fetch(endpoint, {
            method: 'POST',
            body: formData
        });

        if (res.status === 401) {
            window.location.href = '/welcome';
            return;
        }

        const contentType = res.headers.get('content-type') || '';
        let data = {};
        if (contentType.includes('application/json')) {
            data = await res.json();
        }

        if (res.ok) {
            if (statusElem) {
                statusElem.className = 'save-status-text save-status-success';
                statusElem.innerText = versionName ? `Saved "${versionName}" & fit scores updated!` : 'Resume uploaded & fit scores updated!';
                setTimeout(() => statusElem.innerText = '', 3000);
            }
            if (quickVersionNameElem) quickVersionNameElem.value = '';
            populateResumeVersionSelects();
            loadFitScorePage();
        } else {
            const errorMsg = data.error || (res.status === 413 ? 'File too large to upload.' : 'Failed to process resume file.');
            if (statusElem) {
                statusElem.className = 'save-status-text save-status-error';
                statusElem.innerText = errorMsg;
            }
        }
    } catch (err) {
        console.error('Error uploading resume file:', err);
        if (statusElem) {
            statusElem.className = 'save-status-text save-status-error';
            statusElem.innerText = 'Network error uploading file to server.';
        }
    } finally {
        if (fileInput) fileInput.value = '';
    }
}

async function loadFitScorePage() {
    const uploadedCard = document.getElementById('uploaded-resume-card');
    const filenameElem = document.getElementById('uploaded-filename');
    const versionBadgeElem = document.getElementById('uploaded-version-badge');
    const previewContainer = document.getElementById('extracted-text-preview-container');
    const previewTextarea = document.getElementById('extracted-resume-textarea');

    // 1. Populate Version Select Dropdown
    await populateFitScoreVersionDropdown();

    // 2. Fetch current active resume details
    try {
        const res = await fetch('/api/resume');
        if (res.ok) {
            const resumeData = await res.json();
            if (resumeData.resume_text) {
                if (uploadedCard) uploadedCard.classList.remove('hidden');
                if (filenameElem) filenameElem.innerText = resumeData.resume_filename || 'Master_Resume.pdf';
                if (versionBadgeElem) versionBadgeElem.innerText = 'Active Resume Text';
                if (previewContainer) previewContainer.classList.remove('hidden');
                if (previewTextarea) previewTextarea.value = resumeData.resume_text;
            } else {
                if (previewContainer) previewContainer.classList.add('hidden');
                if (previewTextarea) previewTextarea.value = '';
            }
        }
    } catch (err) {
        console.error('Error fetching resume info:', err);
    }

    // 3. Load Application Fit Scores List
    const container = document.getElementById('fit-score-apps-list');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center; padding: 1.5rem; color: var(--text-muted);">Loading fit scores...</div>';

    try {
        const res = await fetch('/applications');
        if (!res.ok) return;

        const apps = await res.json();

        apps.sort((a, b) => {
            const scoreA = a.fit_score !== null && a.fit_score !== undefined ? a.fit_score : -1;
            const scoreB = b.fit_score !== null && b.fit_score !== undefined ? b.fit_score : -1;
            return scoreB - scoreA;
        });

        if (apps.length === 0) {
            container.innerHTML = '<div class="empty-state">No applications found. Create applications to see fit score analysis!</div>';
            return;
        }

        container.innerHTML = '';

        apps.forEach(app => {
            const item = document.createElement('div');
            item.className = 'fit-score-app-item';

            let badgeClass = 'fit-score-none';
            let badgeText = 'Fit Score: --';

            if (app.fit_score !== null && app.fit_score !== undefined) {
                if (app.fit_score >= 70) badgeClass = 'fit-score-high';
                else if (app.fit_score >= 40) badgeClass = 'fit-score-med';
                else badgeClass = 'fit-score-low';
                badgeText = `Fit Score: ${app.fit_score}%`;
            }

            const skillsList = app.missing_skills_list || [];
            let skillsHTML = '';
            if (skillsList.length > 0) {
                skillsHTML = skillsList.map(s => `<span class="skill-tag-pill">${s}</span>`).join(' ');
            } else {
                skillsHTML = '<span class="skill-tag-none">No skill gaps identified</span>';
            }

            item.innerHTML = `
                <div class="fit-score-app-info">
                    <h5>${app.company_name} — ${app.job_title}</h5>
                    <p>Status: <strong>${app.status}</strong> | Job Type: ${app.job_type || 'Full-time'}</p>
                    <div style="margin-top: 0.4rem; display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
                        <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary);">Missing Skills:</span>
                        ${skillsHTML}
                    </div>
                </div>
                <div>
                    <span class="fit-score-badge ${badgeClass}" style="font-size: 0.85rem; padding: 0.35rem 0.65rem;">${badgeText}</span>
                </div>
            `;

            container.appendChild(item);
        });

    } catch (err) {
        console.error('Error loading fit score page:', err);
        container.innerHTML = '<div style="color:#ef4444; padding: 1rem;">Failed to load fit score analysis.</div>';
    }
}

async function populateFitScoreVersionDropdown() {
    const versionSelect = document.getElementById('fit-score-version-select');
    if (!versionSelect) return;

    try {
        const res = await fetch('/api/resume-versions');
        if (!res.ok) return;

        const versions = await res.json();
        const currentVal = versionSelect.value || 'master';

        versionSelect.innerHTML = '<option value="master">Master Resume (Default)</option>';

        versions.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.id;
            const docBadge = v.filename ? ` (${v.filename})` : '';
            opt.innerText = `${v.version_name}${docBadge}`;
            versionSelect.appendChild(opt);
        });

        versionSelect.value = currentVal;
    } catch (err) {
        console.error('Error populating fit score version select:', err);
    }
}

// --------------------------------------------------------------------------
// 16. Resume Versions A/B Tracking Handlers
// --------------------------------------------------------------------------
function initResumeVersionsEvents() {
    const btnNavVersions = document.getElementById('btn-sidebar-resume-versions');
    if (btnNavVersions) {
        btnNavVersions.addEventListener('click', () => switchView('resume-versions'));
    }

    const btnFileSelect = document.getElementById('btn-select-version-file');
    const fileInput = document.getElementById('version-file-input');
    const fileLabel = document.getElementById('version-file-label');
    const addVersionForm = document.getElementById('add-version-form');

    if (btnFileSelect && fileInput) {
        btnFileSelect.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                if (fileLabel) fileLabel.innerText = e.target.files[0].name;
            }
        });
    }

    if (addVersionForm) {
        addVersionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('new-version-input');
            const version_name = nameInput ? nameInput.value.trim() : '';

            if (!version_name) {
                alert('Please enter a version name.');
                return;
            }

            const formData = new FormData();
            formData.append('version_name', version_name);
            if (fileInput && fileInput.files && fileInput.files[0]) {
                formData.append('resume_file', fileInput.files[0]);
            }

            const btnSave = document.getElementById('btn-add-version');
            if (btnSave) {
                btnSave.disabled = true;
                btnSave.innerText = 'Saving...';
            }

            try {
                const res = await fetch('/api/resume-versions', {
                    method: 'POST',
                    body: formData
                });

                if (res.ok) {
                    if (nameInput) nameInput.value = '';
                    if (fileInput) fileInput.value = '';
                    if (fileLabel) fileLabel.innerText = 'Attach File (.pdf, .docx)';
                    loadResumeVersionsPage();
                    populateResumeVersionSelects();
                    populateFitScoreVersionDropdown();
                } else {
                    const err = await res.json();
                    alert(err.error || 'Failed to add version.');
                }
            } catch (err) {
                console.error('Error adding version:', err);
                alert('Network error adding resume version.');
            } finally {
                if (btnSave) {
                    btnSave.disabled = false;
                    btnSave.innerText = 'Save Version';
                }
            }
        });
    }
}

async function populateResumeVersionSelects() {
    try {
        const res = await fetch('/api/resume-versions');
        if (!res.ok) return;

        const versions = await res.json();
        const selects = document.querySelectorAll('.resume-version-select');

        selects.forEach(select => {
            const currentVal = select.value;
            select.innerHTML = '<option value="">(None / Default)</option>';
            versions.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v.version_name;
                opt.innerText = v.version_name;
                select.appendChild(opt);
            });
            if (currentVal) select.value = currentVal;
        });
    } catch (err) {
        console.error('Error populating version selects:', err);
    }
}

async function loadResumeVersionsPage() {
    const pillsList = document.getElementById('versions-pills-list');
    const chartContainer = document.getElementById('versions-performance-container');
    const analyticsChart = document.getElementById('analytics-versions-chart');

    // 1. Render Saved Versions Cards
    if (pillsList) {
        try {
            const res = await fetch('/api/resume-versions');
            if (res.ok) {
                const versions = await res.json();
                if (versions.length === 0) {
                    pillsList.innerHTML = '<span class="skill-tag-none">No versions added yet. Upload or create one above!</span>';
                } else {
                    pillsList.innerHTML = '';
                    versions.forEach(v => {
                        const card = document.createElement('div');
                        card.className = 'version-card-item';

                        const fileTag = v.filename 
                            ? `<span class="version-file-tag"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg> ${v.filename}</span>`
                            : '<span class="skill-tag-none">No file attached</span>';

                        card.innerHTML = `
                            <div class="version-card-header">
                                <span class="version-title-text">${v.version_name}</span>
                                <button type="button" class="version-delete-btn" onclick="deleteResumeVersion(${v.id})" title="Delete Version">&times;</button>
                            </div>
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                ${fileTag}
                            </div>
                        `;
                        pillsList.appendChild(card);
                    });
                }
            }
        } catch (err) {
            console.error('Error fetching resume versions:', err);
        }
    }

    // 2. Render Conversion Performance Bars
    const renderStatsBars = (container, stats) => {
        if (!container) return;
        if (!stats || stats.length === 0) {
            container.innerHTML = '<div style="color: var(--text-muted); padding: 1rem;">No conversion data recorded yet.</div>';
            return;
        }

        container.innerHTML = '';
        stats.forEach(st => {
            const row = document.createElement('div');
            row.className = 'version-stat-bar-row';
            row.innerHTML = `
                <div class="version-stat-header">
                    <span class="version-stat-name">${st.version_name}</span>
                    <span class="version-stat-rate">Interview Rate: ${st.interview_rate}%</span>
                </div>
                <div class="version-progress-bg">
                    <div class="version-progress-fill" style="width: ${st.interview_rate}%;"></div>
                </div>
                <div class="version-stat-details">
                    <span>Total Apps: <strong>${st.total}</strong></span>
                    <span>Interviewing: <strong>${st.interviewing}</strong></span>
                    <span>Offered: <strong>${st.offered}</strong></span>
                    <span>Offer Rate: <strong>${st.offer_rate}%</strong></span>
                </div>
            `;
            container.appendChild(row);
        });
    };

    try {
        const res = await fetch('/api/analytics/resume-versions');
        if (res.ok) {
            const stats = await res.json();
            renderStatsBars(chartContainer, stats);
            renderStatsBars(analyticsChart, stats);
        }
    } catch (err) {
        console.error('Error fetching version analytics:', err);
    }
}

async function deleteResumeVersion(versionId) {
    if (!confirm('Are you sure you want to delete this resume version tag?')) return;
    try {
        const res = await fetch(`/api/resume-versions/${versionId}`, { method: 'DELETE' });
        if (res.ok) {
            loadResumeVersionsPage();
            populateResumeVersionSelects();
            populateFitScoreVersionDropdown();
        }
    } catch (err) {
        console.error('Error deleting resume version:', err);
    }
}


