import { httpGet } from './request'

// 二改版自己的更新清单，不再读上游 lyswhut 的版本信息。
// 主站分享网关要求带 sharecode：应用内请求没有浏览器 cookie，不带会被挡在「链接不完整」页。
// 备用源用 GitHub Release 的 latest/download 永久直链；它会 302 到 CDN，
// 而 needle 默认 follow_max=0 不跟随重定向，所以在 request 里显式放行。
const address = [
  ['https://aa9247f7339b2cb18.app.workbuddy.host/downloads/desktop-version.json?sharecode=ER6OKBO4HG', 'direct'],
  ['https://github.com/yzdz666/lx-music-desktop-mod/releases/latest/download/desktop-version.json', 'direct'],
]

const request = async(url, retryNum = 0) => {
  return new Promise((resolve, reject) => {
    httpGet(url, {
      timeout: 10000,
      follow_max: 5,
    }, (err, resp, body) => {
      if (err || resp.statusCode != 200) {
        ++retryNum >= 3
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

export const getVersionInfo = async(index = 0) => {
  const [url, source] = address[index]
  let promise
  switch (source) {
    case 'direct':
      promise = getDirectInfo(url)
      break
    case 'npm':
      promise = getNpmPkgInfo(url)
      break
  }

  return promise.catch(async(err) => {
    index++
    if (index >= address.length) throw err
    return getVersionInfo(index)
  })
}

// getVersionInfo().then(info => {
//   console.log(info)
// })
