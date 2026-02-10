/**
 * Interface for user authentication credentials
 */
export interface LoginCredentials {
  username: string;
  password: string;
}

/**
 * Interface for authentication response
 */
export interface AuthResponse {
  success: boolean;
  message: string;
  user?: {
    id: string;
    username: string;
    email: string;
  };
}

/**
 * Interface for error response
 */
export interface AuthError {
  message: string;
  status: number;
}
