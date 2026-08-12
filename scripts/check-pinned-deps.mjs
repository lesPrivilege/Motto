import { readdirSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

const dependencySections = ["dependencies", "devDependencies", "optionalDependencies"];
const exactVersionPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const ignoredDirectories = new Set([".git", "dist", "node_modules"]);
const packageJsonFiles = [];

// 依赖形态判定（第三方只 lock、禁浮动 main 宪制）:
//  - 本地/内部:workspace: / file: / link: / portal: —— 跳过
//  - git 类:git+ / github: / git: / ssh: / git:// 前缀,及裸 https git URL(以 .git 结尾)
//    —— 必须钉 commit SHA,禁浮动 branch/tag(如 #main / #v1.0)
//  - 远端 tarball URL(https 非 .git) —— 内容不可变,跳过
//  - 其余 —— 必须精确版本
const localSpecifierPattern = /^(?:workspace:|file:|link:|portal:)/;
const gitSpecifierPattern = /^(?:git\+|github:|git:|ssh:|git:\/\/)/;
const bareGitUrlPattern = /^https?:\/\/[^#\s]+\.git(?:#|$)/i;
const remoteUrlPattern = /^https?:\/\//;
const gitShaFragmentPattern = /^[0-9a-f]{7,40}$/i;

function collectPackageJsonFiles(directory) {
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			if (!ignoredDirectories.has(entry.name)) {
				collectPackageJsonFiles(join(directory, entry.name));
			}
			continue;
		}

		if (entry.isFile() && entry.name === "package.json") {
			packageJsonFiles.push(join(directory, entry.name));
		}
	}
}

function isInternalWorkspaceDependency(name) {
	return name.startsWith("@earendil-works/pi-");
}

function isLocalSpecifier(specifier) {
	return localSpecifierPattern.test(specifier);
}

function isGitSpecifier(specifier) {
	return gitSpecifierPattern.test(specifier) || bareGitUrlPattern.test(specifier);
}

function isRemoteUrlSpecifier(specifier) {
	return remoteUrlPattern.test(specifier) && !isGitSpecifier(specifier);
}

// git 依赖的 commit-ish 片段:`...repo#<fragment>`;支持 `#<sha>:subdir`(取 `:` 前)。
function gitFragment(specifier) {
	const hashIndex = specifier.lastIndexOf("#");
	if (hashIndex < 0) return "";
	const fragment = specifier.slice(hashIndex + 1);
	const subdirIndex = fragment.indexOf(":");
	return subdirIndex >= 0 ? fragment.slice(0, subdirIndex) : fragment;
}

function isPinnedGitSpecifier(specifier) {
	return gitShaFragmentPattern.test(gitFragment(specifier));
}

function getVersionSpecifier(specifier) {
	if (!specifier.startsWith("npm:")) return specifier;
	const aliasTarget = specifier.slice("npm:".length);
	const versionSeparator = aliasTarget.lastIndexOf("@");
	if (versionSeparator <= 0) return specifier;
	return aliasTarget.slice(versionSeparator + 1);
}

function checkManifest(file, packageJson) {
	const manifestFailures = [];
	for (const section of dependencySections) {
		const dependencies = packageJson[section];
		if (!dependencies) continue;

		for (const [name, specifier] of Object.entries(dependencies)) {
			if (isInternalWorkspaceDependency(name)) continue;
			if (isLocalSpecifier(specifier)) continue;
			if (isGitSpecifier(specifier)) {
				if (!isPinnedGitSpecifier(specifier)) {
					manifestFailures.push(
						`${file}: ${section}.${name} git dependency must be pinned to a commit SHA (no floating branch/tag), found ${specifier}`,
					);
				}
				continue;
			}
			if (isRemoteUrlSpecifier(specifier)) continue;
			if (exactVersionPattern.test(getVersionSpecifier(specifier))) continue;
			manifestFailures.push(`${file}: ${section}.${name} must be pinned, found ${specifier}`);
		}
	}
	return manifestFailures;
}

function main() {
	const failures = [];
	collectPackageJsonFiles(".");

	for (const file of packageJsonFiles.sort()) {
		const packageJson = JSON.parse(readFileSync(file, "utf8"));
		failures.push(...checkManifest(file, packageJson));
	}

	if (failures.length > 0) {
		console.error("Direct external dependencies must use exact versions; git dependencies must be pinned to a commit SHA:");
		for (const failure of failures) console.error(`  ${failure}`);
		process.exit(1);
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main();
}

export { checkManifest, gitFragment, isGitSpecifier, isPinnedGitSpecifier, isRemoteUrlSpecifier, main };
