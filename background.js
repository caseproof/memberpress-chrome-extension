// background.js
import { NotificationService } from './services/NotificationService.js';

let notificationService;
let initialized = false;

// Initialize NotificationService
async function initializeServices() {
    if (initialized) return;
    
    try {
        notificationService = new NotificationService();
        await notificationService.initialize();
        initialized = true;
        console.log("MemberPress Manager services initialized successfully");
    } catch (error) {
        console.error("Failed to initialize services:", error);
    }
}

// Handle extension installation
chrome.runtime.onInstalled.addListener(async () => {
    console.log("MemberPress Manager Extension Installed");
    await initializeServices();
    
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

    // Remove trailing slash from baseUrl if present
    const baseUrl = credentials.baseUrl.replace(/\/$/, '');

    try {
        const response = await fetch(`${baseUrl}/wp-json/mp/v1/${endpoint}`, {
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
            throw new Error(errorText || 'API request failed');
        }

        const responseData = await response.json();
        return {
            data: responseData,
            totalPages: parseInt(response.headers.get('X-WP-TotalPages')) || 1,
            totalItems: parseInt(response.headers.get('X-WP-Total')) || 0
        };
    } catch (error) {
        console.error(`API Request Failed for ${endpoint}:`, error);
        throw error;
    }
}

// Message handlers for popup communication
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!initialized) {
        initializeServices().then(() => handleMessage(message, sender, sendResponse));
        return true;
    }
    
    handleMessage(message, sender, sendResponse);
    return true;
});

async function handleMessage(message, sender, sendResponse) {
    try {
        let response;
        
        switch (message.type) {
            case "getMembers":
                response = await makeApiRequest(
                    `members?page=${message.page}&per_page=${message.perPage}${message.search ? '&search=' + encodeURIComponent(message.search) : ''}`
                );
                break;
                
            case "getMember":
                response = await makeApiRequest(`members/${message.id}`);
                break;

            case "getSubscriptions":
                response = await makeApiRequest(
                    `subscriptions?page=${message.page}&per_page=${message.perPage}${message.search ? '&search=' + encodeURIComponent(message.search) : ''}`
                );
                break;

            case "getSubscription":
                response = await makeApiRequest(`subscriptions/${message.id}`);
                break;
                
            default:
                throw new Error('Unknown message type');
        }
        
        sendResponse(response);
    } catch (error) {
        sendResponse({ error: error.message });
    }
}