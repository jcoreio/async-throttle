var _slicedToArray = (function () {
  function sliceIterator(arr, i) {
    var _arr = []
    var _n = true
    var _d = false
    var _e = undefined
    try {
      for (
        var _i = arr[Symbol.iterator](), _s;
        !(_n = (_s = _i.next()).done);
        _n = true
      ) {
        _arr.push(_s.value)
        if (i && _arr.length === i) break
      }
    } catch (err) {
      _d = true
      _e = err
    } finally {
      try {
        if (!_n && _i['return']) _i['return']()
      } finally {
        // eslint-disable-next-line no-unsafe-finally
        if (_d) throw _e
      }
    }
    return _arr
  }
  return function (arr, i) {
    if (Array.isArray(arr)) {
      return arr
    } else if (Symbol.iterator in Object(arr)) {
      return sliceIterator(arr, i)
    } else {
      throw new TypeError(
        'Invalid attempt to destructure non-iterable instance'
      )
    }
  }
})()

module.exports = function babelPluginSetModuleExports({ template }) {
  var addedRootPaths = new Set()

  function addModuleExportsDefaults(path) {
    var rootPath = path.findParent(function (path) {
      return path.key === 'body' || !path.parentPath
    })
    if (addedRootPaths.has(rootPath)) return
    addedRootPaths.add(rootPath)

    // HACK: `path.node.body.push` instead of path.pushContainer(due doesn't work in Plugin.post)
    rootPath.node.body.push(template('module.exports = exports.default')())
    rootPath.node.body.push(
      template('module.exports.default = exports.default')()
    )
  }

  var ExportsDefaultVisitor = {
    CallExpression: function CallExpression(path) {
      if (!path.get('callee').matchesPattern('Object.defineProperty')) {
        return
      }

      var _path$get = path.get('arguments'),
        _path$get2 = _slicedToArray(_path$get, 2),
        identifier = _path$get2[0],
        prop = _path$get2[1]

      var objectName = identifier.get('name').node
      var propertyName = prop.get('value').node

      if (
        (objectName === 'exports' || objectName === '_exports') &&
        propertyName === 'default'
      ) {
        addModuleExportsDefaults(path)
      }
    },
    AssignmentExpression: function AssignmentExpression(path) {
      if (
        path.get('left').matchesPattern('exports.default') ||
        path.get('left').matchesPattern('_exports.default')
      ) {
        addModuleExportsDefaults(path)
      }
    },
  }

  return {
    post(fileMap) {
      fileMap.path.traverse(ExportsDefaultVisitor)
    },
  }
}
