import type { AxiosRequestConfig } from "axios";
import { httpClient } from "../config/axios.config.js";

/** Outbound HTTP calls to other services. Add named clients here as integrations grow. */
export async function callService<T>(config: AxiosRequestConfig) {
  const res = await httpClient.request<T>(config);
  return res.data;
}
