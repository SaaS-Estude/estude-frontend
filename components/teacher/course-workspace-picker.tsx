"use client";

import {useEffect,useState} from "react";
import {courseOfferingApi,type CourseOffering} from "@/lib/course-offering-api";
import {currentCourseId,courseWorkspaceHref} from "@/lib/course-workspace";
import { Select } from "@/components/ui/form-control";


export function CourseWorkspacePicker({classId,onResolved}:{classId?:string;onResolved?:(hasCourses:boolean)=>void}) {
  const [courses,setCourses]=useState<CourseOffering[]>([]);
  const [selected,setSelected]=useState("");
  const [error,setError]=useState("");
  useEffect(()=>{
    let active=true;
    setSelected(currentCourseId());
    courseOfferingApi.list().then((rows)=>{if(active){const available=rows.filter((row)=>!classId||row.primaryClassId===classId);setCourses(available);onResolved?.(available.length>0);}})
      .catch((cause:unknown)=>{if(active)setError(cause instanceof Error?cause.message:"Không tải được môn học theo lớp");});
    return()=>{active=false};
  },[classId,onResolved]);
  if(error)return <p role="alert" className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>;
  if(!courses.length)return null;
  return <label className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold">Môn học theo lớp
    <Select aria-label="Chọn môn học theo lớp" className="h-11 rounded-lg border border-slate-200 bg-white px-3" value={selected} onChange={(event)=>{
      const id=event.target.value;
      if(id)window.location.assign(courseWorkspaceHref(window.location.pathname+window.location.search,id));
    }}><option value="" disabled>Chọn môn học và học kỳ</option>{courses.map((course)=><option key={course.id} value={course.id}>{course.displayName}{course.sectionKey && course.sectionKey !== "MAIN" ? ` · Nhóm ${course.sectionKey}` : ""}</option>)}</Select>
  </label>;
}
