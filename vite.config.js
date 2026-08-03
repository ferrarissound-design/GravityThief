import { defineConfig } from 'vite';

export default defineConfig({
  // In restricted/OneDrive workspaces esbuild's dependency crawler can try to
  // inspect inaccessible parent folders. These ESM packages are safe to serve
  // directly during development; production builds are still fully bundled.
  optimizeDeps: {
    exclude: ['three', 'cannon-es'],
  },
  build: {
    chunkSizeWarningLimit: 650,
  },
});
