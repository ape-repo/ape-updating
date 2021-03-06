/**
 * Update dependencies in package.json
 * @memberof module:ape-updating/lib
 * @function updateDependencies
 * @param {options} [options] - Optional settings.
 * @param {string} [options.pkgPath] - Package.json path.
 * @returns {Promise}
 */

'use strict'

const argx = require('argx')
const path = require('path')
const os = require('os')
const execcli = require('execcli')
const colorprint = require('colorprint')
const writeJson = require('./helpers/write_json')
const readJson = require('./helpers/read_json')
const outdatedModules = require('./helpers/outdated_modules')

const majorVersion = (versstring) => {
  const num = Number(versstring.split(/\./g).shift().trim().replace(/[^0-9]/, ''))
  return isNaN(num) ? -1 : num
}

/** @lends updateDependencies */
async function updateDependencies (options) {
  const args = argx(arguments)
  if (args.pop('function')) {
    throw new Error('[ape-updating] Callback is now deprecated. Use promise interface instead.')
  }
  options = args.pop('object') || {}

  const pkgPath = path.resolve(options.pkgPath || 'package.json')

  const cwd = path.dirname(pkgPath)
  const pkg = await readJson(pkgPath)
  const ignore = /^git|\//
  const outdated = outdatedModules()

  const filterOutdated = (modules) => Object.keys(modules)
    .filter((name) => {
      const version = modules[name]
      const isBeta = /-/.test(version)
      if (isBeta) {
        return false
      }
      if (outdated[name]) {
        const {latest} = outdated[name]
        const hasUpdate = majorVersion(modules[name]) <= majorVersion(latest)
        if (hasUpdate) {
          return true
        }
        if (latest === 'linked') {
          return true
        }
      }
      return modules[name] === '*'
    })
    .reduce((result, name) => Object.assign(result, {
      [name]: modules[name]
    }, {}), {})

  let dependencies = _setAllProperty(filterOutdated(pkg['dependencies']), '*', {ignore})
  let devDependencies = _setAllProperty(filterOutdated(pkg['devDependencies']), '*', {ignore})
  pkg['dependencies'] = Object.assign(pkg['dependencies'], dependencies)
  pkg['devDependencies'] = Object.assign(pkg['devDependencies'], devDependencies)
  await writeJson(pkgPath, pkg)
  {
    let dependencyNames = Object.keys(dependencies).sort().filter((name) => !/^@/.test(name))
    colorprint.trace('dependencies to update:%s%s', os.EOL, dependencyNames)
    let args = ['install'].concat(dependencyNames).concat(['--save'])
    await npm(args, {cwd})
  }
  {
    let devDependencyNames = Object.keys(devDependencies).filter((name) => !/^@/.test(name))
    colorprint.trace('devDependencies to update:%s%s', os.EOL, devDependencyNames)
    let devArgs = ['install'].concat(devDependencyNames).concat(['--save-dev'])
    await npm(devArgs, {cwd})
  }
  await npm(['install'], {cwd})
}

async function npm (args, options) {
  return await execcli('npm', args, options)
}

function _setAllProperty (obj, val, options) {
  options = options || {}
  const ignore = options.ignore

  obj = obj || {}
  Object.keys(obj)
    .filter((key) => {
      const rejected = ignore && ignore.test(obj[key])
      return !rejected
    })
    .forEach((key) => {
      obj[key] = val
    })
  return obj
}

module.exports = updateDependencies
