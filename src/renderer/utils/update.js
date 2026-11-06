import { compareVer } from '@common/utils'
import { httpGet } from './request'

// 二改版自己的更新清单，不再读上游 lyswhut 的版本信息。
// 主源与手机版共用同一个下载站（af384…），页面和 downloads/desktop-version.json 都在这里，
// 发版时能一起改；早期的电脑版专用站 aa9247… 已弃用（站点在别的环境，清单会一直停住，
// 会出现「提示有新版本、点下载还是旧包」）。
// 分享网关要求带 sharecode：应用内请求没有浏览器 cookie，不带会被挡在「链接不完整」页。
// 备用源用 GitHub Release 的 latest/download 永久直链；它会 302 到 CDN，
// 而 needle 默认 follow_max=0 不跟随重定向，所以在 request 里显式放行。
const address = [
  ['https://af384ee6deb6e09e2.app.workbuddy.host/downloads/desktop-version.json?sharecode=MKPWEVLBUS', 'direct'],
  ['https://github.com/yzdz666/lx-music-desktop-mod/releases/latest/download/desktop-version.json', 'direct'],
]

const request = async(url, retryNum = 0) => {
  return new Promise((resolve, reject) => {
    httpGet(url, {
      timeout: 8000,
      follow_max: 5,
    }, (err, resp, body) => {
      if (err || resp.statusCode != 200) {
        ++retryNum >= 2
          ? reject(err || new Error(resp.statusMessage || resp.statusCode))
          : request(url, retryNum).then(resolve).catch(reject)
      } else resolve(body)
    })
  })
}

const getDirectInfo = async(url) => {
  return request(url).then(info => {
    if (info.version == null) throw new Error('failed')
    return info
  })
}

const getNpmPkgInfo = async(url) => {
  return request(url).then(json => {
    if (!json.versionInfo) throw new Error('failed')
    const info = JSON.parse(json.versionInfo)
    if (info.version == null) throw new Error('failed')
    return info
  })
}

const loadInfo = (url, source) => {
  return source === 'npm' ? getNpmPkgInfo(url) : getDirectInfo(url)
}

const withTimeout = (promise, ms) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { reject(new Error('timeout')) }, ms)
    promise.then(value => {
      clearTimeout(timer)
      resolve(value)
    }, err => {
      clearTimeout(timer)
      reject(err)
    })
  })
}

const getVer = info => info.modVersion || info.version

export const getVersionInfo = async() => {
  // 主站清单可能还没跟上（例如刚发版），只认主站会漏掉新版本；
  // 只认 GitHub 又可能被网络挡住。两边同时取，谁的版本号高用谁，单边失败不影响结果。
  const list = await Promise.all(address.map(([url, source], index) => {
    return withTimeout(loadInfo(url, source), index === 0 ? 8000 : 6000)
      .then(info => ({ info }), () => null)
  }))
  let best = null
  for (const item of list) {
    if (!item) continue
    if (!best || compareVer(getVer(item.info), getVer(best)) > 0) best = item.info
  }
  if (!best) throw new Error('failed')
  return best
}

// getVersionInfo().then(info => {
//   console.log(info)
// })
