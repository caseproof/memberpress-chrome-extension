// NotificationService.js
export class NotificationService {
    constructor() {
        this.checkInterval = 5 * 60 * 1000; // 5 minutes default
        this.notifications = [];
        this.settings = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;
        
        this.settings = await this.loadSettings();
        await this.loadNotifications();
        this.startPeriodicCheck();
        this.initialized = true;

        // Set up message listener for background script communication
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'notification_update') {
                this.loadNotifications();
            }
        });
    }

    async loadSettings() {
        return new Promise((resolve) => {
            chrome.storage.sync.get({
                notifications: {
                    enabled: true,
                    failedPayments: true,
                    newMembers: true,
                    canceledSubscriptions: true,
                    expiringMemberships: true,
                    checkInterval: 5, // minutes
                    lastCheck: null
                }
            }, (items) => resolve(items.notifications));
        });
    }

    async loadNotifications() {
        return new Promise((resolve) => {
            chrome.storage.local.get({ notifications: [] }, (items) => {
                this.notifications = items.notifications;
                this.updateBadge();
                resolve(this.notifications);
            });
        });
    }

    async saveNotifications() {
        return new Promise((resolve) => {
            chrome.storage.local.set({ 
                notifications: this.notifications 
            }, () => {
                this.updateBadge();
                resolve();
            });
        });
    }

    startPeriodicCheck() {
        if (!this.settings.enabled) return;
        
        // Initial check
        this.checkForUpdates();
        
        // Set up periodic checks
        setInterval(() => {
            this.checkForUpdates();
        }, this.settings.checkInterval * 60 * 1000);
    }

    async checkForUpdates() {
        if (!this.settings.enabled) return;
        
        const now = Date.now();
        const lastCheck = this.settings.lastCheck || 0;
        
        try {
            const updates = await this.fetchUpdates(lastCheck);
            await this.processUpdates(updates);
            await this.updateLastCheck(now);
        } catch (error) {
            console.error('Error checking for updates:', error);
        }
    }

    async fetchUpdates(since) {
        const credentials = await this.getCredentials();
        if (!credentials.baseUrl || !credentials.apiKey) {
            throw new Error('API credentials not configured');
        }

        const updates = {
            failedPayments: [],
            newMembers: [],
            canceledSubscriptions: [],
            expiringMemberships: []
        };

        if (this.settings.failedPayments) {
            updates.failedPayments = await this.fetchFailedPayments(since);
        }

        if (this.settings.newMembers) {
            updates.newMembers = await this.fetchNewMembers(since);
        }

        if (this.settings.canceledSubscriptions) {
            updates.canceledSubscriptions = await this.fetchCanceledSubscriptions(since);
        }

        if (this.settings.expiringMemberships) {
            updates.expiringMemberships = await this.fetchExpiringMemberships();
        }

        return updates;
    }

    async fetchFailedPayments(since) {
        const response = await this.makeApiRequest('transactions', {
            status: 'failed',
            after: new Date(since).toISOString()
        });
        return response.data || [];
    }

    async fetchNewMembers(since) {
        const response = await this.makeApiRequest('members', {
            after: new Date(since).toISOString()
        });
        return response.data || [];
    }

    async fetchCanceledSubscriptions(since) {
        const response = await this.makeApiRequest('subscriptions', {
            status: 'cancelled',
            after: new Date(since).toISOString()
        });
        return response.data || [];
    }

    async fetchExpiringMemberships() {
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        
        const response = await this.makeApiRequest('transactions', {
            status: 'active',
            expires_before: thirtyDaysFromNow.toISOString()
        });
        return response.data || [];
    }

    async processUpdates(updates) {
        const notifications = [];

        // Process failed payments
        updates.failedPayments.forEach(payment => {
            notifications.push({
                id: `payment-${payment.id}`,
                type: 'failed_payment',
                title: 'Failed Payment',
                message: `Payment failed for ${payment.member.email} (${payment.total})`,
                data: payment,
                timestamp: Date.now(),
                read: false
            });
        });

        // Process new members
        updates.newMembers.forEach(member => {
            notifications.push({
                id: `member-${member.id}`,
                type: 'new_member',
                title: 'New Member',
                message: `${member.first_name} ${member.last_name} (${member.email}) has joined`,
                data: member,
                timestamp: Date.now(),
                read: false
            });
        });

        // Process canceled subscriptions
        updates.canceledSubscriptions.forEach(subscription => {
            notifications.push({
                id: `subscription-${subscription.id}`,
                type: 'subscription_canceled',
                title: 'Subscription Canceled',
                message: `${subscription.member.email}'s subscription was canceled`,
                data: subscription,
                timestamp: Date.now(),
                read: false
            });
        });

        // Process expiring memberships
        updates.expiringMemberships.forEach(membership => {
            const daysUntilExpiry = this.calculateDaysUntilExpiry(membership.expires_at);
            if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
                notifications.push({
                    id: `expiring-${membership.id}`,
                    type: 'membership_expiring',
                    title: 'Membership Expiring Soon',
                    message: `${membership.member.email}'s membership expires in ${daysUntilExpiry} days`,
                    data: membership,
                    timestamp: Date.now(),
                    read: false
                });
            }
        });

        if (notifications.length > 0) {
            this.notifications = [...notifications, ...this.notifications].slice(0, 100);
            await this.saveNotifications();
            this.dispatchEvent('notifications_updated');
        }
    }

    calculateDaysUntilExpiry(expiryDate) {
        const now = new Date();
        const expiry = new Date(expiryDate);
        const diffTime = expiry - now;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    async markAsRead(notificationIds) {
        let updated = false;
        this.notifications = this.notifications.map(notification => {
            if (notificationIds.includes(notification.id) && !notification.read) {
                updated = true;
                return { ...notification, read: true };
            }
            return notification;
        });

        if (updated) {
            await this.saveNotifications();
            this.dispatchEvent('notifications_updated');
        }
    }

    async clearNotifications() {
        this.notifications = [];
        await this.saveNotifications();
        this.dispatchEvent('notifications_cleared');
    }

    updateBadge() {
        const unreadCount = this.notifications.filter(n => !n.read).length;
        
        chrome.action.setBadgeText({
            text: unreadCount > 0 ? unreadCount.toString() : ''
        });

        chrome.action.setBadgeBackgroundColor({
            color: '#FF0000'
        });
    }

    dispatchEvent(type, data = null) {
        const event = new CustomEvent('memberpress_notification', {
            detail: { type, data }
        });
        window.dispatchEvent(event);
    }

    async getCredentials() {
        return new Promise((resolve) => {
            chrome.storage.sync.get({
                baseUrl: '',
                apiKey: ''
            }, resolve);
        });
    }

    async makeApiRequest(endpoint, params = {}) {
        const credentials = await this.getCredentials();
        if (!credentials.baseUrl || !credentials.apiKey) {
            throw new Error('API credentials not configured');
        }

        const queryString = new URLSearchParams(params).toString();
        const url = `${credentials.baseUrl}/wp-json/mp/v1/${endpoint}${queryString ? '?' + queryString : ''}`;

        const response = await fetch(url, {
            headers: {
                'MEMBERPRESS-API-KEY': credentials.apiKey,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
        }

        return await response.json();
    }

    async updateLastCheck(timestamp) {
        this.settings.lastCheck = timestamp;
        return new Promise((resolve) => {
            chrome.storage.sync.set({
                notifications: {
                    ...this.settings,
                    lastCheck: timestamp
                }
            }, resolve);
        });
    }
}