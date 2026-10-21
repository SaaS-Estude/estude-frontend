"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { OfficialGradeReport } from "./official-grade-report";
import { InternalGradeReport } from "./internal-grade-report";
export function GradeReports({studentId="me"}:{studentId?:string}) {
 const [tab,setTab]=useState<"official"|"self-study">("official");
 return <div className="space-y-4"><div role="tablist" aria-label="Báo cáo điểm" className="flex gap-2 rounded-xl border border-slate-200 bg-white p-2"><Button role="tab" aria-selected={tab==="official"} variant={tab==="official"?"primary":"ghost"} onClick={()=>setTab("official")}>Điểm học kỳ</Button><Button role="tab" aria-selected={tab==="self-study"} variant={tab==="self-study"?"primary":"ghost"} onClick={()=>setTab("self-study")}>Kết quả tự học</Button></div><div role="tabpanel">{tab==="official"?<OfficialGradeReport key={studentId} studentId={studentId}/>:<InternalGradeReport key={studentId} studentId={studentId}/>}</div></div>;
}
