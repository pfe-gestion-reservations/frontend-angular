export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  nom: string;
  prenom: string;
  email: string;
  password: string;
  numtel?: string;
}

export interface JwtResponse {
  token: string;
  type: string;
  id: number;
  email: string;
  roles: string[];
  nom: string;
  prenom: string;
}

export interface AuthUser {
  id: number;
  email: string;
  roles: string[];
  token: string;
  nom: string;
  prenom: string;
}