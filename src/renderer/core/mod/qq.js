/* eslint-env browser */
/**
 * QQ 音乐账号中心（桌面版，与手机版能力对齐）
 *
 * 统一走 u.y.qq.com/cgi-bin/musicu.fcg：GET data={comm, req_0}。
 * 覆盖：登录校验、每日推荐、我喜欢的、我的歌单、收藏歌单、歌单歌曲、推荐歌单。
 */
import { request } from './http'
import { formatPlayTime, sizeFormate } from '@common/utils/common'
import { modSetting, updateModSetting } from './settings'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const PAGE_SIZE = 100
const UIN_KEYS = ['uin', 'qqmusic_uin', 'wxuin', 'luin', 'p_uin']
const KEY_KEYS = ['qm_keyst', 'qqmusic_key', 'musickey', 'wxskey', 'p_skey', 'skey']

const getCookie = () => modSetting.txCookie || ''

export const getUinFromCookie = (cookie = getCookie()) => {
  for (const key of UIN_KEYS) {
    const match = cookie.match(new RegExp(`(?:^|;\\s*)${key}=([^;]+)`))
    if (!match) continue
    const raw = match[1].trim()
    if (!/^o?\d{4,}$/.test(raw)) continue
    return raw.replace(/^o/, '')
  }
  return ''
}

export const getKeyFromCookie = (cookie = getCookie()) => {
  for (const key of KEY_KEYS) {
    const match = cookie.match(new RegExp(`(?:^|;\\s*)${key}=([^;]+)`))
    if (match && match[1].trim()) return match[1].trim()
  }
  return ''
}

const getEuinFromCookie = (cookie = getCookie()) => {
  const match = cookie.match(/(?:^|;\s*)euin=([^;]+)/)
  if (!match) return ''
  const raw = match[1].trim()
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export const hasTxSession = (cookie = getCookie()) => Boolean(cookie && getKeyFromCookie(cookie))

const describeCode = (code) => {
  switch (Number(code)) {
    case 1000:
    case 1001:
      return 'QQ 音乐登录状态已失效，请重新登录'
    case 80050:
    case 80000:
      return 'QQ 音乐登录状态已失效，请重新登录'
    default:
      return `QQ 音乐接口返回 ${code}`
  }
}

const buildComm = (cookie = getCookie(), extra = {}) => ({
  ct: 11,
  cv: 14090008,
  v: 14090008,
  chid: '10003505',
  qq: getUinFromCookie(cookie) || null,
  authst: getKeyFromCookie(cookie) || null,
  tmeAppID: 'qqmusic',
  ...extra,
})

const send = async(module, method, param, { cookie = getCookie(), comm = {}, label = 'QQ 音乐' } = {}) => {
  const data = {
    comm: buildComm(cookie, comm),
    req_0: { module, method, param },
  }
  const url = 'https://u.y.qq.com/cgi-bin/musicu.fcg?loginUin=0&hostUin=0&format=json' +
    '&inCharset=utf-8&outCharset=utf-8&notice=0&platform=wk_v15.json&needNewCode=0' +
    `&data=${encodeURIComponent(JSON.stringify(data))}`
  const res = await request(url, {
    method: 'GET',
    headers: {
      'User-Agent': UA,
      Referer: 'https://y.qq.com/',
      ...(cookie ? { Cookie: cookie } : {}),
    },
  })
  if (res.status != 200) throw new Error(`${label}请求失败（${res.status}）`)
  let payload
  try {
    payload = JSON.parse(res.text)
  } catch (err) {
    throw new Error(`${label}返回异常`)
  }
  if (payload?.code !== 0 && payload?.code !== undefined) throw new Error(payload.msg || describeCode(payload.code))
  const req = payload?.req_0 ?? {}
  if (req.code !== 0) throw new Error(describeCode(req.code))
  return req
}

const buildTypes = (file) => {
  const types = []
  const _types = {}
  const add = (type, size) => {
    if (!size) return
    const text = sizeFormate(Number(size))
    types.push({ type, size: text })
    _types[type] = { size: text }
  }
  if (file) {
    add('128k', file.size_128mp3)
    add('320k', file.size_320mp3)
    add('flac', file.size_flac)
    add('flac24bit', file.size_hires)
    add('master', file.size_new?.[0]?.size_media_master ?? file.size_media_master)
  }
  if (!types.length) {
    types.push({ type: '128k', size: 'unknown' }, { type: '320k', size: 'unknown' }, { type: 'flac', size: 'unknown' })
    _types['128k'] = { size: 'unknown' }
    _types['320k'] = { size: 'unknown' }
    _types.flac = { size: 'unknown' }
  }
  return { types, _types }
}

export function toMusicInfo(track) {
  if (!track) return null
  const info = track.track_info ?? track.trackInfo ?? track.songinfo ?? track
  const mid = info.mid ?? info.songmid ?? info.songMid
  if (!mid) return null
  const singers = Array.isArray(info.singer)
    ? info.singer.map(item => item?.name ?? item?.title ?? '').filter(Boolean).join('、')
    : (info.singername ?? info.singerName ?? '')
  const album = info.album ?? {}
  const albumMid = album.mid ?? album.pmid ?? info.albummid ?? info.albumMid ?? ''
  const interval = Number(info.interval ?? info.duration ?? 0)
  const { types, _types } = buildTypes(info.file)
  return {
    id: `tx_${mid}`,
    name: info.name ?? info.title ?? info.songname ?? '未知歌曲',
    singer: singers,
    source: 'tx',
    interval: interval ? formatPlayTime(interval) : '',
    meta: {
      songId: mid,
      albumName: album.name ?? album.title ?? info.albumname ?? info.albumName ?? '',
      albumId: albumMid,
      picUrl: albumMid ? `https://y.gtimg.cn/music/photo_new/T002R500x500M000${albumMid}.jpg` : '',
      qualitys: types,
      _qualitys: _types,
    },
  }
}

const toMusicList = (list) => (list ?? []).map(toMusicInfo).filter(Boolean)

const ensureUin = async(cookie = getCookie()) => {
  const fromCookie = getUinFromCookie(cookie)
  if (fromCookie) return fromCookie
  const info = await getLoginUserInfo(cookie).catch(() => null)
  return info?.uin ?? ''
}

/**
 * 用 GetLoginUserInfo 校验 Cookie 并取资料
 */
export const getLoginUserInfo = async(cookie = getCookie()) => {
  if (!cookie || !hasTxSession(cookie)) return null
  const req = await send('music.UserInfo.userInfoServer', 'GetLoginUserInfo', {}, { cookie, label: 'QQ 用户信息' })
  if (!req.data) return null
  const data = req.data
  return {
    uin: String(data.uin ?? data.qq ?? '').replace(/^o/, ''),
    nickname: data.nick ?? data.nickname ?? data.name ?? '',
    avatar: data.headpic ?? data.avatarUrl ?? data.avatar ?? '',
    vipType: Number(data.vipType ?? data.vip_type ?? 0),
  }
}

export const loginWithCookie = async(input) => {
  const cookie = (input || '').trim()
  if (!cookie) throw new Error('请先填写 Cookie')
  if (!hasTxSession(cookie)) throw new Error('Cookie 里没有 qm_keyst / qqmusic_key，请在登录成功后再复制一次')
  const info = await getLoginUserInfo(cookie)
  if (!info?.uin) throw new Error('Cookie 无效或已过期，没有取到账号信息')
  updateModSetting({
    txCookie: cookie,
    txUid: info.uin,
    txNickname: info.nickname || `QQ音乐用户 ${info.uin}`,
    txAvatar: info.avatar || `https://q1.qlogo.cn/g?b=qq&nk=${info.uin}&s=640`,
  })
  return info
}

export const logout = () => {
  updateModSetting({ txCookie: '', txUid: '', txNickname: '', txAvatar: '' })
}

const TRACK_BATCH_SIZE = 50

const getTracksByIds = async(ids, cookie = getCookie()) => {
  const list = []
  for (let i = 0; i < ids.length; i += TRACK_BATCH_SIZE) {
    const part = ids.slice(i, i + TRACK_BATCH_SIZE)
    const res = await request('https://c.y.qq.com/v8/fcg-bin/fcg_play_single_song.fcg' +
      `?songid=${part.join(',')}&platform=yqq&format=json`, {
      headers: {
        'User-Agent': UA,
        Referer: 'https://y.qq.com/',
        ...(cookie ? { Cookie: cookie } : {}),
      },
    })
    let body
    try {
      body = JSON.parse(res.text)
    } catch (err) {
      throw new Error('QQ 音乐获取歌曲失败（返回异常）')
    }
    if (!body || body.code !== 0) throw new Error(`QQ 音乐获取歌曲失败（${body?.code ?? '网络异常'}）`)
    list.push(...(body.data ?? []))
  }
  return toMusicList(list)
}

/** 推荐流：direction 0 主页 / 1 每日 / 2 猜你喜欢 / 3 新歌 */
const getFeedSongs = async(direction, cookie = getCookie()) => {
  const req = await send('music.recommend.RecommendFeed', 'get_recommend_feed', {
    direction,
    page: 1,
    s_num: 0,
    v_cache: [],
  }, { cookie, label: 'QQ 推荐' })
  const ids = []
  for (const block of (req.data?.v_shelf ?? [])) {
    for (const niche of (block?.v_niche ?? [])) {
      for (const card of (niche?.v_card ?? [])) {
        if (card?.type === 200 && card.id) ids.push(card.id)
      }
    }
  }
  return ids.length ? getTracksByIds(ids, cookie) : []
}

export const getDailyRecommend = async() => getFeedSongs(1)
export const getGuessYouLike = async() => getFeedSongs(2)
export const getNewSongs = async() => getFeedSongs(3)

/** 我创建的歌单（含 dirId=201「我喜欢」） */
export const getMyPlaylists = async() => {
  const cookie = getCookie()
  const realUin = await ensureUin(cookie)
  if (!realUin) throw new Error('QQ 音乐登录已失效，请重新登录')
  const realEuin = getEuinFromCookie(cookie)
  const attempts = []
  if (realEuin) attempts.push({ euin: realEuin })
  attempts.push({ uin: String(realUin) })
  attempts.push({})
  let lastErr = null
  for (const extra of attempts) {
    try {
      const req = await send('music.musicasset.PlaylistBaseRead', 'GetPlaylistByUin', { ...extra }, { cookie, label: 'QQ 歌单' })
      const list = req.data?.v_playlist ?? []
      return list.map(item => ({
        id: String(item.tid ?? item.dissId ?? item.dissid ?? ''),
        name: item.dirName,
        cover: item.picUrl || item.bigpicUrl || '',
        count: item.songNum ?? 0,
        creator: '我',
        subscribed: false,
        isFavorites: item.dirId == 201,
        dirid: item.dirId,
      }))
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr ?? new Error('QQ 音乐歌单读取失败')
}

/** 收藏的歌单 */
export const getSubscribedPlaylists = async() => {
  const cookie = getCookie()
  const realUin = await ensureUin(cookie)
  if (!realUin) throw new Error('QQ 音乐登录已失效，请重新登录')
  const realEuin = getEuinFromCookie(cookie)
  const attempts = []
  if (realEuin) attempts.push({ euin: realEuin })
  attempts.push({ uin: String(realUin) })
  attempts.push({})
  let lastErr = null
  for (const extra of attempts) {
    try {
      const req = await send('music.musicasset.PlaylistFavRead', 'CgiGetPlaylistFavInfo', {
        ...extra,
        begin: 0,
        num: PAGE_SIZE,
      }, { cookie, label: 'QQ 收藏歌单' })
      const list = req.data?.v_playlist ?? req.data?.playlist ?? []
      return list.map(item => ({
        id: String(item.tid ?? item.dissId ?? ''),
        name: item.dirName ?? item.name ?? '',
        cover: item.picUrl || item.cover || '',
        count: item.songNum ?? item.songnum ?? 0,
        creator: item.nick ?? item.creator ?? '',
        subscribed: true,
      }))
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr ?? new Error('QQ 音乐收藏歌单读取失败')
}

/** 我喜欢的音乐 */
export const getLikedSongs = async() => {
  const playlists = await getMyPlaylists()
  const liked = playlists.find(item => item.isFavorites) ?? playlists.find(item => item.dirid == 201)
  if (!liked) return []
  return getPlaylistSongs(liked.id, 201)
}

/** 歌单歌曲 */
export const getPlaylistSongs = async(disstid, dirid = 0) => {
  const id = Number.parseInt(disstid, 10)
  if (!Number.isFinite(id) || id <= 0) throw new Error('QQ 音乐歌单 ID 无效')
  const cookie = getCookie()
  const req = await send('music.srfDissInfo.DissInfo', 'CgiGetDiss', {
    disstid: id,
    dirid: Number(dirid) || 0,
    tag: true,
    song_begin: 0,
    song_num: 999999,
    userinfo: true,
    orderlist: true,
    onlysonglist: false,
  }, { cookie, label: 'QQ 歌单详情' })
  const data = req.data ?? {}
  const list = data.songlist ?? data.songList ?? data.v_shelf ?? []
  return toMusicList(list.map(item => (item.track_info ? item.track_info : item)))
}

/** 推荐歌单（公开） */
export const getRecommendPlaylists = async() => {
  const req = await send('music.playlist.PlaylistSquare', 'GetRecommendWhole', {
    IsReqFeed: true,
    FeedReq: { From: 0, Size: 30 },
  }, { comm: { cv: 1602, ct: 20 }, label: 'QQ 推荐歌单' })
  const list = req.data?.FeedRsp?.List ?? []
  return list.map((item) => {
    const basic = item?.Playlist?.basic
    if (!basic || !basic.tid) return null
    const cover = basic.cover ?? {}
    return {
      id: String(basic.tid),
      name: basic.title ?? '',
      cover: cover.medium_url || cover.big_url || cover.small_url || cover.default_url || '',
      count: basic.song_cnt ?? basic.songnum ?? 0,
      creator: basic.creator?.nick ?? '',
      subscribed: false,
    }
  }).filter(Boolean)
}

/** 头像转 data URL */
export const fetchImageAsDataUrl = async(url) => {
  if (!url) return ''
  try {
    const res = await request(url, { headers: { Referer: 'https://y.qq.com/' } })
    const type = String(res.headers['content-type'] || 'image/jpeg').split(';')[0]
    return `data:${type};base64,${res.body.toString('base64')}`
  } catch (err) {
    return ''
  }
}
