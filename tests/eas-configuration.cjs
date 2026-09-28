// Exercise the pinned EAS CLI's real parsers without logging in or submitting a build.
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { realpathSync } = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const req = createRequire(realpathSync(process.argv[2]));
const { EasJsonAccessor, EasJsonUtils, Platform } = req('@expo/eas-json');
const { resolveWorkflowAsync } = req('eas-cli/build/project/workflow');
const { getPrivateExpoConfigAsync } = req('eas-cli/build/project/expoConfig');
const { resolveXcodeBuildContextAsync } = req('eas-cli/build/project/ios/scheme');
const { resolveTargetsAsync } = req('eas-cli/build/project/ios/target');
const { validateCustomBuildConfigAsync } = req('eas-cli/build/project/customBuildConfig');
const vcsClient = {
  getRootPathAsync: async () => root,
  isFileIgnoredAsync: async (file) => {
    const result = spawnSync('git', ['check-ignore', '--quiet', file], { cwd: root });
    assert.ok(result.status === 0 || result.status === 1, 'git check-ignore failed');
    return result.status === 0;
  },
};
(async () => {
  for (const role of ['customer', 'merchant', 'driver']) {
    const projectDir = path.join(root, 'apps', `${role}-mobile`);
    const accessor = EasJsonAccessor.fromProjectPath(projectDir);
    assert.equal(await resolveWorkflowAsync(projectDir, Platform.IOS, vcsClient), 'generic');
    const exp = await getPrivateExpoConfigAsync(projectDir);
    for (const name of ['development-simulator', 'preview', 'production']) {
      const profile = await EasJsonUtils.getBuildProfileAsync(accessor, Platform.IOS, name);
      assert.ok(await validateCustomBuildConfigAsync({ profile, projectDir, vcsClient }));
      const xcodeBuildContext = await resolveXcodeBuildContextAsync({ projectDir, exp, vcsClient, nonInteractive: true }, profile);
      assert.equal(xcodeBuildContext.buildScheme, 'Runner');
      const targets = await resolveTargetsAsync({ projectDir, exp, vcsClient, xcodeBuildContext });
      assert.equal(targets.length, 1);
      assert.equal(targets[0].bundleIdentifier, `com.fidalix.marketplace.${role}`);
      assert.equal(targets[0].entitlements['aps-environment'], 'production');
      console.log(`${role}/${name}: native target, EAS profile and custom workflow valid`);
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
