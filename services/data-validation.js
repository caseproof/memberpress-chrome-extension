// Data Validation Service
export class ValidationService {
    // Validate member data
    validateMember(member) {
        const errors = [];

        // Required fields
        if (!member.email) {
            errors.push('Email is required');
        } else if (!this.isValidEmail(member.email)) {
            errors.push('Invalid email format');
        }

        if (!member.username) {
            errors.push('Username is required');
        }

        // Numeric fields
        if (isNaN(parseInt(member.active_txn_count))) {
            errors.push('Invalid active transaction count');
        }

        if (isNaN(parseInt(member.expired_txn_count))) {
            errors.push('Invalid expired transaction count');
        }

        // Date fields
        if (!this.isValidDate(member.registered_at)) {
            errors.push('Invalid registration date');
        }

        // Return validation result
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Validate subscription data
    validateSubscription(subscription) {
        const errors = [];

        // Required fields
        if (!subscription.member) {
            errors.push('Member is required');
        }

        if (!subscription.membership) {
            errors.push('Membership is required');
        }

        // Numeric fields
        if (isNaN(parseFloat(subscription.price))) {
            errors.push('Invalid price');
        }

        if (isNaN(parseFloat(subscription.total))) {
            errors.push('Invalid total');
        }

        if (!this.isValidSubscriptionStatus(subscription.status)) {
            errors.push('Invalid subscription status');
        }

        // Date fields
        if (!this.isValidDate(subscription.created_at)) {
            errors.push('Invalid creation date');
        }

        // Return validation result
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Helper: Validate email format
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Helper: Validate date
    isValidDate(dateString) {
        const date = new Date(dateString);
        return date instanceof Date && !isNaN(date);
    }

    // Helper: Validate subscription status
    isValidSubscriptionStatus(status) {
        const validStatuses = ['active', 'cancelled', 'pending', 'suspended'];
        return validStatuses.includes(status);
    }

    // Helper: Validate API configuration
    validateApiConfig(config) {
        const errors = [];

        if (!config.baseUrl) {
            errors.push('Base URL is required');
        } else if (!this.isValidUrl(config.baseUrl)) {
            errors.push('Invalid base URL format');
        }

        if (!config.apiKey) {
            errors.push('API Key is required');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Helper: Validate URL format
    isValidUrl(