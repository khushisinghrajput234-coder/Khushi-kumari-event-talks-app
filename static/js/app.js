// Application State
let state = {
    updates: [],
    currentFilter: 'all',
    currentSearch: '',
    lastSyncTime: null
};

// DOM Elements
const elements = {
    btnRefresh: document.getElementById('btn-refresh'),
    lastUpdated: document.getElementById('last-updated'),
    statusDot: document.querySelector('.status-dot'),
    searchInput: document.getElementById('search-input'),
    filterButtons: document.getElementById('filter-buttons'),
    feedContainer: document.getElementById('feed-container'),
    loadingState: document.getElementById('loading-state'),
    emptyState: document.getElementById('empty-state'),
    statsTotal: document.getElementById('stats-total'),
    
    // Count Badges
    countAll: document.getElementById('count-all'),
    countFeature: document.getElementById('count-feature'),
    countChange: document.getElementById('count-change'),
    countAnnouncement: document.getElementById('count-announcement'),
    countBreaking: document.getElementById('count-breaking'),
    countIssue: document.getElementById('count-issue'),
    
    // Modal Elements
    tweetModal: document.getElementById('tweet-modal'),
    tweetTextarea: document.getElementById('tweet-textarea'),
    tweetCharCount: document.getElementById('tweet-char-count'),
    tweetPreviewText: document.getElementById('tweet-preview-text'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    btnCopyTweet: document.getElementById('btn-copy-tweet'),
    btnPublishTweet: document.getElementById('btn-publish-tweet'),
    
    // Toast
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toast-message')
};

// Map types to emojis for tweets
const typeEmojis = {
    'Feature': '🚀',
    'Change': '🔄',
    'Announcement': '📢',
    'Breaking': '⚠️',
    'Issue': '🔧',
    'Update': '📝'
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    fetchReleaseNotes();
});

// Event Listeners setup
function initEventListeners() {
    // Refresh feed
    elements.btnRefresh.addEventListener('click', fetchReleaseNotes);
    
    // Search input (with debouncing)
    let searchTimeout;
    elements.searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            state.currentSearch = e.target.value.toLowerCase().trim();
            applyFiltersAndRender();
        }, 250);
    });

    // Filter type buttons
    elements.filterButtons.addEventListener('click', (e) => {
        const button = e.target.closest('.filter-btn');
        if (!button) return;

        // Update active class
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        // Set filter and render
        state.currentFilter = button.dataset.type;
        applyFiltersAndRender();
    });

    // Modal Close
    elements.btnCloseModal.addEventListener('click', hideTweetModal);
    elements.tweetModal.addEventListener('click', (e) => {
        if (e.target === elements.tweetModal) hideTweetModal();
    });

    // Tweet Textarea Input
    elements.tweetTextarea.addEventListener('input', (e) => {
        updateTweetPreview(e.target.value);
    });

    // Copy Tweet Button
    elements.btnCopyTweet.addEventListener('click', () => {
        const text = elements.tweetTextarea.value;
        navigator.clipboard.writeText(text).then(() => {
            showToast('Tweet copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            showToast('Failed to copy to clipboard.');
        });
    });

    // Publish Tweet Button (opens Twitter intent)
    elements.btnPublishTweet.addEventListener('click', () => {
        const text = elements.tweetTextarea.value;
        if (text.length > 280) {
            showToast('Tweet exceeds character limit!');
            return;
        }
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(twitterUrl, '_blank', 'noopener,noreferrer');
    });
}

// Fetch notes from Flask API
async function fetchReleaseNotes() {
    setLoadingState(true);
    
    try {
        const response = await fetch('/api/release-notes');
        if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        
        if (data.status === 'success') {
            state.updates = data.updates;
            state.lastSyncTime = new Date();
            updateSyncTimeLabel();
            updateCountBadges();
            applyFiltersAndRender();
        } else {
            throw new Error(data.message || 'Unknown backend error');
        }
    } catch (error) {
        console.error('Failed to load release notes:', error);
        showToast(`Error: ${error.message}`);
        setLoadingState(false);
        elements.emptyState.classList.remove('hidden');
        elements.feedContainer.classList.add('hidden');
    }
}

// Loading state controller
function setLoadingState(isLoading) {
    if (isLoading) {
        elements.btnRefresh.classList.add('loading');
        elements.btnRefresh.disabled = true;
        elements.loadingState.classList.remove('hidden');
        elements.feedContainer.classList.add('hidden');
        elements.emptyState.classList.add('hidden');
        
        elements.statusDot.className = 'status-dot syncing';
    } else {
        elements.btnRefresh.classList.remove('loading');
        elements.btnRefresh.disabled = false;
        elements.loadingState.classList.add('hidden');
        
        elements.statusDot.className = 'status-dot green';
    }
}

// Update Last Sync Label
function updateSyncTimeLabel() {
    if (!state.lastSyncTime) return;
    const options = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
    const timeStr = state.lastSyncTime.toLocaleTimeString(undefined, options);
    elements.lastUpdated.textContent = `Last sync: ${timeStr}`;
}

// Update Count Badges in Sidebar
function updateCountBadges() {
    const counts = {
        all: state.updates.length,
        Feature: 0,
        Change: 0,
        Announcement: 0,
        Breaking: 0,
        Issue: 0
    };

    state.updates.forEach(update => {
        if (counts.hasOwnProperty(update.type)) {
            counts[update.type]++;
        }
    });

    elements.countAll.textContent = counts.all;
    elements.countFeature.textContent = counts.Feature;
    elements.countChange.textContent = counts.Change;
    elements.countAnnouncement.textContent = counts.Announcement;
    elements.countBreaking.textContent = counts.Breaking;
    elements.countIssue.textContent = counts.Issue;
}

// Filter and Render logic
function applyFiltersAndRender() {
    setLoadingState(false);
    
    // Filter updates
    const filtered = state.updates.filter(update => {
        // Filter by Type
        const matchesType = state.currentFilter === 'all' || update.type === state.currentFilter;
        
        // Filter by Search Keyword
        const matchesSearch = !state.currentSearch || 
            update.content_text.toLowerCase().includes(state.currentSearch) ||
            update.type.toLowerCase().includes(state.currentSearch) ||
            update.date.toLowerCase().includes(state.currentSearch);
            
        return matchesType && matchesSearch;
    });

    elements.statsTotal.textContent = filtered.length;

    if (filtered.length === 0) {
        elements.feedContainer.classList.add('hidden');
        elements.emptyState.classList.remove('hidden');
        return;
    }

    elements.emptyState.classList.add('hidden');
    elements.feedContainer.classList.remove('hidden');
    
    // Group updates by date
    const groups = {};
    filtered.forEach(update => {
        if (!groups[update.date]) {
            groups[update.date] = [];
        }
        groups[update.date].push(update);
    });

    // Render HTML
    elements.feedContainer.innerHTML = '';
    
    // Dates are returned in order of appearance in feed (newest first)
    for (const date in groups) {
        const groupEl = document.createElement('div');
        groupEl.className = 'feed-group';
        
        // Group Header
        const headerEl = document.createElement('div');
        headerEl.className = 'group-date-header';
        headerEl.innerHTML = `<span>${date}</span>`;
        groupEl.appendChild(headerEl);
        
        // Group Cards
        groups[date].forEach(update => {
            const cardEl = renderUpdateCard(update);
            groupEl.appendChild(cardEl);
        });
        
        elements.feedContainer.appendChild(groupEl);
    }
}

// Render a single update card
function renderUpdateCard(update) {
    const card = document.createElement('div');
    card.className = 'update-card';
    
    const typeLower = update.type.toLowerCase();
    
    card.innerHTML = `
        <div class="card-header">
            <span class="type-badge ${typeLower}">${update.type}</span>
            <div class="card-actions">
                <button class="btn-card-action tweet-btn" title="Tweet this update">
                    <svg viewBox="0 0 24 24" width="16" height="16">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="currentColor"/>
                    </svg>
                </button>
            </div>
        </div>
        <div class="card-content">
            ${update.content_html}
        </div>
    `;
    
    // Add Event listener to Tweet button
    card.querySelector('.tweet-btn').addEventListener('click', () => {
        openTweetModal(update);
    });
    
    return card;
}

// Open Tweet Composer Modal
function openTweetModal(update) {
    const emoji = typeEmojis[update.type] || '📝';
    const cleanDate = update.date.replace(/,\s*\d{4}/, ''); // Truncate year if needed to save space
    
    const prefix = `${emoji} BigQuery ${update.type} [${cleanDate}]: `;
    const suffix = `\n\n#GoogleCloud #BigQuery`;
    const linkPlaceholder = `\nLearn more: ${update.link}`;
    
    // Let's determine how many characters are left for the description text.
    // Standard Twitter links are shortened to 23 characters, but in our local count we'll count the actual URL length 
    // to be safe and accurate for standard inputs.
    const overhead = prefix.length + suffix.length + linkPlaceholder.length;
    const maxDescLength = 280 - overhead;
    
    let description = update.content_text;
    
    // Handle smart truncation of description
    if (description.length > maxDescLength) {
        description = description.slice(0, maxDescLength - 3) + '...';
    }
    
    const defaultTweetText = `${prefix}${description}${linkPlaceholder}${suffix}`;
    
    elements.tweetTextarea.value = defaultTweetText;
    updateTweetPreview(defaultTweetText);
    
    elements.tweetModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Disable background scrolling
}

// Close Tweet Composer Modal
function hideTweetModal() {
    elements.tweetModal.classList.add('hidden');
    document.body.style.overflow = ''; // Re-enable background scrolling
}

// Live update Tweet preview and character count
function updateTweetPreview(text) {
    elements.tweetPreviewText.textContent = text;
    
    const count = text.length;
    elements.tweetCharCount.textContent = `${count}/280`;
    
    // Visual indicators for character count limits
    const counterEl = elements.tweetCharCount.parentElement;
    if (count > 280) {
        counterEl.className = 'tweet-counter-container danger';
        elements.btnPublishTweet.disabled = true;
    } else if (count > 250) {
        counterEl.className = 'tweet-counter-container warning';
        elements.btnPublishTweet.disabled = false;
    } else {
        counterEl.className = 'tweet-counter-container';
        elements.btnPublishTweet.disabled = false;
    }
}

// Show notification toast
function showToast(message) {
    elements.toastMessage.textContent = message;
    elements.toast.classList.remove('hidden');
    
    // Trigger CSS animation flow
    setTimeout(() => {
        elements.toast.classList.add('hidden');
    }, 3000);
}
