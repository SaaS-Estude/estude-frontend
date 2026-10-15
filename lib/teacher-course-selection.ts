export function selectedTeacherSubjectId(
  subjects: readonly { id: string }[],
  search: string,
): string {
  const requestedId = new URLSearchParams(search).get("subjectId");
  return subjects.find((subject) => subject.id === requestedId)?.id ?? subjects[0]?.id ?? "";
}
