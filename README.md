# async-throttle

[![Build Status](https://travis-ci.org/jcoreio/async-throttle.svg?branch=master)](https://travis-ci.org/jcoreio/async-throttle)
[![Coverage Status](https://coveralls.io/repos/github/jcoreio/async-throttle/badge.svg?branch=master)](https://coveralls.io/github/jcoreio/async-throttle?branch=master)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

throttle async and promise-returning functions.  Other packages don't do it right.

## Installing

```sh
npm install --save @jcoreio/async-throttle
```

### `throttle(func, delay)`

Creates a throttled function that only invokes `func` at most once per every `wait` milliseconds, and also waits for the
`Promise` returned by the previous invocation to finish.