/** @type {import('dependency-cruiser').IConfiguration} */
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
      comment: 'Warn about orphaned modules (except tests and utils in Phase 0)',
      from: {
        orphan: true,
        pathNot: ['\\.test\\.ts$', '\\.spec\\.ts$', '^src/util/'],
      },
      to: {},
    },
    {
      name: 'util-cannot-import-core-or-systems',
      severity: 'error',
      from: { path: '^src/util/' },
      to: { path: '^src/(core|systems|map)/' },
    },
    {
      name: 'core-cannot-import-systems',
      severity: 'error',
      from: { path: '^src/core/' },
      to: { path: '^src/(systems|map)/' },
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
