/**
 * 音质体系（与手机版 1.22.x 对齐）
 *
 * 档位由低到高：128K → 192K → 320K → FLAC → FLAC 24bit → Hi-Res → Atmos → Atmos+ → Master
 * ape / wav 为本地或特殊音源，排在无损档位附近，仅用于展示与排序。
 *
 * 桌面版原来的音质上限只有 flac24bit，这里把手机版支持的
 * Hi-Res / 臻品全景声 / 臻品母带 一并补齐：类型、设置、下载弹窗、
 * 自定义音源声明、请求回退链全部走这一份定义，避免各页面各写一套。
 */
// common.d.ts 是全局声明文件（不是模块），这里直接用全局命名空间里的类型
type Quality = LX.Quality

/** 全部档位，由低到高 */
export const QUALITY_ORDER: Quality[] = [
  '128k',
  '192k',
  '320k',
  'flac',
  'flac24bit',
  'hires',
  'atmos',
  'atmos_plus',
  'master',
  'ape',
  'wav',
]

/** 播放音质可选档位，由高到低（192k 已并入 320k，ape/wav 仅音源特殊场景） */
export const PLAY_QUALITYS: Quality[] = [
  'master',
  'atmos_plus',
  'atmos',
  'hires',
  'flac24bit',
  'flac',
  '320k',
  '128k',
]

/** 下载音质可选档位，由高到低 */
export const DOWNLOAD_QUALITYS: Quality[] = [
  'master',
  'atmos_plus',
  'atmos',
  'hires',
  'flac24bit',
  'flac',
  'wav',
  'ape',
  '320k',
  '192k',
  '128k',
]

/** 尝试顺序：从高到低，用于「歌曲自身最高音质」判定 */
export const TRY_QUALITYS: Quality[] = [
  'master',
  'atmos_plus',
  'atmos',
  'hires',
  'flac24bit',
  'flac',
  '320k',
  '192k',
  '128k',
]

/** 中文全名，播放页徽标 / 下载列表 / 设置页共用 */
export const QUALITY_LABELS: Record<string, string> = {
  '128k': '128K 标准',
  '192k': '192K',
  '320k': '320K 高品质',
  flac: 'FLAC 无损',
  flac24bit: '24bit 无损',
  hires: 'Hi-Res 无损',
  atmos: '臻品全景声 Atmos',
  atmos_plus: '臻品全景声 Atmos+',
  master: '臻品母带 Master',
  ape: 'APE 无损',
  wav: 'WAV 无损',
  local: '本地',
}

/** 简写，用于空间紧张的徽标 */
export const QUALITY_SHORT_LABELS: Record<string, string> = {
  '128k': '128K',
  '192k': '192K',
  '320k': '320K',
  flac: 'FLAC',
  flac24bit: '24BIT',
  hires: 'Hi-Res',
  atmos: 'Atmos',
  atmos_plus: 'Atmos+',
  master: 'Master',
  ape: 'APE',
  wav: 'WAV',
  local: '本地',
}

/** 徽标主色：普通 / 无损 / 高解析 / 空间音频 / 母带 分级 */
export const QUALITY_COLORS: Record<string, string> = {
  '128k': '#8A94A6',
  '192k': '#8A94A6',
  '320k': '#2F7CF6',
  flac: '#12A150',
  flac24bit: '#0E9F6E',
  hires: '#C08A00',
  atmos: '#8B5CF6',
  atmos_plus: '#7C3AED',
  master: '#E5484D',
  ape: '#12A150',
  wav: '#12A150',
  local: '#8A94A6',
}

/** 下载文件后缀 */
export const QUALITY_EXT: Record<string, 'mp3' | 'flac' | 'ape' | 'wav'> = {
  '128k': 'mp3',
  '192k': 'mp3',
  '320k': 'mp3',
  flac: 'flac',
  flac24bit: 'flac',
  hires: 'flac',
  atmos: 'flac',
  atmos_plus: 'flac',
  master: 'flac',
  ape: 'ape',
  wav: 'wav',
}

export const getQualityLabel = (quality?: string | null) => {
  if (!quality) return ''
  return QUALITY_LABELS[quality] ?? quality
}

export const getQualityShortLabel = (quality?: string | null) => {
  if (!quality) return ''
  return QUALITY_SHORT_LABELS[quality] ?? quality
}

export const getQualityColor = (quality?: string | null) => {
  if (!quality) return QUALITY_COLORS['128k']
  return QUALITY_COLORS[quality] ?? QUALITY_COLORS['128k']
}

export const getQualityExt = (quality?: string | null): 'mp3' | 'flac' | 'ape' | 'wav' => {
  if (!quality) return 'mp3'
  return QUALITY_EXT[quality] ?? 'mp3'
}

/** 档位在「高→低」列表里的序号，越小越高 */
export const qualityRank = (quality: string) => {
  const index = TRY_QUALITYS.indexOf(quality as Quality)
  return index < 0 ? TRY_QUALITYS.length : index
}

/**
 * 歌曲自身元信息里支持的最高档位（不看音源声明）
 */
export const getSongQuality = (musicInfo: { meta?: { _qualitys?: Record<string, unknown> } }): Quality => {
  const qualitys = musicInfo.meta?._qualitys ?? {}
  return TRY_QUALITYS.find(q => qualitys[q]) ?? '128k'
}

/**
 * 请求高档位失败后的回退链
 *
 * 顺序：音源声明里低于请求档位的最高一档 → 歌曲自身元信息的最高档 → 128k 保底。
 * 与手机版 1.22.16 一致，最多 3 次请求，失败都是快速报错，不会长时间卡播放。
 */
export const getQualityFallbacks = (
  targetQuality: Quality,
  musicInfo: { meta?: { _qualitys?: Record<string, unknown> } },
  declaredList?: Quality[],
): Quality[] => {
  const startIndex = TRY_QUALITYS.indexOf(targetQuality)
  if (startIndex < 0) return ['128k']
  const lower = TRY_QUALITYS.slice(startIndex + 1)
  const qualitys = musicInfo.meta?._qualitys ?? {}
  const chain: Quality[] = []
  const declared = lower.find(q => declaredList?.includes(q))
  if (declared) chain.push(declared)
  const songBest = lower.find(q => qualitys[q])
  if (songBest && !chain.includes(songBest)) chain.push(songBest)
  if (!chain.includes('128k')) chain.push('128k')
  return chain
}
