import { log } from '@common/utils'
import { mainOn } from '@common/mainIpc'
import { isExistWindow, sendEvent } from './index'
import { quitApp } from '@main/app'
import { WIN_MAIN_RENDERER_EVENT_NAME } from '@common/ipcNames'

log.info('App starting...')

// 二改版不接 electron-updater：
// 它按「安装包版本 + GitHub latest.yml」判断与下载，我们既没有为每个版本发 latest.yml，
// 旧配置里的 publish 又指向上游 lyswhut/lx-music-desktop，一旦触发就会把用户装回官方版。
// 版本判断交给渲染进程读自建清单 desktop-version.json，下载由用户手动打开下载页完成。
export default () => {
  mainOn(WIN_MAIN_RENDERER_EVENT_NAME.update_check, () => {
    checkUpdate()
  })

  mainOn(WIN_MAIN_RENDERER_EVENT_NAME.update_download_update, () => {
    // 不再内置下载安装包，这里刻意留空
  })

  mainOn(WIN_MAIN_RENDERER_EVENT_NAME.quit_update, () => {
    quitApp()
  })
}

const checkUpdate = () => {
  // 只回一条 not-available，让渲染进程接着用自建清单做比较
  if (!isExistWindow()) return
  setTimeout(() => {
    sendEvent(WIN_MAIN_RENDERER_EVENT_NAME.update_not_available, {})
  }, 500)
}
