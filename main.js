const Module = require('module');
const fs = require('fs');
const path = require('path');

const resolve = Module.prototype.require;

// Resolvers

const fromProject = (includes) => {    
    return `${include.root}/${includes.join('/')}`;
};
const fromPackage = (includes) => {
    return `${include._getPackage()}/${includes.join('/')}`;
};
const fromTypescript = (includes) => {
    const package = include._getPackage();
    const identifier = includes.shift();
    if (!include.typePaths.hasOwnProperty(package) && fs.existsSync(`${package}/tsconfig.json`)) {
        const tsData = resolve(`${package}/tsconfig.json`);
        if (tsData.paths) {
            const base = package + '/' + (tsData.baseUrl || '') + '/';
            include.typescriptPaths[package] = {};
            for (const pattern in tsData.paths) {
                include.typescriptPaths[package][pattern.replace(/^[*\\/]+$/, '')] = base + tsData.paths[pattern].replace(/^[*\\/]+$/, '');
            }
        }
    }
    if (include.typescriptPaths.hasOwnProperty(package) && include.typePaths[package].hasOwnProperty(identifier)) {
        return `${include.typePaths[package][identifier]}/${includes.join('/')}`;
    } 
    throw new Error(`no tsconfig found for ${package}`);
};
const fromAliasFile = (includes) => {
    const package = include._getPackage();
    const identifier = includes.shift();
    if (!include.aliasPaths.hasOwnProperty(package) && fs.existsSync(`${package}/.idrinth-better-require.json`)) {
        const paths = resolve(`${package}/.idrinth-better-require.json`);
        if (paths) {
            const base = package + '/';
            include.aliasPaths[package] = {};
            for (const pattern in paths) {
                include.aliasPaths[package][pattern.replace(/^[*\\/]+$/, '')] = base + paths[pattern].replace(/^[*\\/]+$/, '');
            }
        }
    }
    if (include.aliasPaths.hasOwnProperty(package) && include.aliasPaths[package].hasOwnProperty(identifier)) {
        return `${include.aliasPaths[package][identifier]}/${includes.join('/')}`;
    } 
    throw new Error(`no tsconfig found for ${package}`);
};

// Export

const include = (request) => {
  console.log(`resolving ${request}`);
  if (request.charAt(0) !== '~') {
    return resolve(request);
  }
  const identifiers = request.split('/');
  const identifier = identifiers.shift().substring(1);
  if (include.prefixes.hasOwnProperty(identifier) && typeof include.prefixes[identifier] === 'function') {
    return resolve (include.prefixes[identifier](identifiers));
  }
  throw new Error(`Unable to resolve identifier ${identifier}.`);
};

include._getPackage = () => {
    const parent = Object.values(Module._cache).filter(module => !module.loaded)[0];
    let package = parent.file;
    const paths = [];
    do {
        package = path.dirname(package);
        if (include.modulePaths.hasOwnProperty(package)) {
            const res = include.modulePaths[package];
            for (const folder of paths) {
                include.modulePaths[folder] = res;
            }
            return res; 
        }
        paths.push(package);
    } while (!fs.existsSync(`${package}/package.json`))
    for (const folder of paths) {
        include.modulePaths[folder] = package;
    }
    return package;
};
include.modulePaths = {};
include.typescriptPaths = {};
include.aliasPaths = {};
include.root = __dirname.match(/node_modules/) ? __dirname.replace(/node_module.+$/, '') : __dirname;
include.writeCache = false;
include.prefixes = {
    app: fromProject,
    root: fromProject,
    project: fromProject,
    package: fromPackage,
    pkg: fromPackage,
    ts: fromTypescript,
    typescript: fromTypescript,
    alias: fromAliasFile
};

Module.prototype.require = include;

module.exports = include;

// Cache
const cacheFile = `${include.root}/.idrinth-better-require.json`;
if (fs.existsSync(cacheFile)) {
    const cache = resolve(cacheFile);
    if (cache.modules && typeof cache.modules === 'object') {
        include.modulePaths = cache.modules;
    }
    if (cache.typescript && typeof cache.typescript === 'object') {
        include.typescriptPaths = cache.typescript;
    }
    if (cache.alias && typeof cache.alias === 'object') {
        include.aliasPaths = cache.alias;
    }
}

process.once('exit', () => {
  if (!include.writeCache) {
    return;
  }
  try {
    fs.writeFileSync(
      cacheFile,
      JSON.stringify({modules: include.modulePaths, typescript: include.typescriptPaths, alias: include.aliasPaths}),
      'utf-8'
    );
  } catch (err) {
    console.error('@idrinth/better-require: Failed saving cache: ' + err.toString());
  }
});