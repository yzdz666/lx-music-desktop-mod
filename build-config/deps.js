const fs = require('fs')
const path = require('path')
const bindingFilePath = path.join(__dirname, '../node_modules/better-sqlite3/binding.gyp')
const bindingBakFilePath = path.join(__dirname, '../node_modules/better-sqlite3/binding.gyp.bak')
exports.beforePack = async() => {
  if (!fs.existsSync(bindingFilePath)) return
  fs.renameSync(bindingFilePath, bindingBakFilePath)
  // try {
  //   fs.writeFileSync(
  //     bindingFilePath,
  //     fs.readFileSync(bindingFilePath, 'utf-8').replace('\'force_build%\': 0,', '\'force_build%\': 1,'),
  //   )
  // } catch (error) {
  //   console.error(error)
  // }
}
exports.afterPack = async() => {
  if (fs.existsSync(bindingFilePath)) return
  fs.renameSync(bindingBakFilePath, bindingFilePath)
  // try {
  //   fs.writeFileSync(
  //     bindingFilePath,
  //     fs.readFileSync(bindingFilePath, 'utf-8').replace('\'force_build%\': 1,', '\'force_build%\': 0,'),
  //   )
  // } catch (error) {
  //   console.error(error)
  // }
}


const replaceSqliteLib = async(arch) => {
  // console.log(await fs.readdir(path.join(context.appOutDir, './resources/')))
  // if (context.electronPlatformName != 'linux' || context.arch != Arch.arm64) return
  // https://github.com/lyswhut/lx-music-desktop/issues/1102
  // https://github.com/lyswhut/lx-music-desktop/issues/1161
  console.log('replace sqlite lib...')
  const filePath = path.join(__dirname, `./lib/better_sqlite3_${process.platform}-${arch}.node`)
  console.log(filePath)
  const targetPath = path.join(__dirname, '../node_modules/better-sqlite3/build/Release/better_sqlite3.node')
  await fs.promises.unlink(targetPath).catch(_ => _)
  await fs.promises.copyFile(filePath, targetPath)
}
// 原生模块必须能在目标 Electron 里 dlopen。
//
// better-sqlite3 12 起自带的 prebuilds/*.node 走 Node-API（导出 napi_register_module_v1），
// ABI 与 Electron 大版本无关；而 build-config/lib 下那批旧产物是按 V8 ABI 编的
// （win32-x64 里是 node_register_module_v110），Electron 42 的 ABI 是 146，
// Windows 上 dlopen 直接失败 → 数据库 worker 起不来 → 只剩进程、没有窗口。
const isNapiBinding = file => {
  try {
    return fs.readFileSync(file).includes('napi_register_module_v1')
  } catch (_) {
    return false
  }
}

exports.isNapiBinding = isNapiBinding
exports.copyLib = async(arch = process.arch, replaceLocal = false, platform = process.platform) => {
  if (platform === 'linux' || replaceLocal) {
    await replaceSqliteLib(arch)
    return
  }
  const targetPath = path.join(__dirname, '../node_modules/better-sqlite3/build/Release/better_sqlite3.node')
  // 顺序很重要：先用 Node-API 预编译产物，再退回旧 lib（仅当它也是 Node-API）
  const candidates = [
    path.join(__dirname, `../node_modules/better-sqlite3/prebuilds/${platform}-${arch}.node`),
    path.join(__dirname, `./lib/better_sqlite3_${platform}-${arch}.node`),
  ]
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue
    const napi = isNapiBinding(file)
    // 非 Node-API 的预编译只有在 ABI 匹配时才能用，这里不冒险
    if (file.includes('prebuilds') && !napi) continue
    await fs.promises.cp(file, targetPath, { recursive: true, force: true })
    console.log(`sqlite binding <- ${path.relative(path.join(__dirname, '..'), file)} (napi=${napi})`)
    return
  }
  console.error(`Better-sqlite3 binding not found for ${platform}-${arch}`)
}
