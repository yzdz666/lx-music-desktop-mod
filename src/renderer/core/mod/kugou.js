/* eslint-env browser */
/**
 * 酷狗音乐账号中心（桌面版）
 *
 * 覆盖：推荐歌单（公开）、我的歌单、歌单歌曲、我喜欢。
 * 酷狗网关接口要设备指纹 + 多重签名，桌面端只走免签的 web 接口，
 * 登录态用 Cookie 里的 userid 与 token 判断。
 */
import { request } from './http'
import { formatPlayTime, sizeFormate } from '@common/utils/common'
import { toMD5 } from '@common/utils/nodejs'
import { modSetting, updateModSetting } from './settings'

const UID_KEYS = ['userid', 'user_id', 'uid', 'kugouid']
const TOKEN_KEYS = ['token', 't', 'kg_music_token']

const getCookie = () => modSetting.kgCookie || ''

const parseCookie = (cookie) => {
  const map = {}
  ;(cookie || '').split(';').forEach((item) => {
    const index = item.indexOf('=')
    if (index < 0) return
    map[item.slice(0, index).trim()] = item.slice(index + 1).trim()
  })
  return map
}

export const getUid = (cookie = getCookie()) => {
  const map = parseCookie(cookie)
  for (const key of UID_KEYS) {
    if (map[key] && /^\d+$/.test(map[key])) return map[key]
  }
  return ''
}

const getToken = (cookie = getCookie()) => {
  const map = parseCookie(cookie)
  for (const key of TOKEN_KEYS) {
    if (map[key]) return map[key]
  }
  return ''
}

export const hasKgSession = (cookie = getCookie()) => Boolean(cookie && getUid(cookie) && getToken(cookie))

const UA_WEB = 'Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1'
const UA_PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const WEB_SIGN_KEY = 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt'

const signWeb = (params) => toMD5(`${WEB_SIGN_KEY}${params.split('&').sort().join('')}${WEB_SIGN_KEY}`)

const getJson = async(url, options = {}) => {
  const res = await request(url, {
    headers: {
      'User-Agent': UA_WEB,
      Referer: 'https://m.kugou.com/',
      ...(options.headers ?? {}),
      ...(getCookie() ? { Cookie: getCookie() } : {}),
    },
  })
  if (res.status != 200) throw new Error(`酷狗请求失败（${res.status}）`)
  try {
    return JSON.parse(res.text)
  } catch (err) {
    throw new Error('酷狗返回异常')
  }
}

const buildTypes = (item) => {
  const types = []
  const _types = {}
  const add = (type, size) => {
    if (!size) return
    const text = sizeFormate(Number(size))
    types.push({ type, size: text })
    _types[type] = { size: text }
  }
  add('128k', item.filesize)
  add('320k', item.filesize_320 ?? item.hqfilesize)
  add('flac', item.filesize_flac ?? item.sqfilesize)
  add('flac24bit', item.filesize_high ?? item.hiresfilesize)
  if (!types.length) {
    types.push({ type: '128k', size: 'unknown' }, { type: '320k', size: 'unknown' }, { type: 'flac', size: 'unknown' })
    _types['128k'] = { size: 'unknown' }
    _types['320k'] = { size: 'unknown' }
    _types.flac = { size: 'unknown' }
  }
  return { types, _types }
}

const splitName = (item) => {
  if (item.songname) return { name: item.songname, singer: item.singername ?? '' }
  const filename = String(item.filename ?? '').replace(/\.[^.]+$/, '')
  const index = filename.indexOf(' - ')
  if (index > 0) return { name: filename.slice(index + 3), singer: filename.slice(0, index) }
  return { name: filename, singer: '' }
}

export function toMusicInfo(item) {
  if (!item) return null
  const hash = item.hash ?? item.FileHash
  if (!hash) return null
  const { name, singer } = splitName(item)
  const { types, _types } = buildTypes(item)
  const duration = Number(item.duration ?? item.Duration ?? 0)
  return {
    id: `kg_${hash}`,
    name: name || '未知歌曲',
    singer,
    source: 'kg',
    interval: duration ? formatPlayTime(duration) : '',
    meta: {
      songId: hash,
      albumName: item.album_name ?? item.albumname ?? item.remark ?? '',
      albumId: item.album_id ?? '',
      picUrl: '',
      qualitys: types,
      _qualitys: _types,
    },
  }
}

const toMusicList = (list) => (list ?? []).map(toMusicInfo).filter(Boolean)

const normalizePlaylist = (item) => ({
  id: String(item.specialid ?? item.listid ?? item.specialId ?? ''),
  name: item.specialname ?? item.special_name ?? item.name ?? '',
  cover: String(item.imgurl ?? item.img ?? '').replace('{size}', '480'),
  count: item.songcount ?? item.song_count ?? 0,
  creator: item.nickname ?? item.username ?? '',
  subscribed: Boolean(item.subscribed),
})

/** 推荐歌单（公开，免登录） */
export const getRecommendPlaylists = async() => {
  const body = await getJson('https://m.kugou.com/plist/index?json=true', {
    headers: { Referer: 'https://m.kugou.com/' },
  })
  const list = body?.plist?.list?.info ?? []
  return (Array.isArray(list) ? list : []).map(normalizePlaylist).filter(item => item.id)
}

/**
 * 我的歌单
 * m.kugou.com/plist/list/{uid} 是免签的 web 接口，返回公开与自建歌单
 */
export const getMyPlaylists = async() => {
  const uid = getUid()
  if (!uid) throw new Error('酷狗登录已失效，请重新登录')
  const body = await getJson(`https://m.kugou.com/plist/list/${uid}?json=true`, {
    headers: { Referer: 'https://m.kugou.com/' },
  })
  const list = body?.list?.info ?? body?.data?.info ?? []
  return (Array.isArray(list) ? list : []).map(normalizePlaylist).filter(item => item.id)
}

/** 我收藏的歌单（与自建同一接口，按标记区分） */
export const getSubscribedPlaylists = async() => {
  const list = await getMyPlaylists()
  return list.filter(item => item.subscribed)
}

/** 歌单歌曲（web 签名接口，免登录） */
export const getPlaylistSongs = async(listid, pagesize = 100) => {
  const id = String(listid ?? '').trim()
  if (!id) throw new Error('酷狗歌单 ID 为空')
  const songs = []
  for (let page = 1; page <= 50; page++) {
    const t = String(Date.now())
    const params = `appid=1058&specialid=${id}&page=${page}&pagesize=${pagesize}` +
      `&srcappid=2919&clientver=20000&clienttime=${t}&mid=${t}&uuid=${t}&dfid=-`
    const body = await getJson(`https://mobiles.kugou.com/api/v5/special/song?${params}&signature=${signWeb(params)}`, {
      headers: {
        Referer: 'https://m3ws.kugou.com/share/index.php',
        mid: t,
        dfid: '-',
        clienttime: t,
      },
    })
    if (!body || (body.errcode ?? 0) !== 0) throw new Error(`酷狗歌单读取失败（${body?.errcode ?? '网络异常'}）`)
    const list = body.data?.info ?? []
    songs.push(...list)
    if (list.length < pagesize) break
  }
  return toMusicList(songs)
}

/** 我喜欢（酷狗用「我喜欢」歌单承载，登录后从我的歌单里找） */
export const getLikedSongs = async() => {
  const playlists = await getMyPlaylists()
  const liked = playlists.find(item => /我喜欢|喜欢的音乐/.test(item.name))
  if (!liked) throw new Error('没有找到「我喜欢」歌单，请先在酷狗里收藏几首歌')
  return getPlaylistSongs(liked.id)
}

export const loginWithCookie = async(input) => {
  const cookie = (input || '').trim()
  if (!cookie) throw new Error('请先填写 Cookie')
  if (!hasKgSession(cookie)) throw new Error('Cookie 里缺少 userid 或 token，请重新复制')
  updateModSetting({
    kgCookie: cookie,
    kgUid: getUid(cookie),
    kgNickname: `酷狗用户 ${getUid(cookie)}`,
  })
  return { uid: getUid(cookie) }
}

export const logout = () => {
  updateModSetting({ kgCookie: '', kgUid: '', kgNickname: '', kgAvatar: '' })
}

export const fetchImageAsDataUrl = async(url) => {
  if (!url) return ''
  try {
    const res = await request(url, { headers: { Referer: 'https://www.kugou.com/' } })
    const type = String(res.headers['content-type'] || 'image/jpeg').split(';')[0]
    return `data:${type};base64,${res.body.toString('base64')}`
  } catch (err) {
    return ''
  }
}
