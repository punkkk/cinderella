module.exports = {
  entry: './src/main.js',
  output: {
    path: __dirname,
    filename: 'bundle.js'
  },
  module: {
    loaders: [
      {
        loader: 'babel-loader'
      }
    ]
  },
  node: {
    fs: 'empty'
  }
}
