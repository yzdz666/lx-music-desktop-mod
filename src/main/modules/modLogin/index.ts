import { BrowserWindow, ipcMain, session } from 'electron'
import { getProxy } from '@main/utils'
import { MOD_LOGIN_EVENT, type ModLoginOptions } from '@common/modLogin'

/**
 * 三平台网页登录窗口
 *
 * 为什么不用系统浏览器 + 手动复制 Cookie：手机版早就是「打开官方登录页 → 自动抓 cookie」，
 * 桌面版一直让用户按 F12 复制 Cookie，门槛太高。这里用独立 session 的 BrowserWindow
 * 打开同一个登录页，轮询 session.cookies，命中登录票据就返回给渲染层落库。
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

const POLL_INTERVAL = 1200
/** 10 分钟没动静就当作放弃，避免窗口一直挂着 */
const LOGIN_TIMEOUT = 10 * 60 * 1000
/** 命中票据后再等一会儿，等站点把剩余 cookie 写全 */
const FLUSH_DELAY = 600

/** 自动点一次导航栏右上角的「登录」，QQ 音乐 / 酷狗的登录入口不点不出来 */
const AUTO_CLICK_LOGIN = `(function() {
  var tries = 0
  var timer = setInterval(function() {
    tries++
    if (tries > 20) { clearInterval(timer); return }
    var nodes = document.querySelectorAll('a,span,div,button')
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i]
      if (n.children.length) continue
      if ((n.textContent || '').trim() !== '登录') continue
      var r = n.getBoundingClientRect()
      if (!r.width || !r.height) continue
      if (r.top > 200) continue
      n.click()
      clearInterval(timer)
      return
    }
  }, 600)
})()`

let loginWindow: BrowserWindow | null = null

const getPartition = (platform: string) => `persist:mod-login-${platform}`

const applyProxy = (ses: Electron.Session) => {
  const proxy = getProxy()
  if (proxy?.host) {
    void ses.setProxy({
      mode: 'fixed_servers',
      proxyRules: `http://${proxy.host}:${proxy.port || 80}`,
    })
  } else {
    void ses.setProxy({ mode: 'direct' })
  }
}

const readCookie = async(ses: Electron.Session, hosts: string[]) => {
  const merged = new Map<string, string>()
  const cookies = await ses.cookies.get({})
  for (const cookie of cookies) {
    if (!cookie.name || cookie.value == null) continue
    if (hosts.length && !hosts.some(host => cookie.domain?.includes(host))) continue
    merged.set(cookie.name, cookie.value)
  }
  return [...merged.entries()].map(([name, value]) => `${name}=${value}`).join('; ')
}

const openLoginWindow = async(options: ModLoginOptions): Promise<string | null> => {
  return new Promise((resolve) => {
    if (loginWindow && !loginWindow.isDestroyed()) {
      loginWindow.focus()
      resolve(null)
      return
    }

    const ses = session.fromPartition(getPartition(options.platform))
    applyProxy(ses)

    const win = new BrowserWindow({
      width: options.width || (options.mobile ? 460 : 1080),
      height: options.height || (options.mobile ? 760 : 780),
      minWidth: 380,
      minHeight: 520,
      title: options.title || '登录',
      autoHideMenuBar: true,
      show: false,
      backgroundColor: '#ffffff',
      webPreferences: {
        session: ses,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        spellcheck: false,
      },
    })
    loginWindow = win
    win.setMenuBarVisibility(false)
    win.webContents.setUserAgent(UA)

    // 登录页里的第三方登录 / 帮助链接常常要开新窗口，一律在当前窗口打开，免得跑出一堆弹窗
    win.webContents.setWindowOpenHandler(({ url }) => {
      void win.loadURL(url)
      return { action: 'deny' }
    })

    let settled = false
    let pollTimer: NodeJS.Timeout | null = null
    let timeoutTimer: NodeJS.Timeout | null = null
    let flushTimer: NodeJS.Timeout | null = null

    const cleanup = () => {
      if (pollTimer) clearInterval(pollTimer)
      if (timeoutTimer) clearTimeout(timeoutTimer)
      if (flushTimer) clearTimeout(flushTimer)
      pollTimer = null
      timeoutTimer = null
      flushTimer = null
      loginWindow = null
    }

    const finish = (cookie: string | null) => {
      if (settled) return
      settled = true
      cleanup()
      if (!win.isDestroyed()) win.destroy()
      resolve(cookie)
    }

    win.on('closed', () => { finish(null) })
    win.once('ready-to-show', () => { win.show() })

    win.webContents.on('did-finish-load', () => {
      if (!options.autoClickLogin) return
      void win.webContents.executeJavaScript(AUTO_CLICK_LOGIN).catch(() => {})
    })

    const check = async() => {
      if (settled) return
      try {
        const cookie = await readCookie(ses, options.hosts || [])
        if (!cookie) return
        // match 由平台配置给，格式固定，异常只可能是配置写错，捕获后按未登录处理
        let matched = false
        try {
          matched = new RegExp(options.match).test(cookie)
        } catch (err) {
          matched = false
        }
        if (!matched) return
        if (flushTimer) return
        // 命中后再等一小会儿，等站点把 uid / token 之类的补齐
        flushTimer = setTimeout(() => {
          void readCookie(ses, options.hosts || []).then(full => {
            finish(full || cookie)
          }).catch(() => { finish(cookie) })
        }, FLUSH_DELAY)
      } catch (err) {
        // 读取失败下一轮再试
      }
    }

    pollTimer = setInterval(() => { void check() }, POLL_INTERVAL)
    timeoutTimer = setTimeout(() => { finish(null) }, LOGIN_TIMEOUT)

    win.loadURL(options.url).catch(() => { finish(null) })
    void check()
  })
}

export default () => {
  ipcMain.handle(MOD_LOGIN_EVENT.open, async(_event, options: ModLoginOptions) => {
    if (!options?.url || !options?.platform) throw new Error('登录参数不完整')
    return openLoginWindow(options)
  })

  ipcMain.handle(MOD_LOGIN_EVENT.close, () => {
    if (loginWindow && !loginWindow.isDestroyed()) loginWindow.close()
  })

  // 退出登录时顺手清掉独立 session，否则下次打开登录窗会直接是已登录状态
  ipcMain.handle(MOD_LOGIN_EVENT.logout, async(_event, platform: string) => {
    if (!platform) return
    const ses = session.fromPartition(getPartition(platform))
    await ses.clearStorageData({ storages: ['cookies'] })
  })
}
