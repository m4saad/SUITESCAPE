const axios = require('axios');
const cheerio = require('cheerio');
const semver = require('semver');

class WebScraper {
    constructor() {
        // Configure axios defaults
        axios.defaults.timeout = 5000; // 5 second timeout for individual requests

        this.scrapers = {
            'Google Chrome': {
                url: 'https://chromereleases.googleblog.com/',
                scrape: async () => {
                    try {
                        const response = await axios.get('https://chromereleases.googleblog.com/');
                        const $ = cheerio.load(response.data);
                        const title = $('.post-title').first().text();
                        const match = title.match(/\d+\.\d+\.\d+\.\d+/);
                        return match ? match[0] : null;
                    } catch (error) {
                        console.log('Chrome version check failed:', error.message);
                        return null;
                    }
                }
            },
            'Mozilla Firefox': {
                url: 'https://www.mozilla.org/en-US/firefox/releases/',
                scrape: async () => {
                    try {
                        const response = await axios.get('https://www.mozilla.org/en-US/firefox/releases/');
                        const $ = cheerio.load(response.data);
                        return $('.c-release-version').first().text().trim();
                    } catch (error) {
                        console.log('Firefox version check failed:', error.message);
                        return null;
                    }
                }
            },
            'JetBrains': {
                url: 'https://data.services.jetbrains.com/products/releases?code=PCP&latest=true&type=release',
                scrape: async () => {
                    try {
                        const response = await axios.get('https://data.services.jetbrains.com/products/releases?code=PCP&latest=true&type=release');
                        if (response.data && response.data.PCP && response.data.PCP[0]) {
                            return response.data.PCP[0].version;
                        }
                        return null;
                    } catch (error) {
                        console.log('JetBrains version check failed:', error.message);
                        return null;
                    }
                }
            },
            'Visual Studio Code': {
                url: 'https://code.visualstudio.com/updates',
                scrape: async () => {
                    try {
                        const response = await axios.get('https://code.visualstudio.com/updates');
                        const $ = cheerio.load(response.data);
                        const version = $('.updates-version').first().text().trim();
                        return version.replace('version', '').trim();
                    } catch (error) {
                        console.log('VSCode version check failed:', error.message);
                        return null;
                    }
                }
            }
        };

        this.versionCache = new Map();
        this.CACHE_DURATION = 1000 * 60 * 60; // 1 hour
    }

    async getLatestVersion(publisher, currentVersion, productName) {
        try {
            if (!publisher || !currentVersion) {
                return { hasUpdate: false, currentVersion };
            }

            // Check cache first
            const cacheKey = `${publisher}_${currentVersion}_${productName}`;
            const cachedResult = this.versionCache.get(cacheKey);
            if (cachedResult && Date.now() - cachedResult.timestamp < this.CACHE_DURATION) {
                return cachedResult.data;
            }

            // Find a matching scraper
            const matchingScraper = this.findMatchingScraper(publisher);
            let latestVersion = null;

            if (matchingScraper) {
                latestVersion = await Promise.race([
                    matchingScraper.scrape(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Scraper timeout')), 5000)
                    )
                ]);
            }

            if (!latestVersion) {
                const result = {
                    hasUpdate: false,
                    currentVersion,
                    note: 'Unable to determine latest version online'
                };

                // Cache the result
                this.versionCache.set(cacheKey, {
                    timestamp: Date.now(),
                    data: result
                });

                return result;
            }

            // Clean versions for comparison
            const cleanCurrentVersion = this.cleanVersion(currentVersion);
            const cleanLatestVersion = this.cleanVersion(latestVersion);

            const result = {
                hasUpdate: semver.gt(cleanLatestVersion, cleanCurrentVersion),
                currentVersion: cleanCurrentVersion,
                latestVersion: cleanLatestVersion
            };

            // Cache the result
            this.versionCache.set(cacheKey, {
                timestamp: Date.now(),
                data: result
            });

            return result;

        } catch (error) {
            console.error('Error checking version:', error);
            return {
                hasUpdate: false,
                currentVersion,
                note: 'Unable to determine latest version online'
            };
        }
    }

    findMatchingScraper(publisher) {
        if (!publisher) return null;
        
        const publisherLower = publisher.toLowerCase();
        const match = Object.entries(this.scrapers).find(([key]) => 
            publisherLower.includes(key.toLowerCase())
        );

        return match ? this.scrapers[match[0]] : null;
    }

    cleanVersion(version) {
        if (!version) return '0.0.0';
        
        // Remove any non-version characters
        const cleaned = version.replace(/[^\d.]/g, '');
        
        // Split into parts
        const parts = cleaned.split('.').map(part => parseInt(part));
        
        // Ensure we have at least 3 parts
        while (parts.length < 3) {
            parts.push(0);
        }
        
        // Take only the first 3 parts
        return parts.slice(0, 3).join('.');
    }
}

module.exports = new WebScraper();