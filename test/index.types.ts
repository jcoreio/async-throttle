/* eslint-disable */

import throttle, { CanceledError } from '../src'

function fn(x: number, y?: string): string {
  return String(x)
}

const throttled = throttle(fn, 2)
const throttled2 = throttle(fn)
const throttled3 = throttle(fn, 2, {
  getNextArgs: (
    a: [number, string | undefined],
    b: [number, string | undefined]
  ) => (a[0] > b[0] ? a : b),
})

async function go() {
  const a = await throttled(2)
  const b = await throttled(3, 'a')
  // @ts-expect-error
  const c = await throttled(3, 4)

  await throttled.cancel()
  await throttled.flush()
}
