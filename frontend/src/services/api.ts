import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});


api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('wms_token');
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);


api.interceptors.response.use(
  (response) => {
    
    return response;
  },
  (error) => {
    const status = error.response?.status;
    const code = error.response?.data?.code;

    if (window.location.pathname !== '/login') {
      
      if (status === 401) {
        console.warn('⚠️ Sessão expirada ou acessada em outro local. Deslogando...');
        localStorage.clear();
        window.location.href = '/login';
      }
      
      else if (status === 403 && code === 'TENANT_SUSPENSO') {
        console.warn('⚠️ Acesso da empresa suspenso. Deslogando...');
        localStorage.clear();
        alert('O acesso da sua empresa foi suspenso. Fale com o suporte.');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;