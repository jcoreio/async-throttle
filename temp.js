import throttle from './src/index'
const fn = throttle(() => new Promise((r) => setTimeout(r, 200)), 100)

setInterval(fn, 10)
