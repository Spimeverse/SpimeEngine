/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */
const esBuild = require('esbuild');
const path = require('path');

const bjsBundle = '03_04_2022';

let exampleOnResolvePlugin = {
    name: 'example',
    setup(build) {
  
      // extern babylonjs
    build.onResolve({ filter: /@babylonjs/ }, args => {
        return { 
          path: `../Bjs/Bjs_${bjsBundle}.js`,
          external: true
        }
      })
  
      // Mark all paths starting with "http://" or "https://" as external
      build.onResolve({ filter: /^https?:\/\// }, args => {
        return { path: args.path, external: true }
      })
    },
  }

  
  esBuild.build({
    entryPoints: ['src/Bjs.ts'],
    bundle: true,
    outfile: `public/Bjs/Bjs_${bjsBundle}.js`,
    treeShaking: true,
    minify: true,
    format: 'esm',
    target: 'esnext',
    sourcemap: true,
  }).catch(() => process.exit(1))
  console.log(`built Bjs/Bjs_${bjsBundle}.js`);

  esBuild.build({
    entryPoints: ['src/app.ts'],
    bundle: true,
    outfile: 'public/indexExtern.js',
    treeShaking: true,
    minify: true,
    format: 'esm',
    target: 'esnext',
    sourcemap: true,
    external: ['@babylonjs/*'],
    plugins: [exampleOnResolvePlugin],
  }).catch(() => process.exit(1))
  console.log('built App');
