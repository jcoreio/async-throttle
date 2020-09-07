// @flow

import { describe, it, beforeEach, afterEach } from 'mocha'
import { expect, assert } from 'chai'
import delay from 'waait'
import sinon from 'sinon'

import throttle from '../src/index'

const wrapPromise = <T>(
  promise: Promise<T>
): Promise<T> & {
  isPending: () => boolean,
  value: () => T,
  isRejected: () => boolean,
} => {
  let isPending = true
  let value: T = (null: any)
  let isRejected = false
  const result: any = promise
  result.isPending = () => isPending
  result.value = (): T => {
    if (isPending) throw new Error(`promise is pending`)
    return value
  }
  result.isRejected = () => isRejected
  result.then(
    (v: T) => {
      isPending = false
      value = v
    },
    (err: Error) => {
      isPending = false
      isRejected = true
    }
  )
  return result
}

describe('throttle', () => {
  let clock
  beforeEach(() => (clock = sinon.useFakeTimers()))
  afterEach(() => clock.restore())

  it('works', async function(): Promise<void> {
    const foo = sinon.spy(
      async (a: number, wait?: number): Promise<number> => {
        if (wait) await delay(wait)
        if (a < 0) throw new Error()
        return a * 2
      }
    )
    const fn = throttle(foo, 100)
    let promises = [fn(1), fn(2), fn(3)].map(wrapPromise)
    for (let promise of promises) assert(promise.isPending())

    await clock.tickAsync(1)
    for (let promise of promises) expect(promise.value()).to.equal(6)
    expect(foo.args).to.deep.equal([[3]])

    promises = [fn(4), fn(-4), fn(5)].map(wrapPromise)
    promises.forEach(p => p.catch(() => {}))
    await clock.tickAsync(40)
    for (let promise of promises) assert(promise.isPending())

    await clock.tickAsync(60)
    for (let promise of promises) expect(promise.value()).to.equal(10)

    expect(foo.args).to.deep.equal([[3], [5]])

    await clock.tickAsync(1000)
    expect(foo.args).to.deep.equal([[3], [5]])

    promises = [fn(1), fn(2), fn(3)].map(wrapPromise)
    await clock.tickAsync(1)
    for (let promise of promises) expect(promise.value()).to.equal(6)

    await clock.tickAsync(1000)

    promises = [fn(1, 200)]
    await clock.tickAsync(1)

    promises.push(fn(2, 200), fn(-3, 200))
    promises = promises.map(wrapPromise)
    promises.forEach(p => p.catch(() => {}))
    for (let promise of promises) assert(promise.isPending())

    await clock.tickAsync(200)
    expect(promises[0].value()).to.equal(2)

    for (let i of [1, 2]) assert(promises[i].isPending())
    await clock.tickAsync(200)
    for (let i of [1, 2]) expect(promises[i].isRejected()).to.be.true
  })
  it('supports getNextArgs option', async function(): Promise<void> {
    const foo = sinon.spy(
      async (a: number, wait?: number): Promise<number> => {
        if (wait) await delay(wait)
        if (a < 0) throw new Error()
        return a * 2
      }
    )
    const fn = throttle(foo, 100, {
      getNextArgs: ([a], [b]) => [Math.min(a, b)],
    })

    let promises = [fn(1), fn(2), fn(3)].map(wrapPromise)
    for (let promise of promises) assert(promise.isPending())

    await clock.tickAsync(1)
    for (let promise of promises) expect(promise.value()).to.equal(2)
    expect(foo.args).to.deep.equal([[1]])

    promises = [fn(4), fn(-4), fn(5)].map(wrapPromise)
    promises.forEach(p => p.catch(() => {}))
    await clock.tickAsync(40)
    for (let promise of promises) assert(promise.isPending())

    await clock.tickAsync(60)
    for (let promise of promises) expect(promise.isRejected()).to.be.true

    expect(foo.args).to.deep.equal([[1], [-4]])

    await clock.tickAsync(1000)
    expect(foo.args).to.deep.equal([[1], [-4]])
  })
})
