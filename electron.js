const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const filePath = path.join(__dirname, 'build', 'index.html');

  if (!fs.existsSync(filePath)) {
    dialog.showErrorBox('로드 실패', 'index.html 파일을 찾을 수 없습니다.');
    return;
  }

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    x: 100,
    y: 100,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

win.on('close', (e) => {
  const choice = dialog.showMessageBoxSync(win, {
    type: 'question',
    buttons: ['취소', '종료'],
    title: '확인',
    message: '앱을 종료하시겠습니까?'
  });
  if (choice === 0) {
    e.preventDefault(); // 취소 누르면 종료 막기
  }
});


  win.loadURL(`file://${filePath}`)
    .then(() => {
      //win.webContents.openDevTools();
    })
    .catch(err => {
      console.error("로딩 실패:", err);
      dialog.showErrorBox("로드 실패", err.message);
    });
}

app.whenReady().then(() => {
  console.log("app 준비 완료");
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit(); // 창이 다 닫히면 앱 종료
  }
});

process.on('uncaughtException', (err) => {
  console.error("Uncaught Exception:", err);
});
