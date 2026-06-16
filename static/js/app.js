/**
 * BigQuery Release Hub - Frontend Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    // State management
    let releaseUpdates = [];
    let currentFilter = 'all';
    let searchQuery = '';

    // DOM Elements
    const feedContainer = document.getElementById('feed-container');
    const skeletonLoader = document.getElementById('skeleton-loader');
    const emptyState = document.getElementById('empty-state');
    const refreshBtn = document.getElementById('refresh-btn');
    const refreshSpinner = document.getElementById('refresh-spinner');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const themeIcon = document.getElementById('theme-icon');
    const themeText = document.getElementById('theme-text');
    const searchInput = document.getElementById('search-input');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const lastUpdatedText = document.getElementById('last-updated-text');
    
    // Stats
    const statTotal = document.getElementById('stat-total');
    const statFeatures = document.getElementById('stat-features');

    // Tweet Modal Elements
    const tweetModal = document.getElementById('tweet-modal');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const tweetPreviewBadge = document.getElementById('tweet-preview-badge');
    const tweetPreviewDate = document.getElementById('tweet-preview-date');
    const tweetPreviewSourceText = document.getElementById('tweet-preview-source-text');
    const xTweetPreviewText = document.getElementById('x-tweet-preview-text');
    const charCount = document.getElementById('char-count');
    const charCounterContainer = document.querySelector('.char-counter');
    const cancelTweetBtn = document.getElementById('cancel-tweet-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const sendTweetBtn = document.getElementById('send-tweet-btn');
    
    // Active tweet data being composed
    let activeTweetData = null;

    // Theme switching logic
    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        
        if (theme === 'light') {
            themeIcon.className = 'fa-solid fa-moon';
            themeText.textContent = 'Dark Mode';
            themeToggleBtn.title = 'Switch to Dark Mode';
        } else {
            themeIcon.className = 'fa-solid fa-sun';
            themeText.textContent = 'Light Mode';
            themeToggleBtn.title = 'Switch to Light Mode';
        }
    }

    // Initialize the app
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    fetchReleaseNotes();

    // Event Listeners
    refreshBtn.addEventListener('click', fetchReleaseNotes);
    exportCsvBtn.addEventListener('click', exportToCsv);
    themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    });
    
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        renderFeed();
    });

    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderFeed();
        });
    });

    // Close Modal Events
    const closeModal = () => {
        tweetModal.classList.remove('active');
        activeTweetData = null;
    };
    cancelTweetBtn.addEventListener('click', closeModal);
    closeModalBtn.addEventListener('click', closeModal);
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) closeModal();
    });

    // Textarea input event for live preview & character counting
    tweetTextarea.addEventListener('input', updateTweetComposerState);

    // Send tweet event
    sendTweetBtn.addEventListener('click', () => {
        if (!activeTweetData) return;
        const text = tweetTextarea.value.trim();
        if (text.length === 0) {
            showToast('Post content cannot be empty!', 'error');
            return;
        }
        
        // Check real length (accounting for Twitter counting links as 23 chars)
        // For simplicity, we check character length of textarea, which is capped at 280
        if (text.length > 280) {
            showToast('Post exceeds the 280 character limit!', 'error');
            return;
        }

        // Open Twitter Web Intent in new window
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(twitterUrl, '_blank', 'noopener,noreferrer');
        closeModal();
        showToast('Redirected to Twitter composer!', 'success');
    });

    /**
     * Fetch Release Notes from backend API
     */
    async function fetchReleaseNotes() {
        setLoadingState(true);
        try {
            const response = await fetch('/api/release-notes');
            const result = await response.json();
            
            if (result.status === 'success') {
                processFeedData(result.data);
                renderFeed();
                updateStats();
                
                const now = new Date();
                lastUpdatedText.textContent = `Updated ${now.toLocaleTimeString()}`;
                showToast('Release notes synced successfully', 'success');
            } else {
                throw new Error(result.message || 'Failed to fetch notes');
            }
        } catch (error) {
            console.error(error);
            showToast(error.message || 'Error syncing release notes', 'error');
            lastUpdatedText.textContent = 'Sync failed';
        } finally {
            setLoadingState(false);
        }
    }

    /**
     * Process raw entry data and split into sub-updates
     */
    function processFeedData(entries) {
        releaseUpdates = [];
        const parser = new DOMParser();

        entries.forEach((entry, entryIndex) => {
            const doc = parser.parseFromString(entry.content, 'text/html');
            const children = Array.from(doc.body.children);
            
            let currentUpdate = null;
            let subIndex = 0;

            if (children.length === 0) {
                // If there's no children HTML, treat the raw content as a single generic update
                releaseUpdates.push({
                    id: `${entry.id || entryIndex}_0`,
                    date: entry.title,
                    type: 'Update',
                    contentHtml: entry.content || 'No description available.',
                    contentText: stripHtml(entry.content || 'No description available.'),
                    link: entry.link
                });
                return;
            }

            // Iterate elements and group by H3 tags
            children.forEach(child => {
                if (child.tagName === 'H3') {
                    if (currentUpdate) {
                        currentUpdate.contentText = stripHtml(currentUpdate.contentHtml);
                        releaseUpdates.push(currentUpdate);
                        subIndex++;
                    }
                    
                    const typeText = child.textContent.trim();
                    currentUpdate = {
                        id: `${entry.id || entryIndex}_${subIndex}`,
                        date: entry.title,
                        type: typeText,
                        contentHtml: '',
                        contentText: '',
                        link: entry.link
                    };
                } else {
                    // If no H3 has been found yet, create a default "Update" type
                    if (!currentUpdate) {
                        currentUpdate = {
                            id: `${entry.id || entryIndex}_${subIndex}`,
                            date: entry.title,
                            type: 'Update',
                            contentHtml: '',
                            contentText: '',
                            link: entry.link
                        };
                    }
                    currentUpdate.contentHtml += child.outerHTML;
                }
            });

            if (currentUpdate) {
                currentUpdate.contentText = stripHtml(currentUpdate.contentHtml);
                releaseUpdates.push(currentUpdate);
            }
        });
    }

    /**
     * Render release updates feed based on current filters and search queries
     */
    function renderFeed() {
        feedContainer.innerHTML = '';
        
        // Filter and Search updates
        const filtered = releaseUpdates.filter(update => {
            const matchesFilter = currentFilter === 'all' || 
                update.type.toLowerCase() === currentFilter;
                
            const matchesSearch = searchQuery === '' || 
                update.type.toLowerCase().includes(searchQuery) ||
                update.date.toLowerCase().includes(searchQuery) ||
                update.contentText.toLowerCase().includes(searchQuery);
                
            return matchesFilter && matchesSearch;
        });

        if (filtered.length === 0) {
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');

        // Group updates by date for display headers
        let lastDate = '';
        
        filtered.forEach(update => {
            if (update.date !== lastDate) {
                lastDate = update.date;
                const divider = document.createElement('div');
                divider.className = 'date-divider';
                divider.innerHTML = `<span>${update.date}</span>`;
                feedContainer.appendChild(divider);
            }

            const card = createReleaseCard(update);
            feedContainer.appendChild(card);
        });
    }

    /**
     * Create a single DOM card element for a release update
     */
    function createReleaseCard(update) {
        const card = document.createElement('article');
        card.className = 'release-card';
        card.dataset.id = update.id;
        
        const typeClass = getBadgeClass(update.type);
        
        card.innerHTML = `
            <div class="card-header">
                <div class="header-left">
                    <span class="badge ${typeClass}">${update.type}</span>
                    <span class="card-date"><i class="fa-regular fa-calendar"></i> ${update.date}</span>
                </div>
            </div>
            <div class="card-body">
                ${update.contentHtml}
            </div>
            <div class="card-actions">
                <button class="action-btn copy-btn">
                    <i class="fa-regular fa-copy"></i> Copy Note
                </button>
                <button class="action-btn tweet-btn">
                    <i class="fa-brands fa-x-twitter"></i> Tweet Note
                </button>
            </div>
        `;

        // Wire up Copy event
        card.querySelector('.copy-btn').addEventListener('click', () => {
            const textToCopy = `BigQuery Release Note - ${update.type} (${update.date}):\n${update.contentText}\n\nRead more: ${update.link}`;
            navigator.clipboard.writeText(textToCopy).then(() => {
                showToast('Copied note to clipboard!', 'success');
            }).catch(err => {
                console.error('Failed to copy text: ', err);
                showToast('Failed to copy to clipboard', 'error');
            });
        });

        // Wire up Tweet event
        card.querySelector('.tweet-btn').addEventListener('click', () => {
            openTweetComposer(update);
        });

        return card;
    }

    /**
     * Open Tweet Composer modal with default text populated
     */
    function openTweetComposer(update) {
        activeTweetData = update;

        // Visual badge matching the card type
        const typeClass = getBadgeClass(update.type);
        tweetPreviewBadge.className = `badge ${typeClass}`;
        tweetPreviewBadge.textContent = update.type;
        tweetPreviewDate.textContent = update.date;
        tweetPreviewSourceText.textContent = update.contentText;

        // Generate default tweet text
        const titleText = `BigQuery Update: ${update.type} (${update.date})\n`;
        const tags = `\n#BigQuery #GCP`;
        const link = `\n${update.link}`;
        
        // 280 - (link length which counts as 23) - tags length - title length
        // We truncate the description to fit comfortably
        const linkEquivalentLength = 23;
        const availableDescLength = 280 - titleText.length - tags.length - linkEquivalentLength - 6; // buffer for ellipsis
        
        let description = update.contentText.trim();
        if (description.length > availableDescLength) {
            description = description.slice(0, availableDescLength) + '...';
        }
        
        // Set the textarea value
        tweetTextarea.value = `${titleText}"${description}"${link}${tags}`;
        
        // Trigger manual update of character count and previews
        updateTweetComposerState();

        // Show Modal
        tweetModal.classList.add('active');
        tweetTextarea.focus();
    }

    /**
     * Update character counters, validate limits, and render live preview
     */
    function updateTweetComposerState() {
        const text = tweetTextarea.value;
        const length = text.length;

        // Update character counter text
        charCount.textContent = length;
        
        // Counter coloring based on safety
        charCounterContainer.classList.remove('warning', 'danger');
        if (length >= 260 && length < 280) {
            charCounterContainer.classList.add('warning');
        } else if (length >= 280) {
            charCounterContainer.classList.add('danger');
        }

        // Disable button if text is too long or empty
        sendTweetBtn.disabled = length === 0 || length > 280;

        // Update live Twitter preview
        // Format links for visual presentation in the preview box
        let formattedPreview = text;
        if (activeTweetData && activeTweetData.link) {
            // Replace link inside preview with an interactive looking blue element
            formattedPreview = text.replace(activeTweetData.link, `<span style="color: #1d9bf0;">${activeTweetData.link}</span>`);
        }
        
        // Highlight hashtags in preview
        formattedPreview = formattedPreview.replace(/(#[a-zA-Z0-9_]+)/g, '<span style="color: #1d9bf0;">$1</span>');

        xTweetPreviewText.innerHTML = formattedPreview;
    }

    /**
     * Update stats panel totals
     */
    function updateStats() {
        statTotal.textContent = releaseUpdates.length;
        const features = releaseUpdates.filter(u => u.type.toLowerCase() === 'feature').length;
        statFeatures.textContent = features;
    }

    /**
     * Set UI state to loading / interactive
     */
    function setLoadingState(isLoading) {
        const statusInd = document.getElementById('last-updated-text').parentElement.querySelector('.status-indicator');
        if (isLoading) {
            refreshSpinner.classList.add('spinning');
            refreshBtn.disabled = true;
            skeletonLoader.classList.remove('hidden');
            feedContainer.classList.add('hidden');
            emptyState.classList.add('hidden');
            if (statusInd) {
                statusInd.className = 'status-indicator loading';
            }
        } else {
            refreshSpinner.classList.remove('spinning');
            refreshBtn.disabled = false;
            skeletonLoader.classList.add('hidden');
            feedContainer.classList.remove('hidden');
            if (statusInd) {
                statusInd.className = 'status-indicator online';
            }
        }
    }

    /**
     * Toast notification trigger
     */
    function showToast(message, type = 'success') {
        const toastContainer = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'success' ? 
            '<i class="fa-solid fa-circle-check toast-icon"></i>' : 
            '<i class="fa-solid fa-circle-exclamation toast-icon"></i>';
            
        toast.innerHTML = `
            ${icon}
            <span class="toast-message">${message}</span>
        `;
        
        toastContainer.appendChild(toast);
        
        // Animate out after 3.5 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    /**
     * Export currently filtered release updates to a CSV file
     */
    function exportToCsv() {
        const filtered = releaseUpdates.filter(update => {
            const matchesFilter = currentFilter === 'all' || 
                update.type.toLowerCase() === currentFilter;
                
            const matchesSearch = searchQuery === '' || 
                update.type.toLowerCase().includes(searchQuery) ||
                update.date.toLowerCase().includes(searchQuery) ||
                update.contentText.toLowerCase().includes(searchQuery);
                
            return matchesFilter && matchesSearch;
        });

        if (filtered.length === 0) {
            showToast('No updates to export!', 'error');
            return;
        }

        // Generate CSV string
        // Header: Date, Type, Description, Link
        let csvContent = '\uFEFF'; // Add BOM for Excel UTF-8 support
        csvContent += '"Date","Type","Description","Link"\r\n';

        filtered.forEach(update => {
            const date = update.date.replace(/"/g, '""');
            const type = update.type.replace(/"/g, '""');
            const desc = update.contentText.replace(/"/g, '""');
            const link = update.link.replace(/"/g, '""');
            
            csvContent += `"${date}","${type}","${desc}","${link}"\r\n`;
        });

        // Trigger file download
        try {
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const formattedDate = new Date().toISOString().slice(0, 10);
            
            link.setAttribute('href', url);
            link.setAttribute('download', `bigquery_releases_${formattedDate}.csv`);
            link.style.visibility = 'hidden';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showToast(`Exported ${filtered.length} updates to CSV!`, 'success');
        } catch (error) {
            console.error(error);
            showToast('Failed to export CSV', 'error');
        }
    }

    // Helper functions
    function stripHtml(html) {
        const tmp = document.createElement('DIV');
        tmp.innerHTML = html;
        // Add spaces for block level elements so text doesn't run together
        const paragraphs = tmp.querySelectorAll('p, li, h1, h2, h3, h4');
        paragraphs.forEach(p => {
            p.textContent = p.textContent.trim() + ' ';
        });
        return tmp.textContent.replace(/\s+/g, ' ').trim();
    }

    function getBadgeClass(type) {
        const t = type.toLowerCase();
        if (t === 'feature') return 'feature';
        if (t === 'issue') return 'issue';
        if (t === 'deprecation') return 'deprecation';
        if (t === 'changed') return 'changed';
        return 'default';
    }
});
