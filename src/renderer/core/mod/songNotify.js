/* eslint-env browser */
/**
 * 听歌播报（与手机版「设置 → 播放 → 听歌播报」对齐）
 *
 * 桌面端直接使用 Chromium 的 speechSynthesis：
 * Windows 走 SAPI、macOS 走系统语音、Linux 走 speech-dispatcher。
 * 没有可用语音引擎时静默失败，不影响播放。
 */
import { watch } from '@common/utils/vueTools'
import { playMusicInfo } from '@renderer/store/player/state'
import { modSetting } from './settings'

let lastKey = ''
let inited = false

const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window

export const speak = (text) => {
  if (!canSpeak() || !text) return
  try {
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'zh-CN'
    utter.rate = Math.min(2, Math.max(0.5, Number(modSetting.songNotifyRate) || 1))
    utter.volume = 1
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utter)
  } catch (err) {
    console.warn('speak failed', err)
  }
}

export const stopSpeak = () => {
  if (!canSpeak()) return
  try {
    window.speechSynthesis.cancel()
  } catch {}
}

export const initSongNotify = () => {
  if (inited) return
  inited = true

  watch(() => playMusicInfo.musicInfo, (musicInfo) => {
    if (!musicInfo) {
      lastKey = ''
      return
    }
    const key = `${musicInfo.id}_${musicInfo.source}`
    if (key == lastKey) return
    lastKey = key
    // 本地歌曲也播报，手机版同样处理
    if (!modSetting.songNotify) return
    speak(`正在播放 ${musicInfo.name}${musicInfo.singer ? '，' + musicInfo.singer : ''}`)
  })
}
