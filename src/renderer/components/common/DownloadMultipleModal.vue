<template>
  <material-modal :show="show" :bg-close="bgClose" :teleport="teleport" @close="handleClose">
    <main :class="$style.main">
      <h2>{{ $t('download__multiple_tip', { len: list.length }) }}<br>{{ $t('download__multiple_tip2') }}</h2>
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
    bgClose: {
      type: Boolean,
      default: true,
    },
    listId: {
      type: String,
      default: '',
    },
    list: {
      type: Array,
      default() {
        return []
      },
    },
    teleport: {
      type: String,
      default: '#root',
    },
  },
  emits: ['update:show', 'confirm'],
  data() {
    return {
      qualitys: DOWNLOAD_QUALITYS,
    }
  },
  methods: {
    getQualityLabel,
    handleClick(quality) {
      void createDownloadTasks(this.list.filter(item => item.source != 'local'), quality, this.listId)
      this.handleClose()
      this.$emit('confirm')
    },
    handleClose() {
      this.$emit('update:show', false)
    },
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
