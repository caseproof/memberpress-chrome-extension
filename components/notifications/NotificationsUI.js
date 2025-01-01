// NotificationsUI.js
export class NotificationsUI {
    constructor(containerElement, notificationService) {
        console.log('NotificationsUI constructor called');
        this.container = containerElement;
        this.notificationService = notificationService;
        this.currentFilter = 'all';
        this.initialize();
    }

    initialize() {
        console.log('NotificationsUI initializing');
        this.render();
        this.attachEventListeners();
        this.loadNotifications();
    }

    render() {
        console.log('Rendering NotificationsUI');
        this.container.innerHTML = `
            <div class="notifications-header">
                <div class="filter-buttons">
                    <button class="filter-btn active" data-filter="all">All</button>
                    <button class="filter-btn" data-filter="failed_payment">Failed Payments</button>
                    <button class="filter-btn" data-filter="new_member">New Members</button>
                </div>
                <div class="action-buttons">
                    <button class="action-btn" id="mark-all-read">
                        Mark All Read
                    </button>
                    <button class="action-btn" id="clear-notifications">
                        Clear All
                    </button>
                </div>
            </div>
            <div class="notifications-list"></div>
        `;

        // Cache DOM elements
        this.listElement = this.container.querySelector('.notifications-list');
        this.filterButtons = this.container.querySelectorAll('.filter-btn');
        console.log('UI elements rendered');
    }

    async loadNotifications() {
        console.log('Loading notifications');
        try {
            const notifications = await this.notificationService.loadNotifications();
            console.log('Loaded notifications:', notifications);
            this.renderNotifications(this.filterNotifications(notifications));
        } catch (error) {
            console.error('Error loading notifications:', error);
            this.listElement.innerHTML = `
                <div class="error-state">
                    Error loading notifications. Please try again.
                </div>
            `;
        }
    }

    filterNotifications(notifications) {
        console.log('Filtering notifications:', this.currentFilter);
        if (this.currentFilter === 'all') return notifications;
        return notifications.filter(n => n.type === this.currentFilter);
    }

    renderNotifications(notifications) {
        console.log('Rendering notifications:', notifications);
        if (!notifications || notifications.length === 0) {
            this.listElement.innerHTML = this.getEmptyStateHTML();
            return;
        }

        this.listElement.innerHTML = notifications.map(notification => 
            this.getNotificationHTML(notification)
        ).join('');

        // Attach click handlers
        this.listElement.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', () => {
                console.log('Notification clicked:', item.dataset.id);
                this.handleNotificationClick(item.dataset.id);
            });
        });
    }

    attachEventListeners() {
        console.log('Attaching event listeners');
        
        // Filter buttons
        this.filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                console.log('Filter clicked:', button.dataset.filter);
                this.filterButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                this.currentFilter = button.dataset.filter;
                this.loadNotifications();
            });
        });

        // Action buttons
        const markAllReadBtn = this.container.querySelector('#mark-all-read');
        const clearAllBtn = this.container.querySelector('#clear-notifications');

        if (markAllReadBtn) {
            markAllReadBtn.addEventListener('click', () => {
                console.log('Mark all read clicked');
                this.handleMarkAllRead();
            });
        }

        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                console.log('Clear all clicked');
                this.handleClearAll();
            });
        }

        // Listen for notification updates
        window.addEventListener('memberpress_notification', (event) => {
            console.log('Notification event received:', event.detail);
            if (['notifications_updated', 'notifications_cleared'].includes(event.detail.type)) {
                this.loadNotifications();
            }
        });
    }

    getEmptyStateHTML() {
        return `
            <div class="empty-state">
                <p>No notifications</p>
            </div>
        `;
    }

    getNotificationHTML(notification) {
        return `
            <div class="notification-item ${notification.read ? '' : 'unread'}" 
                 data-id="${notification.id}">
                <div class="notification-content">
                    <div class="notification-header">
                        <span class="notification-title">${notification.title}</span>
                        <span class="notification-time">
                            ${this.formatTimeAgo(notification.timestamp)}
                        </span>
                    </div>
                    <div class="notification-message">${notification.message}</div>
                </div>
            </div>
        `;
    }

    formatTimeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return new Date(timestamp).toLocaleDateString();
    }

    async handleNotificationClick(id) {
        console.log('Handling notification click:', id);
        await this.notificationService.markAsRead([id]);
        this.loadNotifications();
    }

    async handleMarkAllRead() {
        console.log('Handling mark all read');
        const notifications = await this.notificationService.loadNotifications();
        const unreadIds = notifications
            .filter(n => !n.read)
            .map(n => n.id);
            
        if (unreadIds.length) {
            await this.notificationService.markAsRead(unreadIds);
            this.loadNotifications();
        }
    }

    async handleClearAll() {
        console.log('Handling clear all');
        if (confirm('Are you sure you want to clear all notifications?')) {
            await this.notificationService.clearNotifications();
            this.loadNotifications();
        }
    }
}