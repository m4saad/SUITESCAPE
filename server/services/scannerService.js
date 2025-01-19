const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const util = require('util');
const execFilePromise = util.promisify(execFile);
const Application = require('../models/Application');

class ScannerService {
  async scanApplication(filePath) {
    try {
      // Get basic file info
      const fileInfo = await this.getFileInfo(filePath);
      
      // Get version info
      const versionInfo = await this.getVersionInfo(filePath);
      
      // Extract icon
      const iconData = await this.extractIcon(filePath);

      // Create hash of the file path for unique identification
      const fileHash = crypto.createHash('md5').update(filePath).digest('hex');

      const applicationData = {
        name: path.basename(filePath, '.exe'),
        path: filePath,
        version: versionInfo.FileVersion || '0.0.0',
        publisher: versionInfo.CompanyName || 'Unknown',
        icon: iconData,
        metadata: {
          fileSize: fileInfo.size,
          created: fileInfo.created,
          modified: fileInfo.modified,
          description: versionInfo.FileDescription,
          copyright: versionInfo.LegalCopyright,
          productVersion: versionInfo.ProductVersion,
          originalFilename: versionInfo.OriginalFilename,
          internalName: versionInfo.InternalName,
          productName: versionInfo.ProductName,
          companyName: versionInfo.CompanyName,
          language: versionInfo.Language
        }
      };

      // Save to database
      const existingApp = await Application.findOne({ path: filePath });
      if (existingApp) {
        Object.assign(existingApp, applicationData);
        await existingApp.save();
        return existingApp;
      } else {
        const newApp = new Application(applicationData);
        await newApp.save();
        return newApp;
      }
    } catch (error) {
      console.error('Error scanning application:', error);
      throw error;
    }
  }

  async getFileInfo(filePath) {
    const stats = await fs.stat(filePath);
    return {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime
    };
  }

  async getVersionInfo(filePath) {
    try {
      const { stdout } = await execFilePromise('powershell', [
        '-command',
        `(Get-Item '${filePath}').VersionInfo | ConvertTo-Json`
      ]);

      return JSON.parse(stdout);
    } catch (error) {
      console.error('Error getting version info:', error);
      return {};
    }
  }

  async extractIcon(filePath) {
    try {
      // This is a basic implementation. For a more robust solution,
      // you might want to use a library like 'extract-file-icon'
      const { stdout } = await execFilePromise('powershell', [
        '-command',
        `
        Add-Type -AssemblyName System.Drawing;
        $icon = [System.Drawing.Icon]::ExtractAssociatedIcon('${filePath}');
        $bitmap = $icon.ToBitmap();
        $ms = New-Object System.IO.MemoryStream;
        $bitmap.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png);
        [Convert]::ToBase64String($ms.ToArray());
        `
      ]);

      return `data:image/png;base64,${stdout.trim()}`;
    } catch (error) {
      console.error('Error extracting icon:', error);
      return null;
    }
  }
}

module.exports = new ScannerService();