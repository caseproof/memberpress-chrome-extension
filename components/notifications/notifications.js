// notifications.js
export class NotificationsUI {
    constructor(containerElement, notificationService) {
        this.container = containerElement;
        this.notificationService = notificationService;
        this.currentFilter = 'all';
        this.initialize();
    }

    initialize() {
        this.render();
        this.attachEventListeners();
        this.loadNotifications();
    }

    render() {
        this.container.innerHTML = `
            <div class="notifications-header">
                <div class="filter-buttons">
                    <button class="filter-btn active" data-filter="all">All</button>
                    <button class="filter-btn" data-filter="failed_payment">Failed Payments</button>
                    <button class="filter-btn" data-filter="new_member">New Members</button>
                </div>
                <div class="action-buttons">
                    <button class="action-btn" id="mark-all-read">
                        <i class="icon-check"></i> Mark All Read
                    </button>
                    <button class="action-btn" id="clear-notifications">
                        <i class="icon-trash"></i> Clear All
                    </button>
                </div>
            </div>
            <div class="notifications-list"></div>
        `;

        // Cache DOM elements
        this.listElement = this.container.querySelector('.notifications-list');
        this.filterButtons = this.container.querySelectorAll('.filter-btn');
    }

    attachEventListeners() {
        // Filter buttons
        this.filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.filterButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                this.currentFilter = button.dataset.filter;
                this.loadNotifications();
            });
        });

        // Action buttons
        this.container.querySelector('#mark-all-read').addEventListener('click', () => {
            this.handleMarkAllRead();
        });

        this.container.querySelector('#clear-notifications').addEventListener('click', () => {
            this.handleClearAll();
        });

        // Listen for notification updates
        window.addEventListener('memberpress_notification', (event) => {
            if (['notification_added', 'notifications_updated', 'notifications_cleared'].includes(event.detail.type)) {
                this.loadNotifications();
            }
        });
    }

    async loadNotifications() {
        this.showLoading();
        const notifications = await this.notificationService.loadNotifications();
        this.renderNotifications(this.filterNotifications(notifications));
        this.hideLoading();
    }

    filterNotifications(notifications) {
        if (this.currentFilter === 'all') return notifications;
        return notifications.filter(n => n.type === this.currentFilter);
    }

    renderNotifications(notifications) {
        if (notifications.length === 0) {
            this.listElement.innerHTML = this.getEmptyStateHTML();
            return;
        }

        this.listElement.innerHTML = notifications.map(notification => 
            this.getNotificationHTML(notification)
        ).join('');

        // Attach click handlers to individual notifications
        this.listElement.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', () => {
                this.handleNotificationClick(item.dataset.id);
            });
        });
    }

    getNotificationHTML(notification) {
        return `
            <div class="notification-item ${notification.read ? '' : 'unread'}" 
                 data-id="${notification.id}">
                <div class="notification-icon ${this.getIconClass(notification.type)}"></div>
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

    getEmptyStateHTML() {
        return `
            <div class="empty-state">
                <div class="empty-icon"></div>
                <p>No notifications</p>
            </div>
        `;
    }

    getIconClass(type) {
        switch (type) {
            case 'failed_payment': return 'icon-alert';
            case 'new_member': return 'icon-user';
            case 'subscription_canceled': return 'icon-x';
            case 'membership_expiring': return 'icon-clock';
            default: return 'icon-bell';
        }
    }

    formatTimeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        
        return new Date(timestamp).toLocaleDateString();
    }

    async handleNotificationClick(id) {
        await this.notificationService.markAsRead([id]);
        this.loadNotifications();
    }

    async handleMarkAllRead() {
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
        if (confirm('Are you sure you want to clear all notifications?')) {
            await this.notificationService.clearNotifications();
            this.loadNotifications();
        }
    }

    showLoading() {
        this.listElement.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
            </div>
        `;
    }

    hideLoading() {
        const spinner = this.listElement.querySelector('.loading-spinner');
        if (spinner) spinner.remove();
    }
}
