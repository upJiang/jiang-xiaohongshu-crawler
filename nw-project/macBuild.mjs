import nwbuild from "nw-builder";

const build = async () => {
  await nwbuild({
    mode: "build",
    flavor: "sdk",
    platform: "osx",
    srcDir: "./",
    cacheDir: "./node_modules/nw",
    outDir: "./dist-app",
    glob: false,
    logLevel: "debug",
    app: {
      name: "Demo",
      /* File path of icon from where it is copied. */
      icon: "./public/app.icns",
      LSApplicationCategoryType: "public.app-category.utilities",
      CFBundleIdentifier: "io.nwutils.demo",
      CFBundleName: "Demo",
      CFBundleDisplayName: "Demo",
      CFBundleSpokenName: "Demo",
      CFBundleVersion: "0.0.0",
      CFBundleShortVersionString: "0.0.0",
      NSHumanReadableCopyright: "Copyright (c) 2024 NW.js Utilities",
      NSLocalNetworkUsageDescription:
        "Demo requires access to network to showcase its capabilities",
    },
  });
};

build();
