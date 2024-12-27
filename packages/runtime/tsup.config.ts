import { defineConfig } from 'tsup';
import { polyfillNode } from "esbuild-plugin-polyfill-node";

export default defineConfig([
  {
    entry: ['src/index.ts'],
    esbuildPlugins: [
      polyfillNode({
        polyfills: {
          assert: true
        }
      })
    ],
    sourcemap: true,
    dts: {
      resolve: true,
    },
    clean: true,
    treeshake: true,
    cjsInterop: false,
    removeNodeProtocol: false,
    minify: true,
    shims: true, // Convert import.meta.url to a shim for CJS
    format: ['esm', 'cjs'],
    target: 'es2023',
    splitting: true,
    skipNodeModulesBundle: true,
    noExternal: [ /(.*)/ ],
    platform: 'browser'
  },
]);
