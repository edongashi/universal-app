import React from 'react'
import ReactDOM from 'react-dom/server'
import { serialize } from 'app'
import App from '../../src/components/App'
import { flushChunkNames } from 'react-universal-component/server'
import flushChunks, { filesFromChunks } from 'webpack-flush-chunks'
import fs from 'fs'
import path from 'path'

function readBootstrap(clientStats) {
  console.log(filesFromChunks(['bootstrap'], clientStats.assetsByChunkName))
  const fileName = filesFromChunks(['bootstrap'], clientStats.assetsByChunkName)[0]
  console.log('paths', process.env.CLIENT_ROOT, fileName)
  const bootstrap = fs
    .readFileSync(path.join(process.env.CLIENT_ROOT, fileName), 'utf8')
    .replace('//# sourceMappingURL=bootstrap.', '//# sourceMappingURL=/static/bootstrap.')
  return bootstrap
}

function stringify(value) {
  return JSON.stringify(value)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
    .replace(/</g, '\\u003c')
}

function merge(array) {
  if (array) {
    return array.join('\n')
  }

  return ''
}

export default function render({ clientStats }) {
  const bootstrap = readBootstrap(clientStats)
  return function (ctx) {
    const app = ctx.app
    // const history = createHistory({ initialEntries: [ctx.path] })
    const domString = ReactDOM.renderToString(<App />)
    const oldChunkNames = app.__volatile.chunkNames
    const newChunkNames = flushChunkNames()
    let chunkNames
    if (oldChunkNames) {
      newChunkNames.forEach(chunk => oldChunkNames.add(chunk))
      chunkNames = Array.from(oldChunkNames)
    } else {
      chunkNames = newChunkNames
    }

    const { js, styles, cssHash } = flushChunks(clientStats, { chunkNames, before: ['vendor'] })
    // console.log('PATH', ctx.path)
    // console.log('DYNAMIC CHUNK NAMES RENDERED', chunkNames)
    // console.log('SCRIPTS SERVED', scripts)
    // console.log('STYLESHEETS SERVED', stylesheets)

    const renderopts = ctx.render || {}
    const helmetContext = app.__volatile.helmetContext || {
      helmet: {
        htmlAttributes: '',
        title: 'App',
        meta: '',
        link: '',
        bodyAttributes: ''
      }
    }

    const { helmet } = helmetContext
    ctx.body = `<!DOCTYPE html>
<html ${helmet.htmlAttributes.toString()}>
  <head>
    ${helmet.meta.toString()}
    ${helmet.title.toString()}
    ${merge(renderopts.head)}
    ${styles}
    ${helmet.link.toString()}
  </head>
  <body ${helmet.bodyAttributes.toString()}>
    <div id="root">${domString}</div>
    ${merge(renderopts.scripts)}
    <script>
${bootstrap}
    </script>
    <script>window.__STATE__=${stringify(serialize(app))};</script>
    ${cssHash}
    ${js}
  </body>
</html>`
  }
}