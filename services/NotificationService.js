// NotificationService.js
export class NotificationService {
    constructor() {
        this.checkInterval = 5 * 60 * 1000; // 5 minutes default
        this.notifications = [];
        this.settings = null;
        this.initialized = false;
        this.lastMemberCheck = null;
    }

    async initialize() {
        if (this.initialized) return;
        
        this.settings = await this.loadSettings();
        await this.loadNotifications();
        await this.loadLastCheckTimes();
        this.startPeriodicCheck();
        this.initialized = true;

        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'notification_update') {
                this.loadNotifications();
            }
        });
    }

    async loadLastCheckTimes() {
        return new Promise((resolve) => {
            chrome.storage.local.get({
                lastMemberCheck: null,
            }, (items) => {
                // Set last check to 24 hours ago if not set
                const oneDayAgo = new Date();
                oneDayAgo.setDate(oneDayAgo.getDate() - 1);
                this.lastMemberCheck = items.lastMemberCheck || oneDayAgo.toISOString();
                console.log('Loaded last check time:', this.lastMemberCheck);
                resolve();
            });
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

    getMinutesDifference(date1, date2) {
        const diff = date1.getTime() - date2.getTime();
        return Math.floor(diff / (1000 * 60));
    }

    async fetchNewMembers() {
        try {
            // Use a date 24 hours ago as the minimum check time
            const oneDayAgo = new Date();
            oneDayAgo.setDate(oneDayAgo.getDate() - 1);
            const checkTime = new Date(this.lastMemberCheck);
            
            // If lastMemberCheck is more than 24 hours ago, use 24 hours ago
            const afterDate = checkTime < oneDayAgo ? oneDayAgo : checkTime;
            
            console.log('Checking for members after:', afterDate.toISOString());
            
            const response = await this.makeApiRequest('members', {
                after: afterDate.toISOString(),
                per_page: 100,
                orderby: 'registered_at',
                order: 'desc'
            });

            // Update last check time to now
            this.lastMemberCheck = new Date().toISOString();
            await this.saveLastCheckTimes();

            // Process the members
            if (response.data && response.data.length > 0) {
                console.log('Found members:', response.data);
                return response.data;
            }

            return [];

        } catch (error) {
            console.error('Error fetching new members:', error);
            return [];
        }
    }

    async processNewMembers(members) {
        const notifications = members.map(member => ({
            id: `new-member-${member.id}-${Date.now()}`,
            type: 'new_member',
            title: 'New Member',
            message: `${member.first_name || ''} ${member.last_name || ''} (${member.email}) has joined`,
            data: member,
            timestamp: Date.now(),
            read: false,
            memberDate: member.registered_at
        }));

        if (notifications.length > 0) {
            console.log('Creating notifications for members:', notifications);
            // Add new notifications to the beginning of the array
            this.notifications = [...notifications, ...this.notifications].slice(0, 100);
            await this.saveNotifications();
            this.dispatchEvent('notifications_updated', { count: notifications.length });
        }
    }

    async checkForUpdates() {
        if (!this.settings.enabled || !this.settings.newMembers) return;
        
        try {
            console.log('Checking for new members since:', this.lastMemberCheck);
            const newMembers = await this.fetchNewMembers();
            
            if (newMembers.length > 0) {
                console.log('Found new members:', newMembers.length);
                await this.processNewMembers(newMembers);
            }
            
            // Update badge count
            this.updateBadge();
            
        } catch (error) {
            console.error('Error checking for updates:', error);
        }
    }

    async saveLastCheckTimes() {
        return new Promise((resolve) => {
            chrome.storage.local.set({
                lastMemberCheck: this.lastMemberCheck
            }, () => {
                console.log('Saved last check time:', this.lastMemberCheck);
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

    formatRelativeTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        
        return new Date(timestamp).toLocaleDateString();
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

        console.log('Making API request to:', url);

        try {
            const response = await fetch(url, {
                headers: {
                    'MEMBERPRESS-API-KEY': credentials.apiKey,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('API response:', data);
            return { data };
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }
}