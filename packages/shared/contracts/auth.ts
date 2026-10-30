// Application email-code authentication. Never include SMTP credentials here.
export interface AuthUser {
  id: string;
  email: string;
  email_verified: boolean;
  created_at: string;
}
export interface SendCodeRequest { email: string }
export interface SendCodeResponse {
  challenge_id: string;
  email: string;
  expires_in: number;
  resend_after_seconds: number;
}
export interface VerifyCodeRequest {
  challenge_id: string;
  code: string;
  client: 'web' | 'native';
}
export interface RefreshRequest {
  client: 'web' | 'native';
  refresh_token?: string;
}
export interface SessionResponse {
  user: AuthUser;
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  // Only native responses contain a refresh token. Web uses an HttpOnly cookie.
  refresh_token: string | null;
}
export interface MeResponse { user: AuthUser }

export interface AuthErrorResponse {
  error: { code: string; message: string; retry_after_seconds?: number | null };
}
