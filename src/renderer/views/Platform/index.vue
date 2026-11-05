<template>
  <div :class="$style.page">
    <div :class="$style.header">
      <div :class="$style.title">平台设置</div>
      <div :class="$style.subtitle">音源开关、播放音质、账号与二改功能入口</div>
    </div>

    <div :class="$style.scroll">
      <section :class="$style.section">
        <h3 :class="$style.sectionTitle">播放音质</h3>
        <div :class="$style.qualityRow">
          <button
            v-for="item in qualityOptions" :key="item.value"
            :class="[$style.qualityBtn, { [$style.qualityActive]: appSetting['player.playQuality'] == item.value }]"
            @click="setQuality(item.value)"
          >
            <span :class="$style.qualityName">{{ item.name }}</span>
            <span :class="$style.qualityDesc">{{ item.desc }}</span>
          </button>
        </div>
        <p :class="$style.note">实际播放会按音源支持情况自动降级；下载音质在「设置 → 下载」里单独配置。</p>
      </section>

      <section :class="$style.section">
        <h3 :class="$style.sectionTitle">音源平台</h3>
        <div :class="$style.table">
          <div :class="[$style.tr, $style.th]">
            <span :class="$style.tdName">平台</span>
            <span :class="$style.tdState">状态</span>
            <span :class="$style.tdQuality">可用音质</span>
            <span :class="$style.tdAction">操作</span>
          </div>
          <div v-for="source in sources" :key="source.id" :class="$style.tr">
            <span :class="$style.tdName">
              <b>{{ source.name }}</b>
              <span :class="$style.sourceId">{{ source.id }}</span>
            </span>
            <span :class="$style.tdState">
              <span v-if="source.enabled" :class="$style.dotOk">可用</span>
              <span v-else :class="$style.dotOff">未启用</span>
            </span>
            <span :class="$style.tdQuality">{{ source.qualities.length ? source.qualities.join(' / ') : '—' }}</span>
            <span :class="$style.tdAction">
              <button :class="$style.ghostBtn" @click="$router.push('/setting')">音源设置</button>
            </span>
          </div>
        </div>
        <p :class="$style.note">
          音源脚本在「设置 → 基本设置 → 音乐 API → 导入」里添加（支持本地 js 与在线链接），导入后这里会显示每个音源实际支持的音质。
          桌面版与手机版一样不内置音源脚本；脚本声明了 Master / Atmos / Hi-Res 时，播放与下载都会按对应档位请求。
        </p>
      </section>

      <section :class="$style.section">
        <h3 :class="$style.sectionTitle">平台账号</h3>
        <div v-for="account in accounts" :key="account.id" :class="$style.accountRow">
          <img v-if="account.avatar" :class="$style.avatar" :src="account.avatar" alt="">
          <div>
            <div :class="$style.accountName">{{ account.name }}<span v-if="account.loggedIn" :class="$style.accountMeta"> · {{ account.nickname || '已登录' }}</span></div>
            <div :class="$style.accountMeta">{{ account.loggedIn ? '账号已登录，可在「我的音乐」读取歌单与推荐' : '未登录' }}</div>
          </div>
          <div :class="$style.spacer" />
          <button :class="$style.ghostBtn" @click="$router.push('/mine')">{{ account.loggedIn ? '进入我的音乐' : '去登录' }}</button>
          <button v-if="account.loggedIn" :class="$style.dangerBtn" @click="handleLogout(account.id)">退出</button>
        </div>
        <p :class="$style.note">三个平台的 Cookie 都只保存在本机。QQ / 酷狗的歌单读取依赖对应音源脚本，脚本未导入时仅保存登录态。</p>
      </section>

      <section :class="$style.section">
        <h3 :class="$style.sectionTitle">音源音质测试</h3>
        <p :class="$style.note">用当前播放的在线歌曲，按音质档位逐个向音源取链接，验证「设置里能选」的档位是否真的能拿到。播放一首在线歌曲后再点测试。</p>
        <div :class="$style.row" :style="{ marginTop: '10px' }">
          <button :class="$style.primaryBtn" :disabled="testing" @click="runSourceTest">{{ testing ? '测试中…' : '开始测试' }}</button>
          <span :class="$style.savedTip">{{ testTip }}</span>
        </div>
        <div v-if="testRows.length" :class="$style.table" :style="{ marginTop: '10px' }">
          <div v-for="row in testRows" :key="row.quality" :class="$style.tr">
            <span :class="$style.tdName">{{ row.label }}</span>
            <span :class="$style.tdState">
              <span v-if="row.status == 'ok'" :class="$style.dotOk">可用</span>
              <span v-else-if="row.status == 'fail'" :class="$style.dotOff">失败</span>
              <span v-else>—</span>
            </span>
            <span :class="$style.tdQuality">{{ row.detail }}</span>
          </div>
        </div>
      </section>

      <section :class="$style.section">
        <h3 :class="$style.sectionTitle">外观与播报</h3>
        <div :class="$style.field">
          <span :class="$style.label">自定义主题背景（与手机版一致，任何主题都生效，优先于主题自带背景图）</span>
          <div :class="$style.row">
            <input ref="bgInputRef" type="file" accept="image/*" style="display: none" @change="handleBgFile">
            <button :class="$style.primaryBtn" @click="pickBg">选择图片</button>
            <button v-if="modSetting.customBg" :class="$style.ghostBtn" @click="clearBg">清除背景</button>
            <span :class="$style.savedTip">{{ bgTip }}</span>
          </div>
          <img v-if="modSetting.customBg" :class="$style.bgPreview" :src="modSetting.customBg" alt="">
        </div>
        <div :class="$style.field">
          <span :class="$style.label">听歌播报（切歌时朗读「正在播放 歌名，歌手」）</span>
          <div :class="$style.row">
            <button :class="[modSetting.songNotify ? $style.primaryBtn : $style.ghostBtn]" @click="toggleNotify">{{ modSetting.songNotify ? '已开启' : '已关闭' }}</button>
            <span :class="$style.label">语速</span>
            <input v-model.number="notifyRate" :class="$style.input" type="range" min="0.5" max="2" step="0.1" style="max-width: 180px" @change="saveNotifyRate">
            <span :class="$style.savedTip">{{ notifyRate }}x</span>
            <button :class="$style.ghostBtn" @click="testNotify">试听</button>
          </div>
        </div>
      </section>

      <section :class="$style.section">
        <h3 :class="$style.sectionTitle">一起听</h3>
        <div :class="$style.field">
          <span :class="$style.label">中继服务器地址（WebSocket）</span>
          <input v-model="server" :class="$style.input" spellcheck="false">
        </div>
        <div :class="$style.field">
          <span :class="$style.label">网页版地址（浏览器 / 手机直接加入）</span>
          <input v-model="webUrl" :class="$style.input" spellcheck="false">
        </div>
        <div :class="$style.row">
          <button :class="$style.primaryBtn" @click="saveServer">保存</button>
          <button :class="$style.ghostBtn" @click="$router.push('/listen')">打开一起听</button>
          <button :class="$style.ghostBtn" @click="handleOpenWeb">打开网页版</button>
          <span :class="$style.savedTip">{{ savedTip }}</span>
        </div>
        <p :class="$style.hint">网页版是同一个房间的网页客户端：手机不装 App 也能听房主正在播的歌；地址留空则用内置公网中继。</p>
      </section>

      <section :class="$style.section">
        <h3 :class="$style.sectionTitle">二改功能</h3>
        <div :class="$style.featureGrid">
          <button :class="$style.featureCard" @click="$router.push('/mine')">
            <b>我的音乐</b><span>每日推荐 / 我喜欢的 / 我的歌单</span>
          </button>
          <button :class="$style.featureCard" @click="$router.push('/cloud')">
            <b>云盘</b><span>网易云云盘 / WebDAV 网盘</span>
          </button>
          <button :class="$style.featureCard" @click="$router.push('/local')">
            <b>本地音乐</b><span>扫描本地文件夹并播放</span>
          </button>
          <button :class="$style.featureCard" @click="$router.push('/listen')">
            <b>一起听</b><span>多端同步播放房间</span>
          </button>
        </div>
      </section>

      <section :class="$style.section">
        <h3 :class="$style.sectionTitle">关于</h3>
        <p :class="$style.about">
          LX Mod 桌面版 v{{ modVersion }} · 基于 LX Music Desktop 2.12.6 二改 · 作者：{{ modAuthor }}（QQ {{ modQQ }}）<br>
          二改新增：我的音乐（网易云 / QQ / 酷狗）、云盘（网易云 + WebDAV）、本地音乐、一起听（含网页版）、平台设置、全音质支持。
        </p>
        <div :class="$style.row">
          <button :class="$style.ghostBtn" @click="openUrl(modHomeUrl)">二改版主页</button>
          <button :class="$style.ghostBtn" @click="openUrl(modDesktopUrl)">电脑版下载 / 源码</button>
          <button :class="$style.ghostBtn" @click="openUrl(modGithubApp)">GitHub 源码</button>
          <button :class="$style.ghostBtn" @click="$router.push('/setting?name=SettingUpdate')">检查更新</button>
        </div>
        <p :class="$style.about" style="margin-top: 10px;">
          致谢：lyswhut/lx-music-desktop（桌面版基础）、lyswhut/lx-music-mobile（手机版基础）。本软件完全免费，代码开源。
        </p>
      </section>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from '@common/utils/vueTools'
import { appSetting, updateSetting } from '@renderer/store/setting'
import { qualityList, sourceNames } from '@renderer/store'
import { modSetting, updateModSetting } from '@renderer/core/mod/settings'
import { MOD_VERSION, MOD_AUTHOR, MOD_QQ, MOD_HOME_URL, MOD_DESKTOP_URL, MOD_GITHUB_APP, LISTEN_WEB_URL } from '@renderer/core/mod/meta'
import { openUrl } from '@common/utils/electron'
import * as wy from '@renderer/core/mod/netease'
import { PLAY_QUALITYS, TRY_QUALITYS, getQualityLabel, getSongQuality } from '@common/quality'
import musicSdk from '@renderer/utils/musicSdk'
import { toOldMusicInfo } from '@common/utils/tools'
import { playMusicInfo } from '@renderer/store/player/state'
import { applyTheme } from '@renderer/store/utils'
import { themeId, themeInfo } from '@renderer/store'
import { speak } from '@renderer/core/mod/songNotify'

export default {
  name: 'Platform',
  setup() {
    const server = ref(modSetting.listenServer)
    const webUrl = ref(modSetting.listenWebUrl)
    const savedTip = ref('')
    const avatar = ref('')
    const bgInputRef = ref()
    const bgTip = ref('')
    const notifyRate = ref(Number(modSetting.songNotifyRate) || 1)
    const testing = ref(false)
    const testTip = ref('')
    const testRows = ref([])

    const accounts = computed(() => [
      {
        id: 'wy',
        name: '网易云音乐',
        loggedIn: Boolean(modSetting.wyCookie),
        nickname: modSetting.wyNickname,
        avatar: modSetting.wyAvatar ? avatar.value : '',
      },
      { id: 'tx', name: 'QQ 音乐', loggedIn: Boolean(modSetting.txCookie), nickname: modSetting.txNickname, avatar: '' },
      { id: 'kg', name: '酷狗音乐', loggedIn: Boolean(modSetting.kgCookie), nickname: modSetting.kgNickname, avatar: '' },
    ])

    const qualityOptions = PLAY_QUALITYS.map((value) => ({ value, name: getQualityLabel(value), desc: value.toUpperCase() }))

    const sources = computed(() => {
      const list = Object.keys(sourceNames.value).filter(id => id != 'all')
      return list.map(id => {
        const qualities = qualityList.value[id] ?? []
        return {
          id,
          name: sourceNames.value[id],
          enabled: qualities.length > 0,
          qualities: qualities.map(q => getQualityLabel(q)),
        }
      })
    })

    const setQuality = (value) => {
      updateSetting({ 'player.playQuality': value })
    }

    const refreshTheme = () => {
      applyTheme(themeId.value, appSetting['theme.lightId'], appSetting['theme.darkId'], themeInfo.dataPath)
    }

    const pickBg = () => {
      bgInputRef.value?.click()
    }

    const handleBgFile = (event) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return
      if (file.size > 4 * 1024 * 1024) {
        bgTip.value = '图片不要超过 4MB'
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        updateModSetting({ customBg: String(reader.result || '') })
        refreshTheme()
        bgTip.value = '已应用'
        setTimeout(() => { bgTip.value = '' }, 1500)
      }
      reader.onerror = () => { bgTip.value = '读取图片失败' }
      reader.readAsDataURL(file)
    }

    const clearBg = () => {
      updateModSetting({ customBg: '' })
      refreshTheme()
      bgTip.value = '已清除'
      setTimeout(() => { bgTip.value = '' }, 1500)
    }

    const toggleNotify = () => {
      updateModSetting({ songNotify: !modSetting.songNotify })
    }

    const saveNotifyRate = () => {
      updateModSetting({ songNotifyRate: notifyRate.value })
    }

    const testNotify = () => {
      updateModSetting({ songNotifyRate: notifyRate.value })
      speak('正在播放 测试歌曲，测试歌手')
    }

    const handleLogout = (id) => {
      if (id == 'wy') {
        wy.logout()
        avatar.value = ''
      } else if (id == 'tx') {
        updateModSetting({ txCookie: '', txNickname: '', txAvatar: '' })
      } else {
        updateModSetting({ kgCookie: '', kgNickname: '', kgAvatar: '' })
      }
    }

    const SOURCE_NAMES = { kw: '酷我', kg: '酷狗', tx: 'QQ', wy: '网易云', mg: '咪咕' }

    const runSourceTest = async() => {
      const musicInfo = playMusicInfo.musicInfo
      if (!musicInfo || musicInfo.source == 'local') {
        testTip.value = '请先播放一首在线歌曲'
        return
      }
      testing.value = true
      testTip.value = ''
      testRows.value = []
      try {
        const oldInfo = toOldMusicInfo(musicInfo)
        const songBest = getSongQuality(musicInfo)
        for (const quality of TRY_QUALITYS) {
          const row = { quality, label: getQualityLabel(quality), status: 'pending', detail: '' }
          testRows.value.push(row)
          try {
            const result = await musicSdk[musicInfo.source].getMusicUrl(oldInfo, quality).promise
            if (result?.url) {
              row.status = 'ok'
              row.detail = `${result.type ?? quality} · ${(result.url || '').slice(0, 48)}…`
            } else {
              row.status = 'fail'
              row.detail = '没有返回播放地址'
            }
          } catch (err) {
            row.status = 'fail'
            row.detail = err?.message || String(err)
          }
          testRows.value = [...testRows.value]
        }
        testTip.value = `测试源：${SOURCE_NAMES[musicInfo.source] ?? musicInfo.source} · 歌曲自身最高 ${getQualityLabel(songBest)}`
      } finally {
        testing.value = false
      }
    }

    const saveServer = () => {
      updateModSetting({
        listenServer: server.value.trim(),
        listenWebUrl: webUrl.value.trim() || LISTEN_WEB_URL,
      })
      savedTip.value = '已保存'
      setTimeout(() => { savedTip.value = '' }, 1500)
    }

    // 网页版入口：把中继地址一起带过去，自建服务器也能直接加入
    const handleOpenWeb = () => {
      let base = (webUrl.value || '').trim() || 'https://af384ee6deb6e09e2.app.workbuddy.host/?sharecode=MKPWEVLBUS'
      const relay = server.value.trim()
      if (relay && !/[?&]server=/.test(base)) {
        base += `${base.includes('?') ? '&' : '?'}server=${encodeURIComponent(relay)}`
      }
      void openUrl(base)
    }

    onMounted(async() => {
      if (modSetting.wyAvatar) avatar.value = await wy.fetchImageAsDataUrl(modSetting.wyAvatar)
    })

    return {
      appSetting,
      modSetting,
      qualityOptions,
      getQualityLabel,
      accounts,
      bgInputRef,
      bgTip,
      notifyRate,
      pickBg,
      handleBgFile,
      clearBg,
      toggleNotify,
      saveNotifyRate,
      testNotify,
      testing,
      testTip,
      testRows,
      runSourceTest,
      sources,
      server,
      webUrl,
      handleOpenWeb,
      modVersion: MOD_VERSION,
      modAuthor: MOD_AUTHOR,
      modQQ: MOD_QQ,
      modHomeUrl: MOD_HOME_URL,
      modDesktopUrl: MOD_DESKTOP_URL,
      modGithubApp: MOD_GITHUB_APP,
      openUrl,
      savedTip,
      avatar,
      setQuality,
      handleLogout,
      saveServer,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/components/mod/page.less';

.scroll {
  flex: auto;
  overflow-y: auto;
  min-height: 0;
  padding-right: 8px;
}
.section {
  margin-bottom: 22px;
  padding: 16px 18px;
  border-radius: 10px;
  background: var(--color-main-background, rgba(128, 128, 128, .06));
}
.sectionTitle {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
}
.qualityRow {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.qualityBtn {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 104px;
  padding: 9px 14px;
  text-align: left;
  color: var(--color-font);
  background: var(--color-button-background, rgba(128, 128, 128, .14));
  border: 1px solid transparent;
  border-radius: 7px;
  cursor: pointer;
}
.qualityActive {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: rgba(128, 128, 128, .1);
}
.qualityName { font-size: 13px; font-weight: 600; }
.qualityDesc { font-size: 11px; color: var(--color-font-label); }
.note {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--color-font-label);
}
.table { display: flex; flex-direction: column; }
.tr {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 6px;
  border-bottom: 1px solid var(--color-border, rgba(128, 128, 128, .12));
}
.th { font-size: 12px; color: var(--color-font-label); }
.tdName { flex: 1; display: flex; align-items: baseline; gap: 8px; }
.sourceId { font-size: 11px; color: var(--color-font-label); }
.tdState { flex: 0 0 74px; font-size: 12px; }
.tdQuality { flex: 0 0 240px; font-size: 12px; color: var(--color-font-label); }
.tdAction { flex: 0 0 90px; text-align: right; }
.dotOk { color: #2e9e5b; }
.dotOff { color: var(--color-font-label); }
.accountRow {
  display: flex;
  align-items: center;
  gap: 12px;
}
.avatar { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; }
.accountName { font-size: 14px; font-weight: 600; }
.accountMeta { font-size: 12px; color: var(--color-font-label); }
.dangerBtn {
  padding: 6px 12px;
  font-size: 12px;
  color: #e5484d;
  background: rgba(229, 72, 77, .1);
  border: none;
  border-radius: 5px;
  cursor: pointer;
}
.savedTip { font-size: 12px; color: var(--color-primary); }
.featureGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 10px;
}
.featureCard {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  text-align: left;
  color: var(--color-font);
  background: var(--color-button-background, rgba(128, 128, 128, .14));
  border: none;
  border-radius: 8px;
  cursor: pointer;
  b { font-size: 13px; }
  span { font-size: 11px; color: var(--color-font-label); }
  &:hover { color: var(--color-primary); }
}
.bgPreview {
  width: 220px;
  height: 124px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid var(--color-border, rgba(128, 128, 128, .2));
  margin-top: 10px;
}
.about {
  margin: 0;
  font-size: 12px;
  line-height: 1.9;
  color: var(--color-font-label);
}
</style>
