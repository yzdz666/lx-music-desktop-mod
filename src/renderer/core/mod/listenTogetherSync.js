/* eslint-env browser */
import { reactive, watch } from '@common/utils/vueTools'
import { LIST_IDS } from '@common/constants'
import { playMusicInfo, isPlay } from '@renderer/store/player/state'
import { playProgress } from '@renderer/store/player/playProgress'
import { play, pause, playList } from '@renderer/core/player'
import { setTempList } from '@renderer/store/list/action'
import ListenTogetherClient from './listenTogetherClient'
import { searchSongs } from './netease'
import { modSetting } from './settings'

export const LT_TEMP_LIST_ID = 'mod_listen_together'

export const ltState = reactive({
  status: 'idle',
  statusText: '',
  room: null,
  selfId: '',
  members: [],
  messages: [],
  isHost: false,
  // 当前播放源（房主或房间空闲时抢先播放的成员）
  sourceId: '',
  isSource: false,
  syncing: false,
  lastError: '',
})

const client = new ListenTogetherClient()
let unwatchers = []
let broadcastTimer = null
let followGuardUntil = 0
let followedSnapshotId = ''

const pushMessage = (message) => {
  ltState.messages.push(message)
  if (ltState.messages.length > 200) ltState.messages.splice(0, ltState.messages.length - 200)
}

const resetRoom = () => {
  ltState.room = null
  ltState.selfId = ''
  ltState.members = []
  ltState.isHost = false
  ltState.sourceId = ''
  ltState.isSource = false
  ltState.syncing = false
  stopBroadcast()
}

client.on('status', (status, text) => {
  ltState.status = status
  ltState.statusText = text
  if (status == 'idle' || status == 'error') {
    if (status == 'idle') resetRoom()
  }
})

client.on('room', (room, selfId) => {
  ltState.room = room
  ltState.selfId = selfId
  ltState.members = room.members ?? []
  ltState.isHost = room.hostId == selfId
  ltState.sourceId = room.stateSourceId ?? ''
  ltState.isSource = ltState.isHost || ltState.sourceId == selfId
  ltState.syncing = false
  if (room.state) applyRemoteState(room.state)
  if (ltState.isHost) startBroadcast()
})

client.on('members', (members, hostId) => {
  ltState.members = members
  ltState.isHost = hostId == ltState.selfId
  if (ltState.room) ltState.room.hostId = hostId
  if (ltState.isHost) startBroadcast()
  else stopBroadcast()
})

client.on('state', (state, from, sourceId) => {
  if (ltState.room) {
    ltState.room.state = state
    ltState.room.stateSourceId = sourceId
  }
  ltState.sourceId = sourceId ?? ltState.sourceId
  ltState.isSource = ltState.isHost || ltState.sourceId == ltState.selfId
  // 自己发送后的回显：只认领播放源身份，不重复应用
  if (from && from == ltState.selfId) return
  if (ltState.isSource) return
  applyRemoteState(state)
})

client.on('control', (action, position) => {
  // 只有播放源执行控制指令
  if (!ltState.isSource) return
  const run = () => {
    if (action == 'play') play()
    else if (action == 'pause') pause()
    else if (action == 'seek' && typeof position == 'number') window.app_event.setProgress(position)
  }
  if (ltState.room) ltState.syncing = true
  try {
    run()
  } finally {
    setTimeout(() => { ltState.syncing = false }, 300)
  }
})

client.on('chat', (message) => {
  pushMessage(message)
})

client.on('kicked', (reason) => {
  ltState.lastError = reason || '你已被移出房间'
  pushMessage({ id: `sys_${Date.now()}`, type: 'system', senderId: '', senderName: '', text: ltState.lastError, at: Date.now() })
  resetRoom()
  ltState.status = 'idle'
})

client.on('error', (code, message) => {
  ltState.lastError = message || code
  ltState.syncing = false
})

const waitFor = (check, timeout = 4000) => new Promise(resolve => {
  const start = Date.now()
  const timer = setInterval(() => {
    if (check()) {
      clearInterval(timer)
      resolve(true)
    } else if (Date.now() - start > timeout) {
      clearInterval(timer)
      resolve(false)
    }
  }, 120)
})

const buildSnapshot = (musicInfo) => ({
  id: musicInfo.id,
  source: musicInfo.source,
  name: musicInfo.name,
  singer: musicInfo.singer,
  album: musicInfo.meta?.albumName ?? '',
  interval: musicInfo.interval ?? null,
  picUrl: musicInfo.meta?.picUrl ?? null,
  musicInfo: musicInfo.source == 'local' ? null : musicInfo,
  url: null,
})

const buildState = () => ({
  music: playMusicInfo.musicInfo ? buildSnapshot(playMusicInfo.musicInfo) : null,
  isPlaying: isPlay.value,
  position: playProgress.nowPlayTime,
  playRate: 1,
  sentAt: Date.now(),
})

/**
 * 谁可以广播（与手机版一致）：
 * 房主始终是权威；房间空闲时（还没有任何 state）成员播歌可成为播放源，
 * 播放源一旦确立就不能被其他成员抢占。
 */
const canBroadcast = () => {
  if (!ltState.room || !client.isConnected) return false
  if (ltState.isHost) return true
  return !ltState.room.state || ltState.sourceId == ltState.selfId
}

const urlCache = new Map()

/** 取当前歌曲的音频直链，供网页版 / 其他端直接播放，5 分钟缓存 */
const resolveMusicUrl = async(musicInfo) => {
  if (!musicInfo || musicInfo.source == 'local') return null
  const cacheKey = `${musicInfo.source}_${musicInfo.id}`
  const cached = urlCache.get(cacheKey)
  if (cached && Date.now() - cached.at < 5 * 60 * 1000) return cached.url
  try {
    const { handleGetOnlineMusicUrl } = await import('@renderer/core/music/utils')
    const result = await handleGetOnlineMusicUrl({
      musicInfo,
      isRefresh: false,
      allowToggleSource: false,
      onToggleSource: () => {},
    })
    urlCache.set(cacheKey, { url: result.url, at: Date.now() })
    return result.url
  } catch (err) {
    return null
  }
}

const broadcast = async() => {
  if (!canBroadcast()) return
  const state = buildState()
  if (state.music && !state.music.url) state.music.url = await resolveMusicUrl(playMusicInfo.musicInfo)
  if (!client.sendState(state)) return
  // 发送成功即认领播放源身份：服务端不会把 state 回显给发送者以外的人，
  // 不认领会导致下一首歌不再广播（手机版 1.13.1 的同一个坑）
  if (!ltState.isHost) {
    ltState.sourceId = ltState.selfId
    ltState.isSource = true
    if (ltState.room) ltState.room.stateSourceId = ltState.selfId
  }
}

/** 成员控制：自己不是播放源时，播放 / 暂停 / 跳转都转给播放源执行 */
let lastIsPlay = isPlay.value
const initControlForward = () => {
  watch(isPlay, (value) => {
    const changed = lastIsPlay != value
    lastIsPlay = value
    if (!changed || ltState.isSource || ltState.syncing || !ltState.room) return
    client.sendControl(value ? 'play' : 'pause')
  })
}
initControlForward()

const startBroadcast = () => {
  if (broadcastTimer) return
  const trigger = () => {
    if (Date.now() < followGuardUntil) return
    void broadcast()
  }
  unwatchers = [
    watch(() => playMusicInfo.musicInfo?.id, trigger),
    watch(isPlay, trigger),
  ]
  broadcastTimer = setInterval(() => {
    if (ltState.isSource) void broadcast()
  }, 4000)
  trigger()
}

const stopBroadcast = () => {
  unwatchers.forEach(fn => fn())
  unwatchers = []
  if (broadcastTimer) {
    clearInterval(broadcastTimer)
    broadcastTimer = null
  }
}

const resolvePlayableMusic = async(snapshot) => {
  if (snapshot.musicInfo) return snapshot.musicInfo
  // 本地歌曲 / 信息不完整，按歌名+歌手在网易云找同名歌曲
  try {
    const list = await searchSongs(`${snapshot.name} ${snapshot.singer}`.trim(), 5)
    return list[0] ?? null
  } catch (err) {
    return null
  }
}

async function applyRemoteState(state) {
  if (!state) return
  if (!state.music) {
    if (isPlay.value) pause()
    return
  }
  followGuardUntil = Date.now() + 1200
  ltState.syncing = true
  const target = await resolvePlayableMusic(state.music)
  if (!target) {
    ltState.syncing = false
    pushMessage({
      id: `sys_${Date.now()}`,
      type: 'system',
      senderId: '',
      senderName: '',
      text: `未找到可播放的歌曲：${state.music.name}`,
      at: Date.now(),
    })
    return
  }

  const driftPosition = () => {
    const elapsed = state.isPlaying ? (Date.now() - state.sentAt) / 1000 : 0
    return Math.max(0, state.position + elapsed)
  }

  if (followedSnapshotId != state.music.id) {
    followedSnapshotId = state.music.id
    await setTempList(LT_TEMP_LIST_ID, [target])
    playList(LIST_IDS.TEMP, 0)
    await waitFor(() => playMusicInfo.musicInfo?.id == target.id, 5000)
    // 等待音频真正可 seek
    await new Promise(resolve => setTimeout(resolve, 700))
    window.app_event.setProgress(driftPosition())
  } else {
    const diff = Math.abs(playProgress.nowPlayTime - driftPosition())
    if (diff > 1.5) window.app_event.setProgress(driftPosition())
  }

  if (state.isPlaying) {
    if (!isPlay.value) play()
  } else if (isPlay.value) {
    pause()
  }
  ltState.syncing = false
}

export const createRoom = (nickname, roomName = '') => {
  if (!nickname.trim()) throw new Error('请先填写昵称')
  ltState.messages.splice(0)
  client.createRoom(modSetting.listenServer, { nickname: nickname.trim(), roomName })
}

export const joinRoom = (code, nickname) => {
  if (!nickname.trim()) throw new Error('请先填写昵称')
  if (!code.trim()) throw new Error('请填写房间码')
  ltState.messages.splice(0)
  client.joinRoom(modSetting.listenServer, { code: code.trim().toUpperCase(), nickname: nickname.trim() })
}

export const leaveRoom = () => {
  client.leaveRoom()
  resetRoom()
}

export const sendChat = (text) => {
  const value = (text || '').trim()
  if (!value) return false
  return client.sendChat(value)
}

export const transferHost = (targetId) => client.transferHost(targetId)

export const getRoomCode = () => client.roomCode

export const seekTo = (position) => {
  if (ltState.isSource) {
    window.app_event.setProgress(position)
  } else if (ltState.room) {
    client.sendControl('seek', position)
  }
}

export const destroy = () => {
  client.destroy()
  resetRoom()
}
