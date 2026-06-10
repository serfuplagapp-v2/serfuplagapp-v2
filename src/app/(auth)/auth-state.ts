/** Estado compartido entre los formularios de autenticación y sus acciones. */
export type AuthState = {
  error: string | null;
  success: string | null;
};

export const initialAuthState: AuthState = { error: null, success: null };
