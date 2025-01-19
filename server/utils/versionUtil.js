const semver = require('semver');

class VersionUtil {
  static normalize(version) {
    if (!version) return '0.0.0';

    // Remove any non-version text (like 'v' prefix)
    version = version.replace(/[^\d.]/g, '');

    // Split version into parts
    const parts = version.split('.');

    // Ensure at least three parts (major.minor.patch)
    while (parts.length < 3) {
      parts.push('0');
    }

    // Take only first three parts and join them
    return parts.slice(0, 3).join('.');
  }

  static isValidVersion(version) {
    if (!version) return false;
    const normalized = this.normalize(version);
    return semver.valid(normalized) !== null;
  }

  static compare(version1, version2) {
    const v1 = this.normalize(version1);
    const v2 = this.normalize(version2);
    
    if (!this.isValidVersion(v1) || !this.isValidVersion(v2)) {
      return 0;
    }

    return semver.compare(v1, v2);
  }

  static isNewer(newVersion, currentVersion) {
    const v1 = this.normalize(newVersion);
    const v2 = this.normalize(currentVersion);

    if (!this.isValidVersion(v1) || !this.isValidVersion(v2)) {
      return false;
    }

    return semver.gt(v1, v2);
  }

  static parseVersion(text) {
    if (!text) return null;

    // Common version patterns
    const patterns = [
      /(\d+\.\d+\.\d+\.\d+)/, // four parts (e.g., 1.2.3.4)
      /(\d+\.\d+\.\d+)/,      // three parts (e.g., 1.2.3)
      /(\d+\.\d+)/,           // two parts (e.g., 1.2)
      /v(\d+\.\d+\.\d+)/,     // with 'v' prefix
      /version\s+(\d+\.\d+\.\d+)/i, // with 'version' prefix
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }
}

module.exports = VersionUtil;