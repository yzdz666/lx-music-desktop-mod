<template lang="pug">
dd
  h3#cloud_sync {{ $t('setting__cloud_sync') }}
  .p.small {{ $t('setting__cloud_sync_tip') }}
dd
  h3 {{ $t('setting__cloud_sync_server') }}
  div
    .p.small {{ $t('setting__cloud_sync_url') }}
    base-input(:model-value="appSetting['sync.cloudUrl']" :placeholder="defaultUrl" @update:model-value="setUrl")
  div
    .p.small {{ $t('setting__cloud_sync_code') }}
    base-input(:model-value="appSetting['sync.cloudCode']" :placeholder="$t('setting__cloud_sync_code_ph')" @update:model-value="setCode")
  div
    .p.small {{ $t('setting__cloud_sync_secret') }}
    base-input(:model-value="appSetting['sync.cloudSecret']" :placeholder="$t('setting__cloud_sync_secret_ph')" @update:model-value="setSecret")
  div
    base-checkbox(id="setting_cloud_sync_auto" :model-value="appSetting['sync.cloudAuto'] === 'on'" :label="$t('setting__cloud_sync_auto')" @update:model-value="setAuto")
dd
  h3 {{ $t('setting__cloud_sync_action') }}
  div
    base-btn.btn.gap-left(min :disabled="busy" @click="handleSync") {{ busy ? $t('setting__cloud_sync_busy') : $t('setting__cloud_sync_now') }}
    base-btn.btn.gap-left(min :disabled="busy" @click="handleInfo") {{ $t('setting__cloud_sync_info') }}
    base-btn.btn.gap-left(min :disabled="busy" @click="handleCreate") {{ $t('setting__cloud_sync_create') }}
    base-btn.btn.gap-left(min :disabled="busy" @click="handlePushAll") {{ $t('setting__cloud_sync_push_all') }}
    base-btn.btn.gap-left(min :disabled="busy" @click="handleReset") {{ $t('setting__cloud_sync_reset') }}
  .p.small {{ statusText }}
</template>

<script>
import { ref, computed } from '@common/utils/vueTools'
import { useI18n } from '@renderer/plugins/i18n'
import { dialog } from '@renderer/plugins/Dialog'
import { appSetting, updateSetting } from '@renderer/store/setting'
import {
  createCloudSpace,
  pushAllToCloud,
  readCloudSpaceInfo,
  resetCloudSync,
  syncCloud,
  DEFAULT_SYNC_URL,
} from '@renderer/core/mod/cloudSync'

const formatTime = (at) => {
  const d = new Date(at)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export default {
  name: 'SettingCloudSync',
  setup() {
    const t = useI18n()
    const busy = ref(false)
    const info = ref(null)

    const setUrl = (value) => { updateSetting({ 'sync.cloudUrl': value.trim() }) }
    const setCode = (value) => { updateSetting({ 'sync.cloudCode': value.trim().toUpperCase() }) }
    const setSecret = (value) => { updateSetting({ 'sync.cloudSecret': value.trim() }) }
    const setAuto = (value) => { updateSetting({ 'sync.cloudAuto': value ? 'on' : 'off' }) }

    const run = async(action) => {
      if (busy.value) return
      busy.value = true
      try {
        await action()
      } catch (err) {
        void dialog({ message: t('setting__cloud_sync_failed', { msg: String(err?.message ?? err) }) })
      } finally {
        busy.value = false
      }
    }

    const handleSync = async() => {
      await run(async() => {
        const result = await syncCloud()
        info.value = null
        void dialog({
          message: t('setting__cloud_sync_ok', { lists: result.lists, songs: result.songs, settings: result.settings }),
        })
      })
    }

    const handleInfo = async() => {
      await run(async() => {
        const data = await readCloudSpaceInfo()
        info.value = data
        void dialog({
          message: t('setting__cloud_sync_space_info', {
            code: data.code,
            lists: data.lists,
            songs: data.songs,
            size: formatBytes(data.bytes),
          }),
        })
      })
    }

    const handleCreate = async() => {
      const confirm = await dialog({
        message: t('setting__cloud_sync_create_confirm'),
        showCancel: true,
        confirmButtonText: t('setting__cloud_sync_create'),
      })
      if (!confirm) return
      await run(async() => {
        const result = await createCloudSpace()
        void dialog({ message: t('setting__cloud_sync_create_ok', { code: result.code }) })
      })
    }

    const handlePushAll = async() => {
      const confirm = await dialog({
        message: t('setting__cloud_sync_push_all_confirm'),
        showCancel: true,
        confirmButtonText: t('setting__cloud_sync_push_all'),
      })
      if (!confirm) return
      await run(async() => {
        const result = await pushAllToCloud()
        void dialog({
          message: t('setting__cloud_sync_ok', { lists: result.lists, songs: result.songs, settings: result.settings }),
        })
      })
    }

    const handleReset = async() => {
      const confirm = await dialog({
        message: t('setting__cloud_sync_reset_confirm'),
        showCancel: true,
        confirmButtonText: t('setting__cloud_sync_reset'),
      })
      if (!confirm) return
      resetCloudSync()
      info.value = null
    }

    const statusText = computed(() => {
      if (info.value) {
        return t('setting__cloud_sync_space_info', {
          code: info.value.code,
          lists: info.value.lists,
          songs: info.value.songs,
          size: formatBytes(info.value.bytes),
        })
      }
      const at = Number(appSetting['sync.cloudLastAt']) || 0
      return at ? t('setting__cloud_sync_last', { time: formatTime(at) }) : t('setting__cloud_sync_never')
    })

    return {
      appSetting,
      busy,
      statusText,
      defaultUrl: DEFAULT_SYNC_URL,
      setUrl,
      setCode,
      setSecret,
      setAuto,
      handleSync,
      handleInfo,
      handleCreate,
      handlePushAll,
      handleReset,
    }
  },
}
</script>
