'use strict'

const path = require('path')
const fs = require('fs')
const webpack = require('webpack')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')

const getFallbackEnvs = ({fallbacks, basedir}) => {
  let { document } = fallbacks

  if (!document) {
    let pagesDir = undefined

    if (fs.existsSync(path.join(basedir, 'pages'))) {
      pagesDir = path.join(basedir, 'pages')
    } else if (fs.existsSync(path.join(basedir, 'src', 'pages'))) {
      pagesDir = path.join(basedir, 'src', 'pages')
    }

    if (!pagesDir) return

    const offlines = ['tsx', 'ts', 'jsx', 'js']
      .map(ext => path.join(pagesDir, `_offline.${ext}`))
      .filter(entry => fs.existsSync(entry))
    if (offlines.length === 1) {
      document = '/_offline'
    }
  }
  
  const envs = {
    __PWA_FALLBACK_DOCUMENT__: document || false,
    __PWA_FALLBACK_IMAGE__: fallbacks.image || false,
    __PWA_FALLBACK_AUDIO__: fallbacks.audio || false,
    __PWA_FALLBACK_VIDEO__: fallbacks.video || false,
    __PWA_FALLBACK_FONT__: fallbacks.font || false
  }

  if (Object.values(envs).filter(v => !!v).length === 0) return

  console.log('> [PWA] Fallback to precache routes when fetch failed from cache or network:')
  if (envs.__PWA_FALLBACK_DOCUMENT__) console.log(`> [PWA]   document (page): ${envs.__PWA_FALLBACK_DOCUMENT__}`)
  if (envs.__PWA_FALLBACK_IMAGE__) console.log(`> [PWA]   image: ${envs.__PWA_FALLBACK_IMAGE__}`)
  if (envs.__PWA_FALLBACK_AUDIO__) console.log(`> [PWA]   audio: ${envs.__PWA_FALLBACK_AUDIO__}`)
  if (envs.__PWA_FALLBACK_VIDEO__) console.log(`> [PWA]   video: ${envs.__PWA_FALLBACK_VIDEO__}`)
  if (envs.__PWA_FALLBACK_FONT__) console.log(`> [PWA]   font: ${envs.__PWA_FALLBACK_FONT__}`)
  
  return envs
}

const buildFallbackWorker = ({ id, fallbacks, basedir, destdir, success, minify }) => {
  const envs = getFallbackEnvs({fallbacks, basedir})
  if (!envs) return false

  const name = `fallback-${id}.js`
  const fallbackJs = path.join(__dirname, `fallback.js`)

  webpack({
    mode: 'none',
    target: 'webworker',
    entry: {
      main: fallbackJs
    },
    resolve: {
      extensions: ['.js']
    },
    module: {
      rules: [
        {
          test: /\.js$/i,
          use: [
            {
              loader: 'babel-loader',
              options: {
                presets: [['next/babel', {
                  'transform-runtime': {
                    corejs: false,
                    helpers: true,
                    regenerator: false,
                    useESModules: true
                  },
                  'preset-env': {
                    modules: false,
                    targets: 'chrome >= 56'
                  }
                }]]
              }
            }
          ]
        }
      ]
    },
    output: {
      path: destdir,
      filename: name
    },
    plugins: [
      new CleanWebpackPlugin({
        cleanOnceBeforeBuildPatterns: [path.join(destdir, 'fallback-*.js'), path.join(destdir, 'fallback-*.js.map')]
      }),
      new webpack.EnvironmentPlugin(envs)
    ],
    optimization: minify ? {
      minimize: true,
      minimizer: [new TerserPlugin()]
    } : undefined
  }).run((error, status) => {
    if (error || status.hasErrors()) {
      console.error(`> [PWA] Failed to build fallback worker`)
      console.error(status.toString({ colors: true }))
      process.exit(-1)
    } else {
      success({name, precaches: Object.values(envs).filter(v => !!v)})
    }
  })

  return fallbacks
}

module.exports = buildFallbackWorker
