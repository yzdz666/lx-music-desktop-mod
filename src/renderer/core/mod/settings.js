/* eslint-env browser */
import { reactive, watch } from '@common/utils/vueTools'
import { LISTEN_SERVER_URL, LISTEN_WEB_URL } from './meta'

const STORAGE_KEY = 'lxmod.settings.v1'

const defaults = {
  // 网易云账号
  wyCookie: '',
  wyUid: '',
  wyNickname: '',
  wyAvatar: '',
  // QQ 音乐账号
  txCookie: '',
  txNickname: '',
  txAvatar: '',
  // 酷狗账号
  kgCookie: '',
  kgNickname: '',
  kgAvatar: '',
  // 一起听
  listenServer: LISTEN_SERVER_URL,
  listenNickname: '',
  listenWebUrl: LISTEN_WEB_URL,
  // 本地音乐
  localDirs: [],
  // 听歌播报
  songNotify: false,
  songNotifyRate: 1,
  // 自定义主题背景（data URL，空为不启用）
  customBg: '',
  // WebDAV
  webdavUrl: '',
  webdavUser: '',
  webdavPass: '',
}

const load = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const data = JSON.parse(raw)
    return data && typeof data == 'object' ? data : {}
  } catch (err) {
    console.warn('load mod settings failed', err)
    return {}
  }
}

export const modSetting = reactive({ ...defaults, ...load() })

let saveTimer = null
const save = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(modSetting))
  } catch (err) {
    console.warn('save mod settings failed', err)
  }
}
watch(modSetting, () => {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(save, 200)
}, { deep: true })

export const updateModSetting = (patch) => {
  Object.assign(modSetting, patch)
}

export const isWyLoggedIn = () => Boolean(modSetting.wyCookie)
