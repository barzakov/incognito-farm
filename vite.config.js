import { defineConfig } from 'vite';
import { resolve } from 'path';

const pageRewrites = {
  '/products': '/pages/products/index.html',
  '/products/': '/pages/products/index.html',
  '/about': '/pages/about/index.html',
  '/about/': '/pages/about/index.html',
  '/contact': '/pages/contact/index.html',
  '/contact/': '/pages/contact/index.html',
  '/cart': '/pages/cart/index.html',
  '/cart/': '/pages/cart/index.html',
  '/auth/login': '/pages/auth/login.html',
  '/auth/login/': '/pages/auth/login.html',
  '/auth/login.html': '/pages/auth/login.html',
  '/auth/register': '/pages/auth/register.html',
  '/auth/register/': '/pages/auth/register.html',
  '/auth/register.html': '/pages/auth/register.html',
  '/admin': '/pages/admin/index.html',
  '/admin/': '/pages/admin/index.html',
  '/home': '/pages/home/home.html',
  '/home/': '/pages/home/home.html',
  '/user': '/pages/user/index.html',
  '/user/': '/pages/user/index.html',
};

export default defineConfig({
  root: 'src',
  appType: 'mpa',
  envDir: '..',
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
        cart: resolve(__dirname, 'src/pages/cart/index.html'),
        about: resolve(__dirname, 'src/pages/about/index.html'),
        contact: resolve(__dirname, 'src/pages/contact/index.html'),
        'auth/login': resolve(__dirname, 'src/pages/auth/login.html'),
        'auth/register': resolve(__dirname, 'src/pages/auth/register.html'),
        admin: resolve(__dirname, 'src/pages/admin/index.html'),
        user: resolve(__dirname, 'src/pages/user/index.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
