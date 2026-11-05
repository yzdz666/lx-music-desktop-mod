const { base, typescript } = require('./.eslintrc.base.cjs')

module.exports = {
  root: true,
  ...base,
  overrides: [
    {
      // 二改新增的页面与模块：样式类规则交给 prettier 习惯，这里不做强制
      files: [
        'src/renderer/core/mod/**/*.js',
        'src/renderer/components/mod/**/*.vue',
        'src/renderer/views/Mine/**/*.vue',
        'src/renderer/views/Cloud/**/*.vue',
        'src/renderer/views/LocalMusic/**/*.vue',
        'src/renderer/views/ListenTogether/**/*.vue',
        'src/renderer/views/Platform/**/*.vue',
      ],
      rules: {
        'object-property-newline': 'off',
        'quote-props': 'off',
        'no-void': 'off',
        'no-undef': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/no-confusing-void-expression': 'off',
        '@typescript-eslint/no-floating-promises': 'off',
      },
    },
    {
      ...typescript,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
  ],
  ignorePatterns: [
    'node_modules',
    '*.min.js',
    'dist',
    'build',
  ],
}
