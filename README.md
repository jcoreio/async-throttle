# async-throttle

[![CircleCI](https://circleci.com/gh/jcoreio/async-throttle.svg?style=svg)](https://circleci.com/gh/jcoreio/async-throttle)
[![codecov](https://codecov.io/gh/jcoreio/async-throttle/branch/master/graph/badge.svg?token=pLauOb4sn7)](undefined)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![npm version](https://badge.fury.io/js/%40jcoreio%2Fasync-throttle.svg)](https://badge.fury.io/js/%40jcoreio%2Fasync-throttle)

Throttle async and promise returning functions. Unlike similarly named packages, this behaves much like an async version of
`lodash.throttle`:

- Only one invocation can be running at a time (similarly named packages don't do this)
- Has `.cancel()` and `.flush()`

## Differences from `lodash.throttle`

- No `leading` and `trailing` options
- `getNextArgs` option allows you to customize how the arguments for the next invocation are determined

## Installing

```sh
npm install --save @jcoreio/async-throttle
```

### Usage

```js
const throttle = require('@jcoreio/async-throttle')
import throttle from '@jcoreio/async-throttle'
```

```js
function throttle<Args: Array<any>, Value>(
  func: (...args: Args) => Promise<Value>,
  wait: ?number,
  options?: {
    getNextArgs?: (current: Args, next: Args) => Args
  }
): (...args: Args) => Promise<Value>;
```

Creates a throttled function that only invokes `func` at most once per every `wait` milliseconds, and also waits for the
`Promise` returned by the previous invocation to finish (it won't invoke `func` in parallel).

The promise returned by the throttled function will track the promise returned by the next invocation of `func`.

If `wait` is falsy, it is treated as 0, which causes `func` to be invoked on the next tick afte the previous invocation
finishes.

By default, `func` is called with the most recent arguments to the throttled function. You can change this with the
`getNextArgs` option -- for example, if you want to invoke `func` with the minimum of all arguments since the last
invocation:

```js
const throttledFn = throttle(foo, 10, {
  getNextArgs: ([a], [b]) => [Math.min(a, b)],
})
throttledFn(2)
throttledFn(1)
throttledFn(3)
// foo will be called with 1

// time passes...

throttledFn(4)
throttledFn(6)
throttledFn(5)
// foo will be called with 4
```

### `throttledFn.invokeIgnoreResult(args)`

Calls the throttled function soon, but doesn't return a promise, catches any CanceledError, and doesn't create any new promises if a call is already pending.

To use this, you should handle all errors inside the throttled function:

```js
const throttled = throttle(async (arg) => {
  try {
    await doSomething(arg)
  } catch (err) {
    // handle error
  }
})
```

Then call `invokeIgnoreResult` instead of the throttled function:

```js
throttled.invokeIgnoreResult(arg)
```

The `invokeIgnoreResult` method is useful because the following code example would leave 1000 pending promises
on the heap, even though the catch block is a no-op:

```js
for (let i = 0; i < 1000; i++) {
  throttled(arg).catch(() => {})
}
```

### `throttledFn.cancel()`

Cancels the pending invocation, if any. All `Promise`s tracking the pending invocation will be
rejected with a `CancelationError` (`const {CancelationError} = require('@jcoreio/async-throttle')`).
However, if an invocation is currently running, all `Promise`s tracking the current invocation will be fulfilled as usual.

Returns a `Promise` that will resolve once the current invocation (if any) is finished.

### `throttledFn.flush()`

Cancels the `wait` before the pending invocation, if any. The pending invocation will still wait for the current invocation (if any)
to finish, but will begin immediately afterward, even if `wait` has not elapsed.

Returns a `Promise` that will resolve once the current invocation (if any) is finished.
