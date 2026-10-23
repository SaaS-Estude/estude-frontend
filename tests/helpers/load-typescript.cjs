const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function loadTypeScript(relativePath, resolveImport) {
  const filename = path.resolve(relativePath);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const nativeRequire = loaded.require.bind(loaded);
  loaded.require = (name) => {
    if (name.startsWith('.')) {
      const dependency = path.resolve(path.dirname(filename), name + '.ts');
      if (fs.existsSync(dependency)) return loadTypeScript(dependency);
    }
    return resolveImport ? resolveImport(name) : nativeRequire(name);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  return loaded.exports;
}

module.exports = { loadTypeScript };
