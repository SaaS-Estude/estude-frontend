/* CommonJS is required by this isolated TypeScript component test loader. */
/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { create, act } = require("react-test-renderer");
global.IS_REACT_ACT_ENVIRONMENT = true;
global.requestAnimationFrame = (callback) => callback();

const flush = async () => {
  await new Promise(setImmediate);
  await new Promise(setImmediate);
};
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};
const flashcard = (id) => ({
  id,
  document: { id: "document", name: "lesson.pdf" },
  concept: { id: "concept", title: "Định luật Newton" },
  front: `Question ${id}`,
  back: `Answer ${id}`,
  difficulty: "MEDIUM",
  queueKind: id === "one" ? "DUE" : "NEW",
  generationVersion: 1,
  review: null,
  sourceReferences: [{ pageNumber: 2, section: "Section", excerpt: "Evidence" }],
});
const queue = (cards) => ({
  cards,
  actualSize: cards.length,
  dueCount: cards.filter((card) => card.queueKind === "DUE").length,
  newCount: cards.filter((card) => card.queueKind === "NEW").length,
  totalAvailable: cards.length,
  totalCards: cards.length,
  scheduledCount: 0,
  mode: "DUE",
  asOf: new Date().toISOString(),
});
const childText = (value) => {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(childText).join("");
  if (React.isValidElement(value)) return childText(value.props.children);
  return "";
};

async function setup(t, { load = () => queue([flashcard("one"), flashcard("two")]), review = () => ({}), storedSession = null, materialId } = {}) {
  const calls = [];
  const completions = [];
  const storage = new Map();
  global.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  };
  if (storedSession) storage.set(`estude:study-coach:flashcards:v1:${materialId ?? "all"}`, JSON.stringify(storedSession));
  const router = { push: () => undefined };
  const filename = path.resolve("components/student/student-flashcards-page.tsx");
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (id) => {
    if (id === "next/navigation") return { useRouter: () => router, useParams: () => ({ materialId }) };
    if (id === "lucide-react") {
      return new Proxy({}, { get: (_target, name) => (props) => React.createElement("svg", { ...props, "data-icon": String(name) }) });
    }
    if (id === "@/components/student/student-shell") {
      return { StudentShell: ({ children }) => React.createElement("main", null, children) };
    }
    if (id === "@/components/ui/button") {
      return { Button: ({ children, ...props }) => React.createElement("button", props, children) };
    }
    if (id === "@/lib/study-coach-api") {
      return {
        studyCoachService: {
          getDueQueue: async (documentId, mode) => load(documentId, mode),
          reviewFlashcard: async (cardId, rating, clientEventId) => {
            calls.push({ cardId, rating, clientEventId });
            return review(cardId, rating, clientEventId);
          },
          completeFlashcardSession: async (input) => { completions.push(input); return {}; },
        },
      };
    }
    return originalRequire(id);
  };
  loaded._compile(compiled, filename);
  const Page = loaded.exports.StudentFlashcardsPage;
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(Page), {
      createNodeMock: () => ({ focus() {} }),
    });
    await flush();
  });
  t.after(async () => {
    await act(async () => {
      renderer.unmount();
      await flush();
    });
  });
  const text = () => JSON.stringify(renderer.toJSON());
  const buttons = () => renderer.root.findAllByType("button");
  const button = (label) => buttons().find((item) => childText(item.props.children).includes(label));
  const hasText = (value) => renderer.root.findAll((item) => childText(item.props.children).includes(value)).length > 0;
  return { renderer, calls, completions, text, button, hasText };
}

test("loads a stable session, reveals the answer, and advances only after review succeeds", async (t) => {
  const reviewRequest = deferred();
  const ui = await setup(t, { review: () => reviewRequest.promise });
  assert.match(ui.text(), /Question one/);
  assert.doesNotMatch(ui.text(), /Answer one/);

  await act(async () => {
    ui.button("Hiện đáp án").props.onClick();
  });
  assert.match(ui.text(), /Answer one/);

  await act(async () => {
    const rating = ui.button("3 · Tốt");
    rating.props.onClick();
    rating.props.onClick();
    await flush();
  });
  assert.equal(ui.calls.length, 1, "double click must submit one review");
  assert.match(ui.text(), /Đang lưu lịch ôn/);
  assert.match(ui.text(), /Question one/);

  await act(async () => {
    reviewRequest.resolve({});
    await flush();
  });
  assert.match(ui.text(), /Question two/);
  assert.equal(ui.hasText("1/2 đã ôn"), true);
});

test("resumes the remaining stable queue and progress from browser storage", async (t) => {
  const ui = await setup(t, {
    storedSession: {
      cardIds: ["two"],
      initialTotal: 2,
      reviewed: 1,
    },
  });
  assert.match(ui.text(), /Question two/);
  assert.equal(ui.hasText("1/2 đã ôn"), true);
});

test("keeps the card on network failure and retries with the same clientEventId", async (t) => {
  let attempts = 0;
  const ui = await setup(t, {
    load: () => queue([flashcard("one")]),
    review: () => {
      if (attempts++ === 0) throw new Error("Mất kết nối");
      return {};
    },
  });
  await act(async () => {
    ui.button("Hiện đáp án").props.onClick();
  });
  await act(async () => {
    ui.button("1 · Học lại").props.onClick();
    await flush();
  });
  assert.match(ui.text(), /Mất kết nối/);
  assert.match(ui.text(), /Question one/);
  await act(async () => {
    ui.button("Thử gửi lại").props.onClick();
    await flush();
  });
  assert.equal(ui.calls.length, 2);
  assert.equal(ui.calls[0].clientEventId, ui.calls[1].clientEventId);
  assert.match(ui.text(), /Hoàn thành phiên học/);
});

test("shows a retryable loading error and the empty queue state", async (t) => {
  let requests = 0;
  const ui = await setup(t, {
    load: () => {
      if (requests++ === 0) throw new Error("Không tải được");
      return queue([]);
    },
  });
  assert.match(ui.text(), /Không tải được/);
  await act(async () => {
    ui.button("Thử lại").props.onClick();
    await flush();
  });
  assert.match(ui.text(), /Chưa có flashcard cần học/);
  assert.match(ui.text(), /Tải tài liệu/);
});

test("offers all-card practice when no card is due and loads it explicitly", async (t) => {
  const modes = [];
  const ui = await setup(t, {
    load: (_documentId, mode) => {
      modes.push(mode);
      return mode === "ALL"
        ? { ...queue([flashcard("one")]), mode: "ALL" }
        : { ...queue([]), totalCards: 1, scheduledCount: 1 };
    },
  });

  await act(async () => {
    ui.button("Ôn lại tất cả thẻ").props.onClick();
    await flush();
  });

  assert.deepEqual(modes, ["DUE", "ALL"]);
  assert.match(ui.text(), /Question one/);
});

test("scopes the flashcard queue and browser session to the selected material", async (t) => {
  const requestedDocuments = [];
  const ui = await setup(t, {
    materialId: "geography",
    load: (documentId) => {
      requestedDocuments.push(documentId);
      return queue([{ ...flashcard("geo"), document: { id: "geography", name: "Địa lý.pdf" } }]);
    },
  });

  assert.deepEqual(requestedDocuments, ["geography"]);
  assert.match(ui.text(), /Địa lý\.pdf/);
});

test("counts one completed flashcard session instead of individual cards", async (t) => {
  const ui = await setup(t, { materialId: "document", load: () => queue([flashcard("one")]) });
  await act(async () => { ui.button("Hiện đáp án").props.onClick(); });
  await act(async () => { ui.button("3 · Tốt").props.onClick(); await flush(); });
  assert.equal(ui.completions.length, 1);
  assert.equal(ui.completions[0].documentId, "document");
  assert.equal(ui.completions[0].reviewedCardCount, 1);
});
