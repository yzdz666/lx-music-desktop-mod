<template>
  <div :class="$style.table">
    <div :class="$style.head">
      <span :class="$style.colNum">#</span>
      <span :class="$style.colName">歌曲</span>
      <span :class="$style.colSinger">歌手</span>
      <span :class="$style.colAlbum">专辑</span>
      <span :class="$style.colQuality">音质</span>
      <span :class="$style.colTime">时长</span>
      <span :class="$style.colAction">操作</span>
    </div>
    <div ref="scrollRef" :class="$style.body">
      <div v-if="loading" :class="$style.tip">正在加载…</div>
      <div v-else-if="!list.length" :class="$style.tip">{{ emptyText }}</div>
      <div
        v-for="(item, index) in list" :key="item.id + '_' + index"
        :class="[$style.row, { [$style.playing]: playingId == item.id }]"
        @dblclick="$emit('play', index)"
      >
        <span :class="$style.colNum">
          <span v-if="playingId == item.id" :class="$style.playingDot">▶</span>
          <template v-else>{{ index + 1 }}</template>
        </span>
        <span :class="[$style.colName, $style.ellipsis]" :title="item.name">{{ item.name }}</span>
        <span :class="[$style.colSinger, $style.ellipsis]" :title="item.singer">{{ item.singer }}</span>
        <span :class="[$style.colAlbum, $style.ellipsis]" :title="item.meta && item.meta.albumName">{{ (item.meta && item.meta.albumName) || '—' }}</span>
        <span :class="$style.colQuality">
          <em v-if="item.source != 'local'" :class="$style.qualityBadge" :style="{ color: getQualityColor(getSongQuality(item)), borderColor: getQualityColor(getSongQuality(item)) }">{{ getQualityShortLabel(getSongQuality(item)) }}</em>
          <template v-else>—</template>
        </span>
        <span :class="$style.colTime">{{ item.interval || '—' }}</span>
        <span :class="$style.colAction">
          <button :class="$style.btn" title="播放" @click.stop="$emit('play', index)">播放</button>
          <button :class="$style.btn" title="加入试听列表" @click.stop="$emit('play-later', item)">稍后</button>
          <button :class="$style.btn" title="收藏到默认列表" @click.stop="$emit('collect', item)">收藏</button>
        </span>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from '@common/utils/vueTools'
import { getSongQuality, getQualityShortLabel, getQualityColor } from '@common/quality'

export default {
  name: 'ModSongTable',
  props: {
    list: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    emptyText: { type: String, default: '暂无歌曲' },
    playingId: { type: String, default: '' },
  },
  emits: ['play', 'play-later', 'collect'],
  setup() {
    return {
      scrollRef: ref(),
      getSongQuality,
      getQualityShortLabel,
      getQualityColor,
    }
  },
}
</script>

<style lang="less" module>
.table {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  font-size: 13px;
  color: var(--color-font);
}
.head, .row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
}
.head {
  flex: none;
  height: 34px;
  font-size: 12px;
  color: var(--color-font-label);
  border-bottom: 1px solid var(--color-border, rgba(128, 128, 128, .2));
}
.body {
  flex: auto;
  min-height: 0;
  overflow-y: auto;
  contain: content;
}
.row {
  height: 38px;
  border-radius: 6px;
  cursor: default;
  content-visibility: auto;
  contain-intrinsic-size: 38px;
  &:hover {
    background: var(--color-hover, rgba(128, 128, 128, .12));
  }
  &.playing {
    color: var(--color-primary);
  }
}
.colNum {
  flex: 0 0 42px;
  text-align: center;
  color: var(--color-font-label);
}
.playingDot {
  color: var(--color-primary);
}
.colName { flex: 1 1 32%; min-width: 0; }
.colSinger { flex: 0 0 18%; min-width: 0; color: var(--color-font-label); }
.colAlbum { flex: 0 0 20%; min-width: 0; color: var(--color-font-label); }
.colQuality { flex: 0 0 64px; display: flex; justify-content: flex-start; }
.qualityBadge {
  padding: 1px 5px;
  font-size: 10px;
  font-style: normal;
  line-height: 1.5;
  border: 1px solid currentColor;
  border-radius: 3px;
  opacity: .9;
  white-space: nowrap;
}
.colTime { flex: 0 0 54px; text-align: right; color: var(--color-font-label); }
.colAction {
  flex: 0 0 156px;
  display: flex;
  gap: 6px;
  justify-content: flex-end;
  opacity: 0;
  transition: opacity .15s;
}
.row:hover .colAction { opacity: 1; }
.btn {
  padding: 2px 8px;
  font-size: 12px;
  color: var(--color-font);
  background: var(--color-button-background, rgba(128, 128, 128, .16));
  border: none;
  border-radius: 4px;
  cursor: pointer;
  &:hover { background: var(--color-primary); color: #fff; }
}
.ellipsis {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.tip {
  padding: 40px 0;
  text-align: center;
  color: var(--color-font-label);
}
</style>
