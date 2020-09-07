// @flow

const delay = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, Math.max(ms, 0) || 0))

module.exports = function throttle<Args: Array<any>, Value>(
  fn: (...args: Args) => Promise<Value>,
  wait: ?number,
  options: {
    getNextArgs?: (args0: Args, args1: Args) => Args,
  } = {}
): (...args: Args) => Promise<Value> {
  const getNextArgs = options.getNextArgs || ((prev, next) => next)

  let nextArgs: ?Args
  let lastPromise: Promise<any> = delay(0)
  let nextPromise: ?Promise<Value> = null
  let lastInvokeTime: number = NaN

  function invoke(): Promise<Value> {
    lastInvokeTime = Date.now()
    nextPromise = null
    const args = nextArgs
    if (!args) throw new Error('unexpected error: nextArgs is null')
    nextArgs = null
    return (lastPromise = fn(...args))
  }

  return async function(...args: Args): Promise<Value> {
    nextArgs = nextArgs ? getNextArgs(nextArgs, args) : args
    if (!nextPromise) {
      nextPromise = Promise.all([
        lastPromise,
        delay(lastInvokeTime + wait - Date.now()),
      ]).then(invoke, invoke)
    }
    return nextPromise
  }
}
