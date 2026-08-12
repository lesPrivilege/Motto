import assert from "node:assert/strict";
import test from "node:test";
import { checkManifest, gitFragment, isGitSpecifier, isPinnedGitSpecifier } from "./check-pinned-deps.mjs";

test("git fragment 提取:兼容 `#sha` 与 `#sha:subdir`", () => {
	assert.equal(gitFragment("github:user/repo#a1b2c3d4"), "a1b2c3d4");
	assert.equal(gitFragment("git+https://github.com/user/repo.git#a1b2c3d4e5f67890abcdef1234567890abcdef12"), "a1b2c3d4e5f67890abcdef1234567890abcdef12");
	assert.equal(gitFragment("github:user/repo#a1b2c3d4:packages/foo"), "a1b2c3d4");
	assert.equal(gitFragment("github:user/repo"), "");
	assert.equal(gitFragment("github:user/repo#main"), "main");
});

test("git 类 specifier 识别(git+/github:/git:/ssh:/git:// 与裸 https .git URL)", () => {
	for (const s of [
		"git+https://github.com/user/repo.git#a1b2c3d4",
		"github:user/repo#a1b2c3d4",
		"git://github.com/user/repo.git#a1b2c3d4",
		"git+ssh://git@github.com/user/repo.git#a1b2c3d4",
		"https://github.com/user/repo.git#a1b2c3d4",
	]) {
		assert.equal(isGitSpecifier(s), true, s);
	}
	// 本地/内部与 tarball 不算 git 类
	for (const s of ["workspace:*", "file:../foo", "link:./x", "portal:./y", "https://example.com/pkg-1.0.0.tgz"]) {
		assert.equal(isGitSpecifier(s), false, s);
	}
});

test("git 依赖必须钉 commit SHA,禁浮动 branch/tag", () => {
	assert.equal(isPinnedGitSpecifier("github:user/repo#a1b2c3d4"), true);
	assert.equal(isPinnedGitSpecifier("github:user/repo#0123456789abcdef0123456789abcdef01234567"), true);
	assert.equal(isPinnedGitSpecifier("github:user/repo#main"), false);
	assert.equal(isPinnedGitSpecifier("github:user/repo#v1.0.0"), false);
	assert.equal(isPinnedGitSpecifier("github:user/repo"), false);
	assert.equal(isPinnedGitSpecifier("git+https://github.com/user/repo.git#release/2026"), false);
});

test("checkManifest:浮动 git 依赖报错,钉 SHA 通过", () => {
	const file = "package.json";
	const floating = {
		dependencies: {
			"pi-rewind": "github:user/pi-rewind#main",
		},
	};
	const failures = checkManifest(file, floating);
	assert.equal(failures.length, 1);
	assert.match(failures[0], /github:user\/pi-rewind#main/);
	assert.match(failures[0], /pinned to a commit SHA/);

	const pinned = {
		dependencies: {
			"pi-rewind": "github:user/pi-rewind#a1b2c3d4e5f67890abcdef1234567890abcdef12",
		},
	};
	assert.equal(checkManifest(file, pinned).length, 0);
});

test("checkManifest:精确版本与本地/tarball 通过,浮动版本报错", () => {
	const file = "package.json";
	const good = {
		dependencies: {
			"left-pad": "1.3.0",
			"some-tarball": "https://example.com/pkg-1.0.0.tgz",
			"local": "workspace:*",
		},
	};
	assert.equal(checkManifest(file, good).length, 0);

	const bad = {
		dependencies: {
			"left-pad": "^1.3.0",
		},
	};
	const failures = checkManifest(file, bad);
	assert.equal(failures.length, 1);
	assert.match(failures[0], /must be pinned/);
});

test("checkManifest:内部 workspace 依赖(@earendil-works/pi-*)跳过", () => {
	const file = "package.json";
	const manifest = {
		dependencies: {
			"@earendil-works/pi-coding-agent": "0.84.1",
			"@earendil-works/pi-tui": "0.84.1",
		},
	};
	assert.equal(checkManifest(file, manifest).length, 0);
});
