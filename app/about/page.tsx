import type { Metadata } from "next";
import { AboutPage } from "@/components/marketing/about-page";

export const metadata: Metadata = {
  title: "Giới thiệu EStude | Không gian học tập kết nối",
  description:
    "Khám phá EStude: nền tảng quản lý lớp học, kiểm tra đánh giá và hỗ trợ học tập với AI, kết nối người học, giáo viên, phụ huynh và nhà trường.",
};

export default function About() {
  return <AboutPage />;
}
