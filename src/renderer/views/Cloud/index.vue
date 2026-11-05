<template>
  <div :class="$style.page">
    <div :class="$style.header">
      <div :class="$style.title">云盘</div>
      <div :class="$style.subtitle">网易云音乐云盘 · WebDAV 网盘</div>
      <div :class="$style.spacer" />
      <button :class="[$style.ghostBtn, { [$style.tabActive]: tab == 'wy' }]" @click="tab = 'wy'">网易云云盘</button>
      <button :class="[$style.ghostBtn, { [$style.tabActive]: tab == 'dav' }]" @click="tab = 'dav'">WebDAV</button>
    </div>

    <div v-if="tab == 'wy'" :class="$style.bodyColumn">
      <div v-if="!loggedIn" :class="$style.loginBox">
        <h3>网易云云盘需要先登录</h3>
        <p :class="$style.hint">先到「我的音乐」里用手机号 / 扫码登录，再回到这里刷新即可看到云盘歌曲。</p>
        <button :class="$style.primaryBtn" @click="$router.push('/mine')">去登录</button>
      </div>
      <template v-else>
        <div :class="$style.toolbar">
          <span :class="$style.listTitle">云盘歌曲</span>
          <span :class="$style.count">{{ wySongs.length }} 首</span>
          <div :class="$style.spacer" />
          <button :class="$style.ghostBtn" :disabled="!wySongs.length" @click="playAllWy">播放全部</button>
          <button :class="$style.ghostBtn" :disabled="loadingWy" @click="loadWyCloud">刷新</button>
        </div>
        <div v-if="error" :class="$style.errorBar">{{ error }}</div>
        <mod-song-table
          :list="wySongs" :loading="loadingWy" :playing-id="playingId"
          empty-text="云盘里还没有歌曲，先在网易云 App 上传音乐"
          @play="playWy" @play-later="playLater" @collect="collect"
        />
      </template>
    </div>

    <div v-else :class="$style.bodyColumn">
      <div :class="$style.davForm">
        <div :class="$style.field">
          <span :class="$style.label">WebDAV 地址（坚果云填 https://dav.jianguoyun.com/dav/）</span>
          <input v-model="dav.url" :class="$style.input" placeholder="https://dav.example.com/dav/" spellcheck="false">
        </div>
        <div :class="$style.davRow">
          <div :class="$style.field">
            <span :class="$style.label">账号</span>
            <input v-model="dav.user" :class="$style.input" placeholder="邮箱 / 用户名" spellcheck="false">
          </div>
          <div :class="$style.field">
            <span :class="$style.label">密码 / 应用密码</span>
            <input v-model="dav.pass" :class="$style.input" type="password" placeholder="应用密码">
          </div>
        </div>
        <div :class="$style.row">
          <button :class="$style.primaryBtn" :disabled="davLoading" @click="connectDav">{{ davLoading ? '连接中…' : '连接并浏览' }}</button>
          <span :class="$style.error">{{ davError }}</span>
        </div>
      </div>

      <div v-if="davItems.length || davPath.length" :class="$style.davBrowser">
        <div :class="$style.crumbs">
          <button :class="$style.crumb" @click="goDavRoot">根目录</button>
          <template v-for="(item, index) in davPath" :key="item.url">
            <span :class="$style.crumbSep">/</span>
            <button :class="$style.crumb" @click="goDavIndex(index)">{{ item.name }}</button>
          </template>
          <div :class="$style.spacer" />
          <span :class="$style.count">{{ davItems.length }} 项</span>
        </div>
        <div :class="$style.davList">
          <div v-if="davLoading" :class="$style.empty">正在读取目录…</div>
          <div
            v-for="item in davItems" :key="item.url"
            :class="[$style.davItem, { [$style.davPlaying]: playingPath == item.url }]"
            @click="handleDavItem(item)"
          >
            <span :class="$style.davIcon">{{ item.isDir ? '📁' : '🎵' }}</span>
            <span :class="[$style.davName, $style.ellipsis]" :title="item.name">{{ item.name }}</span>
            <span :class="$style.davMeta">{{ item.isDir ? '文件夹' : formatSize(item.size) }}</span>
            <span v-if="loadingFile == item.url" :class="$style.davMeta">下载中…</span>
          </div>
        </div>
      </div>
      <div v-else :class="$style.hintBox">
        填写地址与账号后点击「连接并浏览」，可以直接播放网盘里的音频文件。文件会先缓存到系统临时目录。
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted } from '@common/utils/vueTools'
import { LIST_IDS } from '@common/constants'
import { modSetting, updateModSetting } from '@renderer/core/mod/settings'
import * as wy from '@renderer/core/mod/netease'
import * as webdav from '@renderer/core/mod/webdav'
import { createLocalMusicInfo } from '@renderer/utils/music'
import { setTempList, addListMusics } from '@renderer/store/list/action'
import { playList } from '@renderer/core/player'
import { playMusicInfo, tempPlayList } from '@renderer/store/player/state'
import ModSongTable from '@renderer/components/mod/SongTable.vue'

export default {
  name: 'Cloud',
  components: { ModSongTable },
  setup() {
    const tab = ref('wy')
    const loggedIn = computed(() => Boolean(modSetting.wyCookie))
    const playingId = computed(() => playMusicInfo.musicInfo?.id ?? '')
    const wySongs = ref([])
    const loadingWy = ref(false)
    const error = ref('')

    const dav = reactive({
      url: modSetting.webdavUrl,
      user: modSetting.webdavUser,
      pass: modSetting.webdavPass,
    })
    const davItems = ref([])
    const davPath = ref([])
    const davLoading = ref(false)
    const davError = ref('')
    const loadingFile = ref('')
    const playingPath = ref('')

    const loadWyCloud = async() => {
      if (!loggedIn.value) return
      loadingWy.value = true
      error.value = ''
      try {
        wySongs.value = await wy.getCloudSongs()
      } catch (err) {
        error.value = err.message || String(err)
        wySongs.value = []
      } finally {
        loadingWy.value = false
      }
    }

    const playWy = async(index) => {
      if (!wySongs.value[index]) return
      await setTempList('mod_cloud_wy', wySongs.value)
      playList(LIST_IDS.TEMP, index)
    }
    const playAllWy = () => { playWy(0) }

    const playLater = (item) => {
      tempPlayList.push({ listId: LIST_IDS.TEMP, musicInfo: item, isTempPlay: true })
    }
    const collect = async(item) => {
      try {
        await addListMusics(LIST_IDS.DEFAULT, [item], 'top')
      } catch (err) {
        error.value = err.message || String(err)
      }
    }

    const saveDavSetting = () => {
      updateModSetting({ webdavUrl: dav.url, webdavUser: dav.user, webdavPass: dav.pass })
    }

    const connectDav = async() => {
      saveDavSetting()
      davError.value = ''
      davLoading.value = true
      davPath.value = []
      try {
        davItems.value = await webdav.listDir(dav.url)
      } catch (err) {
        davError.value = err.message || String(err)
        davItems.value = []
      } finally {
        davLoading.value = false
      }
    }

    const goDavRoot = () => {
      davPath.value = []
      connectDav()
    }

    const goDavIndex = async(index) => {
      davPath.value = davPath.value.slice(0, index + 1)
      await loadDavDir(davPath.value[index].url)
    }

    const loadDavDir = async(url) => {
      davLoading.value = true
      davError.value = ''
      try {
        davItems.value = await webdav.listDir(url)
      } catch (err) {
        davError.value = err.message || String(err)
        davItems.value = []
      } finally {
        davLoading.value = false
      }
    }

    const handleDavItem = async(item) => {
      if (item.isDir) {
        davPath.value.push({ name: item.name, url: item.url })
        await loadDavDir(item.url)
        return
      }
      if (!webdav.isAudioFile(item.name)) return
      if (loadingFile.value) return
      loadingFile.value = item.url
      davError.value = ''
      try {
        const filePath = await webdav.downloadToCache(item.url, item.name)
        const musicInfo = await createLocalMusicInfo(filePath)
        if (!musicInfo) throw new Error('无法解析音频文件')
        await setTempList('mod_cloud_dav', [musicInfo])
        playList(LIST_IDS.TEMP, 0)
        playingPath.value = item.url
      } catch (err) {
        davError.value = err.message || String(err)
      } finally {
        loadingFile.value = ''
      }
    }

    const formatSize = (size) => {
      if (!size) return ''
      if (size > 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`
      return `${Math.round(size / 1024)} KB`
    }

    onMounted(() => {
      if (loggedIn.value) loadWyCloud()
    })

    return {
      tab,
      loggedIn,
      playingId,
      wySongs,
      loadingWy,
      error,
      dav,
      davItems,
      davPath,
      davLoading,
      davError,
      loadingFile,
      playingPath,
      loadWyCloud,
      playWy,
      playAllWy,
      playLater,
      collect,
      connectDav,
      goDavRoot,
      goDavIndex,
      handleDavItem,
      formatSize,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/components/mod/page.less';

.bodyColumn {
  flex: auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.davForm {
  flex: none;
  max-width: 720px;
  padding: 12px 0 6px;
}
.davRow {
  display: flex;
  gap: 12px;
  > * { flex: 1; }
}
.davBrowser {
  flex: auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  margin-top: 6px;
  border-top: 1px solid var(--color-border, rgba(128, 128, 128, .16));
}
.crumbs {
  flex: none;
  display: flex;
  align-items: center;
  gap: 2px;
  height: 36px;
}
.crumb {
  padding: 3px 6px;
  font-size: 12px;
  color: var(--color-primary);
  background: transparent;
  border: none;
  cursor: pointer;
  &:hover { text-decoration: underline; }
}
.crumbSep {
  color: var(--color-font-label);
}
.davList {
  flex: auto;
  overflow-y: auto;
  min-height: 0;
}
.davItem {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 38px;
  padding: 0 10px;
  border-radius: 6px;
  cursor: pointer;
  &:hover { background: var(--color-hover, rgba(128, 128, 128, .12)); }
}
.davPlaying { color: var(--color-primary); }
.davIcon { flex: none; }
.davName { flex: 1; min-width: 0; }
.davMeta {
  flex: none;
  font-size: 12px;
  color: var(--color-font-label);
}
.hintBox {
  margin-top: 20px;
  padding: 18px;
  font-size: 12px;
  line-height: 1.8;
  color: var(--color-font-label);
  border: 1px dashed var(--color-border, rgba(128, 128, 128, .3));
  border-radius: 8px;
}
.tabActive {
  color: var(--color-primary);
  font-weight: 600;
}
.ellipsis {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
