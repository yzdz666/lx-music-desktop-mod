/* eslint-env browser */
import fs from 'node:fs'
import path from 'node:path'
import { createLocalMusicInfo } from '@renderer/utils/music'

const AUDIO_EXT = new Set(['.mp3', '.flac', '.wav', '.ape', '.m4a', '.aac', '.ogg', '.opus', '.wma', '.mp4'])
const STORAGE_KEY = 'lxmod.localMusic.v1'
const MAX_CACHE = 5000

const readDir = async(dir) => {
  try {
    return await fs.promises.readdir(dir, { withFileTypes: true })
  } catch (err) {
    return []
  }
}

const collectFiles = async(dir, out, depth = 0) => {
  if (depth > 8 || out.length > MAX_CACHE) return
  const entries = await readDir(dir)
  for (const entry of entries) {
    if (out.length > MAX_CACHE) return
    if (entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await collectFiles(full, out, depth + 1)
    } else if (entry.isFile() && AUDIO_EXT.has(path.extname(entry.name).toLowerCase())) {
      out.push(full)
    }
  }
}

/**
 * 扫描目录里的音频文件并解析标签
 * @param {string[]} dirs
 * @param {(done: number, total: number) => void} onProgress
 */
export const scanLocalMusic = async(dirs, onProgress = () => {}) => {
  const files = []
  for (const dir of dirs) {
    if (!dir) continue
    await collectFiles(dir, files)
  }
  const list = []
  let done = 0
  for (const file of files) {
    const info = await createLocalMusicInfo(file).catch(() => null)
    if (info) list.push(info)
    done++
    if (done % 5 == 0 || done == files.length) onProgress(done, files.length)
  }
  list.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
  return list
}

export const loadLocalCache = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch (err) {
    return []
  }
}

export const saveLocalCache = (list) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_CACHE)))
  } catch (err) {
    console.warn('save local music cache failed', err)
  }
}

export const filterLocalMusic = (list, keyword) => {
  const key = (keyword || '').trim().toLowerCase()
  if (!key) return list
  return list.filter(item => `${item.name} ${item.singer} ${item.meta?.albumName ?? ''}`.toLowerCase().includes(key))
}
