<template>
  <div :class="$style.page">
    <div :class="$style.header">
      <div :class="$style.title">本地音乐</div>
      <div :class="$style.subtitle">扫描本机文件夹，像在线歌单一样播放</div>
      <div :class="$style.spacer" />
      <button :class="$style.ghostBtn" @click="handleAddDir">添加文件夹</button>
      <button :class="$style.primaryBtn" :disabled="scanning || !dirs.length" @click="handleScan">
        {{ scanning ? `扫描中 ${progress}%` : '重新扫描' }}
      </button>
    </div>

    <div :class="$style.dirBar">
      <div v-for="dir in dirs" :key="dir" :class="$style.dirChip" :title="dir">
        <span :class="$style.dirText">{{ dir }}</span>
        <button :class="$style.removeDir" title="移除" @click="removeDir(dir)">×</button>
      </div>
      <span v-if="!dirs.length" :class="$style.hintInline">还没有添加文件夹，点右上角「添加文件夹」开始。</span>
    </div>

    <div :class="$style.toolbar">
      <input v-model="keyword" :class="[$style.input, $style.search]" placeholder="搜索歌名 / 歌手 / 专辑">
      <span :class="$style.count">{{ filtered.length }} / {{ allSongs.length }} 首</span>
      <div :class="$style.spacer" />
      <button :class="$style.ghostBtn" :disabled="!filtered.length" @click="playAll">播放全部</button>
    </div>

    <div v-if="error" :class="$style.errorBar">{{ error }}</div>
    <mod-song-table
      :list="filtered" :loading="scanning" :playing-id="playingId"
      empty-text="没有扫描到音频文件，添加文件夹后点「重新扫描」"
      @play="playIndex" @play-later="playLater" @collect="collect"
    />
  </div>
</template>

<script>
import { ref, computed, onMounted } from '@common/utils/vueTools'
import { LIST_IDS } from '@common/constants'
import { modSetting, updateModSetting } from '@renderer/core/mod/settings'
import { scanLocalMusic, loadLocalCache, saveLocalCache, filterLocalMusic } from '@renderer/core/mod/local'
import { showSelectDialog } from '@renderer/utils/ipc'
import { setTempList, addListMusics } from '@renderer/store/list/action'
import { playList } from '@renderer/core/player'
import { playMusicInfo, tempPlayList } from '@renderer/store/player/state'
import ModSongTable from '@renderer/components/mod/SongTable.vue'

export default {
  name: 'LocalMusic',
  components: { ModSongTable },
  setup() {
    const dirs = ref([...modSetting.localDirs])
    const allSongs = ref(loadLocalCache())
    const keyword = ref('')
    const scanning = ref(false)
    const progress = ref(0)
    const error = ref('')
    const playingId = computed(() => playMusicInfo.musicInfo?.id ?? '')
    const filtered = computed(() => filterLocalMusic(allSongs.value, keyword.value))

    const persistDirs = () => {
      updateModSetting({ localDirs: [...dirs.value] })
    }

    const handleAddDir = async() => {
      try {
        const result = await showSelectDialog({
          title: '选择音乐文件夹',
          properties: ['openDirectory', 'multiSelections'],
        })
        if (result.canceled) return
        const added = result.filePaths.filter(p => !dirs.value.includes(p))
        if (!added.length) return
        dirs.value = [...dirs.value, ...added]
        persistDirs()
        await handleScan()
      } catch (err) {
        error.value = err.message || String(err)
      }
    }

    const removeDir = (dir) => {
      dirs.value = dirs.value.filter(item => item != dir)
      persistDirs()
    }

    const handleScan = async() => {
      if (scanning.value) return
      if (!dirs.value.length) {
        error.value = '请先添加至少一个文件夹'
        return
      }
      scanning.value = true
      progress.value = 0
      error.value = ''
      try {
        const list = await scanLocalMusic(dirs.value, (done, total) => {
          progress.value = total ? Math.round(done / total * 100) : 0
        })
        allSongs.value = list
        saveLocalCache(list)
      } catch (err) {
        error.value = err.message || String(err)
      } finally {
        scanning.value = false
        progress.value = 100
      }
    }

    const playIndex = async(index) => {
      const target = filtered.value[index]
      if (!target) return
      await setTempList('mod_local', filtered.value)
      playList(LIST_IDS.TEMP, index)
    }
    const playAll = () => { playIndex(0) }

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

    onMounted(() => {
      if (!allSongs.value.length && dirs.value.length) handleScan()
    })

    return {
      dirs,
      allSongs,
      filtered,
      keyword,
      scanning,
      progress,
      error,
      playingId,
      handleAddDir,
      removeDir,
      handleScan,
      playIndex,
      playAll,
      playLater,
      collect,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/components/mod/page.less';

.dirBar {
  flex: none;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 4px 0 8px;
}
.dirChip {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 360px;
  padding: 4px 4px 4px 10px;
  font-size: 12px;
  color: var(--color-font-label);
  background: var(--color-button-background, rgba(128, 128, 128, .14));
  border-radius: 14px;
}
.dirText {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.removeDir {
  width: 18px;
  height: 18px;
  line-height: 16px;
  font-size: 14px;
  color: var(--color-font-label);
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  &:hover { color: #e5484d; background: rgba(229, 72, 77, .12); }
}
.hintInline {
  font-size: 12px;
  color: var(--color-font-label);
}
.search {
  width: 240px;
}
</style>
