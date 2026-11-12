import { apiRequest, type Credentials } from "../services/api";
import type { Gender } from "./types";

export interface SignupInput {
  email: string;
  username: string;
  fullName: string;
  password: string;
  confirmPassword: string;
  gender: Gender;
  phoneNumber: string;
  /** YYYY-MM-DD */
  DOB: string;
}

const post = <T = unknown>(path: string, body: unknown) =>
  apiRequest<T>(`/auth${path}`, { method: "POST", body });

export const authApi = {
  login: async (email: string, password: string): Promise<Credentials> => {
    const { data } = await post<Credentials>("/login", { email, password });
    if (!data) throw new Error("Login response did not include credentials");
    return data;
  },
  signup: (input: SignupInput) => post("/register", input),
  verifyEmail: (email: string, otp: string) => post("/verify-otp", { email, otp }),
  requestPasswordReset: (email: string) => post("/forgot-password", { email }),
  verifyPasswordReset: (email: string, otp: string) =>
    post("/verify-forgot-password", { email, otp }),
  /** Last step of forgot-password: the emailed OTP is required again. */
  changePassword: (email: string, otp: string, password: string, confirmPassword: string) =>
    post("/change-password", { email, otp, password, confirmPassword }),
  /** Revokes this device's access + refresh token on the server. */
  logout: (refreshToken: string) =>
    apiRequest("/auth/logout", { method: "POST", body: { refreshToken }, auth: true }),
  /** Revokes every session of this account, on every device. */
  logoutAll: () =>
    apiRequest("/auth/logout", { method: "POST", body: { type: "ALL" }, auth: true }),
};
