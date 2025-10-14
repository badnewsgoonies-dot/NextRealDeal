module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      from: { orphan: true, pathNot: ['\\.test\\.ts$', '\\.spec\\.ts$'] },
      to: {},
    },
    {
      name: 'util-cannot-import-core-or-systems',
      severity: 'error',
      from: { path: '^src/util/' },
      to: { path: '^src/(core|systems)/' },
    },
    {
      name: 'core-cannot-import-systems',
      severity: 'error',
      from: { path: '^src/core/' },
      to: { path: '^src/systems/' },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: './tsconfig.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
    reporterOptions: {
      dot: {
        collapsePattern: 'node_modules/[^/]+',
      },
      archi: {
        collapsePattern: '^(node_modules|packages|src/[^/]+|lib)',
      },
      text: {
        highlightFocused: true,
      },
    },
  },
};
