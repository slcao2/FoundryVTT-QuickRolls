module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    'airbnb-base',
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  rules: {
    'consistent-return': 'off',
    'import/extensions': ['error', 'ignorePackages'],
    'import/prefer-default-export': 'off',
    'max-len': ['error', {
      code: 120,
      ignoreComments: true,
    }],
    'no-param-reassign': 'off',
    'no-underscore-dangle': 'off',
  },
  globals: {
    $: 'readonly',
    AbilityTemplate: 'readonly',
    canvas: 'readonly',
    ChatMessage: 'readonly',
    CONFIG: 'writable',
    CONST: 'readonly',
    Dialog: 'readonly',
    Die: 'readonly',
    duplicate: 'readonly',
    game: 'writable',
    getProperty: 'readonly',
    Hooks: 'readonly',
    loadTemplates: 'readonly',
    mergeObject: 'readonly',
    renderTemplate: 'readonly',
    Roll: 'readonly',
    ui: 'readonly',
  },
};
