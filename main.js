const { app, BrowserWindow, ipcMain, desktopCapturer, screen } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  mainWindow.loadFile('src/renderer/index.html');

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('get-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 150, height: 150 }
    });
    return sources;
  } catch (error) {
    console.error('Error getting sources:', error);
    return [];
  }
});

ipcMain.handle('get-screen-size', () => {
  const primaryDisplay = screen.getPrimaryDisplay();
  return primaryDisplay.size;
});

ipcMain.handle('start-server', (event, port) => {
  return new Promise((resolve, reject) => {
    try {
      serverProcess = spawn('node', [path.join(__dirname, 'src/server/server.js'), port], {
        stdio: 'inherit'
      });
      
      serverProcess.on('error', (error) => {
        reject(error);
      });
      
      // Give server time to start
      setTimeout(() => {
        resolve(true);
      }, 2000);
    } catch (error) {
      reject(error);
    }
  });
});

ipcMain.handle('stop-server', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
    return true;
  }
  return false;
});