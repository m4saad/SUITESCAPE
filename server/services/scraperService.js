const puppeteer = require('puppeteer');
const semver = require('semver');
const VersionUtil = require('../utils/versionUtil');
const { Cache } = require('../utils/cache');

class ScraperService {
  constructor() {
    this.browser = null;
    this.cache = new Cache(1800); // 30 minute cache
    this.publishers = {
      'Mozilla': {
        url: 'https://www.mozilla.org/en-US/firefox/releases/',
        scraper: this.scrapeMozilla.bind(this)
      },
      'Google': {
        url: 'https://chromereleases.googleblog.com/',
        scraper: this.scrapeGoogle.bind(this)
      },
      'Microsoft': {
        url: 'https://learn.microsoft.com/en-us/visualstudio/releases/2022/release-notes',
        scraper: this.scrapeMicrosoft.bind(this)
      }
    };
  }

  async initialize() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
  }

  async checkForUpdates(application) {
    try {
      await this.initialize();

      // Check cache first
      const cacheKey = `updates_${application.id}`;
      const cachedResult = this.cache.get(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      let result;
      // Try publisher-specific scraper first
      if (this.publishers[application.publisher]) {
        result = await this.publishers[application.publisher].scraper(application);
      } else {
        // Fall back to generic scraping method
        result = await this.genericVersionCheck(application);
      }

      // Cache the result
      this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error(`Error checking updates for ${application.name}:`, error);
      return {
        hasUpdate: false,
        latestVersion: application.version,
        downloadUrl: null,
        error: error.message
      };
    }
  }

  async genericVersionCheck(application) {
    const page = await this.browser.newPage();
    try {
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Search for the application's download page
      const searchQuery = `${application.name} ${application.publisher} latest version download`;
      await page.goto(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`);

      // Wait for search results
      await page.waitForSelector('div.g');

      // Extract potential version numbers from search results
      const versions = await page.evaluate(() => {
        const versionRegex = /\d+\.\d+(\.\d+)?/g;
        const text = document.body.innerText;
        return [...new Set([...text.matchAll(versionRegex)].map(match => match[0]))];
      });

      // Find the highest version number
      const latestVersion = versions
        .filter(version => VersionUtil.isValidVersion(version))
        .sort((a, b) => VersionUtil.compare(b, a))[0];

      const hasUpdate = latestVersion && VersionUtil.isNewer(latestVersion, application.version);

      const downloadUrl = await page.evaluate(() => {
        const downloadLink = Array.from(document.querySelectorAll('a')).find(a => 
          a.href.includes('download') && 
          a.href.includes(window.location.hostname)
        );
        return downloadLink ? downloadLink.href : null;
      });

      await page.close();
      
      return {
        hasUpdate,
        latestVersion: latestVersion || application.version,
        downloadUrl,
        checkedAt: new Date()
      };
    } catch (error) {
      await page.close();
      throw error;
    }
  }

  async scrapeMozilla(application) {
    const page = await this.browser.newPage();
    try {
      await page.goto('https://www.mozilla.org/en-US/firefox/releases/');
      
      const latestVersion = await page.$eval('.c-release-version', el => el.textContent.trim());
      const hasUpdate = VersionUtil.isNewer(latestVersion, application.version);

      await page.close();
      return {
        hasUpdate,
        latestVersion,
        downloadUrl: 'https://www.mozilla.org/firefox/download/thanks/',
        checkedAt: new Date()
      };
    } catch (error) {
      await page.close();
      throw error;
    }
  }

  async scrapeGoogle(application) {
    const page = await this.browser.newPage();
    try {
      await page.goto('https://chromereleases.googleblog.com/');
      
      const latestVersion = await page.$eval('.post-title', el => {
        const versionMatch = el.textContent.match(/\d+\.\d+\.\d+\.\d+/);
        return versionMatch ? versionMatch[0] : null;
      });

      const hasUpdate = latestVersion && VersionUtil.isNewer(latestVersion, application.version);

      await page.close();
      return {
        hasUpdate,
        latestVersion: latestVersion || application.version,
        downloadUrl: 'https://www.google.com/chrome/',
        checkedAt: new Date()
      };
    } catch (error) {
      await page.close();
      throw error;
    }
  }

  async scrapeMicrosoft(application) {
    const page = await this.browser.newPage();
    try {
      await page.goto('https://learn.microsoft.com/en-us/visualstudio/releases/2022/release-notes');
      
      const latestVersion = await page.$eval('.release-version', el => {
        const versionMatch = el.textContent.match(/\d+\.\d+\.\d+/);
        return versionMatch ? versionMatch[0] : null;
      });

      const hasUpdate = latestVersion && VersionUtil.isNewer(latestVersion, application.version);

      await page.close();
      return {
        hasUpdate,
        latestVersion: latestVersion || application.version,
        downloadUrl: 'https://visualstudio.microsoft.com/downloads/',
        checkedAt: new Date()
      };
    } catch (error) {
      await page.close();
      throw error;
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = new ScraperService();