module.exports = {
  paperflow: {
    output: {
      mode: 'single',
      target: 'src/generated/client.ts',
      client: 'axios',
      mock: false,
      clean: true,
      prettier: true,
      override: {
        mutator: {
          path: './src/mutator/custom-client.ts',
          name: 'customClient',
        },
        operations: {
          'uploadDocument': {
            mutator: {
              path: './src/mutator/upload-client.ts', 
              name: 'uploadClient',
            },
          },
        },
      },
    },
    input: {
      target: 'http://localhost:3002/openapi.json',
    },
  },
};