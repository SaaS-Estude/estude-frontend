import { FlatCompat } from '@eslint/eslintrc';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const baseDirectory = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory });

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    files: ['tests/**/*.cjs'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['app/**/*.tsx', 'components/**/*.tsx'],
    ignores: ['components/ui/**'],
    rules: {
      'no-restricted-syntax': ['error',
        { selector: 'JSXOpeningElement[name.name=/^(button|input|select|textarea)$/]', message: 'Dùng component UI chung của project (Button, Input, Select, DateInput, Checkbox, Textarea).' },
        { selector: 'JSXSelfClosingElement[name.name=/^(button|input|select|textarea)$/]', message: 'Dùng component UI chung của project (Button, Input, Select, DateInput, Checkbox, Textarea).' },
      ],
    },
  },
  {
    ignores: [
      '.next/**',
      '.next.*/**',
      '.next-*/**',
      'node_modules/**',
      'out/**',
      'next-env.d.ts',
    ],
  },
];

export default eslintConfig;
