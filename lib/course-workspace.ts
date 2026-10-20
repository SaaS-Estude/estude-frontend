export function currentCourseId(): string {
  return typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("courseOfferingId") ?? "";
}

export function courseWorkspaceHref(href: string, courseId = currentCourseId()): string {
  if (!courseId) return href;
  const [path, search = ""] = href.split("?");
  const query = new URLSearchParams(search);
  query.set("courseOfferingId", courseId);
  return `${path}?${query}`;
}
