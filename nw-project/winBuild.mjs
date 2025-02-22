import nwbuild from "nw-builder";

const build = async () => {
  await nwbuild({
    mode: "build",
    flavor: "sdk",
    platform: "win",
    srcDir: "./",
    cacheDir: "./node_modules/nw",
    outDir: "../dist-app",
    glob: false,
    logLevel: "debug",
    app: {
      name: "小红书爬虫",
      /* File path of icon from where it is copied. */
      icon: "./public/vite.svg",
      version: "0.0.0",
      comments: "小红书爬虫",
      company: "NW.js Utilities",
      fileDescription: "小红书爬虫",
      fileVersion: "0.0.0",
      internalName: "小红书爬虫",
      legalCopyright: "小红书爬虫",
      originalFilename: "小红书爬虫",
      productName: "小红书爬虫",
      productVersion: "0.0.0",
    },
  });
};

build();
