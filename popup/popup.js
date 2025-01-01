import { NotificationService } from './services/NotificationService.js';
import { NotificationsUI } from './components/notifications/notifications.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize notification service
    const notificationService = new NotificationService();
    await notificationService.initialize();

    // Initialize notifications UI
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
        initializeNotifications();
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

    // Initialize notification handling
    function initializeNotifications() {
        // Set up filter buttons
        document.querySelectorAll('.filter-btn').forEach(button => {
            button.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                currentNotificationFilter = button.dataset.filter;
                loadNotifications();
            });
        });

        // Set up action buttons
        document.getElementById('mark-all-read')?.addEventListener('click', markAllNotificationsRead);
        document.getElementById('clear-notifications')?.addEventListener('click', clearAllNotifications);

        // Initial notification load
        loadNotifications();
        updateNotificationCount();
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
                await loadNotifications();
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

    // Load and display notifications
    async function loadNotifications() {
        const notifications = await sendMessage({ type: 'getNotifications' });
        const filteredNotifications = currentNotificationFilter === 'all' 
            ? notifications 
            : notifications.filter(n => n.type === currentNotificationFilter);

        displayNotifications(filteredNotifications);
        updateNotificationCount(notifications);
    }

    // Display notifications
    function displayNotifications(notifications) {
        const emptyState = document.getElementById('notifications-empty');

        if (!notifications.length) {
            notificationsList.style.display = 'none';
            emptyState.style.display = 'flex';
            return;
        }

        notificationsList.style.display = 'flex';
        emptyState.style.display = 'none';
        notificationsList.innerHTML = '';

        notifications.forEach(notification => {
            const notificationHtml = `
                <div class="notification-item ${notification.read ? '' : 'unread'}" data-id="${notification.id}">
                    <div class="notification-icon icon-${notification.type}">
                        ${getNotificationIcon(notification.type)}
                    </div>
                    <div class="notification-content">
                        <div class="notification-title">${notification.title}</div>
                        <div class="notification-message">${notification.message}</div>
                        <div class="notification-time">
                            <span class="time-badge ${isRecent(notification.timestamp) ? 'recent' : ''}">
                                ${formatRelativeTime(notification.timestamp)}
                            </span>
                        </div>
                    </div>
                    <div class="notification-actions">
                        ${getNotificationActions(notification)}
                    </div>
                </div>
            `;

            notificationsList.insertAdjacentHTML('beforeend', notificationHtml);
        });

        notificationsList.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', () => handleNotificationClick(item.dataset.id));
        });
    }

    // Update notification count badge
    async function updateNotificationCount() {
        const notifications = await sendMessage({ type: 'getNotifications' });
        const unreadCount = notifications.filter(n => !n.read).length;
        const badge = document.getElementById('notification-count');
        
        if (unreadCount > 0) {
            badge.textContent = unreadCount;
            badge.style.display = 'inline-flex';
        } else {
            badge.style.display = 'none';
        }
    }

    // Handle notification click
    async function handleNotificationClick(notificationId) {
        await sendMessage({
            type: 'markAsRead',
            ids: [notificationId]
        });
        
        const notification = document.querySelector(`.notification-item[data-id="${notificationId}"]`);
        if (notification) {
            notification.classList.remove('unread');
        }
        
        updateNotificationCount();
    }

    // Mark all notifications as read
    async function markAllNotificationsRead() {
        const notifications = await sendMessage({ type: 'getNotifications' });
        const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
        
        if (unreadIds.length) {
            await sendMessage({
                type: 'markAsRead',
                ids: unreadIds
            });
            
            loadNotifications();
        }
    }

    // Clear all notifications
    async function clearAllNotifications() {
        if (confirm('Are you sure you want to clear all notifications?')) {
            await sendMessage({ type: 'clearNotifications' });
            loadNotifications();
        }
    }

    // Helper: Get notification icon
    function getNotificationIcon(type) {
        switch (type) {
            case 'failed_payment': return '💳';
            case 'new_member': return '👤';
            case 'subscription_canceled': return '🚫';
            case 'membership_expiring': return '⏰';
            default: return '🔔';
        }
    }

    // Helper: Check if notification is recent
    function isRecent(timestamp) {
        return (new Date() - new Date(timestamp)) < 86400000; // 24 hours
    }

    // Helper: Get notification actions
    function getNotificationActions(notification) {
        switch (notification.type) {
            case 'failed_payment':
                return `
                    <button class="notification-action primary" data-action="view-transaction" data-id="${notification.data.id}">
                        View Transaction
                    </button>
                `;
            case 'new_member':
                return `
                    <button class="notification-action primary" data-action="view-member" data-id="${notification.data.id}">
                        View Member
                    </button>
                `;
            case 'subscription_canceled':
                return `
                    <button class="notification-action primary" data-action="view-subscription" data-id="${notification.data.id}">
                        View Subscription
                    </button>
                `;
            case 'membership_expiring':
                return `
                    <button class="notification-action primary" data-action="view-membership" data-id="${notification.data.id}">
                        View Membership
                    </button>
                `;
            default:
                return '';
        }
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

    // Handle notification action clicks
    document.addEventListener('click', async (e) => {
        const actionButton = e.target.closest('.notification-action');
        if (!actionButton) return;

        e.stopPropagation(); // Prevent notification item click

        const { action, id } = actionButton.dataset;
        const settings = await getStoredSettings();

        switch (action) {
            case 'view-transaction':
                chrome.tabs.create({
                    url: `${settings.baseUrl}/wp-admin/admin.php?page=memberpress-trans&action=edit&id=${id}`
                });
                break;
            case 'view-member':
                navigateToMemberPage(id);
                break;
            case 'view-subscription':
                navigateToSubscriptionPage(id);
                break;
            case 'view-membership':
                chrome.tabs.create({
                    url: `${settings.baseUrl}/wp-admin/admin.php?page=memberpress-memberships&action=edit&id=${id}`
                });
                break;
        }
    });

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
            