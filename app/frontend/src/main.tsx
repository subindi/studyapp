import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './skin/font.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// PWA: 배포 빌드에서만 서비스 워커 등록 (개발 중에는 캐시 때문에 헷갈리지 않게)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* 등록 실패해도 앱은 동작 */
    });
  });
}
