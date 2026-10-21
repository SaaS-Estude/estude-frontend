const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"); const path = require("node:path"); const Module = require("node:module");
const ts = require("typescript"); const React = require("react"); const {create,act} = require("react-test-renderer");
global.IS_REACT_ACT_ENVIRONMENT=true;
function load(file,mocks={}) {const filename=path.resolve(file);const mod=new Module(filename,module);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));const original=mod.require.bind(mod);mod.require=(id)=>Object.hasOwn(mocks,id)?mocks[id]:original(id);mod._compile(ts.transpileModule(fs.readFileSync(filename,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename);return mod.exports;}
const view = load("lib/online-session-view.ts");
async function setup(t,overrides={}) {
 const writes=[],saved=[],closed=[];
 const {OnlineSessionEditor}=load("components/online-sessions/session-editor.tsx",{
  "@/context/auth-context":{useAuth:()=>({user:{id:"teacher"}})},
  "@/lib/online-session-view":view,
  "@/lib/online-sessions-api":{onlineSessionApi:{roster:async()=>({students:[{id:"s1",fullName:"Nguyễn An",accountName:"an"},{id:"s2",fullName:"Lê Bình",accountName:"binh"}],teachers:[{id:"teacher",fullName:"Cô Lan"}]}),save:async(...args)=>{writes.push(args);if(overrides.fail)throw new Error("Buổi học đã thay đổi");}}},
  "@/components/ui/modal":{Modal:({children,footer})=>React.createElement("section",null,children,React.createElement("footer",null,footer))},
  "@/components/ui/button":{Button:({children,...p})=>React.createElement("button",p,children)},
  "@/components/ui/form-control":{Input:p=>React.createElement("input",p),Textarea:p=>React.createElement("textarea",p),Checkbox:p=>React.createElement("input",{...p,type:"checkbox"}),Select:({children,...p})=>React.createElement("select",p,children)},
 });
 let ui;await act(async()=>{ui=create(React.createElement(OnlineSessionEditor,{role:"teacher",courseId:"course",courseName:"Toán 12A1",onClose:()=>closed.push(true),onSaved:()=>saved.push(true),...overrides.props}));});t.after(async()=>act(async()=>ui.unmount()));
 const field=label=>ui.root.findAll(node=>typeof node.type==="string"&&node.props.label===label)[0];
 const change=async(label,value)=>act(async()=>field(label).props.onChange({target:{value}}));
 const submit=async()=>act(async()=>ui.root.findByType("form").props.onSubmit({preventDefault(){}}));
 return {ui,writes,saved,closed,change,submit,field};
}
test("draft form edits and cancel never write; footer has only cancel and confirm",async t=>{
 const s=await setup(t);await s.change("Tên buổi học","Tên chưa lưu");await s.change("Trạng thái","DRAFT");assert.equal(s.writes.length,0);
 const buttons=s.ui.root.findByType("footer").findAllByType("button");assert.deepEqual(buttons.map(b=>b.children.join("")),["Hủy","Xác nhận"]);await act(async()=>buttons[0].props.onClick());assert.equal(s.closed.length,1);assert.equal(s.writes.length,0);
});
test("confirm sends one request with Vietnam times and only selected students",async t=>{
 const s=await setup(t);await s.change("Tên buổi học","Ôn tập");await s.change("Đường dẫn tham gia","https://meet.google.com/abc-defg-hij");await s.change("Bắt đầu (giờ Việt Nam)","2026-10-23T19:00");await s.change("Kết thúc (giờ Việt Nam)","2026-10-23T20:00");await s.change("Đối tượng tham gia","SELECTED");
 const checks=s.ui.root.findAllByType("input").filter(n=>n.props.type==="checkbox");await act(async()=>checks[0].props.onChange({target:{checked:true}}));await s.submit();assert.equal(s.writes.length,1);assert.equal(s.saved.length,1);
 const [role,course,id,input]=s.writes[0];assert.equal(role,"teacher");assert.equal(course,"course");assert.equal(id,undefined);assert.deepEqual(input.studentIds,["s1"]);assert.equal(input.startsAt,"2026-10-23T12:00:00.000Z");assert.equal(input.endsAt,"2026-10-23T13:00:00.000Z");assert.match(input.requestKey,/^[a-f0-9-]{36}$/);
});
test("empty group does not save and errors preserve edits",async t=>{
 const s=await setup(t,{fail:true});await s.change("Tên buổi học","Ôn tập");await s.change("Đối tượng tham gia","SELECTED");await s.submit();assert.equal(s.writes.length,0);assert.match(JSON.stringify(s.ui.toJSON()),/Chọn ít nhất/);await s.change("Đối tượng tham gia","ALL");await s.submit();assert.equal(s.writes.length,1);assert.equal(s.saved.length,0);assert.equal(s.field("Tên buổi học").props.value,"Ôn tập");assert.match(JSON.stringify(s.ui.toJSON()),/Buổi học đã thay đổi/);
});
test("server-relative clock opens at 15 minutes and ends exclusively; cancellation disables join",()=>{
 const row={status:"SCHEDULED",startsAt:"2026-10-23T12:00:00Z",endsAt:"2026-10-23T13:00:00Z",joinOpensAt:"2026-10-23T11:45:00Z"};
 assert.equal(view.canEnterOnline(row,Date.parse("2026-10-23T11:44:59Z")),false);assert.equal(view.canEnterOnline(row,Date.parse(row.joinOpensAt)),true);assert.equal(view.canEnterOnline(row,Date.parse(row.endsAt)),false);assert.equal(view.canEnterOnline({...row,status:"CANCELLED"},Date.parse(row.startsAt)),false);assert.equal(view.onlineLiveState(row,Date.parse(row.startsAt)),"LIVE");assert.equal(view.onlineLiveState(row,Date.parse(row.endsAt)),"ENDED");assert.equal(view.onlineUTC(view.onlineLocalInput(row.startsAt)),"2026-10-23T12:00:00.000Z");
});

test("editing an existing session preserves unchanged schedule precision", async t => {
 const session={id:"meeting",revision:3,organizerId:"teacher",title:"Ôn tập",description:"",platform:"MEET",meetingUrl:"https://meet.google.com/abc-defg-hij",startsAt:"2026-10-23T12:00:41.123Z",endsAt:"2026-10-23T13:00:41.123Z",audience:"ALL",status:"SCHEDULED",studentIds:[]};
 const s=await setup(t,{props:{session}});await s.change("Nội dung / mục tiêu rèn luyện","Mô tả mới");await s.submit();assert.equal(s.writes[0][3].startsAt,session.startsAt);assert.equal(s.writes[0][3].endsAt,session.endsAt);assert.equal(s.writes[0][3].revision,3);
});
