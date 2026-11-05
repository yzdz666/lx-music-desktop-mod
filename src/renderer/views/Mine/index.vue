<template>
  <div :class="$style.page">
    <div :class="$style.header">
      <div :class="$style.title">我的音乐</div>
      <div :class="$style.platforms">
        <button
          v-for="item in platforms" :key="item.id"
          :class="[$style.platformTab, { [$style.platformActive]: platform == item.id }]"
          @click="switchPlatform(item.id)"
        >{{ item.name }}</button>
      </div>
      <div :class="$style.spacer" />
      <template v-if="loggedIn">
        <img v-if="avatar" :class="$style.avatar" :src="avatar" alt="">
        <span :class="$style.nickname">{{ nickname || '已登录' }}</span>
        <button :class="$style.ghostBtn" @click="handleLogout">退出登录</button>
      </template>
    </div>

    <div v-if="!loggedIn" :class="$style.loginBox">
      <h3>登录{{ platformName }}账号</h3>
      <p :class="$style.hint">
        点下面的按钮会在应用内打开 <b>{{ platformName }}</b> 官方登录页，
        直接输入<b>手机号 + 验证码</b>（或扫码）登录。登录成功后窗口会自动关闭，账号只保存在本机。
      </p>
      <div :class="$style.row">
        <button :class="$style.webLoginBtn" :disabled="webLoggingIn" @click="handleWebLogin">
          {{ webLoggingIn ? '等待登录…' : '打开登录窗口（手机号 / 扫码）' }}
        </button>
        <span :class="$style.error">{{ error }}</span>
      </div>
      <p :class="$style.hint">
        登录窗口用的是独立浏览器会话，不会影响系统浏览器；只读取该平台的登录凭证，不上传任何服务器。
      </p>

      <details :class="$style.cookieBox">
        <summary :class="$style.cookieSummary">登录窗口打不开？改用粘贴 Cookie</summary>
        <p :class="$style.hint">
          在浏览器打开 <b>{{ loginHost }}</b> 并登录，按 F12 → Application → Cookies → 复制整段 Cookie
          （或只复制关键字段），粘贴到下面即可。
        </p>
        <textarea v-model="cookieInput" :class="$style.textarea" :placeholder="cookiePlaceholder" spellcheck="false" />
        <div :class="$style.row">
          <button :class="$style.primaryBtn" :disabled="loggingIn" @click="handleLogin">{{ loggingIn ? '登录中…' : '登录' }}</button>
        </div>
      </details>
    </div>

    <div v-else :class="$style.body">
      <div :class="$style.side">
        <button
          v-for="item in entries" :key="item.key"
          :class="[$style.sideItem, { [$style.activeItem]: activeEntry == item.key }]"
          @click="openEntry(item)"
        >
          <span :class="$style.entryName">{{ item.name }}</span>
          <span v-if="item.desc" :class="$style.entryDesc">{{ item.desc }}</span>
        </button>
      </div>
      <div :class="$style.main">
        <div :class="$style.toolbar">
          <span :class="$style.listTitle">{{ currentTitle }}</span>
          <span v-if="view == 'songs'" :class="$style.count">{{ songs.length }} 首</span>
          <div :class="$style.spacer" />
          <button v-if="view == 'songs'" :class="$style.ghostBtn" :disabled="!songs.length" @click="playAll">播放全部</button>
          <button v-if="view == 'songs'" :class="$style.ghostBtn" :disabled="!songs.length" @click="downloadAll">下载全部</button>
          <button :class="$style.ghostBtn" :disabled="loading" @click="reload">刷新</button>
        </div>
        <div v-if="error" :class="$style.errorBar">{{ error }}</div>

        <mod-song-table
          v-if="view == 'songs'"
          :list="songs"
          :loading="loading"
          :playing-id="playingId"
          empty-text="这里还没有歌曲"
          @play="playIndex"
          @play-later="playLater"
          @collect="collect"
        />

        <div v-else :class="$style.gridWrap">
          <div v-if="loading" :class="$style.empty">正在加载…</div>
          <div v-else-if="!cards.length" :class="$style.empty">暂无内容</div>
          <div v-else :class="$style.grid">
            <button v-for="item in cards" :key="item.id" :class="$style.card" @click="openCard(item)">
              <img v-if="item.cover" :class="$style.cover" :src="item.cover" loading="lazy" alt="">
              <div v-else :class="$style.coverPlaceholder">{{ (item.name || '?').slice(0, 1) }}</div>
              <div :class="$style.cardBody">
                <div :class="$style.cardName" :title="item.name">{{ item.name }}</div>
                <div :class="$style.cardDesc">{{ item.artist || item.creator || '' }}<template v-if="item.count"> · {{ item.count }} 首</template></div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from '@common/utils/vueTools'
import { LIST_IDS } from '@common/constants'
import { modSetting } from '@renderer/core/mod/settings'
import * as wy from '@renderer/core/mod/netease'
import * as tx from '@renderer/core/mod/qq'
import * as kg from '@renderer/core/mod/kugou'
import { setTempList, addListMusics } from '@renderer/store/list/action'
import { playList } from '@renderer/core/player'
import { playMusicInfo, tempPlayList } from '@renderer/store/player/state'
import { rendererInvoke } from '@common/rendererIpc'
import { MOD_LOGIN_EVENT } from '@common/modLogin'
import ModSongTable from '@renderer/components/mod/SongTable.vue'

const TEMP_LIST_ID = 'mod_mine'

const PLATFORM_META = {
  wy: {
    name: '网易云音乐',
    host: 'music.163.com',
    placeholder: 'MUSIC_U=xxxxx 或整段 Cookie',
    cookieKey: 'wyCookie',
    nicknameKey: 'wyNickname',
    avatarKey: 'wyAvatar',
    // 与手机版 WebLoginModal 同一套登录页与判定规则
    loginUrl: 'https://music.163.com/m/login',
    loginMatch: '(?:^|;\\s*)MUSIC_U=',
    loginHosts: ['music.163.com', '163.com'],
    loginMobile: true,
    loginSize: { width: 460, height: 780 },
  },
  tx: {
    name: 'QQ 音乐',
    host: 'y.qq.com',
    placeholder: '粘贴 y.qq.com 的整段 Cookie（需含 qm_keyst / qqmusic_key）',
    cookieKey: 'txCookie',
    nicknameKey: 'txNickname',
    avatarKey: 'txAvatar',
    loginUrl: 'https://y.qq.com/',
    loginMatch: '(?:^|;\\s*)(?:qm_keyst|qqmusic_key|musickey)=',
    loginHosts: ['qq.com'],
    loginAutoClick: true,
    loginSize: { width: 1080, height: 780 },
  },
  kg: {
    name: '酷狗音乐',
    host: 'www.kugou.com',
    placeholder: '粘贴 kugou.com 的整段 Cookie（需含 userid 与 token）',
    cookieKey: 'kgCookie',
    nicknameKey: 'kgNickname',
    avatarKey: 'kgAvatar',
    loginUrl: 'https://www.kugou.com/',
    // kg_mid 是游客设备号，不能当登录标记
    loginMatch: '(?:^|;\\s*)(?:KuGoo|kg_music)=',
    loginHosts: ['kugou.com'],
    loginAutoClick: true,
    loginSize: { width: 1080, height: 780 },
  },
}

export default {
  name: 'Mine',
  components: { ModSongTable },
  setup() {
    const cookieInput = ref('')
    const loggingIn = ref(false)
    const webLoggingIn = ref(false)
    const platform = ref('wy')
    const avatar = ref('')
    const view = ref('songs')
    const activeEntry = ref('daily')
    const songs = ref([])
    const cards = ref([])
    const loading = ref(false)
    const error = ref('')
    const playingId = computed(() => playMusicInfo.musicInfo?.id ?? '')

    const platforms = [
      { id: 'wy', name: '网易云' },
      { id: 'tx', name: 'QQ 音乐' },
      { id: 'kg', name: '酷狗' },
    ]

    const platformMeta = computed(() => PLATFORM_META[platform.value])
    const platformName = computed(() => platformMeta.value.name)
    const loginHost = computed(() => platformMeta.value.host)
    const cookiePlaceholder = computed(() => platformMeta.value.placeholder)
    const loggedIn = computed(() => Boolean(modSetting[platformMeta.value.cookieKey]))
    const nickname = computed(() => modSetting[platformMeta.value.nicknameKey])

    const entries = computed(() => {
      if (platform.value == 'wy') {
        return [
          { key: 'daily', name: '每日推荐', view: 'songs' },
          { key: 'liked', name: '我喜欢的音乐', view: 'songs' },
          { key: 'playlists', name: '我的歌单', view: 'playlists' },
          { key: 'subPlaylists', name: '收藏的歌单', view: 'playlists' },
          { key: 'heartbeat', name: '心动模式', view: 'songs' },
          { key: 'subAlbums', name: '收藏的专辑', view: 'albums' },
          { key: 'followed', name: '关注的歌手', view: 'artists' },
          { key: 'personalFm', name: '私人 FM', view: 'songs' },
          { key: 'newAlbums', name: '新碟上架', view: 'albums' },
          { key: 'cloud', name: '云盘音乐', view: 'songs' },
        ]
      }
      if (platform.value == 'tx') {
        return [
          { key: 'daily', name: '每日推荐', view: 'songs' },
          { key: 'guess', name: '猜你喜欢', view: 'songs' },
          { key: 'newSongs', name: '新歌速递', view: 'songs' },
          { key: 'liked', name: '我喜欢的音乐', view: 'songs' },
          { key: 'playlists', name: '我的歌单', view: 'playlists' },
          { key: 'subPlaylists', name: '收藏的歌单', view: 'playlists' },
          { key: 'recommend', name: '推荐歌单', view: 'playlists' },
        ]
      }
      return [
        { key: 'liked', name: '我喜欢的音乐', view: 'songs' },
        { key: 'playlists', name: '我的歌单', view: 'playlists' },
        { key: 'recommend', name: '推荐歌单', view: 'playlists' },
      ]
    })

    const currentTitle = computed(() => {
      const entry = entries.value.find(item => item.key == activeEntry.value)
      return entry ? entry.name : '我的音乐'
    })

    const loadAvatar = async() => {
      const url = modSetting[platformMeta.value.avatarKey]
      if (!url) {
        avatar.value = ''
        return
      }
      const api = platform.value == 'tx' ? tx : platform.value == 'kg' ? kg : wy
      avatar.value = await api.fetchImageAsDataUrl(url)
    }

    const setError = (err) => { error.value = err?.message || String(err) }

    const saveLogin = async(cookie) => {
      if (platform.value == 'wy') await wy.loginWithCookie(cookie)
      else if (platform.value == 'tx') await tx.loginWithCookie(cookie)
      else await kg.loginWithCookie(cookie)
      await loadAvatar()
      await openEntry(entries.value[0])
    }

    const handleLogin = async() => {
      if (loggingIn.value) return
      loggingIn.value = true
      error.value = ''
      try {
        await saveLogin(cookieInput.value)
        cookieInput.value = ''
      } catch (err) {
        setError(err)
      } finally {
        loggingIn.value = false
      }
    }

    // 应用内打开官方登录页，用户在页面里用手机号 / 验证码 / 扫码登录
    const handleWebLogin = async() => {
      if (webLoggingIn.value) return
      webLoggingIn.value = true
      error.value = ''
      try {
        const meta = platformMeta.value
        const cookie = await rendererInvoke(MOD_LOGIN_EVENT.open, {
          platform: platform.value,
          url: meta.loginUrl,
          match: meta.loginMatch,
          hosts: meta.loginHosts,
          title: `登录${meta.name}`,
          mobile: Boolean(meta.loginMobile),
          autoClickLogin: Boolean(meta.loginAutoClick),
          ...(meta.loginSize || {}),
        })
        // null 表示用户关掉了登录窗口
        if (!cookie) return
        await saveLogin(cookie)
      } catch (err) {
        setError(err)
      } finally {
        webLoggingIn.value = false
      }
    }

    const handleLogout = () => {
      if (platform.value == 'wy') wy.logout()
      else if (platform.value == 'tx') tx.logout()
      else kg.logout()
      // 独立 session 里还留着登录态，不清掉的话下次打开登录窗会直接是已登录
      rendererInvoke(MOD_LOGIN_EVENT.logout, platform.value).catch(() => {})
      songs.value = []
      cards.value = []
      avatar.value = ''
    }

    const switchPlatform = (id) => {
      if (platform.value == id) return
      platform.value = id
      songs.value = []
      cards.value = []
      error.value = ''
      view.value = entries.value[0].view
      activeEntry.value = entries.value[0].key
      if (loggedIn.value) {
        void loadAvatar()
        void openEntry(entries.value[0])
      }
    }

    const runWithLoading = async(fn) => {
      loading.value = true
      error.value = ''
      try {
        await fn()
      } catch (err) {
        setError(err)
        songs.value = []
        cards.value = []
      } finally {
        loading.value = false
      }
    }

    const loadSongs = (loader) => runWithLoading(async() => {
      songs.value = await loader()
    })

    const loadCards = (loader) => runWithLoading(async() => {
      cards.value = await loader()
    })

    const openEntry = async(entry) => {
      activeEntry.value = entry.key
      view.value = entry.view
      songs.value = []
      cards.value = []
      if (!loggedIn.value) return
      const api = platform.value == 'tx' ? tx : platform.value == 'kg' ? kg : wy
      switch (entry.key) {
        case 'daily':
          await loadSongs(() => api.getDailyRecommend())
          break
        case 'guess':
          await loadSongs(() => api.getGuessYouLike())
          break
        case 'newSongs':
          await loadSongs(() => api.getNewSongs())
          break
        case 'liked':
          await loadSongs(() => api.getLikedSongs())
          break
        case 'playlists':
          await loadCards(async() => (await api.getMyPlaylists()).filter(item => !item.subscribed))
          break
        case 'subPlaylists':
          await loadCards(() => api.getSubscribedPlaylists())
          break
        case 'recommend':
          await loadCards(() => api.getRecommendPlaylists())
          break
        case 'heartbeat':
          await loadSongs(() => wy.getHeartbeatSongs())
          break
        case 'subAlbums':
          await loadCards(() => wy.getSubAlbums())
          break
        case 'followed':
          await loadCards(() => wy.getFollowedArtists())
          break
        case 'personalFm':
          await loadSongs(() => wy.getPersonalFmSongs())
          break
        case 'newAlbums':
          await loadCards(() => wy.getNewAlbums())
          break
        case 'cloud':
          await loadSongs(() => wy.getCloudSongs())
          break
      }
    }

    const openCard = async(item) => {
      const api = platform.value == 'tx' ? tx : platform.value == 'kg' ? kg : wy
      if (activeEntry.value == 'playlists' || activeEntry.value == 'subPlaylists' || activeEntry.value == 'recommend') {
        view.value = 'songs'
        if (platform.value == 'wy') await loadSongs(async() => (await wy.getPlaylistSongs(item.id)).songs)
        else await loadSongs(() => api.getPlaylistSongs(item.id))
        return
      }
      if (activeEntry.value == 'subAlbums' || activeEntry.value == 'newAlbums') {
        view.value = 'songs'
        await loadSongs(async() => (await wy.getAlbumSongs(item.id)).songs)
        return
      }
      if (activeEntry.value == 'followed') {
        view.value = 'songs'
        await loadSongs(() => wy.getArtistSongs(item.id))
      }
    }

    const reload = () => {
      const entry = entries.value.find(item => item.key == activeEntry.value)
      if (entry) void openEntry(entry)
    }

    const playIndex = async(index) => {
      if (!songs.value[index]) return
      await setTempList(TEMP_LIST_ID, songs.value)
      playList(LIST_IDS.TEMP, index)
    }

    const playAll = () => { playIndex(0) }

    const downloadAll = () => {
      if (!songs.value.length) return
      void addListMusics(LIST_IDS.DEFAULT, songs.value, 'top')
    }

    const playLater = (item) => {
      tempPlayList.push({ listId: LIST_IDS.TEMP, musicInfo: item, isTempPlay: true })
    }

    const collect = async(item) => {
      try {
        await addListMusics(LIST_IDS.DEFAULT, [item], 'top')
        error.value = ''
      } catch (err) {
        setError(err)
      }
    }

    onMounted(async() => {
      if (!loggedIn.value) return
      await loadAvatar()
      await openEntry(entries.value[0])
    })

    return {
      cookieInput,
      loggingIn,
      webLoggingIn,
      platform,
      platforms,
      platformName,
      loginHost,
      cookiePlaceholder,
      loggedIn,
      nickname,
      avatar,
      view,
      entries,
      activeEntry,
      songs,
      cards,
      loading,
      error,
      playingId,
      currentTitle,
      handleLogin,
      handleWebLogin,
      handleLogout,
      switchPlatform,
      openEntry,
      openCard,
      reload,
      playIndex,
      playAll,
      downloadAll,
      playLater,
      collect,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/components/mod/page.less';
</style>
