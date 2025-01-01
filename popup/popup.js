// popup.js
import { NotificationsUI } from '../components/notifications/NotificationsUI.js';
import { NotificationService } from '../services/NotificationService.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize NotificationService and UI
    const notificationService = new NotificationService();
    await notificationService.initialize();
    
    // Initialize NotificationsUI
    const notificationsContainer = document.getElementById('notifications-tab');
    const notificationsUI = new NotificationsUI(notificationsContainer, notificationService);

    // State management
    let currentTab = 'members';
    let currentPage = 1;
    let currentNotificationFilter = 'all';
    const perPage = 10;
    let searchTimeout = null;

    // Cache DOM elements
    const tabButtons = document.querySelectorAll('.tab-button');
    const searchInput = document.getElementById('search');
    const membersList = document.getElementById('members-list');
    const subscriptionsList = document.getElementById('subscriptions-list');
    const notificationsList = document.getElementById('notifications-list');
    const membersLoading = document.getElementById('members-loading');
    const subscriptionsLoading = document.getElementById('subscriptions-loading');

    // Initialize application
    function initialize() {
        initializeTabs();
        initializeSearch();
        checkConfiguration();
    }

    // Initialize tab handling
    function initializeTabs() {
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(`${button.dataset.tab}-tab`).classList.add('active');
                
                currentTab = button.dataset.tab;
                currentPage = 1;
                loadCurrentTabData();
            });
        });
    }

    // Initialize search functionality
    function initializeSearch() {
        searchInput.addEventListener('input', (e) => {
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }
            
            searchTimeout = setTimeout(() => {
                currentPage = 1;
                loadCurrentTabData();
            }, 300);
        });
    }

    // Check extension configuration
    async function checkConfiguration() {
        const settings = await getStoredSettings();
        if (!settings.baseUrl || !settings.apiKey) {
            showStatus('Please configure the extension settings first', true);
            document.getElementById('settings-prompt').style.display = 'flex';
            document.getElementById('open-settings').addEventListener('click', () => {
                chrome.runtime.openOptionsPage();
            });
        } else {
            loadCurrentTabData();
        }
    }

    // Load data for current tab
    async function loadCurrentTabData() {
        switch(currentTab) {
            case 'members':
                await loadMembers();
                break;
            case 'subscriptions':
                await loadSubscriptions();
                break;
            case 'notifications':
                // NotificationsUI handles this
                break;
        }
    }

    // Helper: Show status messages
    function showStatus(message, isError = false) {
        const status = document.getElementById('status');
        status.textContent = message;
        status.className = `status ${isError ? 'error' : 'success'}`;
        status.style.display = 'block';
        setTimeout(() => status.style.display = 'none', 3000);
    }

    // Helper: Format dates
    function formatDate(dateString) {
        return new Date(dateString).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    // Helper: Format relative time
    function formatRelativeTime(timestamp) {
        const now = new Date();
        const date = new Date(timestamp);
        const diff = Math.floor((now - date) / 1000); // difference in seconds

        if (diff < 60) return 'just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
        
        return formatDate(timestamp);
    }

    // Helper: Format currency
    function formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    }

    // Display pagination controls
    function displayPagination(totalPages, currentPage, containerId) {
        const pagination = document.getElementById(containerId);
        pagination.innerHTML = '';

        if (totalPages <= 1) return;

        const paginationHtml = `
            <button ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">Previous</button>
            <span class="page-info">Page ${currentPage} of ${totalPages}</span>
            <button ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">Next</button>
        `;

        pagination.innerHTML = paginationHtml;

        pagination.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', () => {
                currentPage = parseInt(button.dataset.page);
                loadCurrentTabData();
            });
        });
    }

    // Load and display members
    async function loadMembers() {
        membersLoading.classList.add('active');
        try {
            const response = await sendMessage({
                type: 'getMembers',
                page: currentPage,
                perPage,
                search: searchInput.value.trim()
            });

            if (response.error) throw new Error(response.error);
            
            displayMembers(response.data);
            displayPagination(response.totalPages, currentPage, 'members-pagination');
        } catch (error) {
            showStatus(error.message, true);
        } finally {
            membersLoading.classList.remove('active');
        }
    }

    // Display members list
    function displayMembers(members) {
        membersList.innerHTML = members.length ? '' : '<div class="no-results">No members found</div>';

        members.forEach(member => {
            const memberHtml = `
                <div class="list-item" data-member-id="${member.id}">
                    <div class="list-item-header">
                        <div class="list-item-title">${member.first_name} ${member.last_name}</div>
                        <div class="list-item-status status-${member.active_txn_count > 0 ? 'active' : 'expired'}">
                            ${member.active_txn_count > 0 ? 'Active' : 'Expired'}
                        </div>
                    </div>
                    <div class="member-info">
                        <div>
                            <span class="member-info-label">Email:</span>
                            ${member.email}
                        </div>
                        <div>
                            <span class="member-info-label">Joined:</span>
                            ${formatDate(member.registered_at)}
                        </div>
                        <div>
                            <span class="member-info-label">Active Memberships:</span>
                            ${member.active_txn_count}
                        </div>
                        <div>
                            <span class="member-info-label">Total Transactions:</span>
                            ${parseInt(member.active_txn_count) + parseInt(member.expired_txn_count)}
                        </div>
                    </div>
                    ${member.active_memberships.length ? `
                        <div class="member-memberships">
                            ${member.active_memberships.map(m => `
                                <span class="membership-tag">${m.title}</span>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
            membersList.insertAdjacentHTML('beforeend', memberHtml);
        });

        membersList.querySelectorAll('.list-item').forEach(item => {
            item.addEventListener('click', () => {
                navigateToMemberPage(item.dataset.memberId);
            });
        });
    }

    // Load and display subscriptions
    async function loadSubscriptions() {
        subscriptionsLoading.classList.add('active');
        try {
            const response = await sendMessage({
                type: 'getSubscriptions',
                page: currentPage,
                perPage,
                search: searchInput.value.trim()
            });

            if (response.error) throw new Error(response.error);
            
            displaySubscriptions(response.data);
            displayPagination(response.totalPages, currentPage, 'subscriptions-pagination');
        } catch (error) {
            showStatus(error.message, true);
        } finally {
            subscriptionsLoading.classList.remove('active');
        }
    }

    // Display subscriptions list
    function displaySubscriptions(subscriptions) {
        subscriptionsList.innerHTML = subscriptions.length ? '' : '<div class="no-results">No subscriptions found</div>';

        subscriptions.forEach(subscription => {
            const subscriptionHtml = `
                <div class="list-item" data-subscription-id="${subscription.id}">
                    <div class="list-item-header">
                        <div class="list-item-title">${subscription.member.first_name} ${subscription.member.last_name}</div>
                        <div class="list-item-status status-${subscription.status}">
                            ${subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                        </div>
                    </div>
                    <div class="subscription-info">
                        <div>
                            <span class="member-info-label">Membership:</span>
                            ${subscription.membership.title}
                        </div>
                        <div>
                            <span class="member-info-label">Created:</span>
                            ${formatDate(subscription.created_at)}
                        </div>
                        <div class="price-info">
                            <span class="member-info-label">Billing:</span>
                            ${formatCurrency(subscription.total)} / ${subscription.period} ${subscription.period_type}
                        </div>
                        <div>
                            <span class="member-info-label">Gateway:</span>
                            ${subscription.gateway}
                        </div>
                    </div>
                </div>
            `;
            subscriptionsList.insertAdjacentHTML('beforeend', subscriptionHtml);
        });

        subscriptionsList.querySelectorAll('.list-item').forEach(item => {
            item.addEventListener('click', () => {
                navigateToSubscriptionPage(item.dataset.subscriptionId);
            });
        });
    }

    // Helper: Navigate to member page in WordPress admin
    async function navigateToMemberPage(memberId) {
        const settings = await getStoredSettings();
        if (settings.baseUrl) {
            chrome.tabs.create({
                url: `${settings.baseUrl}/wp-admin/admin.php?page=memberpress-members&action=edit&id=${memberId}`
            });
        }
    }

    // Helper: Navigate to subscription page in WordPress admin
    async function navigateToSubscriptionPage(subscriptionId) {
        const settings = await getStoredSettings();
        if (settings.baseUrl) {
            chrome.tabs.create({
                url: `${settings.baseUrl}/wp-admin/admin.php?page=memberpress-subscriptions&action=edit&id=${subscriptionId}`
            });
        }
    }

    // Helper: Get stored settings
    async function getStoredSettings() {
        return new Promise((resolve) => {
            chrome.storage.sync.get({
                baseUrl: '',
                apiKey: '',
                notifications: {
                    enabled: true,
                    failedPayments: true,
                    newMembers: true,
                    canceledSubscriptions: true,
                    expiringMemberships: true,
                    checkInterval: 5,
                    lastCheck: null
                }
            }, resolve);
        });
    }

    // Helper: Send message to background script
    async function sendMessage(message) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage(message, resolve);
        });
    }

    // Handle keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Alt + N to switch to notifications tab
        if (e.altKey && e.key === 'n') {
            const notificationsTab = document.querySelector('[data-tab="notifications"]');
            if (notificationsTab) notificationsTab.click();
        }
        // Alt + M to switch to members tab
        else if (e.altKey && e.key === 'm') {
            const membersTab = document.querySelector('[data-tab="members"]');
            if (membersTab) membersTab.click();
        }
        // Alt + S to switch to subscriptions tab
        else if (e.altKey && e.key === 's') {
            const subscriptionsTab = document.querySelector('[data-tab="subscriptions"]');
            if (subscriptionsTab) subscriptionsTab.click();
        }
        // Alt + R to refresh current tab data
        else if (e.altKey && e.key === 'r') {
            loadCurrentTabData();
        }
    });

    // Initialize the application
    initialize();
});