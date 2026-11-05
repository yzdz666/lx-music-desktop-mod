import { createDBServiceWorker, getDBServiceWorkerError } from './utils'

export { getDBServiceWorkerError }

export default () => {
  return {
    dbService: createDBServiceWorker(),
  }
}
