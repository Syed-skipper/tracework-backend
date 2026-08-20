import type { PublicUser } from "../utils/serialize.js";

export type { AuthedRequest, AuthedUser } from "./auth.interface.js";

export interface SessionPayload {
  token: string;
  user: PublicUser;
}
