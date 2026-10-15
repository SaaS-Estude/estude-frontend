import { normalizeSearchKeyword } from "@/lib/search-keyword";

const SUBJECT_TRANSLATIONS = [
  ["Accounting", "Kế toán"],
  ["Biology", "Sinh học"],
  ["Business Administration", "Quản trị kinh doanh"],
  ["Calculus", "Giải tích"],
  ["Chemistry", "Hóa học"],
  ["Civic Education", "Giáo dục công dân"],
  ["Civics", "Giáo dục công dân"],
  ["Computer Science", "Khoa học máy tính"],
  ["Data Structures and Algorithms", "Cấu trúc dữ liệu và giải thuật"],
  ["Database", "Cơ sở dữ liệu"],
  ["Database Systems", "Hệ cơ sở dữ liệu"],
  ["Economics", "Kinh tế học"],
  ["English", "Tiếng Anh"],
  ["Fine Arts", "Mỹ thuật"],
  ["Foreign Language", "Ngoại ngữ"],
  ["Foreign Language 1", "Ngoại ngữ 1"],
  ["Foreign Language 2", "Ngoại ngữ 2"],
  ["Geography", "Địa lý"],
  ["History", "Lịch sử"],
  ["Informatics", "Tin học"],
  ["Information Technology", "Tin học"],
  ["Information Systems", "Hệ thống thông tin"],
  ["Law", "Luật học"],
  ["Literature", "Ngữ văn"],
  ["Marketing", "Marketing"],
  ["Mathematics", "Toán học"],
  ["Music", "Âm nhạc"],
  ["National Defense and Security Education", "Giáo dục quốc phòng và an ninh"],
  ["Natural Sciences", "Khoa học tự nhiên"],
  ["Physical Education", "Giáo dục thể chất"],
  ["Physics", "Vật lý"],
  ["Programming", "Lập trình"],
  ["Software Engineering", "Kỹ thuật phần mềm"],
  ["Social Sciences", "Khoa học xã hội"],
  ["Statistics", "Thống kê"],
  ["Technology", "Công nghệ"],
  ["Web Development", "Phát triển web"],
] as const;

const vietnameseNameByEnglishName = new Map(
  SUBJECT_TRANSLATIONS.map(([englishName, vietnameseName]) => [
    normalizeSearchKeyword(englishName),
    vietnameseName,
  ]),
);

export function toVietnameseSubjectName(name: string): string {
  return vietnameseNameByEnglishName.get(normalizeSearchKeyword(name)) ?? name;
}

export function getVietnameseSubjectName(subject: {
  name: string;
  vietnameseName?: string | null;
}): string {
  return subject.vietnameseName?.trim() || toVietnameseSubjectName(subject.name);
}

export function getSubjectApiSearchQueries(search: string): string[] {
  const trimmedSearch = search.trim();
  if (!trimmedSearch) return [""];

  const normalizedSearch = normalizeSearchKeyword(trimmedSearch);
  if (!normalizedSearch) return [trimmedSearch];

  const translatedQueries = SUBJECT_TRANSLATIONS
    .filter(([englishName, vietnameseName]) =>
      normalizeSearchKeyword(englishName).includes(normalizedSearch)
      || normalizeSearchKeyword(vietnameseName).includes(normalizedSearch),
    )
    .map(([englishName]) => englishName);

  return [...new Set([trimmedSearch, ...translatedQueries])];
}
