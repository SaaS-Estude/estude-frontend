require('./helpers/register-ui.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
function compile(filename, overrides = {}) {
 const file = path.resolve(filename), loaded = new Module(file, module);
 loaded.filename = file; loaded.paths = Module._nodeModulePaths(path.dirname(file));
 const original = loaded.require.bind(loaded); loaded.require = (id) => overrides[id] ?? original(id);
 loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, file);
 return loaded.exports;
}
const text = (renderer) => JSON.stringify(renderer.toJSON());
const button = (renderer, label) => renderer.root.findAllByType('button').find((node) => node.children.join('').includes(label));
const modal = { Modal: ({open, children, footer}) => open ? React.createElement('dialog', null, children, footer) : null };
const controls = {
 Select: ({label, children, ...props}) => React.createElement('select', {'aria-label':label, ...props}, children),
 Input: ({label, ...props}) => React.createElement('input', {'aria-label':label, ...props}),
};
test('academic drafts publish separately and adoption sends only the selected self-study source', async (t) => {
 const calls = [];
 const Actions = compile('components/teacher/academic-grade-actions.tsx', {
  '@/components/ui/modal':modal, '@/components/ui/form-control':controls,
  '@/lib/gradebook-api':{gradebookService:{adoptSelfStudy:async (...args)=>calls.push(['adopt',...args]),publishRecords:async (...args)=>calls.push(['publish',...args])}},
 }).AcademicGradeActions;
 const view = {book:{id:'book',revision:8},requiredRegular:3,items:[{id:'practice',title:'Ôn luyện',resultChannel:'INTERNAL',status:'ACTIVE',maxScore:20},{id:'official',title:'TX1',resultChannel:'OFFICIAL',status:'ACTIVE'}],students:[{id:'draft',hasDraft:true,isActive:true},{id:'published',hasDraft:false,isActive:true},{id:'withdrawn',hasDraft:true,isActive:false}]};
 let renderer; await act(async ()=>{renderer=create(React.createElement(Actions,{view,disabled:false,onChanged:()=>{},onError:()=>{}}));});
 t.after(async ()=>{await act(async ()=>renderer.unmount());});
 await act(async ()=>button(renderer,'Lấy điểm tự học').props.onClick());
 assert.equal(renderer.root.findByProps({"aria-label":"Hoạt động tự học"}).findAllByType("option").some((option)=>option.props.value==="official"),false);assert.match(text(renderer),/Ôn luyện/);
 await act(async ()=>button(renderer,'Hủy').props.onClick());assert.equal(calls.length,0);
 await act(async ()=>button(renderer,'Lấy điểm tự học').props.onClick());
 await act(async ()=>{
  renderer.root.findByProps({'aria-label':'Hoạt động tự học'}).props.onChange({target:{value:'practice'}});
  renderer.root.findByProps({'aria-label':'Cột thường kỳ nhận điểm'}).props.onChange({target:{value:'TX3'}});
  renderer.root.findByProps({'aria-label':'Lý do lấy điểm'}).props.onChange({target:{value:'Kết quả ôn luyện'}});
 });
 await act(async ()=>button(renderer,'Xác nhận').props.onClick());
 assert.deepEqual(calls[0],['adopt','book',{revision:8,gradeItemId:'practice',slotKey:'TX3',reason:'Kết quả ôn luyện'}]);
 await act(async ()=>button(renderer,'Công bố điểm học kỳ').props.onClick());
 await act(async ()=>button(renderer,'Xác nhận').props.onClick());
 assert.deepEqual(calls[1],['publish','book',8,['draft']]);
});
test('report tabs mount independent reports for the selected child', async (t) => {
 const Reports=compile('components/assessment/grade-reports.tsx',{
  './official-grade-report':{OfficialGradeReport:({studentId})=>React.createElement('p',null,'Học kỳ '+studentId)},
  './internal-grade-report':{InternalGradeReport:({studentId})=>React.createElement('p',null,'Tự học '+studentId)},
 }).GradeReports;
 let renderer;await act(async ()=>{renderer=create(React.createElement(Reports,{studentId:'first'}));});
 t.after(async ()=>{await act(async ()=>renderer.unmount());});
 assert.match(text(renderer),/Học kỳ first/);assert.doesNotMatch(text(renderer),/Tự học first/);
 await act(async ()=>button(renderer,'Kết quả tự học').props.onClick());
 assert.match(text(renderer),/Tự học first/);assert.doesNotMatch(text(renderer),/Học kỳ first/);
 await act(async ()=>renderer.update(React.createElement(Reports,{studentId:'second'})));
 assert.match(text(renderer),/Tự học second/);assert.doesNotMatch(text(renderer),/Tự học first/);
});
test('academic configuration supports custom weights and rejects invalid column counts', () => {
 const {defaultGradePolicy,gradePolicyValues,validGradePolicy}=compile('components/admin/gradebook-policy-fields.tsx');
 assert.equal(validGradePolicy({...defaultGradePolicy,regularColumns:7,regularWeight:0.5,midtermWeight:2.5,finalWeight:4}),true);
 for(const regularColumns of [0,-1,21,1.5]) assert.equal(validGradePolicy({...defaultGradePolicy,regularColumns}),false);
 for(const finalWeight of [0,-1,101,NaN]) assert.equal(validGradePolicy({...defaultGradePolicy,finalWeight}),false);
 assert.equal(gradePolicyValues({assessmentMode:'NUMERIC',annualPeriods:70,specialized:true}).regularColumns,4);
});
