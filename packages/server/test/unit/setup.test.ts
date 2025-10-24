/**
 * Server Package Structure Tests
 *
 * Verifies the server package is correctly configured.
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Server Package Structure', () => {
  const rootDir = path.join(__dirname, '../..');
  const srcDir = path.join(rootDir, 'src');
  const testDir = path.join(rootDir, 'test');

  describe('Directory Structure', () => {
    it('should have src directory', () => {
      expect(fs.existsSync(srcDir)).toBe(true);
      expect(fs.statSync(srcDir).isDirectory()).toBe(true);
    });

    it('should have test directory', () => {
      expect(fs.existsSync(testDir)).toBe(true);
      expect(fs.statSync(testDir).isDirectory()).toBe(true);
    });

    it('should have test/unit directory', () => {
      const unitDir = path.join(testDir, 'unit');
      expect(fs.existsSync(unitDir)).toBe(true);
      expect(fs.statSync(unitDir).isDirectory()).toBe(true);
    });

    it('should have test/integration directory', () => {
      const integrationDir = path.join(testDir, 'integration');
      expect(fs.existsSync(integrationDir)).toBe(true);
      expect(fs.statSync(integrationDir).isDirectory()).toBe(true);
    });
  });

  describe('Configuration Files', () => {
    it('should have package.json', () => {
      const packagePath = path.join(rootDir, 'package.json');
      expect(fs.existsSync(packagePath)).toBe(true);

      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
      expect(packageJson.name).toBe('@xtts-minimax-proxy/server');
      expect(packageJson.version).toBe('1.0.0');
    });

    it('should have tsconfig.json', () => {
      const tsconfigPath = path.join(rootDir, 'tsconfig.json');
      expect(fs.existsSync(tsconfigPath)).toBe(true);

      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
      expect(tsconfig.extends).toBe('../../tsconfig.json');
    });

    it('should have jest.config.js', () => {
      const jestConfigPath = path.join(rootDir, 'jest.config.js');
      expect(fs.existsSync(jestConfigPath)).toBe(true);
    });
  });

  describe('Package.json Scripts', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8')
    );

    it('should have build script', () => {
      expect(packageJson.scripts.build).toBeDefined();
      expect(packageJson.scripts.build).toBe('tsc');
    });

    it('should have dev script', () => {
      expect(packageJson.scripts.dev).toBeDefined();
      expect(packageJson.scripts.dev).toContain('nodemon');
    });

    it('should have test script', () => {
      expect(packageJson.scripts.test).toBeDefined();
      expect(packageJson.scripts.test).toBe('jest');
    });

    it('should have lint script', () => {
      expect(packageJson.scripts.lint).toBeDefined();
    });
  });

  describe('Dependencies', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8')
    );

    it('should have ws dependency', () => {
      expect(packageJson.dependencies.ws).toBeDefined();
    });

    it('should have winston dependency', () => {
      expect(packageJson.dependencies.winston).toBeDefined();
    });

    it('should have dotenv dependency', () => {
      expect(packageJson.dependencies.dotenv).toBeDefined();
    });

    it('should have TypeScript dev dependencies', () => {
      expect(packageJson.devDependencies['ts-node']).toBeDefined();
      expect(packageJson.devDependencies.nodemon).toBeDefined();
      expect(packageJson.devDependencies.jest).toBeDefined();
      expect(packageJson.devDependencies['ts-jest']).toBeDefined();
    });
  });

  describe('TypeScript Configuration', () => {
    const tsconfig = JSON.parse(
      fs.readFileSync(path.join(rootDir, 'tsconfig.json'), 'utf-8')
    );

    it('should extend root tsconfig', () => {
      expect(tsconfig.extends).toBe('../../tsconfig.json');
    });

    it('should specify correct outDir', () => {
      expect(tsconfig.compilerOptions.outDir).toBe('./dist');
    });

    it('should specify correct rootDir', () => {
      expect(tsconfig.compilerOptions.rootDir).toBe('./src');
    });
  });
});
