import nwbuild from "nw-builder";

const build = async () => {
  await nwbuild({
    mode: "build",
    flavor: "normal",
    platform: "osx",
    arch: "arm64",
    srcDir: "./",
    cacheDir: "./node_modules/nw",
    outDir: "../dist-app",
    glob: false,
    logLevel: "debug",
    app: {
      name: "小红书爬虫",
      /* File path of icon from where it is copied. */
      icon: "./public/app.icns",
      main: "main.html",
      window: {
        title: "小红书爬虫",
        width: 800,
        height: 600,
        min_width: 400,
        min_height: 300,
      },
      LSApplicationCategoryType: "public.app-category.utilities",
      CFBundleIdentifier: "io.nwutils.demo",
      CFBundleName: "小红书爬虫",
      CFBundleDisplayName: "小红书爬虫",
      CFBundleSpokenName: "小红书爬虫",
      CFBundleVersion: "0.0.0",
      CFBundleShortVersionString: "0.0.0",
      NSHumanReadableCopyright: "小红书爬虫",
      NSLocalNetworkUsageDescription: "小红书爬虫",
    },
  });
};

build();
