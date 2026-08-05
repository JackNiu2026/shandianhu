import path from "path";
import { defineConfig } from "@tarojs/cli";
import devConfig from "./dev";
import prodConfig from "./prod";

const sharedPath = path.resolve(__dirname, "..", "..", "shared");

export default defineConfig(async (merge, { command }) => {
  const baseConfig = {
    projectName: "mobile",
    date: "2026-8-5",
    designWidth: 430,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      375: 2 / 1,
      828: 1.81 / 2,
      430: 750 / 430,
    },
    sourceRoot: "src",
    outputRoot: "dist",
    plugins: [],
    defineConstants: {},
    alias: {
      "@": path.resolve(__dirname, "..", "src"),
      "@shared": sharedPath,
      "@lightning-tiger/shared": sharedPath,
    },
    compile: {
      exclude: [
        (modulePath: string) => modulePath.indexOf("@tarojs") >= 0,
      ],
      include: [
        sharedPath,
      ],
    },
    copy: {
      patterns: [],
      options: {},
    },
    framework: "react",
    compiler: "webpack5",
    cache: {
      enable: false,
    },
    sass: {
      data: "",
    },
    mini: {
      webpackChain(chain: { module: { rule: (name: string) => { include: { add: (path: string) => { end: () => void } } } } }) {
        chain.module.rule("script").include.add(sharedPath).end();
      },
      postcss: {
        pxtransform: {
          enable: true,
          config: {
            selectorBlackList: [],
          },
        },
        cssModules: {
          enable: false,
          config: {
            namingPattern: "module",
            generateScopedName: "[name]__[local]___[hash:base64:5]",
          },
        },
      },
    },
    h5: {
      publicPath: "/",
      staticDirectory: "static",
      output: {
        filename: "js/[name].[hash:8].js",
        chunkFilename: "js/[name].[chunkhash:8].js",
      },
      miniCssExtractPluginOption: {
        ignoreOrder: true,
        filename: "css/[name].[hash].css",
        chunkFilename: "css/[name].[chunkhash].css",
      },
      postcss: {
        autoprefixer: {
          enable: true,
          config: {},
        },
        cssModules: {
          enable: false,
          config: {
            namingPattern: "module",
            generateScopedName: "[name]__[local]___[hash:base64:5]",
          },
        },
      },
    },
    rn: {
      appName: "taroDemo",
      postcss: {
        cssModules: {
          enable: false,
        },
      },
    },
  };

  if (process.env.NODE_ENV === "development") {
    return merge({}, baseConfig, devConfig);
  }
  return merge({}, baseConfig, prodConfig);
});
