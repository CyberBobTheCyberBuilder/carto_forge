import { defineConfig } from 'vite';
import { resolve } from 'path';
import type { Plugin, ViteDevServer } from 'vite';

// ---------------------------------------------------------------------------
// Mock API en mémoire — simule l'intégration Python pendant le dev
// ---------------------------------------------------------------------------
function mockHaApi(): Plugin {
  const maps: Record<string, unknown>[] = [];

  return {
    name: 'mock-ha-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/carto_forge')) return next();

        res.setHeader('Content-Type', 'application/json');

        const body = await new Promise<unknown>((resolve) => {
          let data = '';
          req.on('data', (c: Buffer) => (data += c.toString()));
          req.on('end', () => resolve(data ? JSON.parse(data) : {}));
        });

        const mapIdMatch = req.url.match(/\/api\/carto_forge\/maps\/([^/?]+)/);
        const mapId = mapIdMatch?.[1];

        // GET /api/carto_forge/maps
        if (req.method === 'GET' && !mapId) {
          res.end(JSON.stringify(maps));
          return;
        }

        // POST /api/carto_forge/maps
        if (req.method === 'POST' && !mapId) {
          const newMap = { ...(body as object), id: crypto.randomUUID() } as Record<string, unknown>;
          maps.push(newMap);
          res.statusCode = 201;
          res.end(JSON.stringify(newMap));
          return;
        }

        // GET /api/carto_forge/maps/:id
        if (req.method === 'GET' && mapId) {
          const map = maps.find((m) => m['id'] === mapId);
          if (!map) { res.statusCode = 404; res.end('{}'); return; }
          res.end(JSON.stringify(map));
          return;
        }

        // PUT /api/carto_forge/maps/:id
        if (req.method === 'PUT' && mapId) {
          const idx = maps.findIndex((m) => m['id'] === mapId);
          if (idx === -1) { res.statusCode = 404; res.end('{}'); return; }
          maps[idx] = { ...maps[idx], ...(body as object), id: mapId };
          res.end(JSON.stringify(maps[idx]));
          return;
        }

        // DELETE /api/carto_forge/maps/:id
        if (req.method === 'DELETE' && mapId) {
          const idx = maps.findIndex((m) => m['id'] === mapId);
          if (idx === -1) { res.statusCode = 404; res.end('{}'); return; }
          maps.splice(idx, 1);
          res.statusCode = 204;
          res.end();
          return;
        }

        next();
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Config Vite
// ---------------------------------------------------------------------------
export default defineConfig({
  plugins: [mockHaApi()],

  build: {
    lib: {
      entry: resolve(__dirname, 'src/main.ts'),
      name: 'CartoForge',
      fileName: () => 'carto-forge-panel.js',
      formats: ['es'],
    },
    outDir: resolve(__dirname, '../custom_components/carto_forge/www'),
    emptyOutDir: true,
    rollupOptions: { external: [] },
    sourcemap: true,
    minify: 'esbuild',
  },

  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },

  server: {
    port: 5173,
  },
});
