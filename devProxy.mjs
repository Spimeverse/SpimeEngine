// To create sharedBuffers safely in the browser the page must be opened with
// 'Cross-Origin-Opener-Policy': 'same-origin',
// 'Cross-Origin-Embedder-Policy': 'require-corp',
// devProxy.mjs is a proxy server for development that adds these headers to the response.
// and then forwards the request to esbuild's local server.
//
import * as esbuild from 'esbuild'
import http from 'node:http'

const onEndPlugin = {
  name: 'on-end',
  setup(build) {
    build.onEnd((result) => {
      if( result.errors.length > 0) {
        console.error(new Date().toLocaleTimeString()+` build ended with ${result.errors.length} errors`);
      }
      else {
        console.log(new Date().toLocaleTimeString()+ ' build succeeded');
      }
    });
  },
};

const buildOptions = {
    entryPoints: [process.argv[2]],
    plugins: [onEndPlugin]
};

const serveOptions = {
    servedir: '.',
};

let proxyPort = 8000;

process.argv.forEach((arg, index) => {
    if (arg.startsWith('--servedir')) {
        let [key, value] = arg.split('=');
        serveOptions[key.replace('--', '')] = value;
        if (!value) 
          value = true;
    } else if (arg.startsWith('--serve')) {
      proxyPort = arg.split('=')[1];
    } else if (arg.startsWith('--loader:')) {
      buildOptions.loader = buildOptions.loader || {};
      let key = arg.replace('--loader:', '');
      const [ext, loader] = key.split('=');
      buildOptions.loader[ext] = loader;
    } else if (arg.startsWith('--')) {
        let [key, value] = arg.split('=');
        if (!value) 
          value = true;
        buildOptions[key.replace('--', '')] = value;
    }
});

let ctx = await esbuild.context(buildOptions)

// The return value tells us where esbuild's local server is
let { host, port } = await ctx.serve(serveOptions)

http.createServer((req, res) => {
  const options = {
    hostname: host,
    port: port,
    path: req.url,
    method: req.method,
    headers: req.headers,
  }

  // Forward each incoming request to esbuild
  const proxyReq = http.request(options, proxyRes => {

    // Addingheaders to the response sent back to the client
    const headers = {
      ...proxyRes.headers,
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    };

    res.writeHead(proxyRes.statusCode, headers)
    proxyRes.pipe(res, { end: true })
  })

  // Forward the body of the request to esbuild
  req.pipe(proxyReq, { end: true })
}).listen(proxyPort)
