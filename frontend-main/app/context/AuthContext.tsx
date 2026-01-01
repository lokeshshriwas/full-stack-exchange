"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import axios, { AxiosError } from "axios";
import { BASE_URL } from "../helper/fetch";

interface User {
  id: number;
  fullName: string;
  email: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (
    email: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<void>;
  register: (
    fullName: string,
    email: string,
    password: string
  ) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// --- 1. Global Axios Configuration ---
// Set these defaults once so they apply to all functions
axios.defaults.baseURL = BASE_URL;
axios.defaults.withCredentials = true; // REQUIRED for cookies/session to work
axios.defaults.headers.common["Content-Type"] = "application/json";

let interceptorAttached = false;

function attachAuthInterceptor() {
  if (interceptorAttached) return;
  interceptorAttached = true;

  axios.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config;

      if (!originalRequest) return Promise.reject(error);

      // 1. Prevent loop if refresh endpoint itself fails
      if (
        originalRequest.url &&
        originalRequest.url.includes("/auth/refresh")
      ) {
        // ONLY redirect if we are NOT already on the login page
        if (
          typeof window !== "undefined" &&
          window.location.pathname !== "/login" &&
          window.location.pathname !== "/register"
        ) {
          window.location.href = "/login";
        }
        return Promise.reject(error);
      }

      // 2. Handle 401 errors
      if (error.response?.status === 401 && !(originalRequest as any)._retry) {
        (originalRequest as any)._retry = true;

        try {
          await axios.post("/api/v2/auth/refresh");
          return axios(originalRequest);
        } catch (refreshError) {
          // 3. Refresh failed - Redirect to login
          // ONLY redirect if we are NOT already on the login page
          if (
            typeof window !== "undefined" &&
            window.location.pathname !== "/login" &&
            window.location.pathname !== "/register"
          ) {
            window.location.href = "/login";
          }
          return Promise.reject(refreshError);
        }
      }

      return Promise.reject(error);
    }
  );
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // --- 2. Initialize Interceptors once ---
  useEffect(() => {
    attachAuthInterceptor();

    // Check localStorage for persisted user
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Failed to parse stored user", e);
        localStorage.removeItem("user");
      }
    }
  }, []);

  const fetchUser = useCallback(async () => {
    try {
      // We don't need `${BASE_URL}` here because we set axios.defaults.baseURL
      const response = await axios.get("/api/v2/auth/me");

      if (response.data.success) {
        const userData = response.data.data.user || response.data.data;
        setUser(userData);
        localStorage.setItem("user", JSON.stringify(userData));
      }
    } catch (error) {
      setUser(null);
      localStorage.removeItem("user");
      // Don't redirect here, just stop loading.
      // Redirects should happen on Protected Routes, not inside Context.
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (email: string, password: string, rememberMe = false) => {
    setIsLoading(true);
    try {
      const response = await axios.post("/api/v2/auth/login", {
        email,
        password,
        rememberMe,
      });

      if (response.data.success) {
        const userData = response.data.data.user;
        const accessToken = response.data.data.accessToken;

        setUser(userData);
        localStorage.setItem("user", JSON.stringify(userData));

        // Store accessToken for WebSocket authentication (cross-domain issue workaround)
        if (accessToken) {
          localStorage.setItem("accessToken", accessToken);
        }
        // Cookies are set automatically by the browser due to defaults.withCredentials
      }
    } catch (error) {
      console.error("Login failed", error);
      throw error; // Throw so UI can show error message
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    fullName: string,
    email: string,
    password: string
  ) => {
    setIsLoading(true);
    try {
      const response = await axios.post("/api/v2/auth/register", {
        fullName,
        email,
        password,
      });

      if (response.data.success) {
        const userData = response.data.data.user;
        setUser(userData);
        localStorage.setItem("user", JSON.stringify(userData));
      }
    } catch (error) {
      console.error("Register failed", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await axios.post("/api/v2/auth/logout");
    } catch (error) {
      console.error("Logout failed", error);
    } finally {
      setUser(null);
      localStorage.removeItem("user");
      localStorage.removeItem("accessToken");
      router.push("/login");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  console.log("AuthContext", context);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
