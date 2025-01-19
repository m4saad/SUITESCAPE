const webScraper = require('./webScraper');
const semver = require('semver');

class VersionChecker {
    constructor() {
        this.updateCache = new Map();
        this.CACHE_DURATION = 1000 * 60 * 60; // 1 hour
        this.checkCount = 0;
        this.MAX_CHECKS = 1; // Only check once per session
        this.TIMEOUT = 15000; // 15 seconds timeout
    }

    async initialize() {
        // Clear cache and check count on initialization
        this.updateCache.clear();
        this.checkCount = 0;
    }

    async checkForUpdates(application) {
        try {
            if (!application || !application.version) {
                return { hasUpdate: false };
            }

            // If we've already checked the maximum number of times, return cached result
            if (this.checkCount >= this.MAX_CHECKS) {
                const cachedResult = this.updateCache.get(application.path);
                return cachedResult?.data || { 
                    hasUpdate: false,
                    note: 'Version check skipped - maximum checks reached'
                };
            }

            // Check cache first
            const cachedResult = this.updateCache.get(application.path);
            if (cachedResult && Date.now() - cachedResult.timestamp < this.CACHE_DURATION) {
                return cachedResult.data;
            }

            // Create a promise that rejects after timeout
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error('Version check timed out'));
                }, this.TIMEOUT);
            });

            // Race between the version check and timeout
            const result = await Promise.race([
                webScraper.getLatestVersion(
                    application.publisher,
                    application.version,
                    application.name
                ),
                timeoutPromise
            ]).catch(error => ({
                hasUpdate: false,
                currentVersion: application.version,
                note: error.message === 'Version check timed out' 
                    ? 'Unable to determine latest version online (timeout)'
                    : 'Unable to determine latest version online'
            }));

            // Cache the result
            this.updateCache.set(application.path, {
                timestamp: Date.now(),
                data: result
            });

            // Increment check count
            this.checkCount++;

            return result;

        } catch (error) {
            console.error('Error checking for updates:', error);
            return { 
                hasUpdate: false,
                currentVersion: application.version,
                note: 'Unable to determine latest version online'
            };
        }
    }

    async cleanup() {
        this.updateCache.clear();
        this.checkCount = 0;
    }
}

module.exports = new VersionChecker();