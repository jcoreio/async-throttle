const delay = ms => new Promise(resolve => setTimeout(resolve, Math.max(ms, 0) || 0))

export default function throttle(fn, wait) {
  let lastArgs
  let lastPromise = delay(0)
  let nextPromise = null
  let lastCallTime = NaN

  function call() {
    lastCallTime = Date.now()
    nextPromise = null
    return lastPromise = fn(...lastArgs)
  }

  return async function () {
    lastArgs = [...arguments]
    if (!nextPromise) nextPromise = Promise.all([
      lastPromise,
      delay(lastCallTime + wait - Date.now())
    ]).then(call, call)
    return nextPromise
  }
}

