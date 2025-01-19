const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  invoke: (channel, data) => {
    const validChannels = [
      'select-file',
      'scan-application',
      'check-updates',
      'download-update',
      'install-update',
      'handle-file-drop',
      'load-applications',
      'save-applications',
      'resolve-shortcut'
    ];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    }
    return Promise.reject(new Error(`Channel ${channel} is not allowed`));
  },
  handleDrop: (callback) => {
    ipcRenderer.on('file-drop', (event, ...args) => {
      callback(...args);
    });
    return () => {
      ipcRenderer.removeListener('file-drop', callback);
    };
  }
});