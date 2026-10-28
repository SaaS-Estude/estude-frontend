require('./helpers/register-ui.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const React=require('react'),{create,act}=require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT=true;
function load(file,mocks) {
 const filename=path.resolve(file),mod=new Module(filename,module);
 mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));
 const original=mod.require.bind(mod);mod.require=id=>Object.hasOwn(mocks,id)?mocks[id]:original(id);
 mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,filename);
 return mod.exports;
}
function directory(users,{failPage}={}) {
 let active=0,maximum=0;const requests=[];
 const helper=load('lib/account-directory.ts',{'@/lib/auth-api':{authenticatedRequest:async url=>{
  requests.push(url);const query=new URL(url,'http://test').searchParams;
  const page=Number(query.get('page')),limit=Number(query.get('limit'));
  active++;maximum=Math.max(maximum,active);await new Promise(setImmediate);active--;
  if(page===failPage) throw Error('Page unavailable');
  return {items:users.slice((page-1)*limit,page*limit),meta:{page,limit,total:users.length,totalPages:Math.ceil(users.length/limit)}};
 }}});
 return {...helper,requests,maximum:()=>maximum};
}
test('account directory includes all 1051 students with bounded concurrency and fails as a whole',async()=>{
 const users=Array.from({length:1051},(_,i)=>({id:'s'+i,fullName:'Student '+i}));
 const api=directory(users);
 assert.deepEqual(await api.loadAccountDirectory('STUDENT'),users);
 assert.equal(api.requests.length,11);assert.ok(api.maximum()<=4);
 assert.ok(api.requests.every(url=>new URL(url,'http://test').searchParams.get('role')==='STUDENT'));
 const failing=directory(users,{failPage:3});
 await assert.rejects(failing.loadAccountDirectory('STUDENT'),/Page unavailable/);
});
test('create-course selector can choose the 101st teacher from page two',async t=>{
 const previousWindow=global.window;global.window={location:{search:''}};
 const users=Array.from({length:101},(_,i)=>({id:'t'+i,fullName:'Teacher '+i}));
 const api=directory(users);
 const simple=tag=>function Fixture({children}) { return React.createElement(tag,null,children); };
 const overrides={
  '@/components/ui/portal-link':{__esModule:true,default:simple('a')},'lucide-react':new Proxy({},{get:()=>()=>null}),
  './course-offering-editor':{CourseOfferingEditor:()=>null},'./course-offering-details':{CourseOfferingDetails:()=>null},
  './gradebook-policy-fields':{defaultGradePolicy:{annualPeriods:35},validGradePolicy:()=>true,GradebookPolicyFields:()=>null},
  '@/components/ui/button':{Button:({children,...p})=>React.createElement('button',p,children)},
  '@/components/ui/modal':{Modal:({children,footer})=>React.createElement('section',null,children,footer)},
  '@/components/ui/form-control':{
   CustomSelect:({label,options,onValueChange,...p})=>React.createElement('select',{'aria-label':label,value:p.value,onChange:e=>onValueChange(e.target.value)},options.map(o=>React.createElement('option',{key:o.value,value:o.value},o.label))),
   Input:({label,icon,...p})=>{void icon;return React.createElement('input',{'aria-label':label,...p})},
  },
  '@/components/ui/data-table':Object.fromEntries(['Table','TableBody','TableCell','TableEmptyRow','TableHead','TableHeader','TableLoadingBarRow'].map(k=>[k,simple('div')])),
  '@/components/ui/data-table-footer':{DataTableFooter:()=>null},
  '@/lib/search-keyword':{matchesSearchKeyword:()=>true,normalizeSearchKeyword:()=>''},
  '@/lib/assessment-api':{academicDataService:{getAcademicYears:async()=>[{id:'year',status:'ACTIVE'}],getTerms:async()=>[{id:'term',academicYearId:'year',status:'ACTIVE'}],getClasses:async()=>[{id:'class',academicYearId:'year',isActive:true}],getSubjects:async()=>[{id:'subject',isActive:true}]}},
  '@/lib/auth-api':{ApiError:Error},'@/lib/account-directory':api,
  '@/lib/course-offering-api':{courseOfferingApi:{list:async()=>[],readiness:async()=>({dbPrepared:true})}},
 };
 const {CourseOfferingPanel}=load('components/admin/course-offering-panel.tsx',overrides);
 let ui;
 await act(async()=>{ui=create(React.createElement(CourseOfferingPanel));for(let i=0;i<5;i++) await new Promise(setImmediate)});
 t.after(async()=>{await act(async()=>ui.unmount());global.window=previousWindow});
 await act(async()=>ui.root.findAllByType('button').find(n=>n.children.includes('Thêm môn cho lớp')).props.onClick());
 const selector=ui.root.findByProps({'aria-label':'Giáo viên 1'});
 assert.equal(selector.findAllByType('option').length,101);
 await act(async()=>selector.props.onChange({target:{value:'t100'}}));
 assert.equal(ui.root.findByProps({'aria-label':'Giáo viên 1'}).props.value,'t100');
 assert.equal(api.requests.length,2);
});
