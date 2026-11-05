import { autoUpdater } from 'electron-updater'
import { log, isWin } from '@common/utils'
import { mainOn } from '@common/mainIpc'
import { isExistWindow, sendEvent } from './index'
import { WIN_MAIN_RENDERER_EVENT_NAME } from '@common/ipcNames'

autoUpdater.logger = log
autoUpdater.autoDownload = false
// autoUpdater.forceDevUpdateConfig = true
// autoUpdater.autoDownload = false

// let isFirstCheckedUpdate = true

log.info('App starting...')


// -------------------------------------------------------------------
// Open a window that displays the version
//
// THIS SECTION IS NOT REQUIRED
//
// This isn't required for auto-updates to work, but it's easier
// for the app to show a window than to have to click "About" to see
// that updates are working.
// -------------------------------------------------------------------
// let win

function sendStatusToWindow(text: string) {
  log.info(text)
  // ipcMain.send('message', text)
}


// -------------------------------------------------------------------
// Auto updates
//
// For details about these events, see the Wiki:
// https://github.com/electron-userland/electron-builder/wiki/Auto-Update#events
//
// The app doesn't need to listen to any events except `update-downloaded`
//
// Uncomment any of the below events to listen for them.  Also,
// look in the previous section to see them being used.
// -------------------------------------------------------------------
// autoUpdater.on('checking-for-update', () => {
// })
// autoUpdater.on('update-available', (ev, info) => {
// })
// autoUpdater.on('update-not-available', (ev, info) => {
// })
// autoUpdater.on('error', (ev, err) => {
// })
// autoUpdater.on('download-progress', (ev, progressObj) => {
// })
// autoUpdater.on('update-downloaded', (ev, info) => {
//   // Wait 5 seconds, then quit and install
//   // In your application, you don't need to wait 5 seconds.
//   // You could call autoUpdater.quitAndInstall(); immediately
//   // setTimeout(function() {
//   // autoUpdater.quitAndInstall()
//   // }, 5000)

// })

interface WaitEvent {
  type: string
  info: any
}

// let waitEvent: WaitEvent[] = []
const handleSendEvent = (action: WaitEvent) => {
  if (isExistWindow()) {
    setTimeout(() => { // 延迟发送事件，过早发送可能渲染进程还没启动完成
      sendEvent(action.type, action.info)
    }, 1000)
  }
}

export default () => {
  autoUpdater.on('checking-for-update', () => {
    sendStatusToWindow('Checking for update...')
  })
  autoUpdater.on('update-available', info => {
    sendStatusToWindow('Update available.')
    handleSendEvent({ type: WIN_MAIN_RENDERER_EVENT_NAME.update_available, info })
  })
  autoUpdater.on('update-not-available', info => {
    sendStatusToWindow('Update not available.')
    handleSendEvent({ type: WIN_MAIN_RENDERER_EVENT_NAME.update_not_available, info })
  })
  autoUpdater.on('error', err => {
    sendStatusToWindow('Error in auto-updater.')
    handleSendEvent({ type: WIN_MAIN_RENDERER_EVENT_NAME.update_error, info: err.message })
  })
  autoUpdater.on('download-progress', progressObj => {
    let log_message = `Download speed: ${progressObj.bytesPerSecond}`
    log_message = `${log_message} - Downloaded ${progressObj.percent}%`
    log_message = `${log_message} (progressObj.transferred/${progressObj.total})`
    sendStatusToWindow(log_message)
    handleSendEvent({ type: WIN_MAIN_RENDERER_EVENT_NAME.update_progress, info: progressObj })
  })
  autoUpdater.on('update-downloaded', info => {
    sendStatusToWindow('Update downloaded.')
    handleSendEvent({ type: WIN_MAIN_RENDERER_EVENT_NAME.update_downloaded, info })
  })

  mainOn(WIN_MAIN_RENDERER_EVENT_NAME.update_check, () => {
    console.log('check')
    checkUpdate()
  })

  mainOn(WIN_MAIN_RENDERER_EVENT_NAME.update_download_update, () => {
    // 二改版不通过 electron-updater 下载安装包（见下方 checkUpdate 说明），
    // 下载入口统一走渲染进程的下载页，这里直接忽略。
  })

  mainOn(WIN_MAIN_RENDERER_EVENT_NAME.quit_update, () => {
    global.lx.isSkipTrayQuit = true

    setTimeout(() => {
      autoUpdater.quitAndInstall(true, true)
    }, 1000)
  })
}

const checkUpdate = () => {
  // 二改版：不再走 electron-updater。
  //
  // electron-updater 用「安装包 app 版本」和 GitHub Release 的 latest.yml 比较，
  // 而我们的产物既没有代码签名、也没有为每个版本生成 latest.yml；
  // 更关键的是历史 publish 配置指向上游 lyswhut/lx-music-desktop，
  // 一旦触发下载，用户装回去的就是官方版，二改功能全部丢失。
  //
  // 现在统一由渲染进程读自建清单 desktop-version.json 判断版本，
  // 有新版时引导用户打开二改版下载页手动覆盖安装（数据保留）。
  // 这里只回一条 not-available，让渲染进程接着用自建清单做判断。
  handleSendEvent({ type: WIN_MAIN_RENDERER_EVENT_NAME.update_not_available, info: {} })
}
