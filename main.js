const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const fs = require('fs').promises;
const https = require('https');
const { pipeline } = require('stream').promises;
const os = require('os');
const { execFile } = require('child_process');
const util = require('util');
const execFilePromise = util.promisify(execFile);
const applicationsStorePath = path.join(app.getPath('userData'), 'applications.json');
const versionChecker = require('./server/services/versionChecker');

let mainWindow;
let dynamicUpdates = {};
const updatesStorePath = path.join(app.getPath('userData'), 'updates.json');

async function loadStoredUpdates() {
    try {
        const data = await fs.readFile(updatesStorePath, 'utf8');
        dynamicUpdates = JSON.parse(data);
    } catch (error) {
        dynamicUpdates = {};
        await saveUpdates();
    }
}

async function saveUpdates() {
    try {
        await fs.writeFile(updatesStorePath, JSON.stringify(dynamicUpdates, null, 2));
    } catch (error) {
        console.error('Error saving updates:', error);
    }
}

async function loadApplications() {
    try {
        const data = await fs.readFile(applicationsStorePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return [];
        }
        throw error;
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: true
        }
    });

    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    isDev 
                        ? [
                            "default-src 'self'",
                            "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
                            "style-src 'self' 'unsafe-inline'",
                            "img-src 'self' data: https:",
                            "font-src 'self' data:",
                            "connect-src 'self' ws: wss: http: https:",
                            "worker-src 'self' blob:"
                        ].join('; ')
                        : [
                            "default-src 'self'",
                            "script-src 'self'",
                            "style-src 'self' 'unsafe-inline'",
                            "img-src 'self' data: https:",
                            "font-src 'self' data:",
                            "connect-src 'self'"
                        ].join('; ')
                ]
            }
        });
    });

    const startURL = isDev 
        ? 'http://localhost:3000' 
        : `file://${path.join(__dirname, 'build/index.html')}`;

    mainWindow.loadURL(startURL);

    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.webContents.on('will-navigate', (event) => {
        event.preventDefault();
    });

    mainWindow.webContents.session.on('will-download', (event) => {
        event.preventDefault();
    });

    mainWindow.webContents.on('drop', (event, files) => {
        event.preventDefault();
        mainWindow.webContents.send('file-drop', files);
    });
}

async function getVersionInfo(filePath) {
    if (!filePath) return null;
    
    try {
        const { stdout } = await execFilePromise('powershell', [
            '-command',
            `(Get-Item '${filePath}').VersionInfo | ConvertTo-Json`
        ]);

        const versionInfo = JSON.parse(stdout);
        
        const formatVersion = (version) => {
            if (!version) return '0.0.0';
            const cleanVersion = version.replace(/[^\d.]/g, '');
            const parts = cleanVersion.split('.').map(part => parseInt(part, 10));
            while (parts.length < 3) parts.push(0);
            return parts.slice(0, 3).join('.');
        };

        return {
            version: formatVersion(versionInfo.FileVersion),
            publisher: versionInfo.CompanyName || 'Unknown',
            description: versionInfo.FileDescription,
            productName: versionInfo.ProductName,
            originalFilename: versionInfo.OriginalFilename
        };
    } catch (error) {
        console.error('Error getting version info:', error);
        return null;
    }
}

async function extractIcon(filePath) {
    if (!filePath) return null;
    
    try {
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
        return stdout.trim();
    } catch (error) {
        console.error('Error extracting icon:', error);
        return null;
    }
}

async function scanApplication(filePath) {
    try {
        if (!filePath) {
            console.log('No file path provided to scanApplication');
            return null;
        }

        // Check for duplicates
        const existingApps = await loadApplications();
        const isDuplicate = existingApps.some(app => 
            app.path && filePath && 
            app.path.toLowerCase() === filePath.toLowerCase()
        );
        
        if (isDuplicate) {
            console.log('Duplicate application detected:', filePath);
            return { isDuplicate: true };
        }

        const versionInfo = await getVersionInfo(filePath);
        if (!versionInfo) {
            console.log('Failed to get version info for:', filePath);
            return null;
        }

        const icon = await extractIcon(filePath);
        
        const appInfo = {
            name: path.basename(filePath, '.exe'),
            path: filePath,
            version: versionInfo.version,
            publisher: versionInfo.publisher,
            icon: icon,
            description: versionInfo.description,
            productName: versionInfo.productName,
            id: Date.now()
        };

        return appInfo;
    } catch (error) {
        console.error('Error scanning application:', error);
        throw error;
    }
}

// IPC Handlers
ipcMain.handle('select-file', async () => {
    try {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile', 'multiSelections'],
            filters: [{ name: 'Executables', extensions: ['exe'] }]
        });
        
        return result.canceled ? null : result.filePaths;
    } catch (error) {
        console.error('Error selecting file:', error);
        throw error;
    }
});

ipcMain.handle('scan-application', async (event, filePath) => {
    try {
        const appInfo = await scanApplication(filePath);
        return appInfo;
    } catch (error) {
        console.error('Error scanning application:', error);
        throw error;
    }
});

ipcMain.handle('handle-file-drop', async (event, filePath) => {
    try {
        const appInfo = await scanApplication(filePath);
        return appInfo;
    } catch (error) {
        console.error('Error handling dropped file:', error);
        throw error;
    }
});

ipcMain.handle('resolve-shortcut', async (event, shortcutPath) => {
    if (!shortcutPath) return null;
    
    try {
        const { stdout } = await execFilePromise('powershell', [
            '-command',
            `
            $shell = New-Object -COM WScript.Shell;
            $shortcut = $shell.CreateShortcut('${shortcutPath}');
            $shortcut.TargetPath;
            `
        ]);
        return stdout.trim();
    } catch (error) {
        console.error('Error resolving shortcut:', error);
        throw error;
    }
});

ipcMain.handle('load-applications', async () => {
    try {
        return await loadApplications();
    } catch (error) {
        console.error('Error loading applications:', error);
        throw error;
    }
});

ipcMain.handle('save-applications', async (event, applications) => {
    try {
        await fs.writeFile(applicationsStorePath, JSON.stringify(applications, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving applications:', error);
        throw error;
    }
});

// Replace the existing check-updates handler in main.js with this version:

ipcMain.handle('check-updates', async (event, appInfo) => {
    try {
        const updateInfo = await versionChecker.checkForUpdates(appInfo);
        return {
            ...updateInfo,
            checked: true
        };
    } catch (error) {
        console.error('Error checking updates:', error);
        return { 
            hasUpdate: false,
            note: 'Unable to determine latest version online'
        };
    }
});

ipcMain.handle('download-update', async (event, appInfo) => {
    try {
        const tempDir = os.tmpdir();
        const downloadPath = path.join(tempDir, `${appInfo.name}-${appInfo.version}.exe`);
        
        // Here you would implement the actual download logic
        return {
            success: true,
            downloadPath
        };
    } catch (error) {
        console.error('Error downloading update:', error);
        throw error;
    }
});

ipcMain.handle('install-update', async (event, { downloadPath, currentPath }) => {
    try {
        await execFilePromise(downloadPath, ['/S'], { windowsHide: true });
        const appInfo = await scanApplication(currentPath);
        return { success: true };
    } catch (error) {
        console.error('Error installing update:', error);
        throw error;
    }
});

async function initialize() {
    await loadStoredUpdates();
    await versionChecker.initialize();
    createWindow();
}

// App lifecycle
app.whenReady().then(initialize);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Clean shutdown
app.on('before-quit', async (event) => {
    event.preventDefault();
    try {
        await versionChecker.cleanup();
        app.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        app.exit(1);
    }
});

// Error handling
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled Rejection:', error);
});