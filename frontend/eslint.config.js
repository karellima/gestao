// Config do coletor de lint do frontend (../quality/gate.py).
// Só o preset recomendado + regras de React Hooks. Nada de estilo: o gate mede
// defeitos reais, não formatação.
import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  { ignores: ['dist/**', 'node_modules/**', 'public/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: '18.2' } },
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // O projeto não usa PropTypes; exigir isso agora seria ruído puro.
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'no-alert': 'error',
    },
  },
]
