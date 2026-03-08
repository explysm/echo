const { withProjectBuildGradle } = require("@expo/config-plugins");

/**
 * Expo Config Plugin to fix JitPack timeout issues by:
 * 1. Excluding standard groups from JitPack.
 * 2. Forcing Bouncy Castle versions to avoid range resolution that triggers JitPack metadata checks.
 */
const withJitPackFixed = (config) => {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === "groovy") {
      config.modResults.contents = fixBuildGradle(config.modResults.contents);
    }
    return config;
  });
};

function fixBuildGradle(buildGradle) {
  // 1. Look for the jitpack repository definition and add exclusions
  const jitpackRegex = /maven\s*\{\s*url\s*['"]https:\/\/www\.jitpack\.io['"]\s*\}/g;
  const jitpackReplacement = `maven {
            url 'https://www.jitpack.io'
            content {
                excludeGroup "org.bouncycastle"
                excludeGroup "com.google.android.gms"
                excludeGroup "com.google.firebase"
                excludeGroup "com.facebook.react"
            }
        }`;

  let updated = buildGradle;
  if (updated.includes("https://www.jitpack.io")) {
    updated = updated.replace(jitpackRegex, jitpackReplacement);
  }

  // 2. Add a resolutionStrategy to all projects to force Bouncy Castle versions.
  // This prevents Gradle from attempting to resolve ranges like [1.81, 1.82), 
  // which is what triggers the expensive/failing metadata checks across all repositories.
  const resolutionStrategyBlock = `
    configurations.all {
        resolutionStrategy {
            force 'org.bouncycastle:bcprov-jdk15to18:1.81'
            force 'org.bouncycastle:bcutil-jdk15to18:1.81'
            force 'org.bouncycastle:bcpkix-jdk15to18:1.81'
        }
    }
`;

  if (updated.includes("allprojects {")) {
    // Inject the resolution strategy into the allprojects block
    updated = updated.replace(/allprojects\s*\{/, `allprojects {${resolutionStrategyBlock}`);
  }
  
  return updated;
}

module.exports = withJitPackFixed;
