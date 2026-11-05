
export const getNow = typeof performance == 'object' && window.performance.now ? window.performance.now.bind(window.performance) : Date.now.bind(Date)

export class TimeoutTools {
  constructor(thresholdTime = 80) {
    this.nextTick = window.requestAnimationFrame.bind(window)
    this.cancelNextTick = window.cancelAnimationFrame.bind(window)
    this.invokeTime = 0
    this.animationFrameId = null
    this.timeoutId = null
    this.callback = null
    this.thresholdTime = thresholdTime
  }

  run() {
    this.animationFrameId = this.nextTick(() => {
      this.animationFrameId = null
      // 链被 clear() 之后仍可能有已入队的回调跑进来，回调没了就直接退出
      if (typeof this.callback !== 'function') return
      let diff = this.invokeTime - getNow()
      // console.log('diff', diff)
      if (diff > 0) {
        if (diff < this.thresholdTime) return this.run()
        // console.log('run timeout', diff, diff - this.thresholdTime)
        return this.timeoutId = window.setTimeout(() => {
          this.timeoutId = null
          this.run()
        }, diff - this.thresholdTime)
      }

      // console.log('diff', diff)
      this.callback(diff)
    })
  }

  start(callback = () => {}, timeout = 0) {
    // console.log(timeout)
    // 起新链前先清旧链，避免上一轮已入队的 rAF 在切歌后继续跑
    this.clear()
    this.callback = callback
    this.invokeTime = getNow() + timeout

    this.run()
  }

  clear() {
    if (this.animationFrameId) {
      this.cancelNextTick(this.animationFrameId)
      this.animationFrameId = null
    }
    if (this.timeoutId) {
      window.clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
    this.callback = null
  }
}

