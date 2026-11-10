<template lang="pug">
dt#report {{ $t('setting__play_report') }}
dd
  .p.small {{ $t('setting__play_report_tip') }}
dd
  div
    base-btn.btn.gap-left(min @click="show = true") {{ $t('setting__play_report_open') }}
    base-btn.btn.gap-left(min @click="handleClear") {{ $t('setting__play_report_clear') }}
PlayReportModal(v-model:show="show")
</template>

<script>
import { ref } from '@common/utils/vueTools'
import { useI18n } from '@renderer/plugins/i18n'
import { dialog } from '@renderer/plugins/Dialog'
import { clearPlayStats } from '@renderer/core/mod/playStats'
import PlayReportModal from './PlayReportModal.vue'

export default {
  name: 'SettingReport',
  components: { PlayReportModal },
  setup() {
    const t = useI18n()
    const show = ref(false)

    const handleClear = async() => {
      const confirm = await dialog({
        message: t('setting__play_report_clear_confirm'),
        showCancel: true,
        confirmButtonText: t('setting__play_report_clear'),
      })
      if (!confirm) return
      clearPlayStats()
    }

    return { show, handleClear }
  },
}
</script>
