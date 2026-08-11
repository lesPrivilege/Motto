import assert from "node:assert/strict";
import test, { after } from "node:test";
import mottoGeminiVision from "../index.ts";
import {
  cleanupTempDirs,
  completedBody,
  installFetch,
  jsonResponse,
  makeTempDir,
  PNG_1x1_RED,
  trackTempDir,
  writeFixture,
} from "./fixtures.mjs";

after(async () => await cleanupTempDirs());

test("pi extension resolves the Google credential through ModelRegistry", async () => {
  let registered;
  mottoGeminiVision({
    registerTool(tool) {
      registered = tool;
    },
  });

  assert.equal(registered.name, "motto_vision");
  const dir = trackTempDir(await makeTempDir());
  await writeFixture(dir, "shot.png", PNG_1x1_RED);
  const mock = installFetch(() => jsonResponse(200, completedBody("A red pixel.")));
  try {
    const result = await registered.execute(
      "call-1",
      { path: "shot.png", question: "What color is visible?" },
      new AbortController().signal,
      undefined,
      {
        cwd: dir,
        modelRegistry: {
          async getApiKeyForProvider(provider) {
            assert.equal(provider, "google");
            return "local-auth-key";
          },
        },
      },
    );

    assert.deepEqual(result.content, [{ type: "text", text: "A red pixel." }]);
    assert.equal(mock.calls[0].init.headers["x-goog-api-key"], "local-auth-key");
  } finally {
    mock.restore();
  }
});
