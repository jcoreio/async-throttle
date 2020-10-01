// @flow

class CanceledError extends Error {
  constructor() {
    super('throttled invocation was canceled')
    this.name = 'CanceledError'
  }
}

class Delay {
  ready: Promise<void>
  _resolve: () => void
  _reject: Error => void
  _timeout: TimeoutID

  constructor(wait: number) {
    const promise = new Promise(
      (resolve: () => void, reject: Error => void) => {
        this._resolve = resolve
        this._reject = reject
        this._timeout = setTimeout(resolve, wait)
      }
    )
    promise.catch(() => {})
    this.ready = promise
  }

  flush() {
    clearTimeout(this._timeout)
    this._resolve()
  }

  cancel() {
    clearTimeout(this._timeout)
    this._reject(new CanceledError())
  }
}

function throttle<Args: Array<any>, Value>(
  fn: (...args: Args) => Promise<Value>,
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
  let delay: Delay = new Delay(0)
  const initialReady = delay.ready
  let lastPromise: Promise<any> = Promise.resolve()
  let readyPromise: Promise<any> = lastPromise.then(() => initialReady)
  let nextPromise: ?Promise<Value> = null

  function invoke(): Promise<Value> {
    const args = nextArgs
    if (!args) throw new Error('unexpected error: nextArgs is null')
    nextPromise = null
    nextArgs = null
    delay = new Delay(wait)
    const { ready } = delay
    const result = fn(...args)
    lastPromise = result.catch(() => {})
    readyPromise = lastPromise.then(() => ready)
    return result
  }

  async function wrapper(...args: Args): Promise<Value> {
    nextArgs = nextArgs ? getNextArgs(nextArgs, args) : args
    if (!nextArgs) throw new Error('unexpected error: nextArgs is null')
    if (!nextPromise) nextPromise = readyPromise.then(invoke)
    return nextPromise
  }

  wrapper.cancel = async (): Promise<void> => {
    const _lastPromise = lastPromise
    delay.cancel()
    nextPromise = null
    delay = new Delay(0)
    const { ready } = delay
    lastPromise = Promise.resolve()
    readyPromise = lastPromise.then(() => ready)
    await _lastPromise
  }

  wrapper.flush = async (): Promise<void> => {
    delay.flush()
    await lastPromise
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
