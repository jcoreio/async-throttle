// @flow

import { describe, it, beforeEach, afterEach } from 'mocha'
import { expect, assert } from 'chai'
import delay from 'waait'
import sinon from 'sinon'

import throttle, { CanceledError } from '../src/index'

const wrapPromise = <T>(
  promise: Promise<T>
): Promise<T> & {
  isPending: () => boolean,
  isResolved: () => boolean,
  isRejected: () => boolean,
  value: () => T,
  reason: () => ?Error,
} => {
  let state:
    | { state: 'pending' }
    | { state: 'resolved', value: T }
    | { state: 'rejected', reason: Error } = { state: 'pending' }
  const result: any = promise
  result.isPending = () => state.state === 'pending'
  result.isResolved = () => state.state === 'resolved'
  result.isRejected = () => state.state === 'rejected'
  result.value = (): T => {
    const s = state
    if (s.state !== 'resolved') throw new Error(`promise is ${s.state}`)
    return s.value
  }
  result.reason = (): Error => {
    const s = state
    if (s.state !== 'rejected') throw new Error(`promise is ${s.state}`)
    return s.reason
  }
  result.then(
    (value: T) => {
      state = { state: 'resolved', value }
    },
    (reason: Error) => {
      state = { state: 'rejected', reason }
    }
  )
  return result
}

describe('throttle', () => {
  let clock
  beforeEach(() => (clock = sinon.useFakeTimers()))
  afterEach(() => clock.restore())

  it(`throws when nextArgs is null`, async function() {
    const fn = throttle(async x => x * 2, 100, {
      getNextArgs: () => (null: any),
    })
    fn(1)
    expect(() => fn(1)).to.throw()
  })
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
  it('.cancel', async function() {
    const foo = sinon.spy(
      async (a: number, wait?: number): Promise<number> => {
        if (wait) await delay(wait)
        if (a < 0) throw new Error()
        return a * 2
      }
    )
    const fn = throttle(foo, 100)
    const promises = []
    const invoke = (a: number, wait?: number) =>
      promises.push(wrapPromise(fn(a, wait)))
    invoke(1, 50)
    invoke(2, 50)
    await clock.tickAsync(1)
    invoke(3, 50)

    const cancelPromise = wrapPromise(fn.cancel())

    invoke(4, 50)
    invoke(5, 50)

    await clock.tickAsync(40)
    expect(promises[0].isPending()).to.be.true
    expect(promises[1].isPending()).to.be.true
    expect(promises[2].isPending()).to.be.true
    expect(promises[3].isPending()).to.be.true
    expect(promises[4].isPending()).to.be.true
    expect(cancelPromise.isPending()).to.be.true

    invoke(6, 50)

    await clock.tickAsync(10)
    expect(promises[0].value()).to.equal(4)
    expect(promises[1].value()).to.equal(4)
    expect(promises[2].reason()).to.be.an.instanceOf(CanceledError)
    expect(promises[3].value()).to.equal(10)
    expect(promises[4].value()).to.equal(10)
    expect(promises[5].isPending()).to.be.true
    expect(cancelPromise.value()).to.be.undefined

    await clock.tickAsync(99)
    expect(promises[5].isPending()).to.be.true
    await clock.tickAsync(1)
    expect(promises[5].value()).to.equal(12)
  })
  it('.cancel when invocation takes longer than wait', async function() {
    const foo = sinon.spy(
      async (a: number, wait?: number): Promise<number> => {
        if (wait) await delay(wait)
        if (a < 0) throw new Error()
        return a * 2
      }
    )
    const fn = throttle(foo, 25)
    const promises = []
    const invoke = (a: number, wait?: number) =>
      promises.push(wrapPromise(fn(a, wait)))
    invoke(1, 50)
    invoke(2, 50)
    await clock.tickAsync(1)
    invoke(3, 50)

    const cancelPromise = wrapPromise(fn.cancel())

    invoke(4, 50)
    invoke(5, 50)

    await clock.tickAsync(40)
    expect(promises[0].isPending()).to.be.true
    expect(promises[1].isPending()).to.be.true
    expect(promises[2].isPending()).to.be.true
    expect(promises[3].isPending()).to.be.true
    expect(promises[4].isPending()).to.be.true
    expect(cancelPromise.isPending()).to.be.true

    invoke(6, 50)

    await clock.tickAsync(10)
    expect(promises[0].value()).to.equal(4)
    expect(promises[1].value()).to.equal(4)
    expect(promises[2].reason()).to.be.an.instanceOf(CanceledError)
    expect(promises[3].value()).to.equal(10)
    expect(promises[4].value()).to.equal(10)
    expect(promises[5].isPending()).to.be.true
    expect(cancelPromise.value()).to.be.undefined

    await clock.tickAsync(49)
    expect(promises[5].isPending()).to.be.true
    await clock.tickAsync(1)
    expect(promises[5].value()).to.equal(12)
  })
  it('.flush', async function() {
    const foo = sinon.spy(
      async (a: number, wait?: number): Promise<number> => {
        if (wait) await delay(wait)
        if (a < 0) throw new Error()
        return a * 2
      }
    )
    const fn = throttle(foo, 100)
    const promises = []
    const invoke = (a: number, wait?: number) =>
      promises.push(wrapPromise(fn(a, wait)))
    invoke(1, 50)
    invoke(2, 50)
    await clock.tickAsync(1)
    invoke(3, 50)

    const flushPromise = wrapPromise(fn.flush())

    invoke(4, 50)
    invoke(5, 50)

    await clock.tickAsync(40)
    expect(promises[0].isPending()).to.be.true
    expect(promises[1].isPending()).to.be.true
    expect(promises[2].isPending()).to.be.true
    expect(promises[3].isPending()).to.be.true
    expect(promises[4].isPending()).to.be.true
    expect(flushPromise.isPending()).to.be.true

    await clock.tickAsync(9)
    expect(promises[0].value()).to.equal(4)
    expect(promises[1].value()).to.equal(4)
    expect(promises[2].isPending()).to.be.true
    expect(promises[3].isPending()).to.be.true
    expect(promises[4].isPending()).to.be.true
    expect(flushPromise.value()).to.be.undefined

    await clock.tickAsync(40)
    expect(promises[2].isPending()).to.be.true
    expect(promises[3].isPending()).to.be.true
    expect(promises[4].isPending()).to.be.true
    await clock.tickAsync(10)
    expect(promises[2].value()).to.equal(10)
    expect(promises[3].value()).to.equal(10)
    expect(promises[4].value()).to.equal(10)
  })
})
