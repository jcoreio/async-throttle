class CanceledError extends Error {
  constructor() {
    super('throttled invocation was canceled')
    this.name = 'CanceledError'
  }
}

class Delay implements Promise<void> {
  ready: Promise<void> | undefined
  declare resolve: () => void
  canceled: boolean = false
  declare timeout: number | NodeJS.Timeout

  constructor(lastInvocationDone: Promise<any>, wait: number) {
    const delay = new Promise<void>((resolve) => {
      this.timeout = setTimeout(resolve, wait)
      this.resolve = resolve
    })
    this.ready = lastInvocationDone
      .then(
        () => delay,
        () => delay
      )
      .then(() => {
        this.ready = undefined
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

  get [Symbol.toStringTag]() {
    return 'Delay'
  }

  then<TResult1 = void, TResult2 = never>(
    onfulfilled?:
      | ((value: void) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null
  ): Promise<TResult1 | TResult2> {
    return (this.ready || Promise.resolve())
      .then(() => {
        if (this.canceled) throw new CanceledError()
      })
      .then(onfulfilled, onrejected)
  }

  catch<TResult = never>(
    onrejected?:
      | ((reason: any) => TResult | PromiseLike<TResult>)
      | undefined
      | null
  ): Promise<void | TResult> {
    return this.then(undefined, onrejected)
  }

  finally(onfinally?: (() => void) | undefined | null): Promise<void> {
    return this.then().finally(onfinally)
  }
}

function throttle<Args extends any[], Value>(
  fn: (...args: Args) => Value | Promise<Value>,
  _wait?: number | null | undefined,
  options: {
    getNextArgs?: (args0: Args, args1: Args) => Args
  } = {}
): {
  (...args: Args): Promise<Value>
  invokeIgnoreResult: (...args: Args) => void
  cancel: () => Promise<void>
  flush: () => Promise<void>
} {
  const wait = _wait != null && Number.isFinite(_wait) ? Math.max(_wait, 0) : 0
  const getNextArgs = options.getNextArgs || ((prev, next) => next)

  let nextArgs: Args | undefined
  let lastInvocationDone: Promise<any> | undefined = undefined
  let delay: Delay | undefined = undefined
  let nextInvocation: Promise<Value> | undefined = undefined

  function invoke(): Promise<Value> {
    const args = nextArgs
    // istanbul ignore next
    if (!args) {
      return Promise.reject(new Error('unexpected error: nextArgs is null'))
    }
    nextInvocation = undefined
    nextArgs = undefined
    const result = Promise.resolve(fn(...args))
    lastInvocationDone = result
      .catch(() => {})
      .then(() => {
        lastInvocationDone = undefined
      })
    delay = new Delay(lastInvocationDone, wait)
    return result
  }

  function setNextArgs(args: Args) {
    nextArgs = nextArgs ? getNextArgs(nextArgs, args) : args
    if (!nextArgs) throw new Error('unexpected error: nextArgs is null')
  }

  function doInvoke(): Promise<Value> {
    return (nextInvocation = (delay || Promise.resolve()).then(invoke))
  }
  function wrapper(...args: Args): Promise<Value> {
    try {
      setNextArgs(args)
    } catch (error) {
      return Promise.reject(error)
    }
    return nextInvocation || doInvoke()
  }

  /**
   * Calls the throttled function soon, but doesn't return a promise, catches
   * any CanceledError, and doesn't create any new promises if a call is already
   * pending.
   *
   * The throttled function should handle all errors internally,
   * e.g.:
   *
   * asyncThrottle(async () => {
   *   try {
   *     await foo()
   *   } catch (err) {
   *     // handle error
   *   }
   * })
   *
   * If the throttled function throws an error or returns a promise that is
   * eventually rejected, the runtime's unhandled promise rejection handler will
   * be called, which may crash the process, route the rejection to a handler
   * that has been previously registered, or ignore the rejection, depending
   * on the runtime and your code.
   */
  wrapper.invokeIgnoreResult = (...args: Args) => {
    setNextArgs(args)
    if (!nextInvocation) {
      doInvoke().catch((err: any) => {
        if (!(err instanceof CanceledError)) {
          // trigger the unhandled promise rejection handler
          throw err
        }
      })
    }
  }

  wrapper.cancel = async (): Promise<void> => {
    const prevLastInvocationDone = lastInvocationDone
    delay?.cancel?.()
    nextInvocation = undefined
    nextArgs = undefined
    lastInvocationDone = undefined
    delay = undefined
    await prevLastInvocationDone
  }

  wrapper.flush = async (): Promise<void> => {
    delay?.flush?.()
    await lastInvocationDone
  }

  return wrapper
}
;(throttle as any).CanceledError = CanceledError

export default throttle
export { CanceledError }
