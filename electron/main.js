/* Made by Tiffany-datalab */

import { app, BrowserWindow, Menu } from 'electron';
import pkg from "electron-updater";
const { autoUpdater } = pkg;
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { ipcMain, dialog } from "electron";
import log from 'electron-log';

// 強制指定 log 檔案路徑
log.transports.file.level = 'info';
log.transports.file.resolvePath = () =>
  path.join(app.getPath('userData'), 'logs/main.log');

// 設定 electron-log
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
// ⚠️ 禁止輸出到 console，只寫入 main.log
log.transports.console.level = false;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;

/* ======================
   啟動 Flask 後端
====================== */
function startFlask() {
  const isDev = !app.isPackaged;
  const script = isDev
    ? path.join(__dirname, '../backend/app.py')
    : path.join(process.resourcesPath, 'app.asar.unpacked', 'backend', 'app.exe');

  log.info("🚀 Flask script path:", script);

  let py;
  if (isDev) {
    py = spawn("python", [script]);   // dev 模式 → 用 Python 跑 app.py
  } else {
    py = spawn(script);               // dist 模式 → 直接跑 app.exe
  }

  py.stdout.on('data', (data) => log.info(`[Flask] ${data}`));
  py.stderr.on('data', (data) => log.error(`[Flask Error] ${data}`));
  py.on('error', (err) => log.error("❌ 無法啟動 Flask:", err));
  py.on('close', (code) => log.info(`[Flask] process exited with code ${code}`));
}

/* ======================
   建立主視窗
====================== */
function createWindow() {
  log.info("🪟 createWindow: 開始建立瀏覽器視窗");

  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  log.info("⚡ 預期載入的 preload 路徑:", path.join(__dirname, 'preload.js'));

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:1420');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/web/index.html'));
  }

  // ✅ 啟動後檢查更新
  mainWindow.webContents.once("did-finish-load", () => {
    if (app.isPackaged) {
      autoUpdater.checkForUpdatesAndNotify();
    }
  });

  // ✅ 自訂選單
  const menu = Menu.buildFromTemplate([
    {
      label: '功能選單',
      submenu: [
        {
          label: '報告改名',
          click: () => {
            mainWindow.webContents.send('menu-action', 'ocr');
            mainWindow.setTitle("PDF小工具 - 報告改名");
          }
        },
        {
          label: '蓋電子章',
          click: () => {
            mainWindow.webContents.send('menu-action', 'stamp');
            mainWindow.setTitle("PDF小工具 - 蓋電子章");
          }
        },
      ]
    },
    {
      label: '開發者工具',
      click: () => {
        mainWindow.webContents.toggleDevTools();
      }
    }
  ]);
  Menu.setApplicationMenu(menu);
}

/* ======================
   自動更新必要事件
====================== */
autoUpdater.on('error', (err) => {
  log.error('❌ 更新錯誤:', err);
});
autoUpdater.on('update-downloaded', () => {
  log.info('✅ 更新下載完成，將在關閉程式後安裝');
});

/* ======================
   單一實例鎖
====================== */
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    startFlask();
    createWindow();
  });
}

/* ======================
   IPC 事件
====================== */
ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"]
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle("select-file", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [
      { name: "Images", extensions: ["png", "jpg", "jpeg"] }
    ]
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

/* ======================
   App lifecycle
====================== */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
