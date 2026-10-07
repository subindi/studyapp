import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 9090,
    // 개발 중에는 /api 를 Spring Boot(8080)로 넘긴다. 운영에서는 nginx 가 같은 일을 한다
    proxy: { '/api': 'http://localhost:8080' },
  },
});
