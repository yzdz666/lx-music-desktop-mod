import { DOWNLOAD_STATUS, QUALITYS } from '@common/constants'
import { getQualityExt } from '@common/quality'
import { filterFileName } from '@common/utils/common'
import { buildLyrics } from './lrcTool'
import fs from 'fs'
import { clipFileNameLength, clipNameLength, formatMusicName } from '@common/utils/tools'

/**
 * 保存歌词文件
 */
export const saveLrc = async(lrcData: LX.Music.LyricInfo, info: {
  filePath: string
  format: LX.LyricFormat
  downloadLxlrc: boolean
  downloadTlrc: boolean
  downloadRlrc: boolean
}) => {
  const iconv = (await import('iconv-lite')).default
  const lrc = buildLyrics(lrcData, info.downloadLxlrc, info.downloadTlrc, info.downloadRlrc)
  switch (info.format) {
    case 'gbk':
      fs.writeFile(info.filePath, iconv.encode(lrc, 'gbk', { addBOM: true }), err => {
        if (err) console.log(err)
      })
      break
    case 'utf8':
    default:
      fs.writeFile(info.filePath, iconv.encode(lrc, 'utf8', { addBOM: true }), err => {
        if (err) console.log(err)
      })
      break
  }
}

export const getExt = (type: string): LX.Download.FileExt => getQualityExt(type) as LX.Download.FileExt

/**
 * 获取音乐音质
 * @param musicInfo
 * @param type
 * @param qualityList
 */
/**
 * 计算下载任务的目标音质（与手机版 1.22.17 对齐）
 *
 * 选到歌曲/音源没声明的档位时照样按用户档位建任务，取链失败由上层
 * 回退链降级——自定义音源的声明普遍落后于实际能力，提前降级会让
 * 「播放能出母带、下载只能出 FLAC」。
 */
export const getMusicType = (musicInfo: LX.Music.MusicInfoOnline, type: LX.Quality, qualityList: LX.QualityList): LX.Quality => {
  if (!type) return '128k'
  if (!QUALITYS.includes(type as typeof QUALITYS[number])) return '128k'
  return type
}

// const checkExistList = (list: LX.Download.ListItem[], musicInfo: LX.Music.MusicInfo, type: LX.Quality, ext: string): boolean => {
//   return list.some(s => s.id === musicInfo.id && (s.metadata.type === type || s.metadata.ext === ext))
// }

export const createDownloadInfo = (musicInfo: LX.Music.MusicInfoOnline, type: LX.Quality, fileName: string, qualityList: LX.QualityList, listId?: string) => {
  type = getMusicType(musicInfo, type, qualityList)
  let ext = getExt(type)
  const key = `${musicInfo.id}_${type}_${ext}`
  // if (checkExistList(list, musicInfo, type, ext)) return null
  const downloadInfo: LX.Download.ListItem = {
    id: key,
    isComplate: false,
    status: DOWNLOAD_STATUS.WAITING,
    statusText: '待下载',
    downloaded: 0,
    total: 0,
    progress: 0,
    speed: '',
    writeQueue: 0,
    metadata: {
      musicInfo,
      url: null,
      quality: type,
      ext,
      filePath: '',
      listId,
      fileName: filterFileName(`${clipFileNameLength(formatMusicName(fileName, musicInfo.name, clipNameLength(musicInfo.singer)))}.${ext}`),
    },
  }
  // downloadInfo.metadata.filePath = joinPath(savePath, downloadInfo.metadata.fileName)
  // commit('addTask', downloadInfo)

  // 删除同路径下的同名文件
  // TODO
  // void removeFile(downloadInfo.metadata.filePath)
  // .catch(err => {
  //   if (err.code !== 'ENOENT') {
  //     return commit('setStatusText', { downloadInfo, text: '文件删除失败' })
  //   }
  // })

  return downloadInfo
}
