require('./helpers/register-ui.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const React=require('react'),{create,act}=require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT=true;
async function setup(t,send) {
 const filename=path.resolve('components/admin/account-password-reset-panel.tsx'),mod=new Module(filename,module);
 mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));
 const original=mod.require.bind(mod),writes=[],closed=[],saved=[];
 const mocks={
  '@/lib/auth-api':{authenticatedRequest:async(path,options)=>{writes.push({path,...options});return send?.()}},
  '@/components/ui/button':{Button:({children,permission,...p})=>{void permission;return React.createElement('button',p,children)}},
  '@/components/ui/modal':{Modal:({children,onClose})=>React.createElement('section',null,children,React.createElement('button',{'aria-label':'Đóng',onClick:onClose}))},
  '@/components/ui/form-control':{Input:({label,showPasswordToggle,...p})=>{void showPasswordToggle;return React.createElement('input',{'aria-label':label,...p})}},
 };
 mod.require=id=>Object.hasOwn(mocks,id)?mocks[id]:original(id);
 mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,filename);
 let ui;
 await act(async()=>ui=create(React.createElement(mod.exports.AccountPasswordResetPanel,{user:{id:'student-id',fullName:'Nguyễn An',accountName:'an',role:'STUDENT',status:'LOCKED'},onClose:()=>closed.push(true),onSaved:()=>saved.push(true)})));
 t.after(async()=>act(async()=>ui.unmount()));
 const change=async(label,value)=>act(async()=>ui.root.findByProps({'aria-label':label}).props.onChange({target:{value}}));
 const submit=async()=>act(async()=>ui.root.findByType('form').props.onSubmit({preventDefault(){}}));
 return {ui,writes,closed,saved,change,submit};
}
test('reset validates confirmation, retains input on failure, and only sends credentials on confirmation',async t=>{
 let fail=true;
 const f=await setup(t,()=>{if(fail) throw Error('Không đủ quyền')});
 await f.change('Mật khẩu tạm','Temporary-123!');await f.change('Nhập lại mật khẩu tạm','Other-123!');
 await f.submit();assert.equal(f.writes.length,0);
 await f.change('Nhập lại mật khẩu tạm','Temporary-123!');await f.submit();
 assert.equal(f.saved.length,0);assert.match(JSON.stringify(f.ui.toJSON()),/Không đủ quyền/);
 assert.equal(f.ui.root.findByProps({'aria-label':'Mật khẩu tạm'}).props.value,'Temporary-123!');
 fail=false;await f.submit();
 assert.equal(f.saved.length,1);
 assert.deepEqual(JSON.parse(f.writes[1].body),{newPassword:'Temporary-123!',confirmNewPassword:'Temporary-123!'});
 assert.equal(f.writes[1].path,'/users/student-id/password');
 assert.equal(f.ui.root.findByProps({'aria-label':'Mật khẩu tạm'}).props.value,'');
 await f.submit();assert.equal(f.writes.length,2);
});
test('reset serializes duplicate submits and blocks closing while the request is pending',async t=>{
 let finish;const pending=new Promise(resolve=>finish=resolve);
 const f=await setup(t,()=>pending);
 await f.change('Mật khẩu tạm','Temporary-123!');await f.change('Nhập lại mật khẩu tạm','Temporary-123!');
 let submitted;
 await act(async()=>{submitted=f.ui.root.findByType('form').props.onSubmit({preventDefault(){}});await new Promise(setImmediate)});
 await f.submit();await act(async()=>f.ui.root.findByProps({'aria-label':'Đóng'}).props.onClick());
 assert.equal(f.writes.length,1);assert.equal(f.closed.length,0);
 await act(async()=>{finish();await submitted});assert.equal(f.saved.length,1);
});
test('cancelling an edited reset form never writes a password',async t=>{
 const f=await setup(t);
 await f.change('Mật khẩu tạm','Temporary-123!');
 await act(async()=>f.ui.root.findAllByType('button').find(n=>n.children.includes('Hủy')).props.onClick());
 assert.equal(f.closed.length,1);assert.equal(f.writes.length,0);
});
