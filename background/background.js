import { NotificationService } from './services/NotificationService.js';

const notificationService = new NotificationService();
await notificationService.initialize();

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
    console.log("MemberPress Manager Extension Installed");
    
    // Check for settings on installation
    chrome.storage.sync.get({
        baseUrl: '',
        apiKey: ''
    }, (items) => {
        if (!items.baseUrl || !items.apiKey) {
            chrome.runtime.openOptionsPage();
        }
    });
});

// Helper function to get stored credentials
async function getStoredCredentials() {
    return new Promise((resolve) => {
        chrome.storage.sync.get({
            baseUrl: '',
            apiKey: ''
        }, (items) => resolve(items));
    });
}

// Helper function for making API requests
async function makeApiRequest(endpoint, options = {}) {
    const credentials = await getStoredCredentials();
    
    if (!credentials.baseUrl || !credentials.apiKey) {
        throw new Error('Please configure the extension settings first');
    }

    const response = await fetch(`${credentials.baseUrl}/wp-json/mp/v1/${endpoint}`, {
        ...options,
        headers: {
            'MEMBERPRESS-API-KEY': credentials.apiKey,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...options.headers
        }
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'API request failed');
    }

    return {
        data: await response.json(),
        totalPages: parseInt(response.headers.get('X-WP-TotalPages')) || 1,
        totalItems: parseInt(response.headers.get('X-WP-Total')) || 0
    };
}

// Message handlers for popup communication
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "getMembers") {
        makeApiRequest(`members?page=${message.page}&per_page=${message.perPage}${message.search ? '&search=' + encodeURIComponent(message.search) : ''}`)
            .then(sendResponse)
            .catch(error => sendResponse({ error: error.message }));
        return true;
    }
    
    if (message.type === "getMember") {
        makeApiRequest(`members/${message.id}`)
            .then(sendResponse)
            .catch(error => sendResponse({ error: error.message }));
        return true;
    }

    if (message.type === "getSubscriptions") {
        makeApiRequest(`subscriptions?page=${message.page}&per_page=${message.perPage}${message.search ? '&search=' + encodeURIComponent(message.search) : ''}`)
            .then(sendResponse)
            .catch(error => sendResponse({ error: error.message }));
        return true;
    }

    if (message.type === "getSubscription") {
        makeApiRequest(`subscriptions/${message.id}`)
            .then(sendResponse)
            .catch(error => sendResponse({ error: error.message }));
        return true;
    }
});