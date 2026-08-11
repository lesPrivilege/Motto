// 项目本地域(.motto/agent.md)注入单元测试 —— 四判定:
//   存在(注入且项目原文逐字节保留)/ 缺失(零注入零副作用)/ 超限(截断+标注)/ 与身份段共存次序稳定。
// 运行:cd extensions/motto && node --test test/project-doc.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	PROJECT_DOC_LIMIT_BYTES,
	injectBrandIdentity,
	injectProjectDoc,
	readProjectDoc,
} from "../core.ts";

function makeProject() {
	return mkdtempSync(join(tmpdir(), "motto-project-doc-"));
}

function writeAgentMd(dir, content) {
	mkdirSync(join(dir, ".motto"), { recursive: true });
	writeFileSync(join(dir, ".motto", "agent.md"), content);
}

const DOC_CONTENT = [
	"# 示例项目",
	"",
	"- 维护语境:某某系统,每季度一次大版本。",
	"- 生态:对接 pi-lsp 与 pi-subagents。",
	"- 长期:dogfooding 从此目录始。",
].join("\n");

test("存在:注入且项目原文逐字节保留,段有明确标题标明来源", () => {
	const dir = makeProject();
	try {
		writeAgentMd(dir, DOC_CONTENT);
		const doc = readProjectDoc(dir);
		assert.ok(doc, "存在 .motto/agent.md 时必须读到");
		assert.equal(doc.truncated, false);
		assert.equal(doc.bytes, DOC_CONTENT.length);
		// 段含明确标题与来源。
		assert.ok(doc.section.includes("## Project context (.motto/agent.md)"), "段必须标明来源");
		// 项目原文逐字节保留(不增删改一个字)。
		assert.ok(doc.section.includes(DOC_CONTENT), "项目原文必须逐字节保留在段内");
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("注入:上游提示词原文逐字节不动,项目段整体追加在其后", () => {
	const dir = makeProject();
	try {
		writeAgentMd(dir, DOC_CONTENT);
		const doc = readProjectDoc(dir);
		const prompt = "# system prompt (upstream, byte-for-byte sacred)";
		const out = injectProjectDoc(prompt, doc);
		assert.equal(out.slice(0, prompt.length), prompt, "上游原文必须逐字节保留");
		assert.ok(out.startsWith(prompt));
		const tail = out.slice(prompt.length);
		assert.ok(tail.includes("## Project context (.motto/agent.md)"), "项目段必须整体位于原文之后");
		assert.ok(tail.includes(DOC_CONTENT));
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("缺失:零注入零副作用(无 .motto 目录 / 无 agent.md / 空文件 / 读取失败)", () => {
	const dir = makeProject();
	try {
		// 无 .motto 目录。
		assert.equal(readProjectDoc(dir), undefined, "无 .motto 目录必须静默跳过");
		// 有 .motto 目录但无 agent.md。
		mkdirSync(join(dir, ".motto"));
		assert.equal(readProjectDoc(dir), undefined, "无 agent.md 必须静默跳过");
		// 空文件。
		writeFileSync(join(dir, ".motto", "agent.md"), "");
		assert.equal(readProjectDoc(dir), undefined, "空文件必须静默跳过");
		// 不存在的目录(读取失败)。
		assert.equal(readProjectDoc(join(tmpdir(), "motto-nonexistent-dir-xyz")), undefined);
		// 副作用检查:扩展不得建目录、不得写文件、不得改写项目文件。
		assert.equal(readFileSync(join(dir, ".motto", "agent.md"), "utf8"), "", "不得改写项目文件");
		assert.equal(
			readProjectDoc(join(dir, "no-such-subdir")),
			undefined,
			"不得为缺失路径自建目录返回内容",
		);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("超限:截断到上限并在截断点注明", () => {
	const dir = makeProject();
	try {
		const big = "x".repeat(PROJECT_DOC_LIMIT_BYTES + 100);
		writeAgentMd(dir, big);
		const doc = readProjectDoc(dir);
		assert.ok(doc, "超限文件必须读到");
		assert.equal(doc.truncated, true);
		assert.equal(doc.bytes, PROJECT_DOC_LIMIT_BYTES + 100);
		// 段内正文恰为前 32KB(逐字节)。
		const body = "x".repeat(PROJECT_DOC_LIMIT_BYTES);
		assert.ok(doc.section.includes(body), "正文必须为前 32KB 逐字节");
		// 截断标注紧随 32KB 正文之后(截断点注明)。
		const idx = doc.section.indexOf(body);
		const afterBody = doc.section.slice(idx + body.length);
		assert.ok(afterBody.startsWith("\n\n> motto:"), "截断点后应为标注而非正文");
		assert.ok(afterBody.includes("已截断"), "标注须说明截断事实");
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("与身份段共存次序稳定:原文 → 身份段 → 项目段", () => {
	const dir = makeProject();
	try {
		writeAgentMd(dir, DOC_CONTENT);
		const doc = readProjectDoc(dir);
		const prompt = "# system prompt";
		const out = injectProjectDoc(injectBrandIdentity(prompt), doc);
		const identityAt = out.indexOf("## Motto identity");
		const docAt = out.indexOf("## Project context (.motto/agent.md)");
		assert.equal(out.slice(0, prompt.length), prompt, "原文逐字节在最先");
		assert.ok(identityAt > prompt.length, "身份段在原文之后");
		assert.ok(docAt > identityAt, "项目段在身份段之后(次序稳定)");
		assert.ok(out.includes("presented as Motto"), "身份段完整");
		assert.ok(out.includes(DOC_CONTENT), "项目段完整");
		// 三段互不交叠。
		assert.ok(out.indexOf("## Project context") === docAt, "项目段标题唯一出现");
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("collectFacts:context 行在 .motto/agent.md 存在时并列列出", async () => {
	const { collectFacts } = await import("../core.ts");
	const dir = makeProject();
	try {
		// 无 .motto/agent.md:context 不含项目本地正文。
		const without = collectFacts(dir);
		assert.equal(without.context.includes(".motto/agent.md"), false);
		// 有 .motto/agent.md:context 并列列出(与 AGENTS.md 同列)。
		writeAgentMd(dir, DOC_CONTENT);
		const withDoc = collectFacts(dir);
		assert.ok(withDoc.context.includes(".motto/agent.md"), "context 行必须列出 .motto/agent.md");
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
