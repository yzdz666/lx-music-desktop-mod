/**
 * 三平台账号登录（网页登录窗口）公共定义
 *
 * 与手机版 WebLoginModal 同一套逻辑：
 * 打开官方登录页 → 用户在页面里用手机号 / 验证码 / 扫码登录 → 读 cookie → 落库。
 * 桌面版由主进程开 BrowserWindow（独立 session），轮询 session.cookies 命中即返回。
 */

export const MOD_LOGIN_EVENT = {
  open: 'mod_login_open',
  close: 'mod_login_close',
  logout: 'mod_login_logout',
} as const

export interface ModLoginOptions {
  /** 平台标识，用于隔离 session（persist:mod-login-<platform>） */
  platform: string
  /** 登录页地址 */
  url: string
  /** 命中即视为登录成功的 cookie（正则字符串，主进程 new RegExp 用） */
  match: string
  /** 只保留这些域下的 cookie，避免把无关站点的一起拼进去 */
  hosts: string[]
  /** 窗口标题 */
  title?: string
  width?: number
  height?: number
  /** 进页面自动点一次导航栏的「登录」按钮（QQ 音乐 / 酷狗需要） */
  autoClickLogin?: boolean
  /** 已经在登录页里，双击标题栏也无所谓 */
  mobile?: boolean
}

export const MOD_LOGIN_RESULT = {
  ok: 'ok',
  canceled: 'canceled',
  busy: 'busy',
  failed: 'failed',
} as const
