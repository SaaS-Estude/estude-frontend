/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const read = (file) => fs.readFileSync(file, "utf8");

test("teacher support inbox exposes unread, status and reply workflows", () => {
  const page = read("components/assessment/learning-support-inbox-page.tsx");
  const api = read("lib/learning-support-api.ts");
  const shell = read("components/assessment/assessment-shell.tsx");

  assert.match(page, /Hộp thư hỗ trợ học sinh/);
  assert.match(page, /Chờ xử lý/);
  assert.match(page, /Đang xử lý/);
  assert.match(page, /Đánh dấu đã xử lý/);
  assert.match(page, /Phản hồi học sinh/);
  assert.match(api, /support-requests\/unread-count/);
  assert.match(api, /support-requests\/\$\{encodeURIComponent\(requestId\)\}\/replies/);
  assert.match(shell, /supportUnreadCount/);
  assert.match(shell, /Yêu cầu hỗ trợ/);
});

test("student support keeps the current page and renders conversation history", () => {
  const page = read("components/assessment/student-learning-plans-page.tsx");

  assert.match(page, /sendSupportRequest/);
  assert.match(page, /Lịch sử trao đổi/);
  assert.match(page, /trang vẫn giữ nguyên vị trí hiện tại/);
  assert.doesNotMatch(
    page,
    /run\(\(\) => learningPlanService\.reportDifficulty/,
  );
});

test("teacher support inbox is protected by the existing submissions permission", () => {
  const permissions = read("lib/permissions.ts");
  const route = read("app/teacher/support-requests/page.tsx");

  assert.match(permissions, /path === "\/teacher\/support-requests"/);
  assert.match(route, /allowedRole="TEACHER"/);
});
