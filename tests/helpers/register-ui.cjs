// Let component tests load the real shared UI and preserve each test's API mocks.
const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
if (typeof document === 'undefined') global.document = { addEventListener() {}, removeEventListener() {} };
const root = path.resolve(__dirname, '../..');
// Feature tests mock Next navigation; keep those mocks at the new portal UI
// boundary. Dedicated portal routing tests exercise the real adapters.
const originalRequire = Module.prototype.require;
Module.prototype.require = function (request) {
  if (request === '@/components/ui/portal-link') return this.require('next/link');
  if (request === '@/lib/portal-navigation') {
    const navigation = this.require('next/navigation');
    return { ...navigation, useWorkspacePathname: navigation.usePathname };
  }
  return originalRequire.call(this, request);
};
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  return originalResolve.call(this, request.startsWith('@/') ? path.join(root, request.slice(2)) : request, parent, ...rest);
};
for (const extension of ['.ts', '.tsx']) {
  Module._extensions[extension] = (loaded, filename) => {
    loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText, filename);
  };
}
module.exports.formControls = require('../../components/ui/form-control.tsx');

module.exports.dateControls = require("../../components/ui/date-range-picker.tsx");
