<div align="center">

<h1>LX Mod 桌面版</h1>

<p><b>洛雪音乐桌面版二改</b> · Windows / Linux · Electron 42</p>

<p>
  <a href="https://github.com/yzdz666/lx-music-desktop-mod/releases/latest"><img src="https://img.shields.io/github/v/release/yzdz666/lx-music-desktop-mod?label=release" alt="release"></a>
  <a href="https://github.com/yzdz666/lx-music-desktop-mod/releases"><img src="https://img.shields.io/github/downloads/yzdz666/lx-music-desktop-mod/total" alt="downloads"></a>
  <img src="https://img.shields.io/badge/align-mobile%20v1.22.35-4daf7c" alt="align">
  <img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="license">
</p>

</div>

> **非官方二改版，与洛雪官方无关联。** 基于 [lx-music-desktop](https://github.com/lyswhut/lx-music-desktop) v2.12.6 二次开发，把移动版 LX Mod 新增的功能整体搬到电脑端。

## 这是什么

原来洛雪桌面版有的，这里都还在：搜索、歌单、排行榜、我的列表、下载管理、逐字歌词、桌面歌词、音效、音源脚本、深浅色主题。

在此之上，把手机版 LX Mod 这几年加的东西搬了过来：

- **全 11 档音质** —— 播放 8 档、下载 11 档，按用户所选档位直接请求，失败才逐档回退
- **我的音乐 · 三平台** —— 网易云 / QQ 音乐 / 酷狗，共 20 个内容入口
- **云盘** —— 网易云音乐云盘 + WebDAV（坚果云等）
- **本地音乐** —— 多文件夹递归扫描，读标签、缓存、可搜索
- **一起听** —— 与手机版同一协议、同一房间，手机电脑同房
- **平台设置** —— 音源音质测试、三平台账号、自定义主题背景、听歌播报、关于与检查更新

当前版本 **1.1.3**，功能对齐手机版 **v1.22.36**。

## 下载

| 文件 | 平台 | 大小 | 说明 |
| --- | --- | --- | --- |
| `LXMod-Desktop-v1.1.3-win-x64-Setup.exe` | Windows 10/11 x64 | 115.5 MB | 安装版，带开始菜单与桌面快捷方式，多数人用这个 |
| `LXMod-Desktop-v1.1.3-win-x64-green.7z` | Windows 10/11 x64 | 95.0 MB | 绿色版，解压即用，不写注册表 |
| `LXMod-Desktop-v1.1.3-linux-x64.tar.gz` | Linux x64 | 126.1 MB | 免安装包，解压后运行 `LXMod-Desktop-v1.1.3-linux-x64/lx-music-desktop` |
| `lxmod-desktop-src-v1.1.3.zip` | 源码 | 约 13 MB | 完整可构建源码，不含 `node_modules` 与构建产物 |

前往 [Releases](https://github.com/yzdz666/lx-music-desktop-mod/releases/latest) 下载，或访问下载页：
<https://aa9247f7339b2cb18.app.workbuddy.host/desktop.html?sharecode=ER6OKBO4HG>

> 安装包没有购买代码签名证书，Windows 首次运行可能提示「已保护你的电脑」，点「更多信息」→「仍要运行」即可。介意的话先用绿色版。

应用内「检查更新」读的是自建清单 [`desktop-version.json`](https://aa9247f7339b2cb18.app.workbuddy.host/downloads/desktop-version.json?sharecode=ER6OKBO4HG)，主站取不到时自动回退到本仓库 Release 的 `latest/download`。不会再拉官方版本信息，也就不会出现「点了更新装回洛雪官方版、二改功能全丢」的情况。

> **1.1.1 起不再内置自动下载更新。** 点「去下载新版本」直接打开下载页，下载后覆盖安装即可（歌单、设置、账号都保留）。旧版内置的 electron-updater 按「安装包版本 + 上游 latest.yml」判断，既没有为每个版本发布 latest.yml，历史 publish 又指向上游仓库，一旦触发就会装回官方版，因此整条链路已移除。

## 装完必做两步

**1. 导入音源脚本。** 桌面版和手机版一样不内置音源，不导入就没有声音：
`设置 → 基本设置 → 音乐 API → 导入`。

**2. 想用「我的音乐」就填 Cookie。** 三个平台的 Cookie 都只存本机 `localStorage`：

| 平台 | 获取方式 |
| --- | --- |
| 网易云 | 浏览器登录 `music.163.com` → F12 → Application → Cookies → 复制 `MUSIC_U` |
| QQ 音乐 | 登录 `y.qq.com` → F12 → Application → Cookies → 复制 `qm_keyst` 与 `uin` |
| 酷狗 | 登录 `kugou.com` → F12 → 复制 `token` 与 `userid` |

想一起听：左侧栏「一起听」→ 填昵称 → 创建房间 → 把 6 位房间码发给朋友，手机版能进同一个房间。

## 新增功能

### 全 11 档音质

统一音质定义在 `src/common/quality.ts`，`LX.Quality` 扩展为：
`128k / 192k / 320k / flac / flac24bit / hires / atmos / atmos_plus / master / ape / wav`。

- **播放**：设置 → 播放 提供 8 档（Master / Atmos+ / Atmos / Hi-Res / 24bit / FLAC / 320K / 128K）
- **下载**：设置 → 下载 与下载弹窗提供完整 11 档，另有「最佳音质」按 `meta._qualitys` 自动选最高可用档
- **请求策略**：音源声明里没有用户所选档位时**仍按用户档位发起请求**（自定义音源的声明常落后于实际能力），失败后走 `getQualityFallbacks`：声明内较低档 → 歌曲自身最高档 → 128K；`tooManyRequests` 直接抛出，不降级
- **可视化**：歌曲表格带音质彩色徽标；平台设置可按 11 档逐档测试取链结果

### 我的音乐 · 三平台

左侧栏「我的音乐」，顶部切换平台。

| 平台 | 内容入口 |
| --- | --- |
| 网易云 | 每日推荐、我喜欢的、我的歌单、收藏歌单、心动模式、收藏专辑、关注歌手、私人 FM、新碟上架、云盘（10） |
| QQ 音乐 | 每日推荐、猜你喜欢、新歌、我喜欢的、我的歌单、收藏歌单、推荐歌单（7） |
| 酷狗 | 我喜欢的、我的歌单、推荐歌单（3） |

登录与手机版同一套逻辑：点「打开登录窗口（手机号 / 扫码）」会在应用内用独立 session 打开官方登录页，输入手机号 + 验证码（或扫码）后自动读取 Cookie 落库，登录成功窗口自动关闭；退出登录会一并清掉该 session。原来的「粘贴 Cookie」保留在折叠区，登录窗口打不开时仍可用。

请求走 Node 原生 `https`（`src/renderer/core/mod/http.js`），不受浏览器 CORS 限制；网易云走 weapi 加密（AES-128-CBC + RSA NoPadding），QQ 走 `musicu.fcg`，酷狗走 web 签名。

### 云盘与本地音乐

- **云盘**：网易云云盘（`/api/v1/cloud/get`）+ WebDAV（`PROPFIND` 列目录，音频先下到临时目录 `lxmod-webdav/` 再播放，绕开 Basic Auth 带不进 `<audio>` 的问题）
- **本地音乐**：多文件夹递归扫描（最深 8 层），`music-metadata` 读标题 / 歌手 / 专辑 / 时长，结果本地缓存，可搜索、播放全部、收藏

### 一起听

左侧栏「一起听」，或「平台设置 → 一起听」。

- 建房 / 6 位房间码加入，默认连公网中继，可改自建 `ws://` 地址
- 房主权威 + `stateSourceId` 播放源机制：房间空闲时成员可成为播放源且不被抢占；非播放源的播放 / 暂停 / 拖动进度通过 `control` 消息交给播放源执行
- 广播状态带音频直链（5 分钟缓存），网页版与手机端可直接播放房主音频
- 成员列表、转交房主、文字聊天、断线指数退避重连
- 「在浏览器打开网页版」直达一起听网页版，手机浏览器免装 App 即可加入

### 平台设置

左侧栏「平台设置」，五块内容：播放音质 8 档单选与音源平台一览、音源音质测试（按 `TRY_QUALITYS` 逐档取链）、三平台账号状态、外观与播报（自定义主题背景、TTS 听歌播报 + 语速 + 试听）、关于（免费说明 / 官方项目地址 / 赞助码 / 注意事项 / 许可协议，版式与手机版一致）。

## 与手机版对照

| 功能 | 手机版入口 | 桌面版实现 |
| --- | --- | --- |
| 全音质（11 档） | 播放页音质徽标 / 下载弹窗 | 播放 8 档、下载 11 档，逐档请求 + 回退链 |
| 歌曲下载 | 播放页顶栏下载图标 | 播放栏 / 播放详情页下载按钮 + 音质弹窗 |
| 我的音乐 | 侧边栏 | 三平台切换，20 个内容入口 |
| 云盘 | 侧边栏 | 网易云云盘 + WebDAV |
| 本地音乐 | 侧边栏 | 文件夹递归扫描 + `music-metadata` |
| 一起听 | 播放页 / 设置 | 建房 / 加入 / 播放源协议 / 网页版入口 |
| 自定义主题背景 | 设置 → 主题 | 平台设置「外观与播报」，选图即生效 |
| 听歌播报 | 设置 → 播放 | 平台设置「听歌播报」，TTS + 语速 + 试听 |
| 音源测试 | 设置 → 音源测试 | 平台设置「音源音质测试」 |
| 逐字歌词 / 桌面歌词 | App 内播放页 | 上游原生实现（能力覆盖） |

手机特有的系统能力（锁屏 / 灵动岛 / 状态栏歌词、背屏与原子随身听兼容包、系统 TTS 引擎）在桌面端不适用。

## 从源码构建

```bash
npm install
npm run build                                                   # 主进程 + 渲染进程 + 桌面歌词 + 用户脚本
node build-config/build-pack.js target=win arch=x64 type=setup  # Windows 安装版
node build-config/build-pack.js target=win arch=x64 type=green  # Windows 绿色版
```

跨平台打包时 `build-pack.js` 已设 `npmRebuild: false`，原生 sqlite 由 `build-before-pack.js` 按目标平台换成 `build-config/lib/` 下的预编译文件；`signAndEditExecutable: false` 保证 Linux 下无需 wine 改写 exe 资源。

## 代码结构

```
src/common/quality.ts                    统一音质定义（11 档、标签、颜色、回退链）
src/renderer/core/mod/                   HTTP、网易云加密与接口、QQ、酷狗、WebDAV、
                                         本地扫描、一起听客户端 / 同步、播报、设置
src/renderer/components/mod/             歌曲表格（含音质徽标）、页面公共样式
src/renderer/components/common/Download* 下载弹窗（11 档 + 最佳音质）
src/renderer/views/                      Mine / Cloud / LocalMusic / ListenTogether / Platform
src/main/modules/userApi/renderer/preload.js   自定义音源放开 11 档
doc/mod-desktop.md                       二改说明（功能、实现、验证记录）
```

## 已知限制

- **不内置音源脚本**，需自行导入；导入后播放 / 下载才会真正按档位取链
- 网易云 / QQ / 酷狗接口随官方调整可能失效，失效时直接显示接口返回的错误，不静默失败
- 云盘 / 歌单里版权歌曲能否播放取决于音源脚本与账号权限；WebDAV 首次播放大文件需等待下载
- 一起听以房主 / 播放源为权威，跟随端不主动控制播放
- Linux 包在 Xvfb 无头环境完成功能验证，未做真机桌面环境全量验证
- 桌面版与手机版数据不互通（歌单 / 设置各自独立）

## 更新日志

### 1.1.3（2026-11-05）

**修复：切歌时的歌词定时器崩溃**

和手机版 1.22.36 同一个根因。`lyric-font-player` 的 `TimeoutTools` 是模块级单例，`clear()` 取消不掉已经入队的 rAF 回调；`LinePlayer.pause()` 里还有一句 `if (!this.isPlay) return`，状态先被置 false 时整条链就没被清掉。切歌 `setLyric('')` 之后，孤儿回调继续跑，撞上已经重建的 `_lineFonts` / `lines`。

桌面版上表现为三种：

- 还没 `setLyric` 过就直接播放，`TypeError: Cannot read properties of null (reading 'length')` —— `LinePlayer.play()` 里 `this.lines` 是 `null`
- 首句未到 / 播放中改倍速，`FontPlayer.pause()` 里 `this.fonts[-1]` 取到 `undefined`
- 切到无歌词的歌后，上一首的歌词继续推进（`setLyric()` 里 `if (musicInfo.lrc)` 不成立就什么都不做）

修复：`TimeoutTools.start()` 起新链前先 `clear()`、`run()` 回调判空、`clear()` 置空回调；`LinePlayer` / `FontPlayer` 所有数组取值加边界判断；`FontPlayer.pause()` 里写错的 `this.maxLine`（该字段不存在，恒为 `undefined`）改为 `maxFontNum`；`core/lyric.ts` 在无歌词时显式 `setLyric('', [])`。

验证：Node + DOM stub 复现脚本，修复前 2 个场景必崩，修复后 0 崩溃；8 项回归全过（逐行 / 逐字推进、pause 停止、resync 跳行、切歌重推、offset 偏移、播完停最后一行、stop 后再 play）。

**新增：三平台手机号登录**

「我的音乐」不再只能 F12 复制 Cookie。点「打开登录窗口（手机号 / 扫码）」会用独立 session 的 `BrowserWindow` 打开官方登录页，与手机版 `WebLoginModal` 同一套地址和判定规则：

| 平台 | 登录页 | 登录标记 |
| --- | --- | --- |
| 网易云 | `music.163.com/m/login` | `MUSIC_U` |
| QQ 音乐 | `y.qq.com` | `qm_keyst` / `qqmusic_key` / `musickey` |
| 酷狗 | `www.kugou.com` | `KuGoo` / `kg_music` |

登录成功后自动读 Cookie 落库并关窗；退出登录会清掉独立 session，避免下次打开直接是已登录状态。粘贴 Cookie 保留在折叠区作兜底。

**关于页改成手机版版式**

免费说明 → 官方项目地址 → 赞助（内嵌二维码）→ 注意事项 → 许可协议，去掉了原来一长串上游 FAQ / 上游仓库跳转。

**许可协议与更新弹窗的链接**

Apache 许可证原文、开源地址、「桌面版常见问题」全部改到本仓库，不再指向洛雪上游。

### 1.1.2（2026-11-05）

**修复：装完只有进程、没有窗口（打不开）**

根因是数据库用的原生模块 `better-sqlite3` 打包时被换成了 `build-config/lib/better_sqlite3_win32-x64.node`，那是给 Electron 22（ABI 110）编的产物；当前 Electron 42 的 ABI 是 146，Windows 上 `dlopen` 直接失败。数据库 worker 起不来，主进程又没监听 worker 的 `error`，`initAppSetting()` 永远不返回 —— 于是任务管理器里能看到 2~3 个 Electron 进程，却一个窗口都不弹。Linux 版没事，是因为 Linux 那份 lib 恰好是 Node-API 版本。

修复与加固：

- 原生模块改为优先使用 `better-sqlite3` 自带的 N-API 预编译产物（`prebuilds/win32-x64.node`），不再依赖 Electron ABI；打包时会校验并打印实际使用的二进制
- 数据库 worker 增加 `error` / `exit` 监听，初始化加 15 秒超时；失败时弹窗写明原因与日志路径后退出，不再静默卡死
- 修复「检查更新」永远提示已是最新：主进程回 `not-available` 后，渲染层原来直接置 `isLatest = true`，从不比较清单版本。现在统一走 `showUpdateModal()` 做 `compareVer`
- 更新清单改为主站与 GitHub Release **同时取、取版本号更高的一份**，主站忘了更新也不会漏版本；单源失败不影响
- 主进程彻底移除 `electron-updater`（连 `app-update.yml` 依赖一起），避免再出现「点更新装回官方版」
- 协议弹窗、Win7 旧版提示里的上游链接改为本仓库 / 本仓库发布页

### 1.1.1（2026-11-05）

- **修复「关于 → GitHub 源码」跳到手机版仓库**，现在指向本仓库，并单独列出手机版仓库入口
- **关于页 / 更新弹窗里的上游跳转全部改掉**：「最新版下载地址」「提交 Issue」原来指向洛雪官方仓库与官方 Release，用户点过去很容易装回官方版、二改功能全丢
- **移除内置自动下载更新**（electron-updater）：不再读上游 `latest.yml`，点「去下载新版本」直接打开下载页；主进程只回一条「无可用更新」，版本判断统一走自建清单
- 默认关闭「自动下载更新」开关
- **安装包补齐图标与版本信息**：此前 `signAndEditExecutable: false` 把图标和元数据一起跳过，exe 属性里显示 `Electron 42.11.6 / GitHub, Inc.`，现在显示 `LX Mod 1.1.1 / 月下独酌`
- 产物统一命名 `LXMod-Desktop-v版本-平台-架构`，Linux 增加 `tar.gz` 目标
- 打包配置的 `publish` 仓库由上游改为本仓库；桌面快捷方式、Linux desktop entry、legalTrademarks、maintainer 一并改为 LX Mod

## 相关仓库

| 仓库 | 内容 |
| --- | --- |
| [lx-music-mobile-mod](https://github.com/yzdz666/lx-music-mobile-mod) | 手机版二改（包名 `com.lxmod.music`，另有原包名覆盖包） |
| [listen-together-server](https://github.com/yzdz666/listen-together-server) | 一起听中继服务端 + 网页版，可自建 |
| [lx-music-desktop-mod](https://github.com/yzdz666/lx-music-desktop-mod) | 本仓库，桌面版二改 |

## 致谢与许可

- 上游：[lyswhut/lx-music-desktop](https://github.com/lyswhut/lx-music-desktop)（Apache-2.0）
- 移动版二改思路与部分实现参考：[WalnutBai/lx-lxwalnut-music-mobile](https://github.com/WalnutBai/lx-lxwalnut-music-mobile)
- 本项目同样以 **Apache-2.0** 发布，详见 [LICENSE](./LICENSE)

> 本项目仅供学习与交流，请支持正版音乐。所有音源均由用户自行导入，本项目不提供、不托管任何音源。
