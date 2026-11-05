import { app, dialog } from 'electron'
import './utils/logInit'
import '@common/error'
import {
  initGlobalData,
  initSingleInstanceHandle,
  applyElectronEnvParams,
  setUserDataPath,
  registerDeeplink,
  listenerAppEvent,
} from './app'
import { isLinux, log } from '@common/utils'
import { initAppSetting } from '@main/app'
import registerModules from '@main/modules'

// 初始化应用
const init = () => {
  console.log('init')
  if (process.env.BUILD_WIN7 == 'true') import('./utils/winLegacy')
  void initAppSetting().then(() => {
    registerModules()
    global.lx.event_app.app_inited()
  }).catch((err: Error) => {
    // 初始化失败不能让主进程静默挂着（用户只看到进程、没有窗口），
    // 直接把原因弹出来再退出，方便反馈。
    log.error('init app failed:', err)
    try {
      dialog.showErrorBox('LX Mod 启动失败', [
        '初始化时出错，应用无法继续启动：',
        '',
        err?.message ?? String(err),
        '',
        '常见原因：',
        '1. 安装包与系统架构不匹配（如 32 位系统装了 x64 版）',
        '2. 数据库文件损坏或被占用（可尝试删除用户数据目录下的 lx.data.db 后重试）',
        '3. 系统缺少必要运行库',
        '',
        `用户数据目录：${app.getPath('userData')}`,
        `日志目录：${app.getPath('logs')}`,
      ].join('\n'))
    } catch {}
    app.exit(1)
  })
}

initGlobalData()
initSingleInstanceHandle()
applyElectronEnvParams()
setUserDataPath()
registerDeeplink(init)
listenerAppEvent(init)


// https://github.com/electron/electron/issues/16809
void app.whenReady().then(() => {
  isLinux ? setTimeout(init, 300) : init()
})
