<template>
  <material-modal :show="show" :bg-close="bgClose" :teleport="teleport" @close="handleClose">
    <main :class="$style.main">
      <h2>{{ info.name }}<br>{{ info.singer }}</h2>
      <base-btn v-if="bestQuality" :class="$style.btn" @click="handleClick(bestQuality)">
        {{ $t('download__best_quality') }} - {{ getQualityLabel(bestQuality) }}
      </base-btn>
      <base-btn v-for="quality in qualitys" :key="quality" :class="$style.btn" @click="handleClick(quality)">
        {{ getQualityLabel(quality) }}
      </base-btn>
    </main>
  </material-modal>
</template>

<script>
import { createDownloadTasks } from '@renderer/store/download/action'
import { DOWNLOAD_QUALITYS, getQualityLabel } from '@common/quality'

export default {
  props: {
    show: {
      type: Boolean,
      default: false,
    },
    musicInfo: {
      type: [Object, null],
      required: true,
    },
    listId: {
      type: String,
      default: '',
    },
    bgClose: {
      type: Boolean,
      default: true,
    },
    teleport: {
      type: String,
      default: '#root',
    },
  },
  emits: ['update:show'],
  computed: {
    info() {
      return this.musicInfo || {}
    },
    // 与手机版一致：固定展示全部可选档位，不看歌曲/音源声明。
    // 选到不支持的档位时由下载环节按回退链降级，不会静默变成 128K。
    qualitys() {
      return DOWNLOAD_QUALITYS
    },
    bestQuality() {
      const qualitys = this.info.meta?._qualitys ?? {}
      return DOWNLOAD_QUALITYS.find(quality => qualitys[quality]) ?? ''
    },
  },
  methods: {
    handleClick(quality) {
      void createDownloadTasks([this.musicInfo], quality, this.listId)
      this.handleClose()
    },
    handleClose() {
      this.$emit('update:show', false)
    },
    getQualityLabel,
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.main {
  padding: 15px;
  max-width: 400px;
  min-width: 200px;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  h2 {
    font-size: 13px;
    color: var(--color-font);
    line-height: 1.3;
    text-align: center;
    margin-bottom: 15px;
  }
}

.btn {
  display: block;
  margin-bottom: 15px;
  &:last-child {
    margin-bottom: 0;
  }
}

</style>
