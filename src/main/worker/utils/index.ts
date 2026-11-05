import { Worker } from 'node:worker_threads'
import * as Comlink from 'comlink'
import nodeEndpoint from 'comlink/dist/esm/node-adapter'
import { log } from '@common/utils'

export type DBSeriveTypes = Comlink.Remote<LX.WorkerDBSeriveListTypes>

let workerError: Error | null = null

/**
 * 取数据库 worker 的启动错误。
 *
 * worker 在加载阶段（例如原生模块 better-sqlite3 与 Electron ABI 不匹配）抛错时，
 * Comlink 的调用会永远不返回，主进程就卡在 initAppSetting 里 —— 表现是
 * 任务管理器里有 Electron 进程、但一个窗口都没有。这里把错误留出来，
 * 让 initAppSetting 能超时失败并给出提示，而不是静默卡死。
 */
export const getDBServiceWorkerError = () => workerError

export const createDBServiceWorker = () => {
  const worker: Worker = new Worker(new URL(
    /* webpackChunkName: 'dbService.worker' */
    '../dbService',
    import.meta.url,
  ))
  worker.on('error', err => {
    workerError = err
    log.error('dbService worker error:', err)
  })
  worker.on('exit', code => {
    if (code !== 0 && workerError == null) {
      workerError = new Error(`dbService worker exited with code ${code}`)
      log.error(workerError)
    }
  })
  return Comlink.wrap<LX.WorkerDBSeriveListTypes>(nodeEndpoint(worker))
}
