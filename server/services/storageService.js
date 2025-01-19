const { app } = require('electron');
const path = require('path');
const fs = require('fs').promises;

class StorageService {
    constructor() {
        this.storagePath = path.join(app.getPath('userData'), 'applications.json');
    }

    async loadApplications() {
        try {
            const data = await fs.readFile(this.storagePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            // If file doesn't exist or is invalid, return empty array
            return [];
        }
    }

    async saveApplications(applications) {
        try {
            await fs.writeFile(this.storagePath, JSON.stringify(applications, null, 2));
        } catch (error) {
            console.error('Error saving applications:', error);
            throw error;
        }
    }
}

module.exports = new StorageService();
