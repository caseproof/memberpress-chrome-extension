// State Management System
export class StateManager {
    constructor() {
        this.state = {
            members: {
                data: [],
                loading: false,
                error: null,
                page: 1,
                totalPages: 1,
                totalItems: 0,
                search: ''
            },
            subscriptions: {
                data: [],
                loading: false,
                error: null,
                page: 1,
                totalPages: 1,
                totalItems: 0,
                search: ''
            },
            selectedTab: 'members',
            settings: {
                baseUrl: '',
                apiKey: '',
                initialized: false
            }
        };
        
        this.listeners = new Set();
    }

    // Subscribe to state changes
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    // Notify all listeners of state change
    notify() {
        this.listeners.forEach(listener => listener(this.state));
    }

    // Get current state
    getState() {
        return { ...this.state };
    }

    // Update state
    setState(updater) {
        const newState = typeof updater === 'function'
            ? updater(this.state)
            : updater;

        this.state = {
            ...this.state,
            ...newState
        };

        this.notify();
        this.persistRelevantState();
    }

    // Load persisted state
    async loadPersistedState() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['settings'], (items) => {
                if (items.settings) {
                    this.setState({
                        settings: {
                            ...this.state.settings,
                            ...items.settings,
                            initialized: true
                        }
                    });
                }
                resolve();
            });
        });
    }

    // Persist relevant state parts
    persistRelevantState() {
        chrome.storage.sync.set({
            settings: this.state.settings
        });
    }

    // Members state actions
    setMembersLoading(loading) {
        this.setState(state => ({
            members: {
                ...state.members,
                loading,
                error: loading ? null : state.members.error
            }
        }));
    }

    setMembersError(error) {
        this.setState(state => ({
            members: {
                ...state.members,
                error,
                loading: false
            }
        }));
    }

    setMembersData(data, totalPages, totalItems) {
        this.setState(state => ({
            members: {
                ...state.members,
                data,
                totalPages,
                totalItems,
                loading: false,
                error: null
            }
        }));
    }

    setMembersPage(page) {
        this.setState(state => ({
            members: {
                ...state.members,
                page
            }
        }));
    }

    setMembersSearch(search) {
        this.setState(state => ({
            members: {
                ...state.members,
                search,
                page: 1 // Reset to first page on new search
            }
        }));
    }

    // Subscriptions state actions
    setSubscriptionsLoading(loading) {
        this.setState(state => ({
            subscriptions: {
                ...state.subscriptions,
                loading,
                error: loading ? null : state.subscriptions.error
            }
        }));
    }

    setSubscriptionsError(error) {
        this.setState(state => ({
            subscriptions: {
                ...state.subscriptions,
                error,
                loading: false
            }
        }));
    }

    setSubscriptionsData(data, totalPages, totalItems) {
        this.setState(state => ({
            subscriptions: {
                ...state.subscriptions,
                data,
                totalPages,
                totalItems,
                loading: false,
                error: null
            }
        }));
    }

    setSubscriptionsPage(page) {
        this.setState(state => ({
            subscriptions: {
                ...state.subscriptions,
                page
            }
        }));
    }

    setSubscriptionsSearch(search) {
        this.setState(state => ({
            subscriptions: {
                ...state.subscriptions,
                search,
                page: 1 // Reset to first page on new search
            }
        }));
    }

    // Tab state actions
    setSelectedTab(tab) {
        this.setState({ selectedTab: tab });
    }

    // Settings state actions
    updateSettings(settings) {
        this.setState(state => ({
            settings: {
                ...state.settings,
                ...settings,
                initialized: true
            }
        }));
    }

    // Reset state
    resetState() {
        this.setState({
            members: {
                data: [],
                loading: false,
                error: null,
                page: 1,
                totalPages: 1,
                totalItems: 0,
                search: ''
            },
            subscriptions: {
                data: [],
                loading: false,
                error: null,
                page: 1,
                totalPages: 1,
                totalItems: 0,
                search: ''
            },
            selectedTab: 'members'
        });
    }
}