<template lang="pug">
material-modal(:show="show" bg-close teleport="#view" @close="handleClose")
  main(:class="$style.main")
    h2 {{ $t('report__title') }}
    div(:class="$style.ranges")
      button(v-for="item in ranges" :key="item" :class="[$style.rangeBtn, { [$style.active]: range === item }]" @click="setRange(item)") {{ $t('report__range_' + item) }}
    div(v-if="loading" :class="$style.empty") {{ $t('report__loading') }}
    div.scroll(v-else-if="report" :class="$style.body")
      div(:class="$style.summary")
        div(:class="$style.cell")
          strong {{ formatDuration(report.totalSec) }}
          span {{ $t('report__total_time') }}
        div(:class="$style.cell")
          strong {{ report.totalPlays }}
          span {{ $t('report__total_plays') }}
        div(:class="$style.cell")
          strong {{ report.songCount }}
          span {{ $t('report__song_count') }}
        div(:class="$style.cell")
          strong {{ report.artistCount }}
          span {{ $t('report__artist_count') }}
      p(v-if="report.streak > 1" :class="$style.streak") {{ $t('report__streak', { days: report.streak }) }}
      div(v-if="report.daily.length > 1" :class="$style.block")
        h3 {{ $t('report__daily') }}
        div(:class="$style.daily")
          div(v-for="day in report.daily" :key="day.date" :class="$style.dailyCol" :aria-label="day.date")
            div(:class="$style.dailyBar" :style="{ height: barHeight(day.sec, maxDay, 46) + 'px' }")
      div(:class="$style.block")
        h3 {{ $t('report__top_songs') }}
        p(v-if="!report.topSongs.length" :class="$style.empty") {{ $t('report__empty') }}
        div(v-for="(song, index) in report.topSongs.slice(0, 10)" :key="song.key" :class="$style.row")
          span(:class="$style.rank") {{ index + 1 }}
          div(:class="$style.rowMain")
            p(:class="$style.rowTitle") {{ song.name || $t('report__unknown_song') }}
            p(:class="$style.rowSub") {{ song.singer || $t('report__unknown_artist') }}
            div(:class="$style.track")
              div(:class="$style.trackFill" :style="{ width: barHeight(song.plays, maxSongPlays, 100) + '%' }")
          span(:class="$style.count") {{ song.plays }}
      div(:class="$style.block")
        h3 {{ $t('report__top_artists') }}
        p(v-if="!report.topArtists.length" :class="$style.empty") {{ $t('report__empty') }}
        div(v-for="(artist, index) in report.topArtists.slice(0, 8)" :key="artist.name" :class="$style.row")
          span(:class="$style.rank") {{ index + 1 }}
          div(:class="$style.rowMain")
            p(:class="$style.rowTitle") {{ artist.name }}
            div(:class="$style.track")
              div(:class="$style.trackFill" :style="{ width: barHeight(artist.plays, maxArtistPlays, 100) + '%' }")
          span(:class="$style.count") {{ artist.plays }}
      div(v-if="report.sources.length" :class="$style.block")
        h3 {{ $t('report__sources') }}
        div(v-for="item in report.sources" :key="item.source" :class="$style.row")
          span(:class="$style.rank") {{ sourceName(item.source) }}
          div(:class="$style.rowMain")
            div(:class="$style.track")
              div(:class="$style.trackFill" :style="{ width: barHeight(item.plays, maxSourcePlays, 100) + '%' }")
          span(:class="$style.count") {{ item.plays }}
      div(:class="$style.block")
        h3 {{ $t('report__hours') }}
        div(:class="$style.hours")
          div(v-for="(count, hour) in report.hours" :key="hour" :class="$style.hourCol")
            div(:class="$style.hourBar" :style="{ height: barHeight(count, maxHour, 40) + 'px' }")
            span(v-if="hour % 6 === 0" :class="$style.hourLabel") {{ hour }}
</template>

<script>
import { ref, computed, watch } from '@common/utils/vueTools'
import { useI18n } from '@renderer/plugins/i18n'
import { getPlayReport } from '@renderer/core/mod/playStats'

const SOURCE_NAMES = {
  kw: '酷我',
  kg: '酷狗',
  tx: 'QQ 音乐',
  wy: '网易云',
  mg: '咪咕',
  bd: '百度',
  local: '本地',
}

export default {
  name: 'PlayReportModal',
  props: {
    show: { type: Boolean, default: false },
  },
  emits: ['update:show'],
  setup(props, { emit }) {
    const t = useI18n()
    const ranges = ['week', 'month', 'year', 'all']
    const range = ref('month')
    const report = ref(null)
    const loading = ref(false)

    const load = async(next) => {
      loading.value = true
      try {
        report.value = getPlayReport(next)
      } finally {
        loading.value = false
      }
    }

    const setRange = (next) => {
      range.value = next
      void load(next)
    }

    const handleClose = () => { emit('update:show', false) }

    const maxDay = computed(() => Math.max(1, ...(report.value ? report.value.daily.map(d => d.sec) : [1])))
    const maxSongPlays = computed(() => (report.value?.topSongs[0] ? report.value.topSongs[0].plays : 1))
    const maxArtistPlays = computed(() => (report.value?.topArtists[0] ? report.value.topArtists[0].plays : 1))
    const maxSourcePlays = computed(() => (report.value?.sources[0] ? report.value.sources[0].plays : 1))
    const maxHour = computed(() => Math.max(1, ...(report.value ? report.value.hours : [1])))

    const barHeight = (value, max, base) => {
      if (!value || !max) return 0
      return Math.max(1, Math.round((value / max) * base))
    }

    const formatDuration = (sec) => {
      if (sec < 60) return `${Math.round(sec)} 秒`
      const minutes = Math.round(sec / 60)
      if (minutes < 60) return `${minutes} 分钟`
      const hours = Math.floor(minutes / 60)
      const rest = minutes % 60
      return rest ? `${hours} 小时 ${rest} 分` : `${hours} 小时`
    }

    const sourceName = (source) => SOURCE_NAMES[source] || source || t('report__unknown_source')

    watch(() => props.show, value => {
      if (value) void load(range.value)
    })

    return {
      t,
      ranges,
      range,
      report,
      loading,
      setRange,
      handleClose,
      maxDay,
      maxSongPlays,
      maxArtistPlays,
      maxSourcePlays,
      maxHour,
      barHeight,
      formatDuration,
      sourceName,
    }
  },
}
</script>

<style lang="less" module>
.main {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 62vw;
  max-width: 780px;
  max-height: 78vh;
  padding: 15px;
  border-radius: 6px;
  background: var(--color-main-background);
  color: var(--color-font);
  h2 { font-size: 15px; margin-bottom: 8px; }
}

.ranges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.rangeBtn {
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-font-label);
  font-size: 12px;
  cursor: pointer;
  &.active {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
}

.body {
  flex: 1;
  overflow-y: auto;
  padding-right: 4px;
}

.summary {
  display: flex;
  flex-wrap: wrap;
}

.cell {
  width: 50%;
  padding: 6px 0;
  text-align: center;
  strong { display: block; font-size: 16px; color: var(--color-primary); }
  span { font-size: 11px; color: var(--color-font-label); }
}

.streak {
  text-align: center;
  font-size: 12px;
  color: var(--color-primary);
  margin: 4px 0;
}

.block {
  margin-top: 12px;
  h3 { font-size: 13px; margin-bottom: 6px; }
}

.daily {
  display: flex;
  align-items: flex-end;
  height: 52px;
  gap: 1px;
}

.dailyCol {
  flex: 1;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.dailyBar {
  width: 70%;
  min-height: 1px;
  border-radius: 1px;
  background: var(--color-primary);
}

.row {
  display: flex;
  align-items: center;
  padding: 3px 0;
}

.rank {
  width: 46px;
  flex-shrink: 0;
  font-size: 12px;
  color: var(--color-font-label);
}

.rowMain {
  flex: 1;
  min-width: 0;
  padding-right: 8px;
}

.rowTitle {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rowSub {
  font-size: 11px;
  color: var(--color-font-label);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track {
  height: 4px;
  margin-top: 3px;
  border-radius: 2px;
  background: var(--color-border);
  overflow: hidden;
}

.trackFill {
  height: 100%;
  border-radius: 2px;
  background: var(--color-primary);
}

.count {
  width: 34px;
  text-align: right;
  font-size: 11px;
  color: var(--color-font-label);
}

.empty {
  padding: 10px 0;
  font-size: 12px;
  color: var(--color-font-label);
}

.hours {
  display: flex;
  align-items: flex-end;
  height: 56px;
  gap: 1px;
}

.hourCol {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
}

.hourBar {
  width: 70%;
  min-height: 1px;
  border-radius: 1px;
  background: var(--color-primary);
}

.hourLabel {
  font-size: 9px;
  color: var(--color-font-label);
  margin-top: 2px;
}
</style>
