// @flow

class CanceledError extends Error {
  constructor() {
    super('throttled invocation was canceled')
    this.name = 'CanceledError'
  }
}

class Delay {
  ready: ?Promise<void>
  resolve: () => void
  canceled: boolean = false
  timeout: TimeoutID

  constructor(lastInvocationDone: Promise<any>, wait: number) {
    const delay = new Promise((resolve: () => void) => {
      this.timeout = setTimeout(resolve, wait)
      this.resolve = resolve
    })
    this.ready = lastInvocationDone
      .then(
        () => delay,
        () => delay
      )
      .then(() => {
        this.ready = null
      })
  }

  flush() {
    clearTimeout(this.timeout)
    this.resolve()
  }

  cancel() {
    this.canceled = true
    clearTimeout(this.timeout)
    this.resolve()
  }

  then<T>(handler: () => Promise<T>): Promise<T> {
    return (this.ready || Promise.resolve()).then((): Promise<T> => {
      if (this.canceled) throw new CanceledError()
      return handler()
    })
  }
}

function throttle<Args: Array<any>, Value>(
  fn: (...args: Args) => Value | Promise<Value>,
  _wait: ?number,
  options: {
    getNextArgs?: (args0: Args, args1: Args) => Args,
  } = {}
): {
  (...args: Args): Promise<Value>,
  cancel: () => Promise<void>,
  flush: () => Promise<void>,
} {
  const wait = _wait != null && Number.isFinite(_wait) ? Math.max(_wait, 0) : 0
  const getNextArgs = options.getNextArgs || ((prev, next) => next)

  let nextArgs: ?Args
  let lastInvocationDone: ?Promise<any> = null
  let delay: ?Delay = null
  let nextInvocation: ?Promise<Value> = null

  function invoke(): Promise<Value> {
    const args = nextArgs
    // istanbul ignore next
    if (!args) throw new Error('unexpected error: nextArgs is null')
    nextInvocation = null
    nextArgs = null
    const result = Promise.resolve(fn(...args))
    lastInvocationDone = result
      .catch(() => {})
      .then(() => {
        lastInvocationDone = null
      })
    delay = new Delay(lastInvocationDone, wait)
    return result
  }

  function wrapper(...args: Args): Promise<Value> {
    try {
      nextArgs = nextArgs ? getNextArgs(nextArgs, args) : args
    } catch (error) {
      return Promise.reject(error)
    }
    if (!nextArgs)
      return Promise.reject(new Error('unexpected error: nextArgs is null'))
    if (nextInvocation) return nextInvocation
    return (nextInvocation = (delay || Promise.resolve()).then(invoke))
  }

  wrapper.cancel = async (): Promise<void> => {
    const prevLastInvocationDone = lastInvocationDone
    delay?.cancel?.()
    nextInvocation = null
    nextArgs = null
    lastInvocationDone = null
    delay = null
    await prevLastInvocationDone
  }

  wrapper.flush = async (): Promise<void> => {
    delay?.flush?.()
    await lastInvocationDone
  }

  return wrapper
}
;(throttle: any).CanceledError = CanceledError

module.exports = ((throttle: any): {
  <Args: Array<any>, Value>(
    fn: (...args: Args) => Promise<Value>,
    wait: ?number,
    options?: {
      getNextArgs?: (args0: Args, args1: Args) => Args,
    }
  ): {
    (...args: Args): Promise<Value>,
    cancel: () => Promise<void>,
    flush: () => Promise<void>,
  },
  CanceledError: typeof CanceledError,
})
