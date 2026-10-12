import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

/* builds the library; the playground in site/ has its own config */
export default defineConfig({
  plugins: [react(), dts({ include: ['src'], rollupTypes: false, tsconfigPath: './tsconfig.json' })],
  build: {
    lib: {
      entry: { index: resolve(__dirname, 'src/index.ts'), owl: resolve(__dirname, 'src/owl/index.ts') },
      formats: ['es', 'cjs'],
      fileName: (format, name) => `${name}.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', /^three(\/.*)?$/],
    },
  },
});
