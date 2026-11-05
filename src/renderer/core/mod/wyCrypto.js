/* eslint-env browser */
/**
 * 网易云 weapi 加密（与手机版同一套算法，Node 侧用 crypto 实现）
 *
 * 参考 NeteaseCloudMusicApi：aes-128-cbc 两次 + RSA 加密随机密钥。
 * 桌面版之前只用裸 /api/ 明文接口，登录态相关的一批接口（我喜欢的、
 * 我的歌单、收藏专辑、关注歌手）拿不到数据，这里统一走 weapi。
 */
import crypto from 'node:crypto'

const IV = Buffer.from('0102030405060708')
const PRESET_KEY = Buffer.from('0CoJUm6Qyw8W8jud')
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDgtQn2JZ34ZC28NWYpAUd98iZ37BUrX/aKzmFbt7clFSs6sXqHauqKWqdtLkF2KexO40H1YTX8z2lSgBBOAxLsvaklV8k4cBFK9snQXE9/DDaFt6Rr7iVZMldczhC0JNgTz+SHXT6CBHuX3e9SdB1Ua44oncaTWz7OBGLbCiK45wIDAQAB
-----END PUBLIC KEY-----`

const aesEncrypt = (text, key) => {
  const cipher = crypto.createCipheriv('aes-128-cbc', key, IV)
  return Buffer.concat([cipher.update(Buffer.from(text)), cipher.final()]).toString('base64')
}

const rsaEncrypt = (text) => {
  const buffer = Buffer.concat([Buffer.alloc(128 - Buffer.byteLength(text)), Buffer.from(text)])
  return crypto.publicEncrypt({ key: PUBLIC_KEY, padding: crypto.constants.RSA_NO_PADDING }, buffer).toString('hex')
}

const randomKey = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let key = ''
  for (let i = 0; i < 16; i++) key += chars[Math.floor(Math.random() * chars.length)]
  return key
}

/**
 * @param {Record<string, any>} object 业务参数
 * @returns {string} application/x-www-form-urlencoded 的 body
 */
export const weapi = (object) => {
  const text = JSON.stringify(object)
  const secretKey = randomKey()
  const params = aesEncrypt(aesEncrypt(text, PRESET_KEY), Buffer.from(secretKey))
  const encSecKey = rsaEncrypt(secretKey.split('').reverse().join(''))
  return `params=${encodeURIComponent(params)}&encSecKey=${encodeURIComponent(encSecKey)}`
}
