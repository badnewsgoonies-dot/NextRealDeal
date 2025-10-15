/*
 * Plop generator for creating systems and managers.
 * Run with: npm run gen
 */

module.exports = function (plop) {
  // System Manager generator
  plop.setGenerator('system', {
    description: 'Create a new game system',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'System name (e.g., Map, Battle):',
      },
      {
        type: 'confirm',
        name: 'withTests',
        message: 'Generate test file?',
        default: true,
      },
      {
        type: 'confirm',
        name: 'withValidator',
        message: 'Generate validator?',
        default: true,
      },
    ],
    actions: (data) => {
      const actions = [
        {
          type: 'add',
          path: 'src/systems/{{pascalCase name}}Manager.ts',
          templateFile: 'templates/SystemManager.hbs',
        },
      ];

      if (data.withTests) {
        actions.push({
          type: 'add',
          path: 'tests/systems/{{pascalCase name}}Manager.test.ts',
          templateFile: 'templates/SystemTest.hbs',
        });
      }

      if (data.withValidator) {
        actions.push({
          type: 'add',
          path: 'src/systems/{{camelCase name}}Validator.ts',
          templateFile: 'templates/SystemValidator.hbs',
        });
      }

      return actions;
    },
  });

  // Utility generator
  plop.setGenerator('util', {
    description: 'Create a new utility module',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Utility name (e.g., Pool, Cache):',
      },
    ],
    actions: [
      {
        type: 'add',
        path: 'src/util/{{pascalCase name}}.ts',
        template: '/*\n * {{pascalCase name}}: TODO\n */\n\nexport const make{{pascalCase name}} = () => {\n  // TODO: Implement\n};\n',
      },
    ],
  });
};

