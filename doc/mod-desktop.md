# LX Mod 桌面版 · 二改说明

基于 [lx-music-desktop](https://github.com/lyswhut/lx-music-desktop) v2.12.6 的二次开发版本，把移动版 LX Mod 新增的功能整体搬到电脑端，**功能与手机版 v1.22.35 对齐**。

- 二改版本：1.1.0
- 对齐手机版：v1.22.35（versionCode 140000）
- 上游版本：2.12.6（Electron 42 / Vue 3 / webpack 5）
- 作者：月下独酌 · QQ 3139606844

> 手机版 1.22.32 ~ 1.22.35 的改动均为逐字歌词时长、备份导入、WebDAV、抽屉等缺陷修复，未新增功能项（功能清单 `doc/mod-features.md` 与 1.22.31 完全一致）。因此本版按 1.22.31 对齐的功能集即为 1.22.35 的完整功能集。

## 与手机版功能对照

| 功能 | 手机版入口 | 桌面版实现 |
| --- | --- | --- |
| 全音质（11 档） | 播放页音质徽标 / 下载弹窗 | 播放 8 档、下载 11 档，逐档请求 + 回退链 |
| 歌曲下载 | 播放页顶栏下载图标 | 播放栏 / 播放详情页下载按钮 + 音质弹窗（含「最佳音质」） |
| 下载管理 | 侧边栏「下载」 | 上游原生下载管理页（下载路径、并发数、文件命名、封面/歌词嵌入） |
| 我的音乐 | 侧边栏 | 网易云 / QQ 音乐 / 酷狗 三平台切换，共 20 个内容入口 |
| 云盘 | 侧边栏 | 网易云云盘 + WebDAV 网盘 |
| 本地音乐 | 侧边栏 | 文件夹递归扫描 + `music-metadata` 解析 |
| 一起听 | 播放页 / 设置 | 建房 / 加入 / 播放源协议 / 网页版入口，可手机电脑同房 |
| 一起听网页版 | 设置 → 其他 → 一起听 | 平台设置 + 房间页「在浏览器打开网页版」 |
| 自定义主题背景 | 设置 → 主题 | 平台设置「外观与播报」，选图即生效 |
| 听歌播报 | 设置 → 播放 | 平台设置「听歌播报」，TTS 播报 + 语速 + 试听 |
| 音源测试 | 设置 → 音源测试 | 平台设置「音源音质测试」，按 11 档逐档取链接 |
| 平台账号 | 各平台登录 | 平台设置「平台账号」，三平台 Cookie 本机保存 |
| 在线更新 / 主页 / 源码 | 设置 → 关于 | 平台设置「关于」：主页、下载页、GitHub 源码、检查更新 |
| 逐字歌词 / 桌面歌词 | App 内播放页 | 上游原生逐字歌词与桌面歌词悬浮窗（实现不同，能力覆盖） |
| 音效系统 | 设置 → 音效 | 上游原生音效与均衡器 |

手机特有的系统能力（Android 锁屏 / 灵动岛 / 状态栏歌词、背屏与原子随身听兼容包、系统 TTS 引擎、`WRITE_EXTERNAL_STORAGE` 权限）在桌面端不适用，由桌面原生能力替代。

## 全音质支持

统一音质定义放在 `src/common/quality.ts`，`LX.Quality` 类型扩展到 11 档：
`128k / 192k / 320k / flac / flac24bit / hires / atmos / atmos_plus / master / ape / wav`。

- **播放**：设置 → 播放 提供 8 档（Master / Atmos+ / Atmos / Hi-Res / 24bit / FLAC / 320K / 128K）。
- **下载**：设置 → 下载「默认下载音质」与下载弹窗均提供完整 11 档，另加「最佳音质」（按歌曲 `meta._qualitys` 自动选最高可用档）。
- **请求策略**（对齐手机版 1.22.16）：音源声明里没有用户所选档位时**仍按用户档位发起请求**（自定义音源声明常落后于实际能力），失败后走 `getQualityFallbacks`：声明内较低档 → 歌曲自身最高档 → 128K。`tooManyRequests` 直接抛出，不降级。
- **不再提前降级**：下载与播放都改成「目标档位优先 + 逐档回退」，自定义音源 preload 的 `supportQualitys` 也放开到 11 档，Master / Atmos / Hi-Res 不会被过滤。
- **音质可视化**：歌曲表格新增「音质」彩色徽标；平台设置按 11 档逐档测试取链结果。

## 我的音乐（三平台）

入口：左侧栏「我的音乐」，顶部切换平台。三个平台的 Cookie 都只写本机 `localStorage`。

| 平台 | 内容入口 |
| --- | --- |
| 网易云 | 每日推荐、我喜欢的、我的歌单、收藏歌单、心动模式、收藏专辑、关注歌手、私人 FM、新碟上架、云盘（10） |
| QQ 音乐 | 每日推荐、猜你喜欢、新歌、我喜欢的、我的歌单、收藏歌单、推荐歌单（7） |
| 酷狗 | 我喜欢的、我的歌单、推荐歌单（3） |

歌单 / 专辑 / 歌手以封面卡片网格展示，进入后是歌曲表格，工具栏支持播放全部、下载全部、刷新。

实现：

| 文件 | 作用 |
| --- | --- |
| `src/renderer/core/mod/wyCrypto.js` | 网易云 weapi 加密（AES-128-CBC 两次 + RSA NoPadding） |
| `src/renderer/core/mod/netease.js` | 网易云 web 接口，约 20 个导出方法 |
| `src/renderer/core/mod/qq.js` | QQ 音乐 `musicu.fcg` 接口（qm_keyst / uin） |
| `src/renderer/core/mod/kugou.js` | 酷狗 web 签名（`NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt`）+ 歌单接口 |

请求走 Node 原生 `https`（`core/mod/http.js`），不受浏览器 CORS 限制。实测网易云 `song/detail` / `search` / `album/new` 均 `code=200`，QQ 推荐歌单 `code=0`，酷狗推荐歌单与歌单歌曲 `errcode=0`。

## 云盘 / 本地音乐

- **云盘**：网易云云盘（`/api/v1/cloud/get`）+ WebDAV 网盘（`PROPFIND` 列目录，音频先下载到临时目录 `lxmod-webdav/` 再播放，规避 Basic Auth 无法带进 `<audio>`）。
- **本地音乐**：多文件夹递归扫描（最深 8 层），`music-metadata` 读标题 / 歌手 / 专辑 / 时长，结果本地缓存，可搜索、播放全部、收藏。

## 一起听

入口：左侧栏「一起听」或「平台设置 → 一起听」。

- 创建房间 / 6 位房间码加入，默认连公网中继，可改自建 `ws://` 地址。
- 房主权威 + `stateSourceId` 播放源机制（对齐手机版 1.13.1）：房间空闲时成员可成为播放源且不被抢占；广播成功后自查认领播放源；非播放源的播放 / 暂停 / 拖动进度通过 `control` 消息发给播放源执行。
- 广播状态里带音频直链（5 分钟缓存），网页版与手机端可直接播放房主音频。
- 成员列表、房主标识、转交房主、文字聊天、系统消息、断线指数退避重连。
- 页面「在浏览器打开网页版」按钮直达一起听网页版，手机浏览器无需装 App 即可加入。
- 错误提示改为页面内联（早期版本用原生 `alert()`，在无头 / 无桌面环境会卡住渲染进程，已修复）。

## 平台设置

入口：左侧栏「平台设置」。

- 播放音质 8 档单选、音源平台一览（各平台可用音质，脚本导入后动态刷新）。
- **音源音质测试**：拿当前播放的在线歌曲按 `TRY_QUALITYS` 逐档向音源取链，展示可用 / 失败。
- **平台账号**：网易云 / QQ 音乐 / 酷狗 登录态。
- **外观与播报**：自定义主题背景（选图 → `modSetting.customBg` → `applyTheme` 写入 `--background-image`）、听歌播报开关 / 语速 / 试听。
- **一起听**：中继地址、网页版地址、打开房间 / 打开网页版。
- **关于**：版本、作者、二改版主页、电脑版下载页、GitHub 源码、检查更新。

## 代码结构

```
src/common/quality.ts               统一音质定义（11 档、标签、颜色、扩展名、回退链）
src/renderer/core/mod/              HTTP、网易云加密与接口、QQ、酷狗、WebDAV、本地扫描、
                                   一起听客户端 / 同步、播报、设置、发布元数据
src/renderer/components/mod/        歌曲表格（含音质徽标）、页面公共样式
src/renderer/components/layout/PlayBar|PlayDetail   下载按钮
src/renderer/components/common/Download*.vue        下载弹窗（11 档 + 最佳音质）
src/renderer/views/Setting/components/SettingPlay|SettingDownload.vue  音质设置
src/renderer/views/                 Mine / Cloud / LocalMusic / ListenTogether / Platform
src/main/modules/userApi/renderer/preload.js        自定义音源放开 11 档
```

## 构建与打包

```bash
npm install
npm run build                 # 主进程 + 渲染进程 + 桌面歌词 + 用户脚本
node build-config/build-pack.js target=win arch=x64 type=setup   # Windows 安装版
node build-config/build-pack.js target=win arch=x64 type=green   # Windows 绿色版
# Linux 免安装包与源码 zip 由打包脚本额外压缩生成
```

跨平台打包时 `build-pack.js` 已设置 `npmRebuild: false`，原生 sqlite 由 `build-before-pack.js` 按目标平台换成 `build-config/lib/` 下的预编译文件；`signAndEditExecutable: false` 保证 Linux 下无需 wine 改写 exe 资源。

## 验证记录（1.1.0）

CDP + Xvfb 实测：播放设置 8 档、下载设置 11 档、下载弹窗 11 档（含「最佳音质」）、平台设置 5 个音源全 11 档与三平台账号、我的音乐三平台切换、云盘 / 本地音乐渲染；一起听建房成功连上公网中继（显示「已连接」、房间码、成员与房主标识），空昵称 / 空房间码走内联提示且渲染进程保持响应；关于区块 v1.1.0 与四个入口按钮正常。

## 已知限制

- 桌面版与手机版一样**不内置音源脚本**，需在「设置 → 基本设置 → 音乐 API → 导入」添加；导入后播放 / 下载才会真正按对应档位取链。
- 网易云 / QQ / 酷狗接口随官方调整可能失效，失效时页面直接显示接口返回的错误信息，不会静默失败；需登录态的接口未登录会提示「登录状态已失效」。
- 云盘 / 歌单里版权歌曲能否播放取决于音源脚本与账号权限；WebDAV 首次播放大文件需等待下载。
- 一起听以房主 / 播放源为权威，跟随端不主动控制播放。
- Windows 安装包未做代码签名，首次运行可能触发 SmartScreen，点「更多信息 → 仍要运行」即可；Linux 包未做真机桌面环境验证（在 Xvfb 无头环境完成功能验证）。
