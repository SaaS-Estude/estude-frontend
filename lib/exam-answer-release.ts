import type { ExamSettings } from "@/types/assessment";

export function answerReleaseLabel(settings: ExamSettings): string {
  const policy = settings.answerReleasePolicy ||
    (settings.showCorrectAnswers ? "AFTER_EXAM_END" : "NEVER");
  switch (policy) {
    case "AFTER_SUBMIT": return "Ngay sau khi học sinh nộp bài";
    case "AFTER_EXAM_END": return "Sau khi kết thúc thời gian làm bài";
    case "AFTER_RESULT_PUBLISHED": return "Sau khi công bố điểm và kết thúc thời gian làm bài";
    default: return "Không phát hành";
  }
}
