export default {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', { configFile: './babel.config.cjs' }]
  },
  moduleNameMapper: {
    '\\.(css|less|sass|scss)$': 'identity-obj-proxy',
    'apiClient\\.js$': '<rootDir>/client/src/__mocks__/apiClient.cjs',
    'shared/roles\\.js$': '<rootDir>/shared/__mocks__/roles.cjs'
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
};
