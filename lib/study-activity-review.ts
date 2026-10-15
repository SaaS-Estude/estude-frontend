const labels = [
  { key: "Hoạt động", tone: "text-blue-700" },
  { key: "Xu hướng kết quả", tone: "text-amber-700" },
  { key: "Đề xuất tiếp theo", tone: "text-emerald-700" },
] as const;

export function studyActivityReviewSections(comment: string) {
  const lines = comment
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const structured = labels.map(({ key, tone }) => {
    const prefix = `${key}:`;
    const line = lines.find((item) =>
      item.toLocaleLowerCase("vi-VN").startsWith(prefix.toLocaleLowerCase("vi-VN")),
    );
    return { label: key, tone, content: line?.slice(prefix.length).trim() ?? "" };
  });
  if (structured.every((item) => item.content)) return structured;

  const sentences = comment
    .match(/[^.!?]+(?:[.!?]+|$)/g)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean) ?? [];
  return [
    { label: labels[0].key, tone: labels[0].tone, content: sentences[0] ?? comment },
    {
      label: labels[1].key,
      tone: labels[1].tone,
      content: sentences.length > 2
        ? sentences.slice(1, -1).join(" ")
        : "Chưa có đủ nhận xét để xác định xu hướng.",
    },
    {
      label: labels[2].key,
      tone: labels[2].tone,
      content: sentences.length > 1
        ? sentences.at(-1) ?? ""
        : "Chưa có đề xuất tiếp theo.",
    },
  ];
}
