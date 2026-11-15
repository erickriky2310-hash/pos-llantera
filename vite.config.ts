import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({plugins:[react(),VitePWA({registerType:'prompt',manifest:{name:'POS Llantera 0.3 · etapa 2 · R1-20261031',short_name:'Llantera 0.3',lang:'es',theme_color:'#163b34',background_color:'#f5f6f4',display:'standalone',icons:[{src:'/icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any'}]},workbox:{globPatterns:['**/*.{js,css,html,svg}']}})]});
