module.exports = {
  mode: 'production',
  entry: './node_modules/uuid/dist/commonjs-browser/index.js',
  output: {
    path: __dirname + '/src/FemaleUKVoiceForVA',
    filename: 'dependencies.js',
  },
};
