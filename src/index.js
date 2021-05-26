// @flow

class CanceledError extends Error {
  constructor() {
    super('throttled invocation was canceled')
    this.name = 'CanceledError'
  }
}

class Delay {
  ready: Promise<void>
  effect: Promise<void> | void
  timeout: TimeoutID

  constructor(lastInvocationDone: Promise<any>, wait: number) {
    this.effect = new Promise(
      (resolve) => (this.timeout = setTimeout(resolve, wait))
    )
    this.ready = lastInvocationDone.then(() => this.effect)
  }

  flush() {
    clearTimeout(this.timeout)
    this.effect = undefined
  }

  cancel() {
    clearTimeout(this.timeout)
    this.effect = Promise.reject(new CanceledError())
    this.effect.catch(() => {})
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
  let lastInvocationDone: Promise<any> = Promise.resolve()
  let delay: Delay = new Delay(lastInvocationDone, 0)
  let nextInvocation: ?Promise<Value> = null

  function invoke(): Promise<Value> {
    const args = nextArgs
    // istanbul ignore next
    if (!args) throw new Error('unexpected error: nextArgs is null')
    nextInvocation = null
    nextArgs = null
    let result
    try {
      result = Promise.resolve(fn(...args))
    } catch (error) {
      result = Promise.reject(error)
    }
    lastInvocationDone = result.catch(() => {})
    delay = new Delay(lastInvocationDone, wait)
    return result
  }

  function wrapper(...args: Args): Promise<Value> {
    nextArgs = nextArgs ? getNextArgs(nextArgs, args) : args
    if (!nextArgs) throw new Error('unexpected error: nextArgs is null')
    if (!nextInvocation) nextInvocation = delay.ready.then(invoke)
    return nextInvocation
  }

  wrapper.cancel = async (): Promise<void> => {
    const _lastInvocationDone = lastInvocationDone
    delay.cancel()
    nextInvocation = null
    nextArgs = null
    lastInvocationDone = Promise.resolve()
    delay = new Delay(lastInvocationDone, 0)
    await _lastInvocationDone
  }

  wrapper.flush = async (): Promise<void> => {
    delay.flush()
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
