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
global.window = { setTimeout: () => 0, clearTimeout: () => {} };
const challenge = {
  challengeId: "507f1f77bcf86cd799439011",
  expiresIn: 600,
  retryAfter: 60,
};
const textOf = (node) =>
  typeof node === "string"
    ? node
    : Array.isArray(node)
      ? node.map(textOf).join("")
      : textOf(node?.children ?? []);
function load(relative, mocks) {
  const filename = path.resolve(relative);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = mod.require.bind(mod);
  mod.require = (id) =>
    Object.hasOwn(mocks, id) ? mocks[id] : originalRequire(id);
  mod._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    filename,
  );
  return mod.exports;
}
function mocks(api, auth = {}, router = {}) {
  return {
    "@/lib/auth-api": { authApi: api },
    "@/lib/account-security": load("lib/account-security.ts", {}),
    "@/context/auth-context": { useAuth: () => auth },
    "next/navigation": { useRouter: () => router },
    "@/components/ui/form-control": {
      Input: (props) => React.createElement("input", props),
    },
    "@/components/ui/button": {
      Button: (props) => React.createElement("button", props),
    },
    "@/components/brand-logo": { BrandLogo: () => null },
    "./auth-notice": {
      AuthNotice: ({ message }) => React.createElement("p", null, message),
    },
  };
}
const input = (renderer, label) =>
  renderer.root
    .findAllByType("input")
    .find((node) => node.props.label === label);
const button = (renderer, label) =>
  renderer.root
    .findAllByType("button")
    .find((node) => textOf(node.props.children) === label);
async function fill(renderer, label, value) {
  await act(async () =>
    input(renderer, label).props.onChange({ target: { value } }),
  );
}
async function render(t, Component, props) {
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(Component, props));
  });
  t.after(async () => act(async () => renderer.unmount()));
  return renderer;
}
async function submit(renderer) {
  await act(async () => {
    await renderer.root
      .findByType("form")
      .props.onSubmit({ preventDefault() {} });
    await new Promise(setImmediate);
  });
}

test("recovery awaits the server, validates passwords and keeps the form on an invalid OTP", async (t) => {
  const requests = [];
  const confirmations = [];
  let reject = true;
  const { PasswordRecoveryPage } = load(
    "components/auth/password-recovery-page.tsx",
    mocks({
      requestPasswordReset: async (account) => {
        requests.push(account);
        return challenge;
      },
      resetPassword: async (payload) => {
        confirmations.push(payload);
        if (reject) throw new Error("OTP không hợp lệ");
      },
    }),
  );
  const ui = await render(t, PasswordRecoveryPage, { role: "STUDENT" });
  await fill(ui, "Tên tài khoản", " STUDENT.ONE ");
  await submit(ui);
  assert.deepEqual(requests, ["student.one"]);
  assert.equal(input(ui, "Tên tài khoản").props.disabled, true);
  assert.equal(button(ui, "Gửi lại sau 60s").props.disabled, true);
  await fill(ui, "Mã xác thực", "123456");
  await fill(ui, "Mật khẩu mới", "New@12345");
  await fill(ui, "Nhập lại mật khẩu mới", "Other@12345");
  await submit(ui);
  assert.equal(confirmations.length, 0);
  await fill(ui, "Nhập lại mật khẩu mới", "New@12345");
  await submit(ui);
  assert.match(textOf(ui.toJSON()), /OTP không hợp lệ/);
  assert.equal(input(ui, "Mã xác thực").props.value, "123456");
  assert.deepEqual(confirmations[0], {
    challengeId: challenge.challengeId,
    code: "123456",
    newPassword: "New@12345",
    confirmNewPassword: "New@12345",
  });
  reject = false;
  await submit(ui);
  assert.match(textOf(ui.toJSON()), /Đã đặt lại mật khẩu/);
  assert.equal(ui.root.findAllByType("input").length, 0);
});

test("first login verifies the exact email, invalidates the code after editing email, and logs out only after success", async (t) => {
  const requests = [];
  const completions = [];
  const redirects = [];
  let logouts = 0;
  let fail = true;
  const { FirstLoginSetupForm } = load(
    "components/auth/first-login-setup-form.tsx",
    mocks(
      {
        requestFirstLoginOtp: async (email) => {
          requests.push(email);
          return { ...challenge, retryAfter: 0 };
        },
        completeFirstLogin: async (payload) => {
          completions.push(payload);
          if (fail) throw new Error("Mã đã hết hạn");
        },
      },
      {
        user: { role: "STUDENT", requiresFirstLoginSetup: true },
        isInitializing: false,
        signOut: async () => {
          logouts++;
        },
      },
      { replace: (url) => redirects.push(url) },
    ),
  );
  const ui = await render(t, FirstLoginSetupForm, { modal: true });
  assert.equal(ui.root.findByType("section").props["aria-modal"], true);
  await fill(ui, "Email khôi phục", "invalid");
  await act(async () => button(ui, "Gửi mã xác thực").props.onClick());
  assert.equal(requests.length, 0);
  await fill(ui, "Email khôi phục", " FIRST@EXAMPLE.TEST ");
  await act(async () => {
    button(ui, "Gửi mã xác thực").props.onClick();
    await new Promise(setImmediate);
  });
  await fill(ui, "Mã xác thực", "123456");
  await fill(ui, "Email khôi phục", "new@example.test");
  assert.equal(input(ui, "Mã xác thực").props.value, "");
  assert.equal(input(ui, "Mã xác thực").props.disabled, true);
  await act(async () => {
    button(ui, "Gửi mã xác thực").props.onClick();
    await new Promise(setImmediate);
  });
  await fill(ui, "Mã xác thực", "123456");
  await fill(ui, "Mật khẩu mới", "New@12345");
  await fill(ui, "Nhập lại mật khẩu mới", "New@12345");
  await submit(ui);
  assert.equal(logouts, 0);
  assert.match(textOf(ui.toJSON()), /Mã đã hết hạn/);
  fail = false;
  await submit(ui);
  assert.equal(logouts, 1);
  assert.deepEqual(redirects, ["/student/login?setup=complete"]);
  assert.equal(completions[0].email, "new@example.test");
  assert.deepEqual(requests, ["first@example.test", "new@example.test"]);
});

test("restoring a first-login session renders the mandatory popup before loading student workspace data", async (t) => {
  for (const pending of [true, false]) {
    let dataLoads = 0;
    const { AuthProvider, useAuth } = load("context/auth-context.tsx", {
      "@/components/auth/first-login-setup-form": {
        FirstLoginSetupForm: () =>
          React.createElement("dialog", null, "Verify email"),
      },
      "@/lib/auth-api": {
        authApi: {
          setUnauthorizedHandler() {},
          refresh: async () => {},
          me: async () => ({
            role: "STUDENT",
            requiresFirstLoginSetup: pending,
          }),
        },
      },
      "@/lib/portal": { getCurrentPortalRole: () => "STUDENT" },
    });
    function Workspace() {
      const { user, isInitializing } = useAuth();
      React.useEffect(() => {
        if (!isInitializing && user) dataLoads++;
      }, [user, isInitializing]);
      return React.createElement("article", null, "Student workspace");
    }
    const ui = await render(t, AuthProvider, {
      children: React.createElement(Workspace),
    });
    assert.equal(ui.root.findAllByType("dialog").length, pending ? 1 : 0);
    assert.equal(dataLoads, pending ? 0 : 1);
    await act(async () => ui.unmount());
  }
});
