const { withGradleProperties } = require("@expo/config-plugins");

/**
 * Expo Config Plugin to increase Gradle JVM memory limits.
 * This prevents OutOfMemoryError: Metaspace during KSP and other heavy Kotlin tasks.
 */
const withGradleMemory = (config) => {
  return withGradleProperties(config, (config) => {
    config.modResults = setGradleProperty(config.modResults, "org.gradle.jvmargs", "-Xmx4096m -XX:MaxMetaspaceSize=1024m -Dfile.encoding=UTF-8");
    return config;
  });
};

function setGradleProperty(properties, name, value) {
  const index = properties.findIndex((prop) => prop.type === "property" && prop.key === name);
  if (index > -1) {
    properties[index].value = value;
  } else {
    properties.push({
      type: "property",
      key: name,
      value: value,
    });
  }
  return properties;
}

module.exports = withGradleMemory;
