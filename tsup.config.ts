import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/**/*.ts'], // Entry point for the build, includes all TypeScript files in src directory
  format: ['cjs', 'esm'], // Output formats: CommonJS and ES Module
  clean: true, // Clean the output directory before each build
  outDir: 'dist', // Output directory for the build
})
// This configuration file is for building a TypeScript project using tsup.
