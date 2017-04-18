const delay = ms => new Promise(resolve => setTimeout(resolve, Math.max(ms, 0) || 0))

module.exports = function throttle(fn, wait, {getNextArgs} = {}) {
  if (!getNextArgs) getNextArgs = (prev, next) => next

  let nextArgs
  let lastPromise = delay(0)
  let nextPromise = null
  let lastInvokeTime = NaN

  function invoke() {
    lastInvokeTime = Date.now()
    nextPromise = null
    const args = nextArgs
    nextArgs = null
    return lastPromise = fn(...args)
  }

  return async function () {
    nextArgs = nextArgs
      ? getNextArgs(nextArgs, [...arguments])
      : [...arguments]
    if (!nextPromise) {
      nextPromise = Promise.all([
        lastPromise,
        delay(lastInvokeTime + wait - Date.now())
      ]).then(invoke, invoke)
    }
    return nextPromise
  }
}

