/**
 * SDK Package Structure Tests
 *
 * Verifies the SDK package is correctly configured.
 */

import * as fs from 'fs';
import * as path from 'path';

describe('SDK Package Structure', () => {
  const rootDir = path.join(__dirname, '../..');
  const srcDir = path.join(rootDir, 'src');
  const testDir = path.join(rootDir, 'test');
  const examplesDir = path.join(rootDir, 'examples');

  describe('Directory Structure', () => {
    it('should have src directory', () => {
      expect(fs.existsSync(srcDir)).toBe(true);
      expect(fs.statSync(srcDir).isDirectory()).toBe(true);
    });

    it('should have test directory', () => {
      expect(fs.existsSync(testDir)).toBe(true);
      expect(fs.statSync(testDir).isDirectory()).toBe(true);
    });

    it('should have examples directory', () => {
      expect(fs.existsSync(examplesDir)).toBe(true);
      expect(fs.statSync(examplesDir).isDirectory()).toBe(true);
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
      expect(packageJson.name).toBe('xtts-sdk');
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

    it('should have .npmignore', () => {
      const npmignorePath = path.join(rootDir, '.npmignore');
      expect(fs.existsSync(npmignorePath)).toBe(true);
    });
  });

  describe('Package.json Configuration', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8')
    );

    it('should specify main entry point', () => {
      expect(packageJson.main).toBe('dist/index.js');
    });

    it('should specify types', () => {
      expect(packageJson.types).toBe('dist/index.d.ts');
    });

    it('should specify files to include in npm package', () => {
      expect(packageJson.files).toContain('dist');
      expect(packageJson.files).toContain('README.md');
    });

    it('should have build script', () => {
      expect(packageJson.scripts.build).toBe('tsc');
    });

    it('should have test script', () => {
      expect(packageJson.scripts.test).toBe('jest');
    });

    it('should have prepublishOnly script', () => {
      expect(packageJson.scripts.prepublishOnly).toBeDefined();
    });
  });

  describe('Dependencies', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8')
    );

    it('should have ws dependency', () => {
      expect(packageJson.dependencies.ws).toBeDefined();
    });

    it('should have TypeScript dev dependencies', () => {
      expect(packageJson.devDependencies.jest).toBeDefined();
      expect(packageJson.devDependencies['ts-jest']).toBeDefined();
    });

    it('should have minimal dependencies (no provider references)', () => {
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      // Verify no Minimax references in dependencies
      Object.keys(allDeps).forEach((dep) => {
        expect(dep.toLowerCase()).not.toContain('minimax');
      });
    });
  });

  describe('TypeScript Configuration', () => {
    const tsconfig = JSON.parse(
      fs.readFileSync(path.join(rootDir, 'tsconfig.json'), 'utf-8')
    );

    it('should extend root tsconfig', () => {
      expect(tsconfig.extends).toBe('../../tsconfig.json');
    });

    it('should generate declaration files', () => {
      expect(tsconfig.compilerOptions.declaration).toBe(true);
    });

    it('should specify correct outDir', () => {
      expect(tsconfig.compilerOptions.outDir).toBe('./dist');
    });
  });
});
