/* eslint-env browser */

/** 二改版发布信息：关于页、更新检查共用一处，改版本只改这里（package.json 的 version 需同步） */
export const MOD_VERSION = '1.1.5'
/**
 * 二改版站点统一用手机版那个域名（af384…）。
 * 旧的电脑版专用站 aa9247… 是早期单独发布的实例，本地没有它的发布记录，
 * 页面与 downloads/desktop-version.json 停在 1.1.3 改不动，
 * 结果就是「提示有新版本 → 点下载却还是旧安装包」。1.1.4 起统一收到这里维护。
 */
export const MOD_HOME_URL = 'https://af384ee6deb6e09e2.app.workbuddy.host/?sharecode=MKPWEVLBUS'
/** 电脑版下载页（安装包直链走 GitHub Release，页面与清单在本站，版本可控） */
export const MOD_DESKTOP_URL = 'https://af384ee6deb6e09e2.app.workbuddy.host/desktop.html?sharecode=MKPWEVLBUS'
/** 一起听网页版（浏览器 / 手机直接加入房间） */
export const LISTEN_WEB_URL = 'https://af384ee6deb6e09e2.app.workbuddy.host/?sharecode=MKPWEVLBUS'
/** 一起听中继（WebSocket） */
export const LISTEN_SERVER_URL = 'wss://af384ee6deb6e09e2.app.workbuddy.host?sharecode=MKPWEVLBUS'

/** 桌面版二改源码仓库（当前程序） */
export const MOD_GITHUB_APP = 'https://github.com/yzdz666/lx-music-desktop-mod'
/** 手机版二改源码仓库 */
export const MOD_GITHUB_MOBILE = 'https://github.com/yzdz666/lx-music-mobile-mod'
/** 一起听服务端仓库 */
export const MOD_GITHUB_SERVER = 'https://github.com/yzdz666/listen-together-server'
/** 桌面版 Release（所有安装包都在这里发布） */
export const MOD_RELEASES_URL = 'https://github.com/yzdz666/lx-music-desktop-mod/releases'
/** 许可证原文（本仓库 LICENSE） */
export const MOD_LICENSE_URL = 'https://github.com/yzdz666/lx-music-desktop-mod/blob/main/LICENSE'

export const MOD_AUTHOR = '月下独酌'
export const MOD_QQ = '3139606844'
