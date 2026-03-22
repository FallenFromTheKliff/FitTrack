import axios from "axios";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const api = axios.create({
  baseURL: BASE,
  headers: { "Content-Type": "application/json" }
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("fittrack_access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      if (typeof window !== "undefined") {
        const refresh = localStorage.getItem("fittrack_refresh_token");
        if (refresh) {
          try {
            const { data } = await axios.post(`${BASE}/auth/refresh`, { refresh_token: refresh });
            localStorage.setItem("fittrack_access_token", data.access_token);
            original.headers.Authorization = `Bearer ${data.access_token}`;
            return api(original);
          } catch {
            localStorage.removeItem("fittrack_access_token");
            localStorage.removeItem("fittrack_refresh_token");
            window.location.href = "/login";
          }
        }
      }
    }
    return Promise.reject(error);
  }
);