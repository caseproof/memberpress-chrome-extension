document.addEventListener('DOMContentLoaded', () => {
    // Load saved settings
    chrome.storage.sync.get({
        baseUrl: '',
        apiKey: ''
    }, (items) => {
        document.getElementById('baseUrl').value = items.baseUrl;
        document.getElementById('apiKey').value = items.apiKey;
    });

    function showStatus(message, isError = false) {
        const status = document.getElementById('status');
        status.textContent = message;
        status.className = `status ${isError ? 'error' : 'success'}`;
        status.style.display = 'block';
        setTimeout(() => {
            status.style.display = 'none';
        }, 3000);
    }

    // Test connection function
    async function testConnection() {
        const baseUrl = document.getElementById('baseUrl').value.trim();
        const apiKey = document.getElementById('apiKey').value.trim();

        if (!baseUrl || !apiKey) {
            showStatus('Please fill in all fields', true);
            return;
        }

        try {
            const response = await fetch(`${baseUrl}/wp-json/mp/v1/me`, {
                headers: {
                    'MEMBERPRESS-API-KEY': apiKey,
                    'Accept': 'application/json'
                }
            });

            const data = await response.json();

            if (response.ok && data.success) {
                showStatus('Connection successful!');
            } else {
                throw new Error(data.message || 'Connection failed');
            }
        } catch (error) {
            showStatus(`Connection failed: ${error.message}`, true);
        }
    }

    // Save settings
    document.getElementById('settings-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const settings = {
            baseUrl: document.getElementById('baseUrl').value.trim(),
            apiKey: document.getElementById('apiKey').value.trim()
        };

        if (!settings.baseUrl || !settings.apiKey) {
            showStatus('Please fill in all fields', true);
            return;
        }

        // Remove trailing slash if present
        settings.baseUrl = settings.baseUrl.replace(/\/$/, '');

        chrome.storage.sync.set(settings, () => {
            showStatus('Settings saved successfully!');
        });
    });

    // Test connection button handler
    document.getElementById('test').addEventListener('click', testConnection);
});