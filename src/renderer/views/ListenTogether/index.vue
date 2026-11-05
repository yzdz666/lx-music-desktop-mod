<template>
  <div :class="$style.page">
    <div :class="$style.header">
      <div :class="$style.title">一起听</div>
      <div :class="$style.subtitle">同一房间同步播放，房主控进度，成员实时跟随</div>
      <div :class="$style.spacer" />
      <span :class="[$style.status, $style['status_' + ltState.status]]">{{ ltState.statusText || '未连接' }}</span>
    </div>

    <div v-if="!ltState.room" :class="$style.joinWrap">
      <div :class="$style.card">
        <h3>创建房间</h3>
        <div :class="$style.field">
          <span :class="$style.label">你的昵称</span>
          <input v-model="nickname" :class="$style.input" maxlength="24" placeholder="例如：月下独酌">
        </div>
        <div :class="$style.field">
          <span :class="$style.label">服务器地址</span>
          <input v-model="server" :class="$style.input" spellcheck="false" placeholder="wss://... 或 ws://192.168.1.10:23333">
        </div>
        <p v-if="createError" :class="$style.error">{{ createError }}</p>
        <button :class="$style.primaryBtn" :disabled="busy" @click="handleCreate">创建房间</button>
        <p :class="$style.hint">创建后把 6 位房间码发给朋友，对方在右侧输入房间码即可加入。</p>
      </div>

      <div :class="$style.card">
        <h3>加入房间</h3>
        <div :class="$style.field">
          <span :class="$style.label">房间码</span>
          <input v-model="roomCode" :class="$style.input" maxlength="8" placeholder="6 位房间码" @keyup.enter="handleJoin">
        </div>
        <div :class="$style.field">
          <span :class="$style.label">你的昵称</span>
          <input v-model="nickname" :class="$style.input" maxlength="24" placeholder="例如：听歌的人">
        </div>
        <p v-if="joinError" :class="$style.error">{{ joinError }}</p>
        <button :class="$style.primaryBtn" :disabled="busy" @click="handleJoin">加入房间</button>
        <p :class="$style.hint">服务器地址与创建房间共用（左侧填写）。</p>
        <button :class="$style.linkBtn" @click="handleOpenWeb">在浏览器打开网页版（手机也能加入）</button>
      </div>
    </div>

    <div v-else :class="$style.room">
      <div :class="$style.roomSide">
        <div :class="$style.roomCard">
          <div :class="$style.roomLabel">房间码</div>
          <div :class="$style.roomCode">{{ ltState.room.code }}</div>
          <button :class="$style.ghostBtn" @click="copyCode">复制房间码</button>
        </div>
        <div :class="$style.roomCard">
          <div :class="$style.roomLabel">成员（{{ ltState.members.length }}）</div>
          <div :class="$style.memberList">
            <div v-for="member in ltState.members" :key="member.id" :class="$style.member">
              <span :class="$style.memberName">{{ member.nickname }}<span v-if="member.id == ltState.selfId">（我）</span></span>
              <span v-if="member.isHost" :class="$style.badge">房主</span>
              <button v-else-if="ltState.isHost" :class="$style.miniBtn" @click="handleTransfer(member.id)">设为房主</button>
            </div>
          </div>
        </div>
        <button :class="$style.dangerBtn" @click="handleLeave">退出房间</button>
      </div>

      <div :class="$style.roomMain">
        <div :class="$style.nowPlaying">
          <div :class="$style.nowLabel">房间正在播放</div>
          <template v-if="currentMusic">
            <div :class="$style.nowName">{{ currentMusic.name }}</div>
            <div :class="$style.nowSinger">{{ currentMusic.singer }}</div>
            <div :class="$style.nowMeta">
              {{ currentState.isPlaying ? '播放中' : '已暂停' }} · {{ formatTime(currentPosition) }}
              <span v-if="ltState.syncing"> · 同步中…</span>
            </div>
          </template>
          <div v-else :class="$style.nowEmpty">还没有人播放，房主在播放器里点一首歌就会同步到这里</div>
          <div v-if="ltState.isHost" :class="$style.hostTip">你是房主，你的播放、暂停、切歌会实时同步给所有成员。</div>
          <div v-else-if="ltState.isSource" :class="$style.hostTip">你是当前播放源，你的播放、暂停、切歌会实时同步给所有成员。</div>
          <div v-else-if="ltState.sourceId" :class="$style.hostTip">正在跟随播放源的进度；点播放 / 暂停或拖动进度会发送给播放源执行。</div>
          <div v-else :class="$style.hostTip">你正在跟随房主播放；如需控制播放，请让房主转交房主权。</div>
        </div>

        <div :class="$style.chat">
          <div ref="chatRef" :class="$style.chatList">
            <div v-for="message in ltState.messages" :key="message.id" :class="[$style.chatItem, { [$style.chatSystem]: message.type == 'system' }]">
              <template v-if="message.type == 'system'">{{ message.text }}</template>
              <template v-else><b>{{ message.senderName }}</b>：{{ message.text }}</template>
            </div>
            <div v-if="!ltState.messages.length" :class="$style.chatEmpty">还没有消息，打个招呼吧</div>
          </div>
          <div :class="$style.chatInputRow">
            <input v-model="chatText" :class="$style.input" placeholder="说点什么…" maxlength="200" @keyup.enter="handleSendChat">
            <button :class="$style.primaryBtn" @click="handleSendChat">发送</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, nextTick, onMounted } from '@common/utils/vueTools'
import { openUrl } from '@common/utils/electron'
import { modSetting, updateModSetting } from '@renderer/core/mod/settings'
import { LISTEN_SERVER_URL, LISTEN_WEB_URL } from '@renderer/core/mod/meta'
import { ltState, createRoom, joinRoom, leaveRoom, sendChat, transferHost, destroy } from '@renderer/core/mod/listenTogetherSync'

export default {
  name: 'ListenTogether',
  setup() {
    const nickname = ref(modSetting.listenNickname || '')
    const server = ref(modSetting.listenServer)
    const roomCode = ref('')
    const busy = ref(false)
    const createError = ref('')
    const joinError = ref('')
    const chatText = ref('')
    const chatRef = ref()

    const currentState = computed(() => ltState.room?.state ?? null)
    const currentMusic = computed(() => currentState.value?.music ?? null)
    const currentPosition = computed(() => {
      const state = currentState.value
      if (!state) return 0
      const elapsed = state.isPlaying ? (Date.now() - state.sentAt) / 1000 : 0
      return Math.max(0, state.position + elapsed)
    })

    const saveBase = () => {
      updateModSetting({
        listenNickname: nickname.value.trim(),
        listenServer: server.value.trim(),
      })
    }

    const handleCreate = () => {
      if (busy.value) return
      createError.value = ''
      if (!nickname.value.trim()) {
        createError.value = '请先填写昵称'
        return
      }
      if (!server.value.trim()) {
        createError.value = '请填写中继服务器地址'
        return
      }
      busy.value = true
      saveBase()
      try {
        createRoom(nickname.value, '')
      } catch (err) {
        createError.value = err.message || String(err)
      } finally {
        setTimeout(() => { busy.value = false }, 800)
      }
    }

    const handleJoin = () => {
      if (busy.value) return
      joinError.value = ''
      if (!nickname.value.trim()) {
        joinError.value = '请先填写昵称'
        return
      }
      if (!roomCode.value.trim()) {
        joinError.value = '请填写房间码'
        return
      }
      busy.value = true
      saveBase()
      try {
        joinRoom(roomCode.value, nickname.value)
      } catch (err) {
        joinError.value = err.message || String(err)
      } finally {
        setTimeout(() => { busy.value = false }, 800)
      }
    }

    // 网页版入口：把当前中继地址带给网页，自建服务器也能直接用
    const handleOpenWeb = () => {
      let base = (modSetting.listenWebUrl || '').trim() ||
        LISTEN_WEB_URL
      const relay = server.value.trim()
      if (relay && !/[?&]server=/.test(base)) {
        base += `${base.includes('?') ? '&' : '?'}server=${encodeURIComponent(relay)}`
      }
      void openUrl(base)
    }

    const handleLeave = () => {
      leaveRoom()
      roomCode.value = ''
    }

    const handleTransfer = (id) => {
      transferHost(id)
    }

    const copyCode = async() => {
      try {
        await navigator.clipboard.writeText(ltState.room.code)
      } catch (err) {}
    }

    const handleSendChat = () => {
      const text = chatText.value.trim()
      if (!text) return
      if (sendChat(text)) chatText.value = ''
    }

    const formatTime = (seconds) => {
      const value = Math.max(0, Math.floor(seconds || 0))
      return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
    }

    watch(() => ltState.messages.length, async() => {
      await nextTick()
      if (chatRef.value) chatRef.value.scrollTop = chatRef.value.scrollHeight
    })

    onMounted(() => {
      if (!modSetting.listenServer) server.value = LISTEN_SERVER_URL
      if (!modSetting.listenWebUrl) updateModSetting({ listenWebUrl: LISTEN_WEB_URL })
    })

    return {
      ltState,
      nickname,
      server,
      roomCode,
      busy,
      createError,
      joinError,
      chatText,
      chatRef,
      currentState,
      currentMusic,
      currentPosition,
      handleCreate,
      handleJoin,
      handleLeave,
      handleTransfer,
      handleOpenWeb,
      copyCode,
      handleSendChat,
      formatTime,
      destroy,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/components/mod/page.less';

.joinWrap {
  flex: auto;
  display: flex;
  gap: 20px;
  align-items: flex-start;
  padding-top: 10px;
}
.card {
  flex: 1;
  max-width: 420px;
  padding: 22px 24px;
  border-radius: 12px;
  background: var(--color-main-background, rgba(128, 128, 128, .08));
  box-shadow: 0 4px 24px rgba(0, 0, 0, .08);
  h3 { margin: 0 0 14px; font-size: 16px; }
}
.status {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 10px;
  background: var(--color-button-background, rgba(128, 128, 128, .16));
  color: var(--color-font-label);
}
.status_connected { color: #2e9e5b; background: rgba(46, 158, 91, .12); }
.status_error { color: #e5484d; background: rgba(229, 72, 77, .12); }
.status_reconnecting { color: #d99400; background: rgba(217, 148, 0, .12); }

.error {
  margin: 0 0 10px;
  padding: 7px 10px;
  font-size: 12px;
  color: #e5484d;
  background: rgba(229, 72, 77, .1);
  border-radius: 6px;
}
.linkBtn {
  margin-top: 10px;
  padding: 0;
  font-size: 12px;
  color: var(--color-primary);
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: underline;
}

.room {
  flex: auto;
  display: flex;
  gap: 18px;
  min-height: 0;
}
.roomSide {
  flex: 0 0 240px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.roomCard {
  padding: 14px 16px;
  border-radius: 10px;
  background: var(--color-main-background, rgba(128, 128, 128, .08));
}
.roomLabel {
  font-size: 12px;
  color: var(--color-font-label);
  margin-bottom: 6px;
}
.roomCode {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: 6px;
  color: var(--color-primary);
  margin-bottom: 10px;
  font-family: Consolas, monospace;
}
.memberList {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 300px;
  overflow-y: auto;
}
.member {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.memberName {
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  color: #fff;
  background: var(--color-primary);
}
.miniBtn {
  padding: 2px 7px;
  font-size: 11px;
  color: var(--color-font-label);
  background: transparent;
  border: 1px solid var(--color-border, rgba(128, 128, 128, .3));
  border-radius: 4px;
  cursor: pointer;
  &:hover { color: var(--color-primary); border-color: var(--color-primary); }
}
.dangerBtn {
  margin-top: auto;
  padding: 9px;
  font-size: 13px;
  color: #e5484d;
  background: rgba(229, 72, 77, .1);
  border: none;
  border-radius: 7px;
  cursor: pointer;
  &:hover { background: rgba(229, 72, 77, .18); }
}
.roomMain {
  flex: auto;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  gap: 14px;
}
.nowPlaying {
  flex: none;
  padding: 22px 24px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(128, 128, 128, .1), rgba(128, 128, 128, .04));
}
.nowLabel {
  font-size: 12px;
  color: var(--color-font-label);
}
.nowName {
  margin-top: 8px;
  font-size: 20px;
  font-weight: 600;
}
.nowSinger {
  margin-top: 4px;
  font-size: 13px;
  color: var(--color-font-label);
}
.nowMeta {
  margin-top: 8px;
  font-size: 12px;
  color: var(--color-primary);
}
.nowEmpty {
  margin-top: 10px;
  font-size: 13px;
  color: var(--color-font-label);
}
.hostTip {
  margin-top: 12px;
  font-size: 12px;
  color: var(--color-font-label);
}
.chat {
  flex: auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 12px;
  border-radius: 10px;
  background: var(--color-main-background, rgba(128, 128, 128, .06));
}
.chatList {
  flex: auto;
  overflow-y: auto;
  min-height: 0;
  padding-right: 6px;
}
.chatItem {
  padding: 5px 0;
  font-size: 13px;
  line-height: 1.5;
  word-break: break-word;
  b { color: var(--color-primary); font-weight: 600; }
}
.chatSystem {
  color: var(--color-font-label);
  font-size: 12px;
}
.chatEmpty {
  padding: 20px 0;
  text-align: center;
  font-size: 12px;
  color: var(--color-font-label);
}
.chatInputRow {
  flex: none;
  display: flex;
  gap: 8px;
  padding-top: 10px;
}
</style>
