require('./helpers/register-ui.cjs');
const {test}=require('node:test');const assert=require('node:assert/strict');const React=require('react');const {create,act}=require('react-test-renderer');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
global.IS_REACT_ACT_ENVIRONMENT=true;
test('school logo replaces EStude, supports a long name and falls back if the image fails',async t=>{
 const filename=path.resolve('components/brand-logo.tsx'),loaded=new Module(filename,module);loaded.filename=filename;loaded.paths=Module._nodeModulePaths(path.dirname(filename));const original=loaded.require.bind(loaded);
 const name='Trường THPT Chuyên Lê Quý Đôn';
 let tenant={name,branding:{displayName:name,logoUrl:'/api/v1/tenant/logo?v=1'}};
 loaded.require=(id)=>id==='@/context/tenant-context'?{useTenant:()=>tenant}:id==='next/image'?{default:props=>React.createElement('img',props)}:original(id);
 loaded._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename);
 const Logo=loaded.exports.BrandLogo;let ui;await act(async()=>{ui=create(React.createElement(Logo,{wrapTenantName:true}));});t.after(async()=>act(async()=>ui.unmount()));
 assert.equal(ui.root.findByType('img').props.src,tenant.branding.logoUrl);
 assert.match(JSON.stringify(ui.toJSON()),/Trường THPT Chuyên Lê Quý Đôn/);
 assert.doesNotMatch(JSON.stringify(ui.toJSON()),/EStude/);
 await act(async()=>ui.root.findByType('img').props.onError());assert.match(JSON.stringify(ui.toJSON()),/EStude/);
 tenant={...tenant,branding:{...tenant.branding,logoUrl:'/api/v1/tenant/logo?v=2'}};
 await act(async()=>ui.update(React.createElement(Logo,{wrapTenantName:true})));
 assert.equal(ui.root.findByType('img').props.src,'/api/v1/tenant/logo?v=2');
});
