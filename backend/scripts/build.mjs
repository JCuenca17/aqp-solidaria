// Empaqueta cada handler en dist/<nombre>/index.mjs con esbuild.
// infra/template.yaml apunta CodeUri a esas carpetas, así `sam deploy` no necesita `sam build`.
// El AWS SDK v3 lo provee el runtime nodejs24.x, por eso se marca como externo.
import { build } from 'esbuild';
import { readdirSync, rmSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const handlersDir = fileURLToPath(new URL('../src/handlers/', import.meta.url));
const outRoot = fileURLToPath(new URL('../dist/', import.meta.url));
rmSync(outRoot, { recursive: true, force: true });

const entries = readdirSync(handlersDir).filter((f) => f.endsWith('.ts'));
for (const file of entries) {
  const name = basename(file, '.ts');
  await build({
    entryPoints: [join(handlersDir, file)],
    outfile: join(outRoot, name, 'index.mjs'),
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'esm',
    minify: true,
    sourcemap: false,
    external: ['@aws-sdk/*'],
    banner: {
      js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
    },
    legalComments: 'none',
  });
  console.log(`✔ dist/${name}/index.mjs`);
}
