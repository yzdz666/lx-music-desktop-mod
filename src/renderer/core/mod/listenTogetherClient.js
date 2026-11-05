/* eslint-env browser */
const HEARTBEAT_INTERVAL = 15000
const HEARTBEAT_TIMEOUT = 45000
const MAX_RECONNECT = 8
const RECONNECT_DELAY_MAX = 15000

const createClientId = () => `ltd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`

const statusText = {
  idle: '未连接',
  connecting: '连接中…',
  connected: '已连接',
  reconnecting: '重新连接中…',
  error: '连接失败',
}

/**
 * 一起听 WebSocket 客户端：连接、心跳、断线重连、消息分发
 */
export default class ListenTogetherClient {
  constructor() {
    this.socket = null
    this.listeners = {}
    this.session = null
    this.url = ''
    this.manualClose = false
    this.reconnectAttempt = 0
    this.roomCode = ''
    this.memberToken = ''
    this.clientId = createClientId()
    this.heartbeatTimer = null
    this.reconnectTimer = null
    this.lastReceivedAt = 0
    this.status = 'idle'
  }

  on(event, listener) {
    const set = this.listeners[event] ?? (this.listeners[event] = new Set())
    set.add(listener)
    return () => set.delete(listener)
  }

  emit(event, ...args) {
    this.listeners[event]?.forEach(fn => {
      try {
        fn(...args)
      } catch (err) {
        console.error(`listenTogether handler error [${event}]`, err)
      }
    })
  }

  get isConnected() {
    return this.socket != null && this.socket.readyState == 1
  }

  setStatus(status, message = '') {
    this.status = status
    this.emit('status', status, message || statusText[status] || '')
  }

  open() {
    this.clearReconnect()
    this.setStatus(this.reconnectAttempt ? 'reconnecting' : 'connecting')
    let socket
    try {
      socket = new WebSocket(this.url)
    } catch (err) {
      this.setStatus('error', '服务器地址不正确')
      return
    }
    this.socket = socket
    socket.onopen = () => {
      this.reconnectAttempt = 0
      this.lastReceivedAt = Date.now()
      this.setStatus('connected')
      this.sendSession()
      this.startHeartbeat()
    }
    socket.onmessage = (event) => {
      this.lastReceivedAt = Date.now()
      let data
      try {
        data = JSON.parse(event.data)
      } catch (err) {
        return
      }
      this.handleMessage(data)
    }
    socket.onerror = () => {
      if (this.socket != socket) return
      this.setStatus('error', '无法连接服务器，请检查地址')
    }
    socket.onclose = () => {
      if (this.socket != socket) return
      this.socket = null
      this.stopHeartbeat()
      if (this.manualClose) return
      this.scheduleReconnect()
    }
  }

  sendSession() {
    if (!this.session) return
    const { kind, options } = this.session
    if (kind == 'create') {
      this.send({
        type: 'create',
        clientId: this.clientId,
        nickname: options.nickname,
        roomName: options.roomName,
      })
    } else {
      this.send({
        type: 'join',
        clientId: this.clientId,
        nickname: options.nickname,
        code: options.code,
        token: this.memberToken || undefined,
      })
    }
  }

  handleMessage(data) {
    switch (data.type) {
      case 'room':
        this.roomCode = data.room?.code ?? ''
        if (data.token) this.memberToken = data.token
        this.emit('room', data.room, data.selfId, data.token)
        break
      case 'members':
        this.emit('members', data.members, data.hostId)
        break
      case 'state':
        this.emit('state', data.state, data.from, data.sourceId)
        break
      case 'chat':
        this.emit('chat', data.message)
        break
      case 'lyric':
        this.emit('lyric', data.lyric)
        break
      case 'control':
        this.emit('control', data.action, data.position, data.from, data.name)
        break
      case 'error':
        this.emit('error', data.code, data.message)
        break
      case 'kicked':
        this.manualClose = true
        this.emit('kicked', data.reason)
        break
      case 'pong':
        break
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempt >= MAX_RECONNECT) {
      this.setStatus('error', '连接已断开，请重新加入房间')
      return
    }
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempt), RECONNECT_DELAY_MAX)
    this.reconnectAttempt++
    this.setStatus('reconnecting', `连接断开，${Math.round(delay / 1000)} 秒后重试`)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.open()
    }, delay)
  }

  clearReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      if (!this.isConnected) return
      if (Date.now() - this.lastReceivedAt > HEARTBEAT_TIMEOUT) {
        this.socket?.close()
        return
      }
      this.send({ type: 'ping', at: Date.now() })
    }, HEARTBEAT_INTERVAL)
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  createRoom(url, options) {
    this.reset()
    this.url = url
    this.session = { kind: 'create', options }
    this.manualClose = false
    this.open()
  }

  joinRoom(url, options) {
    this.reset()
    this.url = url
    this.session = { kind: 'join', options }
    this.manualClose = false
    this.open()
  }

  leaveRoom() {
    this.manualClose = true
    if (this.isConnected) this.send({ type: 'leave' })
    this.reset()
    this.setStatus('idle')
  }

  reset() {
    this.session = null
    this.roomCode = ''
    this.memberToken = ''
    this.reconnectAttempt = 0
    this.clearReconnect()
    this.stopHeartbeat()
    this.closeSocket()
  }

  closeSocket() {
    if (!this.socket) return
    const socket = this.socket
    this.socket = null
    try {
      socket.close()
    } catch (err) {}
  }

  send(message) {
    if (!this.isConnected) return false
    try {
      this.socket.send(JSON.stringify(message))
      return true
    } catch (err) {
      return false
    }
  }

  sendState(state) {
    return this.send({ type: 'state', state })
  }

  sendChat(text) {
    return this.send({ type: 'chat', text })
  }

  sendLyric(lyric) {
    return this.send({ type: 'lyric', lyric })
  }

  sendControl(action, position) {
    return this.send({ type: 'control', action, position })
  }

  transferHost(targetId) {
    return this.send({ type: 'transferHost', targetId })
  }

  destroy() {
    this.manualClose = true
    this.reset()
    this.listeners = {}
  }
}
