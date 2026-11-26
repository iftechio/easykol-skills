import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

async function harness(t, response = "success", redirectTarget = "/redirected") {
  const dir = mkdtempSync(join(tmpdir(), "easykol-email-"));
  const requests = [];
  const server = createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    requests.push({
      method: req.method,
      path: req.url,
      body: raw ? JSON.parse(raw) : undefined,
      email: req.headers["ek-api-email"],
    });
    if (response === "disconnect") return req.socket.destroy();
    res.setHeader("content-type", "application/json");
    if (response === "error") {
      res.statusCode = 503;
      return res.end('{"message":"unavailable"}');
    }
    if (typeof response === "number" && req.url !== redirectTarget) {
      res.statusCode = response;
      res.setHeader("location", redirectTarget);
      return res.end();
    }
    if (req.method === "PUT" && req.url.endsWith("/followups")) {
      if (response === "empty-sequence-receipt") return res.end();
      const templateId = decodeURIComponent(req.url.split("/").at(-2));
      const { followupEmails } = JSON.parse(raw);
      return res.end(JSON.stringify({
        statusCode: 200,
        data: {
          templateId: response === "wrong-template" ? "another-template" : templateId,
          followupEmails: response === "wrong-sequence" ? [] : followupEmails,
        },
      }));
    }
    const data =
      req.url === "/external/v1/email/send"
        ? response === "missing-record"
          ? {}
          : {
              record: {
                id: "record-1",
                submissionState:
                  response === "unconfirmed" ? "UNCONFIRMED" : "ACCEPTED",
                sentAt:
                  response === "unconfirmed" ? null : "2026-11-17T10:00:00Z",
              },
              followupThread: null,
            }
        : { id: "record-1" };
    res.end(
      JSON.stringify({
        statusCode: 200,
        error: null,
        message: "Success",
        data,
      }),
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  writeFileSync(
    join(dir, "config.json"),
    JSON.stringify({
      apiKey: "test-only",
      email: "actor@example.com",
      apiBase: base,
    }),
  );
  const bodyPath = join(dir, "body.json");
  writeFileSync(
    bodyPath,
    JSON.stringify({
      email: "recipient@example.com",
      subject: "Hello",
      content: "Hi",
    }),
  );
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  });
  const run = (args, stdin) =>
    new Promise((resolve) => {
      const child = spawn(process.execPath, [process.env.EASYKOL_TEST_ENTRY || "dist/index.js", ...args], {
        env: {
          ...process.env,
          EASYKOL_CONFIG_DIR: dir,
          EASYKOL_API_BASE: base,
        },
        stdio: ["pipe", "pipe", "pipe"],
      });
      let out = "",
        err = "";
      child.stdout.on("data", (v) => (out += v));
      child.stderr.on("data", (v) => (err += v));
      child.stdin.end(stdin);
      child.on("close", (code) =>
        resolve({ code, json: out.trim() ? JSON.parse(out) : null, err }),
      );
    });
  return { run, requests, bodyPath };
}

test("template writes preserve JSON, auth identity and encoded template ID", async (t) => {
  const h = await harness(t);
  const body = {
    name: "Collaboration",
    content: "Hello {{nickname}}\nHi",
    cc: ["team@example.com"],
  };
  const r = await h.run(
    ["email-template-update", "--id", "tpl/a", "--shared", "--body-file", "-"],
    JSON.stringify(body),
  );
  assert.equal(r.code, 0);
  assert.deepEqual(h.requests, [
    {
      method: "PATCH",
      path: "/external/v1/email/enterprise/templates/tpl%2Fa",
      body,
      email: "actor@example.com",
    },
  ]);
});
test("actual send requires explicit flag and makes no request when absent", async (t) => {
  const h = await harness(t);
  const r = await h.run(["email-send", "--body-file", h.bodyPath]);
  assert.equal(r.code, 6);
  const prefilled = await h.run(
    ["email-send", "--body-file", "-"],
    JSON.stringify({
      email: "recipient@example.com",
      subject: "Hello",
      content: "Hi",
      confirmSend: true,
    }),
  );
  assert.equal(prefilled.code, 6);
  assert.equal(h.requests.length, 0);
});
test("send confirms one delivery and returns its result", async (t) => {
  const h = await harness(t);
  const r = await h.run([
    "email-send",
    "--body-file",
    h.bodyPath,
    "--confirm-send",
  ]);
  assert.equal(r.code, 0);
  assert.equal(r.json.data.record.id, "record-1");
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].body.confirmSend, true);
});
for (const response of ["error", "disconnect"])
  test(`uncertain send (${response}) is never retried`, async (t) => {
    const h = await harness(t, response);
    const r = await h.run([
      "email-send",
      "--body-file",
      h.bodyPath,
      "--confirm-send",
    ]);
    assert.equal(r.code, 5);
    assert.equal(h.requests.length, 1);
    assert.match(JSON.stringify(r.json), /do not resend automatically/);
  });
test("scheduled change flag is required and allows an authorized clear", async (t) => {
  const h = await harness(t);
  const args = ["email-followups-set", "--id", "template", "--body-file", "-"];
  assert.equal((await h.run(args, '{"followupEmails":[]}')).code, 6);
  assert.equal(
    (await h.run(args, '{"followupEmails":[],"confirmScheduledChanges":true}'))
      .code,
    6,
  );
  assert.equal(h.requests.length, 0);
  assert.equal(
    (
      await h.run(
        [...args, "--confirm-scheduled-changes"],
        '{"followupEmails":[]}',
      )
    ).code,
    0,
  );
  assert.deepEqual(h.requests[0].body, {
    followupEmails: [],
    confirmScheduledChanges: true,
  });
  const followupEmails = [{ content: "Follow-up", daysAfter: 3 }];
  const updated = await h.run(
    [...args, "--confirm-scheduled-changes"],
    JSON.stringify({ followupEmails }),
  );
  assert.equal(updated.code, 0);
  assert.deepEqual(updated.json.data, { templateId: "template", followupEmails });
});

for (const response of ["empty-sequence-receipt", "wrong-template", "wrong-sequence"])
  test(`an unconfirmed follow-up change (${response}) is not retried`, async (t) => {
    const h = await harness(t, response);
    const result = await h.run(
      [
        "email-followups-set",
        "--id",
        "template",
        "--body-file",
        "-",
        "--confirm-scheduled-changes",
      ],
      '{"followupEmails":[{"content":"Follow-up","daysAfter":3}]}',
    );
    assert.equal(result.code, 5);
    assert.match(result.json.error.message, /uncertain; do not retry automatically/);
    assert.equal(h.requests.length, 1);
  });
test("result queries and sender configuration use email endpoints", async (t) => {
  const h = await harness(t);
  for (const args of [
    ["email-record", "--id", "record-1"],
    [
      "email-records",
      "--page",
      "2",
      "--page-size",
      "5",
      "--to",
      "a@example.com",
    ],
    ["email-sender-default", "--id", "sender-1"],
    ["email-sender-limit", "--id", "sender-1", "--body-file", "-"],
  ])
    assert.equal((await h.run(args, '{"autoEmailDailyLimit":0}')).code, 0);
  assert.match(h.requests[1].path, /page=2&pageSize=5&to=a%40example.com/);
  assert.equal(
    h.requests[2].path,
    "/external/v1/email/senders/sender-1/default",
  );
  assert.equal(h.requests[3].body.autoEmailDailyLimit, 0);
});
test("invalid body causes no network request", async (t) => {
  const h = await harness(t);
  for (const input of ["[]", "null", "{bad"])
    assert.equal(
      (await h.run(["email-template-create", "--body-file", "-"], input)).code,
      6,
    );
  assert.equal(h.requests.length, 0);
});

for (const response of ["missing-record", "unconfirmed"])
  test(`HTTP 200 with ${response} is uncertain and never resent`, async (t) => {
    const h = await harness(t, response);
    const r = await h.run([
      "email-send",
      "--body-file",
      h.bodyPath,
      "--confirm-send",
    ]);
    assert.equal(r.code, 5);
    assert.equal(h.requests.length, 1);
    assert.match(JSON.stringify(r.json), /do not resend automatically/);
  });

for (const status of [301, 302, 303, 304, 307, 308])
  test(`HTTP ${status} does not repeat a send or a schedule change`, async (t) => {
    const h = await harness(t, status);
    const sent = await h.run([
      "email-send",
      "--body-file",
      h.bodyPath,
      "--confirm-send",
    ]);
    const scheduled = await h.run(
      [
        "email-followups-set",
        "--id",
        "template",
        "--body-file",
        "-",
        "--confirm-scheduled-changes",
      ],
      '{"followupEmails":[{"content":"Follow-up","daysAfter":3}]}',
    );
    assert.equal(sent.code, 5);
    assert.match(sent.json.error.message, /uncertain; do not resend automatically/);
    assert.match(sent.json.action.hint, /email-record/);
    assert.equal(scheduled.code, 5);
    assert.match(scheduled.json.error.message, /uncertain; do not retry automatically/);
    assert.match(scheduled.json.action.hint, /email-followups-get.*pending plans/);
    assert.deepEqual(
      h.requests.map(({ method, path }) => [method, path]),
      [
        ["POST", "/external/v1/email/send"],
        ["PUT", "/external/v1/email/templates/template/followups"],
      ],
    );
  });

test("other email writes never contact a redirect target", async (t) => {
  const redirected = [];
  const target = createServer((req, res) => {
    redirected.push(req.headers);
    res.setHeader("content-type", "application/json");
    res.end('{"data":{"id":"redirected"}}');
  });
  await new Promise((resolve) => target.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => target.close(resolve)));
  const redirectUrl = `http://127.0.0.1:${target.address().port}/redirected`;
  const h = await harness(t, 307, redirectUrl);
  const writes = [
    ["email-template-create", "POST", "/email/templates", ["--body-file", "-"]],
    ["email-template-update", "PATCH", "/email/enterprise/templates/test", ["--id", "test", "--shared", "--body-file", "-"]],
    ["email-followup-template-create", "POST", "/email/follow-up-templates", ["--body-file", "-"]],
    ["email-followup-template-update", "PATCH", "/email/follow-up-templates/test", ["--id", "test", "--body-file", "-"]],
    ["email-sender-default", "POST", "/email/senders/test/default", ["--id", "test"]],
    ["email-sender-nickname", "PATCH", "/email/senders/test/nickname", ["--id", "test", "--body-file", "-"]],
    ["email-sender-limit", "PATCH", "/email/senders/test/auto-email-limit", ["--id", "test", "--body-file", "-"]],
  ];
  for (const [command, , , args] of writes) {
    const result = await h.run([command, ...args], "{}");
    assert.equal(result.code, 5, command);
    assert.match(result.json.error.message, /Check its current state/);
    assert.ok(!result.json.error.message.includes(redirectUrl));
  }
  assert.deepEqual(
    h.requests.map(({ method, path }) => [method, path]),
    writes.map(([, method, path]) => [method, `/external/v1${path}`]),
  );
  assert.deepEqual(redirected, []);
});

test("email reads and non-email writes retain standard redirect handling", async (t) => {
  const h = await harness(t, 307);
  assert.equal((await h.run(["email-records"])).code, 0);
  assert.equal(
    (await h.run(["creators-by-email", "--email", "fixture@example.com"])).code,
    0,
  );
  assert.deepEqual(
    h.requests.map(({ method, path }) => [method, path.split("?")[0]]),
    [
      ["GET", "/external/v1/email/records"],
      ["GET", "/redirected"],
      ["POST", "/external/v1/creators/by-email"],
      ["POST", "/redirected"],
    ],
  );
});
