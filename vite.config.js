import { defineConfig } from 'vite';
import { resolve } from 'path';

const pageRewrites = {
  '/products': '/pages/products/index.html',
  '/products/': '/pages/products/index.html',
  '/about': '/pages/about/index.html',
  '/about/': '/pages/about/index.html',
  '/contact': '/pages/contact/index.html',
  '/contact/': '/pages/contact/index.html',
  '/auth/login': '/pages/auth/login.html',
  '/auth/login/': '/pages/auth/login.html',
  '/auth/login.html': '/pages/auth/login.html',
  '/auth/register': '/pages/auth/register.html',
  '/auth/register/': '/pages/auth/register.html',
  '/auth/register.html': '/pages/auth/register.html',
  '/home': '/pages/home/home.html',
  '/home/': '/pages/home/home.html',
};

export default defineConfig({
  root: 'src',
  appType: 'mpa',
  envPrefix: 'VITE_',
  plugins: [
    {
      name: 'clean-page-routes',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url?.split('?')[0] || '/';
          const target = pageRewrites[url];
          if (target) {
            req.url = target;
          }
          next();
        });
      },
    },
  ],
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: '../dist',
    minify: 'terser',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html'),
        home: resolve(__dirname, 'src/pages/home/home.html'),
        products: resolve(__dirname, 'src/pages/products/index.html'),
        about: resolve(__dirname, 'src/pages/about/index.html'),
        contact: resolve(__dirname, 'src/pages/contact/index.html'),
        'auth/login': resolve(__dirname, 'src/pages/auth/login.html'),
        'auth/register': resolve(__dirname, 'src/pages/auth/register.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
