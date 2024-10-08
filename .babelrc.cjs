/* eslint-env node, es2018 */
module.exports = function (api) {
  const base = require('@jcoreio/toolchain-esnext/.babelrc.cjs')(api)
  return {
    ...base,
    plugins: process.env.JCOREIO_TOOLCHAIN_CJS
      ? [
          require('./util/babelPluginSetModuleExports.js'),
          ...base.plugins.filter(
            (p) =>
              !(Array.isArray(p) ? p[0] : p).includes(
                'babel-plugin-add-module-exports'
              )
          ),
        ]
      : base.plugins,
  }
}
