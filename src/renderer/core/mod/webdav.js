/* eslint-env browser */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { request } from './http'
import { modSetting } from './settings'

const decodeXml = (input) => input
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
  .replace(/&amp;/g, '&')

const authHeaders = () => {
  const { webdavUser, webdavPass } = modSetting
  if (!webdavUser) return {}
  return { Authorization: 'Basic ' + Buffer.from(`${webdavUser}:${webdavPass}`).toString('base64') }
}

const normalizeBase = (url) => {
  let value = (url || '').trim()
  if (!value) throw new Error('请先填写 WebDAV 地址')
  if (!/^https?:\/\//i.test(value)) value = 'https://' + value
  return value.endsWith('/') ? value : value + '/'
}

const propfind = async(url) => {
  const res = await request(url, {
    method: 'PROPFIND',
    headers: {
      ...authHeaders(),
      Depth: '1',
      'Content-Type': 'application/xml; charset=utf-8',
    },
    body: '<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:displayname/><d:getcontentlength/><d:getcontenttype/><d:resourcetype/><d:getlastmodified/></d:prop></d:propfind>',
    timeout: 20000,
  })
  if (res.status == 401) throw new Error('账号或密码不正确（HTTP 401）')
  if (res.status == 404) throw new Error('目录不存在（HTTP 404）')
  if (res.status >= 400) throw new Error(`WebDAV 返回 HTTP ${res.status}`)
  return res.text
}

const parseEntries = (xml, baseUrl) => {
  const list = []
  const blocks = xml.split(/<d:response[\s>]/i).slice(1)
  const basePath = new URL(baseUrl).pathname
  for (const block of blocks) {
    const hrefMatch = /<d:href>([\s\S]*?)<\/d:href>/i.exec(block)
    if (!hrefMatch) continue
    const href = decodeXml(hrefMatch[1].trim())
    let pathname = href
    try {
      pathname = new URL(href, baseUrl).pathname
    } catch (err) {}
    if (decodeURIComponent(pathname).replace(/\/$/, '') == decodeURIComponent(basePath).replace(/\/$/, '')) continue
    const isDir = /<d:collection\s*\/?>/i.test(block)
    const nameMatch = /<d:displayname>([\s\S]*?)<\/d:displayname>/i.exec(block)
    const sizeMatch = /<d:getcontentlength>(\d+)<\/d:getcontentlength>/i.exec(block)
    const typeMatch = /<d:getcontenttype>([\s\S]*?)<\/d:getcontenttype>/i.exec(block)
    const modifiedMatch = /<d:getlastmodified>([\s\S]*?)<\/d:getlastmodified>/i.exec(block)
    let name = nameMatch ? decodeXml(nameMatch[1]) : decodeURIComponent(pathname.split('/').filter(Boolean).pop() || '')
    if (!name) continue
    list.push({
      name,
      path: decodeURIComponent(pathname),
      url: new URL(href, baseUrl).toString(),
      isDir,
      size: sizeMatch ? Number(sizeMatch[1]) : 0,
      type: typeMatch ? decodeXml(typeMatch[1]) : '',
      modified: modifiedMatch ? decodeXml(modifiedMatch[1]) : '',
    })
  }
  list.sort((a, b) => {
    if (a.isDir != b.isDir) return a.isDir ? -1 : 1
    return a.name.localeCompare(b.name, 'zh-Hans-CN')
  })
  return list
}

export const isAudioFile = (name) => /\.(mp3|flac|wav|ape|m4a|aac|ogg|opus|wma)$/i.test(name || '')

/**
 * 列出 WebDAV 目录
 * @param {string} url 目录地址，为空时用设置里的根地址
 */
export const listDir = async(url) => {
  const target = normalizeBase(url || modSetting.webdavUrl)
  if (!url) modSetting.webdavUrl = target
  const xml = await propfind(target)
  return parseEntries(xml, target)
}

export const testConnection = async() => {
  const list = await listDir(modSetting.webdavUrl)
  return list.length
}

/**
 * 下载 WebDAV 文件到本地缓存，返回本地路径（用于播放/导入）
 */
export const downloadToCache = async(fileUrl, fileName) => {
  const dir = path.join(os.tmpdir(), 'lxmod-webdav')
  await fs.promises.mkdir(dir, { recursive: true })
  const safeName = (fileName || 'audio').replace(/[\\/:*?"<>|]/g, '_')
  const hash = crypto.createHash('md5').update(fileUrl).digest('hex').slice(0, 8)
  const target = path.join(dir, `${hash}-${safeName}`)
  try {
    const stat = await fs.promises.stat(target)
    if (stat.size > 0) return target
  } catch (err) {}
  const res = await request(fileUrl, { headers: authHeaders(), timeout: 120000 })
  if (res.status >= 400) throw new Error(`下载失败（HTTP ${res.status}）`)
  await fs.promises.writeFile(target, res.body)
  return target
}
