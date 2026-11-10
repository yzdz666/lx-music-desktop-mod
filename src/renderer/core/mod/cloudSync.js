/* eslint-env browser */
/**
 * 三端云同步（电脑版客户端）
 *
 * 与手机版 `src/core/sync/cloudSync.ts` 使用同一套协议与同一条推送/拉取流程，
 * 服务端按条目做 LWW 合并，两端各自只上传自己改过的部分。
 *
 * 数据：
 * - 歌单：默认列表 / 我的收藏 / 自建歌单（不含临时列表）
 * - 设置：只同步跨端有意义的一小组（音源、播放方式、逐字歌词样式等）
 *
 * 时间戳用「内容哈希 + 上次同步快照」推断，内容没变就沿用旧时间戳，
 * 避免每次同步都刷新时间把对方的修改压掉。
 */
import { watch } from '@common/utils/vueTools'
import { appSetting, updateSetting } from '@renderer/store/setting'
import { defaultList, loveList, userLists } from '@renderer/store/list/state'
import {
  getListMusics,
  overwriteListMusics,
  createUserList,
  removeUserList,
  updateUserList,
} from '@renderer/store/list/action'
import { LIST_IDS } from '@common/constants'

const DEVICE_KEY = 'lxmod.cloudSync.deviceId'
const SNAPSHOT_KEY = 'lxmod.cloudSync.snapshot'
const CLIENT = 'lx-music-desktop-mod'

export const DEFAULT_SYNC_URL = 'https://af384ee6deb6e09e2.app.workbuddy.host/api/sync?sharecode=MKPWEVLBUS'

/**
 * 允许同步的设置项白名单。
 *
 * 桌面端的窗口尺寸、音量、桌面歌词坐标、媒体设备、快捷键都是「本机专属」，
 * 同步过去只会让另一台机器行为变得莫名其妙，所以显式列白名单而不是黑名单。
 */
const SYNC_SETTING_KEYS = [
  'common.apiSource',
  'player.togglePlayMethod',
  'player.playbackRate',
  'playDetail.style.fontSize',
  'playDetail.style.align',
]

const hashText = (text) => {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return `${hash.toString(16)}:${text.length}`
}

const hashSongs = (list) => hashText(list.map(m => `${m.id}|${m.name}|${m.singer}`).join('\n'))

const loadJSON = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

const saveJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (err) {
    console.warn('cloud sync storage failed', err)
  }
}

const getDeviceId = () => {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

const emptySnapshot = () => ({ at: 0, items: {}, settings: {} })

const loadSnapshot = () => {
  const raw = loadJSON(SNAPSHOT_KEY, null)
  if (!raw || typeof raw != 'object' || !raw.items) return emptySnapshot()
  return {
    at: Number(raw.at) || 0,
    items: raw.items,
    settings: raw.settings && typeof raw.settings == 'object' ? raw.settings : {},
  }
}

export const getSyncConfig = () => ({
  url: (appSetting['sync.cloudUrl'] || DEFAULT_SYNC_URL).trim(),
  code: (appSetting['sync.cloudCode'] || '').trim().toUpperCase(),
  secret: (appSetting['sync.cloudSecret'] || '').trim(),
})

/**
 * 把配置里的基地址拼成具体接口。
 *
 * 基地址自带查询串（默认 `/api/sync?sharecode=xxx`），action 必须插在 path
 * 末尾。接在整串后面会拼成 `/api/sync?sharecode=xxx/create`，网关拿到的
 * sharecode 是 `xxx/create`，校验失败回 403（HTML），客户端只看到「非 JSON」。
 */
const buildUrl = (base, action) => {
  const hashIndex = base.indexOf('#')
  const noHash = hashIndex == -1 ? base : base.slice(0, hashIndex)
  const qIndex = noHash.indexOf('?')
  const path = (qIndex == -1 ? noHash : noHash.slice(0, qIndex)).replace(/\/+$/, '')
  const query = qIndex == -1 ? '' : noHash.slice(qIndex + 1).replace(/^&+|&+$/g, '')
  const params = query ? `${query}&_=${Date.now()}` : `_=${Date.now()}`
  return `${path}/${action}?${params}`
}

const post = async(base, action, body, timeout = 20000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(buildUrl(base, action), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    let data
    try {
      data = await res.json()
    } catch {
      throw new Error(`同步服务返回了非 JSON 内容（HTTP ${res.status}）`)
    }
    if (!res.ok || !data || !data.ok) {
      const code = data && data.error
      if (code == 'auth_failed') throw new Error('同步码或密钥不正确')
      if (code == 'code_exists') throw new Error('这个同步码已被占用，换一个')
      if (code == 'rate_limited') throw new Error('请求太频繁，稍后再试')
      if (code == 'space_too_large') throw new Error('同步空间已满（8MB），请清理歌单')
      throw new Error(`同步服务错误：${code || res.status}`)
    }
    return data
  } finally {
    clearTimeout(timer)
  }
}

const collectLists = async(deviceId, snapshot, now) => {
  const items = []
  const targets = [
    { id: defaultList.id, name: defaultList.name },
    { id: loveList.id, name: loveList.name },
    ...userLists.map(list => ({
      id: String(list.id),
      name: list.name,
      info: {
        id: String(list.id),
        name: list.name,
        source: list.source == null ? null : list.source,
        sourceListId: list.sourceListId == null ? null : list.sourceListId,
        locationUpdateTime: list.locationUpdateTime == null ? null : list.locationUpdateTime,
      },
    })),
  ]

  for (const target of targets) {
    if (!target.id || target.id == LIST_IDS.TEMP) continue
    let musics
    try {
      musics = await getListMusics(target.id)
    } catch {
      continue
    }
    const key = `list:${target.id}`
    const hash = hashSongs(musics)
    const prev = snapshot.items[key]
    const updatedAt = prev && prev.hash === hash ? prev.updatedAt : now
    items.push({
      key,
      kind: target.id == LIST_IDS.LOVE ? 'favorite' : 'list',
      id: target.id,
      name: target.name,
      data: { list: musics, info: target.info },
      updatedAt,
      deviceId,
    })
    snapshot.items[key] = { hash, updatedAt }
  }
  return items
}

const collectSettings = (deviceId, snapshot, now) => {
  const settings = {}
  for (const key of SYNC_SETTING_KEYS) {
    if (!(key in appSetting)) continue
    const value = appSetting[key]
    const hash = hashText(JSON.stringify(value == null ? null : value))
    const prev = snapshot.settings[key]
    const updatedAt = prev && prev.hash === hash ? prev.updatedAt : now
    settings[key] = { value, updatedAt, deviceId }
    snapshot.settings[key] = { hash, updatedAt }
  }
  return settings
}

const applyRemoteList = async(item, warnings) => {
  const id = String(item.id || '')
  if (!id) return false
  try {
    if (item.deleted) {
      if (id == LIST_IDS.DEFAULT || id == LIST_IDS.LOVE) {
        await overwriteListMusics({ listId: id, musicInfos: [] })
      } else if (userLists.some(list => String(list.id) == id)) {
        await removeUserList([id])
      }
      return true
    }
    const musics = Array.isArray(item.data && item.data.list) ? item.data.list : []
    const info = (item.data && item.data.info) || {}
    if (id == LIST_IDS.DEFAULT || id == LIST_IDS.LOVE) {
      await overwriteListMusics({ listId: id, musicInfos: musics })
      return true
    }
    const exists = userLists.some(list => String(list.id) == id)
    if (exists) {
      await updateUserList([{
        id,
        name: String(info.name || item.name || id),
        source: info.source,
        sourceListId: info.sourceListId,
        locationUpdateTime: info.locationUpdateTime == null ? null : info.locationUpdateTime,
      }])
      await overwriteListMusics({ listId: id, musicInfos: musics })
    } else {
      await createUserList({
        id,
        name: String(info.name || item.name || id),
        list: musics,
        source: info.source,
        sourceListId: info.sourceListId,
        position: userLists.length,
      })
    }
    return true
  } catch (err) {
    warnings.push(`歌单「${item.name || item.id}」${String((err && err.message) || err)}`)
    return false
  }
}

let syncPromise = null
/** 执行一次双向同步 */
export const syncCloud = async() => {
  if (syncPromise) return syncPromise
  syncPromise = (async() => {
    const { url, code, secret } = getSyncConfig()
    if (!url) throw new Error('请先填写同步服务地址')
    if (!code || !secret) throw new Error('请先填写同步码与密钥')

    const deviceId = getDeviceId()
    const snapshot = loadSnapshot()
    const now = Date.now()
    const warnings = []

    const items = await collectLists(deviceId, snapshot, now)
    const settings = collectSettings(deviceId, snapshot, now)

    const pushed = await post(url, 'push', {
      code,
      secret,
      deviceId,
      deviceName: `${CLIENT} · Desktop`,
      items,
      settings,
    })

    let applied = 0
    for (const [key, remote] of Object.entries(pushed.items || {})) {
      const local = snapshot.items[key]
      if (local && remote.updatedAt <= local.updatedAt) continue
      if (await applyRemoteList(remote, warnings)) {
        applied++
        snapshot.items[key] = {
          hash: remote.deleted ? '' : hashSongs(Array.isArray(remote.data && remote.data.list) ? remote.data.list : []),
          updatedAt: remote.updatedAt,
        }
      }
    }

    const settingPatch = {}
    for (const [key, remote] of Object.entries(pushed.settings || {})) {
      if (!SYNC_SETTING_KEYS.includes(key)) continue
      const local = snapshot.settings[key]
      if (local && remote.updatedAt <= local.updatedAt) continue
      settingPatch[key] = remote.value
      snapshot.settings[key] = {
        hash: hashText(JSON.stringify(remote.value == null ? null : remote.value)),
        updatedAt: remote.updatedAt,
      }
      applied++
    }
    if (Object.keys(settingPatch).length) updateSetting(settingPatch)

    snapshot.at = Date.now()
    saveJSON(SNAPSHOT_KEY, snapshot)

    const visible = Object.values(pushed.items || {}).filter(item => !item.deleted)
    return {
      at: snapshot.at,
      rev: pushed.rev,
      applied,
      lists: visible.length,
      songs: visible.reduce((total, item) => total + (Array.isArray(item.data && item.data.list) ? item.data.list.length : 0), 0),
      settings: Object.keys(pushed.settings || {}).length,
      warnings,
    }
  })()
  try {
    return await syncPromise
  } finally {
    // eslint-disable-next-line require-atomic-updates
    syncPromise = null
  }
}

/** 新建同步空间 */
export const createCloudSpace = async(customCode) => {
  const { url } = getSyncConfig()
  if (!url) throw new Error('请先填写同步服务地址')
  const result = await post(url, 'create', {
    code: (customCode || '').trim() || undefined,
    deviceId: getDeviceId(),
    deviceName: `${CLIENT} · Desktop`,
  })
  updateSetting({
    'sync.cloudCode': result.code,
    'sync.cloudSecret': result.secret,
  })
  saveJSON(SNAPSHOT_KEY, emptySnapshot())
  return result
}

/** 读取空间信息 */
export const readCloudSpaceInfo = async() => {
  const { url, code, secret } = getSyncConfig()
  if (!code || !secret) throw new Error('请先填写同步码与密钥')
  return post(url, 'info', { code, secret })
}

/** 断开同步：只清本机凭据与快照 */
export const resetCloudSync = () => {
  saveJSON(SNAPSHOT_KEY, emptySnapshot())
  updateSetting({
    'sync.cloudCode': '',
    'sync.cloudSecret': '',
  })
}

/** 全量上传本机数据 */
export const pushAllToCloud = async() => {
  saveJSON(SNAPSHOT_KEY, emptySnapshot())
  return syncCloud()
}

/**
 * 自动同步：启动后延迟一次，之后每 10 分钟检查一次（仅在窗口聚焦时）。
 * 电脑端是长驻进程，用定时器比监听开关窗口更贴合实际使用。
 */
let autoTimer = null
let autoInited = false
export const initCloudAutoSync = () => {
  if (autoInited) return
  autoInited = true

  const run = () => {
    if (appSetting['sync.cloudAuto'] == 'off') return
    if (!appSetting['sync.cloudCode'] || !appSetting['sync.cloudSecret']) return
    syncCloud().catch(err => console.warn('cloud auto sync failed', err))
  }
  setTimeout(run, 8000)
  autoTimer = setInterval(run, 10 * 60 * 1000)
  // 设置里切换同步码 / 开关时立即尝试一次
  watch(() => appSetting['sync.cloudCode'], run)
}

export const disposeCloudAutoSync = () => {
  if (autoTimer) clearInterval(autoTimer)
  autoTimer = null
  autoInited = false
}
