// API Service Layer for MemberPress Manager
export class MemberPressAPI {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    // Get stored credentials
    async getCredentials() {
        return new Promise((resolve) => {
            chrome.storage.sync.get({
                baseUrl: '',
                apiKey: ''
            }, (items) => resolve(items));
        });
    }

    // Validate credentials
    validateCredentials(credentials) {
        if (!credentials.baseUrl || !credentials.apiKey) {
            throw new Error('Missing API configuration. Please check extension settings.');
        }
    }

    // Generic API request handler with caching
    async request(endpoint, options = {}, useCache = true) {
        const credentials = await this.getCredentials();
        this.validateCredentials(credentials);

        const cacheKey = `${endpoint}-${JSON.stringify(options)}`;
        
        // Check cache if enabled
        if (useCache && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
            this.cache.delete(cacheKey);
        }

        const baseUrl = credentials.baseUrl.replace(/\/$/, '');
        const url = `${baseUrl}/wp-json/mp/v1/${endpoint}`;

        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'MEMBERPRESS-API-KEY': credentials.apiKey,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API Error: ${errorText}`);
            }

            const data = {
                data: await response.json(),
                totalPages: parseInt(response.headers.get('X-WP-TotalPages')) || 1,
                totalItems: parseInt(response.headers.get('X-WP-Total')) || 0
            };

            // Store in cache if enabled
            if (useCache) {
                this.cache.set(cacheKey, {
                    data,
                    timestamp: Date.now()
                });
            }

            return data;
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }

    // Members API Methods
    async getMembers(page = 1, perPage = 10, search = '') {
        const query = new URLSearchParams({
            page: page.toString(),
            per_page: perPage.toString(),
            ...(search && { search })
        });

        return this.request(`members?${query}`);
    }

    async getMember(id) {
        return this.request(`members/${id}`);
    }

    // Subscriptions API Methods
    async getSubscriptions(page = 1, perPage = 10, search = '') {
        const query = new URLSearchParams({
            page: page.toString(),
            per_page: perPage.toString(),
            ...(search && { search })
        });

        return this.request(`subscriptions?${query}`);
    }

    async getSubscription(id) {
        return this.request(`subscriptions/${id}`);
    }

    async cancelSubscription(id) {
        return this.request(`subscriptions/${id}/cancel`, {
            method: 'POST'
        }, false);
    }

    // Utility methods for data transformation
    transformMemberData(member) {
        return {
            ...member,
            fullName: `${member.first_name} ${member.last_name}`.trim() || member.username,
            registeredDate: new Date(member.registered_at),
            status: member.active_txn_count > 0 ? 'active' : 'expired',
            totalTransactions: parseInt(member.active_txn_count) + parseInt(member.expired_txn_count)
        };
    }

    transformSubscriptionData(subscription) {
        return {
            ...subscription,
            formattedPrice: new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD'
            }).format(subscription.total),
            startDate: new Date(subscription.created_at),
            nextPayment: this.calculateNextPaymentDate(subscription)
        };
    }

    calculateNextPaymentDate(subscription) {
        if (subscription.status !== 'active') return null;
        
        const startDate = new Date(subscription.created_at);
        const period = parseInt(subscription.period);
        const today = new Date();
        
        switch (subscription.period_type) {
            case 'months':
                const months = Math.ceil((today - startDate) / (30 * 24 * 60 * 60 * 1000));
                const nextMonth = new Date(startDate);
                nextMonth.setMonth(nextMonth.getMonth() + (months * period));
                return nextMonth;
            
            case 'years':
                const years = Math.ceil((today - startDate) / (365 * 24 * 60 * 60 * 1000));
                const nextYear = new Date(startDate);
                nextYear.setFullYear(nextYear.getFullYear() + (years * period));
                return nextYear;
            
            default:
                return null;
        }
    }

    // Cache management
    clearCache() {
        this.cache.clear();
    }

    getCacheSize() {
        return this.cache.size;
    }

    removeCacheItem(key) {
        return this.cache.delete(key);
    }
}