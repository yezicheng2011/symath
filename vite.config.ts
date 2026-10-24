import { defineConfig } from 'vite';
export default defineConfig({ worker: { format: 'es' }, server:{proxy:{'/api':'http://127.0.0.1:8765'}} });
