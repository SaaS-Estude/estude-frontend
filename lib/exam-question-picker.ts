import type { Question } from "@/types/assessment";

export function eligibleExamQuestions(questions: Question[], subjectId: string, selectedIds: ReadonlySet<string>) {
  return questions.filter((question) =>
    !question.disabled &&
    (question.subjectId === subjectId || !question.subjectId || selectedIds.has(question.id)),
  );
}

export function examPickerFolderCounts(questions: Pick<Question, "folderId">[]) {
  return questions.reduce<Record<string, number>>((counts, question) => {
    counts.all = (counts.all ?? 0) + 1;
    const key = question.folderId ?? "unfiled";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, { all: 0, unfiled: 0 });
}
