const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Module=require('node:module'),path=require('node:path');
const filename=path.resolve('lib/tenant-branding.ts'),loaded=new Module(filename,module);loaded.filename=filename;loaded.paths=Module._nodeModulePaths(path.dirname(filename));loaded._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);const {tenantPalette}=loaded.exports;
test('tenant palettes isolate two school colors and preserve RGB opacity channels',()=>{assert.equal(tenantPalette('#167d55')[600],'22 125 85');assert.equal(tenantPalette('#a12662')[600],'161 38 98');assert.notDeepEqual(tenantPalette('#167d55'),tenantPalette('#a12662'))});
test('tenant branding rejects CSS code and malformed color metadata',()=>{for(const value of ['red; background:url(https://bad.test)','var(--other-tenant)','#12345g','rgb(1,2,3)',''])assert.equal(tenantPalette(value)[600],'34 105 239')});

test('school favicon updates PNG type, follows navigation and restores the default',()=>{
 class Icon {
  constructor(attrs){this.attrs=new Map(Object.entries(attrs));this.isConnected=true;}
  getAttribute(key){return this.attrs.get(key)??null}
  setAttribute(key,value){this.attrs.set(key,value)}
  removeAttribute(key){this.attrs.delete(key)}
  hasAttribute(key){return this.attrs.has(key)}
 }
 const originalDocument=global.document,originalObserver=global.MutationObserver;
 const icon=new Icon({href:'/icon.svg?default',type:'image/svg+xml',sizes:'any'});
 let callback,disconnected=false;
 global.document={head:{querySelectorAll:()=>[icon]}};
 global.MutationObserver=class {constructor(fn){callback=fn}observe(){}disconnect(){disconnected=true}};
 try {
  const stop=loaded.exports.applyTenantFavicon('/api/v1/tenant/logo?v=4');
  assert.equal(icon.getAttribute('href'),'/api/v1/tenant/logo?v=4');
  assert.equal(icon.getAttribute('type'),'image/png');
  assert.equal(icon.getAttribute('sizes'),null);
  icon.setAttribute('href','/icon.svg?next-page');callback();
  assert.equal(icon.getAttribute('href'),'/api/v1/tenant/logo?v=4');
  stop();assert.equal(disconnected,true);assert.equal(icon.getAttribute('href'),'/icon.svg?default');assert.equal(icon.getAttribute('type'),'image/svg+xml');
 } finally {global.document=originalDocument;global.MutationObserver=originalObserver}
});
