/* eslint-env browser */
import http from 'node:http'
import https from 'node:https'
import { URL } from 'node:url'

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: '*/*',
  'Accept-Encoding': 'identity',
}

/**
 * 通用 HTTP 请求（走 Node 原生模块，天然没有浏览器的 CORS 限制）
 * @param {string} url
 * @param {{method?: string, headers?: Record<string, string>, body?: any, timeout?: number, redirect?: number}} options
 * @returns {Promise<{status: number, headers: Record<string, any>, body: Buffer, text: string}>}
 */
export const request = (url, options = {}) => {
  const {
    method = 'GET',
    headers = {},
    body = null,
    timeout = 20000,
    redirect = 5,
  } = options

  return new Promise((resolve, reject) => {
    let target
    try {
      target = new URL(url)
    } catch (err) {
      reject(new Error('地址格式不正确: ' + url))
      return
    }
    const isHttps = target.protocol == 'https:'
    const lib = isHttps ? https : http
    const payload = body == null ? null : (Buffer.isBuffer(body) ? body : Buffer.from(typeof body == 'string' ? body : JSON.stringify(body)))
    const req = lib.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (isHttps ? 443 : 80),
      path: target.pathname + target.search,
      method,
      headers: {
        ...DEFAULT_HEADERS,
        ...(payload ? { 'Content-Length': payload.length } : {}),
        ...headers,
      },
      timeout,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirect > 0) {
        res.resume()
        const next = new URL(res.headers.location, url).toString()
        resolve(request(next, { ...options, redirect: redirect - 1 }))
        return
      }
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => {
        const buf = Buffer.concat(chunks)
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: buf,
          text: buf.toString('utf8'),
        })
      })
      res.on('error', reject)
    })
    req.on('timeout', () => {
      req.destroy(new Error('请求超时'))
    })
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

export const requestJson = async(url, options = {}) => {
  const res = await request(url, options)
  try {
    return JSON.parse(res.text)
  } catch (err) {
    throw new Error(`接口返回异常 (HTTP ${res.status}): ${res.text.slice(0, 120)}`)
  }
}
