/* Made by Tiffany-datalab */

import { app, BrowserWindow, Menu } from 'electron';
import pkg from "electron-updater";
const { autoUpdater } = pkg;
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { ipcMain, dialog } from "electron";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;

/* ======================
   啟動 Flask 後端
====================== */
function startFlask() {
  const script = path.join(__dirname, '../backend/app.py');
  const py = spawn('python', [script]);

  py.stdout.on('data', (data) => {
    console.log(`[Flask] ${data}`);
  });

  py.stderr.on('data', (data) => {
    console.error(`[Flask Error] ${data}`);
  });

  py.on('close', (code) => {
    console.log(`[Flask] process exited with code ${code}`);
  });
}

/* ======================
   建立主視窗
====================== */
function createWindow() {
  console.log("🪟 createWindow: 開始建立瀏覽器視窗");

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

  console.log("⚡ 預期載入的 preload 路徑:", path.join(__dirname, 'preload.js'));

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
          console.log("📨 送出 menu-action ocr");
          mainWindow.webContents.send('menu-action', 'ocr');
          mainWindow.setTitle("PDF小工具 - 報告改名"); // ← 新增
        }
      },
      {
        label: '蓋電子章',
        click: () => {
          console.log("📨 送出 menu-action stamp");
          mainWindow.webContents.send('menu-action', 'stamp');
          mainWindow.setTitle("PDF小工具 - 蓋電子章"); // ← 新增
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
   單一實例鎖
====================== */
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // 如果已經有視窗 → 聚焦
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // 只會在第一個實例進來時執行
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
