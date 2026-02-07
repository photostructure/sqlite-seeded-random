/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: "jest-environment-node",
  roots: ["<rootDir>/test"],
  preset: "ts-jest",
  moduleFileExtensions: ["ts", "js", "json"],
  verbose: true,
  testTimeout: 30000,
};
