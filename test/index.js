// @flow

import {describe, it, beforeEach, afterEach} from 'mocha'
import {expect, assert} from 'chai'
import sinon from 'sinon'
import {resolve} from 'bluebird'

import throttle from '../src/index'

const delay = ms => new Promise(resolve => setTimeout(resolve, ms || 0))

describe('throttle', () => {
  let clock
  beforeEach(() => clock = sinon.useFakeTimers())
  afterEach(() => clock.restore())

  it('works', async function (): Promise<void> {
    const foo = sinon.spy(async (a: number, wait?: number): Promise<number> => {
      if (wait) await delay(wait)
      if (a < 0) throw new Error()
      return a * 2
    })
    const fn = throttle(foo, 100)
    let promises = [fn(1), fn(2), fn(3)].map(resolve)
    for (let promise of promises) assert(promise.isPending())

    clock.tick(1)
    await new Promise(setImmediate)
    for (let promise of promises) expect(promise.value()).to.equal(6)
    expect(foo.args).to.deep.equal([[3]])

    promises = [fn(4), fn(-4), fn(5)].map(resolve)
    clock.tick(40)
    await new Promise(setImmediate)
    for (let promise of promises) assert(promise.isPending())

    clock.tick(60)
    await new Promise(setImmediate)
    for (let promise of promises) expect(promise.value()).to.equal(10)

    expect(foo.args).to.deep.equal([[3], [5]])

    clock.tick(1000)
    await new Promise(setImmediate)
    expect(foo.args).to.deep.equal([[3], [5]])

    promises = [fn(1), fn(2), fn(3)].map(resolve)
    clock.tick(1)
    await new Promise(setImmediate)
    for (let promise of promises) expect(promise.value()).to.equal(6)

    clock.tick(1000)

    promises = [fn(1, 200)]
    clock.tick(1)
    await new Promise(setImmediate)

    promises.push(fn(2, 200), fn(-3, 200))
    promises = promises.map(resolve)
    for (let promise of promises) assert(promise.isPending())

    clock.tick(200)
    await new Promise(setImmediate)
    expect(promises[0].value()).to.equal(2)

    for (let i of [1, 2]) assert(promises[i].isPending())
    clock.tick(200)
    await new Promise(setImmediate)
    for (let i of [1, 2]) expect(promises[i].reason()).to.exist
  })
})
