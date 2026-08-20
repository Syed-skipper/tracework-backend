import axios, { type AxiosInstance } from "axios";
import { env } from "./env.config.js";

/** Shared Axios instance for outbound calls from `micro-services/`. */
export const httpClient: AxiosInstance = axios.create({
  timeout: 15_000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

httpClient.interceptors.request.use((config) => {
  if (env.isDev) {
    config.headers.set("X-Tracework-Env", env.nodeEnv);
  }
  return config;
});
