/* eslint-env browser */
/**
 * 网易云账号中心（桌面版，与手机版 1.22.x 对齐）
 *
 * 覆盖：登录/退出、每日推荐、我喜欢的、我创建与收藏的歌单、收藏专辑、
 * 关注歌手、心动模式、私人 FM、新碟上架、云盘、红心。
 *
 * 请求层走 Node https + weapi 加密（和手机版同一套参数），
 * 不再用裸 /api/ 明文接口——那批接口拿不到登录态数据。
 */
import { request } from './http'
import { formatPlayTime, sizeFormate } from '@common/utils/common'
import { modSetting, updateModSetting } from './settings'
import { weapi } from './wyCrypto'

const BASE = 'https://music.163.com'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

const getCookie = () => modSetting.wyCookie || ''

const getCsrf = (cookie) => (cookie.match(/_csrf=([^(;|$)]+)/) || [])[1] || ''

const baseHeaders = (cookie) => ({
  'User-Agent': UA,
  Referer: 'https://music.163.com/',
  Origin: 'https://music.163.com',
  ...(cookie ? { Cookie: cookie } : {}),
})

const parseJson = (res, label) => {
  try {
    return JSON.parse(res.text)
  } catch (err) {
    throw new Error(`${label}返回异常（HTTP ${res.status}）`)
  }
}

const assertOk = (body, label) => {
  if (body && typeof body.code == 'number' && body.code != 200 && body.code != 201) {
    if (body.code == 301 || body.code == -462 || body.code == 250) throw new Error('网易云登录状态已失效，请重新登录')
    throw new Error(body.message || body.msg || `${label}失败（${body.code}）`)
  }
  return body
}

/** weapi 加密 POST（登录态接口） */
const weapiPost = async(path, data = {}, { cookie = getCookie(), label = '请求' } = {}) => {
  if (!cookie) throw new Error('请先登录网易云账号')
  const body = weapi({ ...data, csrf_token: getCsrf(cookie) })
  const res = await request(BASE + path, {
    method: 'POST',
    headers: {
      ...baseHeaders(cookie),
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    },
    body,
  })
  return assertOk(parseJson(res, label), label)
}

/** 明文 GET/POST（公开接口，网易云偶尔只对明文接口放行） */
const plain = async(path, { method = 'GET', form, cookie = getCookie(), label = '请求' } = {}) => {
  const res = await request(BASE + path, {
    method,
    headers: {
      ...baseHeaders(cookie),
      ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: form ?? null,
  })
  return assertOk(parseJson(res, label), label)
}

const retry = async(fn, times = 2) => {
  let lastErr
  for (let i = 0; i <= times; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (String(err?.message || '').includes('登录状态')) throw err
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }
  throw lastErr
}

/** 支持 Cookie 直接粘贴，也支持只粘 MUSIC_U=xxx */
export const normalizeCookie = (input) => {
  let value = (input || '').trim()
  if (!value) return ''
  if (/^[A-Za-z0-9_\-%]+=/.test(value) && !value.includes(';')) return value
  return value.replace(/\s*\n\s*/g, '; ')
}

/**
 * 歌曲音质映射（手机版 filterList 的完整版）
 *
 * 网易云用 privilege.maxBrLevel 标档位，歌曲对象自带 h/m/l/sq/hr 的体积。
 * 除手机版支持的 flac24bit / flac / 320k / 128k 外，这里把
 * jymaster（臻品母带）与 sky（沉浸全景声）也识别出来。
 */
const buildQualities = (song, privilege) => {
  const types = []
  const _types = {}
  const push = (type, size) => {
    if (_types[type]) return
    types.push({ type, size: size ?? null })
    _types[type] = { size: size ?? null }
  }
  const level = String(privilege?.maxBrLevel || privilege?.playMaxBrLevel || '').toLowerCase()
  const maxbr = Number(privilege?.maxbr ?? privilege?.playMaxbr ?? 0)
  const has = (key) => Boolean(song?.[key])

  if (level == 'jymaster' || maxbr >= 1999000) push('master', song?.master ? sizeFormate(song.master.size) : null)
  if (level == 'sky') push('atmos', song?.sky ? sizeFormate(song.sky.size) : null)
  if (level == 'hires' || has('hr')) push('flac24bit', song?.hr ? sizeFormate(song.hr.size) : null)
  if (maxbr >= 999000 || has('sq')) push('flac', song?.sq ? sizeFormate(song.sq.size) : null)
  if (maxbr >= 320000 || has('h')) push('320k', song?.h ? sizeFormate(song.h.size) : null)
  if (maxbr >= 192000 || has('m')) push('192k', song?.m ? sizeFormate(song.m.size) : null)
  if (maxbr >= 128000 || has('l') || !types.length) push('128k', song?.l ? sizeFormate(song.l.size) : null)

  // 由低到高，和上游 types 顺序一致
  types.reverse()
  return { types, _types }
}

/** 网易云歌曲对象 -> LX 在线歌曲信息 */
export function toMusicInfo(song, privilege) {
  const artists = song.ar ?? song.artists ?? []
  const album = song.al ?? song.album ?? {}
  const duration = song.dt ?? song.duration ?? 0
  const { types, _types } = buildQualities(song, privilege ?? song.privilege)
  return {
    id: `wy_${song.id}`,
    name: song.name ?? song.sn ?? '未知歌曲',
    singer: Array.isArray(artists)
      ? artists.map(a => a.name).filter(Boolean).join('、')
      : (song.artist ?? song.singer ?? ''),
    source: 'wy',
    interval: duration ? formatPlayTime(Math.round(duration / 1000)) : '',
    meta: {
      songId: song.id,
      albumName: album.name ?? song.albumName ?? '',
      albumId: album.id ?? song.albumId ?? '',
      picUrl: album.picUrl ?? song.img ?? '',
      qualitys: types,
      _qualitys: _types,
    },
  }
}

const toOnlineList = (songs, privileges) => (songs ?? []).map((song, index) => toMusicInfo(song, privileges?.[index] ?? song.privilege))

const withRetry = retry

/**
 * 用 Cookie 登录，成功后缓存昵称、头像、uid
 */
export const loginWithCookie = async(input) => {
  const cookie = normalizeCookie(input)
  if (!cookie) throw new Error('请先填写 Cookie')
  const body = await weapiPost('/weapi/w/nuser/account/get', {}, { cookie, label: '账号信息' })
  const profile = body.profile
  if (!profile?.userId) throw new Error('Cookie 无效或已过期，没有取到账号信息')
  updateModSetting({
    wyCookie: cookie,
    wyUid: String(profile.userId),
    wyNickname: profile.nickname || '',
    wyAvatar: profile.avatarUrl || '',
    wyVipType: profile.vipType ?? 0,
  })
  return profile
}

export const logout = () => {
  updateModSetting({ wyCookie: '', wyUid: '', wyNickname: '', wyAvatar: '', wyVipType: 0 })
}

export const getAccount = async() => {
  if (!getCookie()) return null
  const body = await weapiPost('/weapi/w/nuser/account/get', {}, { label: '账号信息' })
  return body.profile ?? null
}

/** 每日推荐歌曲 */
export const getDailySongs = async() => {
  const body = await withRetry(() => weapiPost('/weapi/v3/discovery/recommend/songs', {}, { label: '每日推荐' }))
  const data = body.data ?? body
  return toOnlineList(data.dailySongs ?? body.recommend ?? [], data.privileges)
}

/** 每日推荐里的推荐歌单 */
export const getRecommendPlaylists = async() => {
  const body = await withRetry(() => weapiPost('/weapi/v1/discovery/recommend/resource', {}, { label: '推荐歌单' }))
  return (body.recommend ?? []).map(item => ({
    id: String(item.id),
    name: item.name,
    cover: item.picUrl ?? '',
    count: item.playcount ?? item.trackCount ?? 0,
    creator: item.creator?.nickname ?? '',
    subscribed: false,
  }))
}

/** 我的歌单（创建 + 收藏） */
export const getMyPlaylists = async() => {
  const uid = modSetting.wyUid || String((await getAccount())?.userId ?? '')
  if (!uid) throw new Error('网易云登录状态已失效，请重新登录')
  const body = await withRetry(() => weapiPost('/weapi/user/playlist', { uid, limit: 1000, offset: 0 }, { label: '我的歌单' }))
  return (body.playlist ?? []).map(item => ({
    id: String(item.id),
    name: item.name,
    cover: item.coverImgUrl || item.picUrl || '',
    count: item.trackCount ?? 0,
    creatorId: String(item.userId ?? ''),
    creator: item.creator?.nickname ?? '',
    subscribed: Boolean(item.subscribed),
    specialType: item.specialType ?? 0,
  }))
}

/** 我收藏的歌单 */
export const getSubscribedPlaylists = async() => {
  const list = await getMyPlaylists()
  return list.filter(item => item.subscribed)
}

/** 歌单详情（歌曲列表） */
export const getPlaylistSongs = async(id) => {
  const body = await withRetry(() => weapiPost('/weapi/v6/playlist/detail', { id: String(id), n: 1000, s: 8 }, { label: '歌单详情' }))
  const playlist = body.playlist ?? {}
  return {
    name: playlist.name ?? '',
    cover: playlist.coverImgUrl ?? '',
    songs: toOnlineList(playlist.tracks ?? [], body.privileges),
  }
}

/** 我喜欢的音乐（只要 id 列表，用于红心状态） */
export const getLikedIds = async() => {
  const uid = modSetting.wyUid
  if (!uid) return []
  const body = await withRetry(() => weapiPost('/weapi/song/like/get', { uid: String(uid) }, { label: '我喜欢的音乐' }))
  return (body.ids ?? []).map(id => String(id))
}

/** 我喜欢的音乐（完整歌曲信息） */
export const getLikedSongs = async() => {
  let ids = await getLikedIds()
  if (!ids.length) return []
  const list = []
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500)
    const body = await withRetry(() => weapiPost('/weapi/v3/song/detail', {
      c: `[${chunk.map(id => `{"id":${id}}`).join(',')}]`,
      ids: `[${chunk.join(',')}]`,
    }, { label: '歌曲详情' }))
    list.push(...toOnlineList(body.songs ?? [], body.privileges))
  }
  return list
}

export const isLikedSong = (songId) => false

/** 红心 / 取消红心 */
export const toggleLikeSong = async(songId, like) => {
  await weapiPost('/weapi/song/like', { trackId: String(songId), like: String(like), time: String(Date.now()) }, { label: like ? '收藏' : '取消收藏' })
}

/** 云盘歌曲 */
export const getCloudSongs = async() => {
  const body = await withRetry(() => weapiPost('/weapi/v1/cloud/get', { limit: 1000, offset: 0 }, { label: '云盘' }))
  const raw = body.data ?? []
  const ids = raw.map(item => Number(item.songId)).filter(id => id > 0)
  const detailMap = new Map()
  for (let i = 0; i < ids.length; i += 500) {
    try {
      const result = await weapiPost('/weapi/v3/song/detail', {
        c: `[${ids.slice(i, i + 500).map(id => `{"id":${id}}`).join(',')}]`,
        ids: `[${ids.slice(i, i + 500).join(',')}]`,
      }, { label: '云盘详情' })
      ;(result.songs ?? []).forEach((song, index) => {
        detailMap.set(Number(song.id), toMusicInfo(song, result.privileges?.[index]))
      })
    } catch (err) {
      console.log('cloud detail error', err)
    }
  }

  const list = []
  for (const item of raw) {
    const detail = detailMap.get(Number(item.songId))
    if (detail) {
      list.push(detail)
      continue
    }
    const simple = item.simpleSong ?? {}
    const id = item.songId > 0 ? item.songId : simple.id
    if (!id) continue
    list.push({
      id: `wy_${id}`,
      name: item.songName ?? simple.name ?? (item.fileName || '').replace(/\.[^.]+$/, ''),
      singer: item.artist ?? (simple.ar ?? []).map(a => a.name).join('、') ?? '未知歌手',
      source: 'wy',
      interval: simple.dt ? formatPlayTime(Math.round(simple.dt / 1000)) : '',
      meta: {
        songId: id,
        albumName: item.album ?? simple.al?.name ?? '云盘',
        picUrl: simple.al?.picUrl ?? '',
        qualitys: [{ type: '320k', size: item.fileSize ? sizeFormate(item.fileSize) : null }],
        _qualitys: { '320k': { size: item.fileSize ? sizeFormate(item.fileSize) : null } },
      },
    })
  }
  return list
}

/** 我收藏的专辑 */
export const getSubAlbums = async() => {
  const body = await withRetry(() => weapiPost('/weapi/album/sublist', { limit: 100, offset: 0, total: true }, { label: '收藏专辑' }))
  return (body.data ?? []).map(item => ({
    id: String(item.id),
    name: item.name,
    cover: item.picUrl ?? '',
    artist: (item.artists ?? []).map(a => a.name).join('、'),
    count: item.size ?? 0,
  }))
}

/** 新碟上架（全部地区） */
export const getNewAlbums = async(limit = 30, offset = 0) => {
  const body = await withRetry(() => weapiPost('/weapi/album/new', { area: 'ALL', limit, offset, total: true }, { label: '新碟上架' }))
  return (body.albums ?? []).map(item => ({
    id: String(item.id),
    name: item.name,
    cover: item.picUrl ?? '',
    artist: (item.artists ?? []).map(a => a.name).join('、'),
    count: item.size ?? 0,
  }))
}

/** 专辑歌曲 */
export const getAlbumSongs = async(albumId) => {
  const body = await withRetry(() => weapiPost(`/weapi/v1/album/${albumId}`, {}, { label: '专辑详情' }))
  return { info: body.album ?? {}, songs: toOnlineList(body.songs ?? [], (body.songs ?? []).map(song => song.privilege)) }
}

/** 关注歌手 */
export const getFollowedArtists = async() => {
  const body = await withRetry(() => weapiPost('/weapi/artist/sublist', { limit: 100, offset: 0, total: true }, { label: '关注歌手' }))
  return (body.data ?? []).map(item => ({
    id: String(item.id),
    name: item.name,
    cover: item.picUrl ?? item.img1v1Url ?? '',
    albumSize: item.albumSize ?? 0,
  }))
}

/** 歌手热门歌曲 */
export const getArtistSongs = async(id, limit = 100) => {
  const body = await withRetry(() => weapiPost('/weapi/v1/artist/songs', { id: String(id), private_cloud: 'true', order: 'hot', offset: 0, limit }, { label: '歌手歌曲' }))
  return toOnlineList(body.songs ?? [], body.privileges)
}

/**
 * 心动模式
 *
 * 服务端要求 playlistId（漫游范围）与 songId（种子）同时有效：
 * - playlistId 缺省 → 我喜欢的音乐（id 通常等于 uid）
 * - songId 缺省 → 从我喜欢的歌里随机取一首
 */
export const getHeartbeatSongs = async(songId, playlistId) => {
  const uid = modSetting.wyUid
  if (!uid) throw new Error('网易云登录状态已失效，请重新登录')

  let pid = playlistId
  if (!pid) {
    const lists = await getMyPlaylists()
    const liked = lists.find(item => Number(item.specialType) === 5)
    pid = liked?.id ?? uid
  }
  let sid = songId
  if (!sid) {
    const ids = await getLikedIds()
    if (!ids.length) throw new Error('需要先在网易云收藏几首歌，心动模式才有种子')
    sid = ids[Math.floor(Math.random() * ids.length)]
  }

  const body = await withRetry(() => plain('/api/playmode/intelligence/list', {
    method: 'POST',
    form: `songId=${encodeURIComponent(sid)}&playlistId=${encodeURIComponent(pid)}&startMusicId=${encodeURIComponent(sid)}&count=50&type=fromPage`,
    label: '心动模式',
  }))
  const list = toOnlineList(body.data ?? [], body.privileges)
  return list
}

/** 私人 FM（明文接口，未登录也会给通用推荐） */
export const getPersonalFmSongs = async(limit = 30) => {
  const result = []
  const seen = new Set()
  for (let round = 0; round < 6; round++) {
    const body = await plain('/api/v1/radio/get', { label: '私人 FM' })
    const list = toOnlineList(body.data ?? [], body.privileges)
    for (const item of list) {
      const id = String(item.meta?.songId ?? item.id)
      if (seen.has(id)) continue
      seen.add(id)
      result.push(item)
    }
    if (result.length >= Math.min(limit, 10)) break
  }
  return result
}

/** 搜索（用于本地歌曲在云端找同名歌曲） */
export const searchSongs = async(keyword, limit = 5) => {
  const body = await plain(`/api/search/get/web?s=${encodeURIComponent(keyword)}&type=1&limit=${limit}&offset=0`, { label: '搜索' })
  return toOnlineList(body.result?.songs ?? [])
}

/** 下载图片为 data url，用于头像等小图 */
export const fetchImageAsDataUrl = async(url) => {
  if (!url) return ''
  try {
    const res = await request(url, { headers: { Referer: 'https://music.163.com/' } })
    const type = String(res.headers['content-type'] || 'image/jpeg').split(';')[0]
    return `data:${type};base64,${res.body.toString('base64')}`
  } catch (err) {
    return ''
  }
}
