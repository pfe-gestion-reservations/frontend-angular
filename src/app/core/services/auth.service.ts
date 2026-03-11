import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { AuthUser, JwtResponse, LoginRequest, SignupRequest } from '../models/auth.models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API = environment.apiUrl + '/auth';
  private readonly STORAGE_KEY = 'auth_user';

  currentUser = signal<AuthUser | null>(this.loadUser());

  constructor(private http: HttpClient, private router: Router) {}

  login(req: LoginRequest): Observable<JwtResponse> {
    return this.http.post<JwtResponse>(`${this.API}/login`, req).pipe(
      tap(res => {
        const user: AuthUser = {
          id: res.id,
          email: res.email,
          roles: res.roles,
          token: res.token,
          nom: res.nom,
          prenom: res.prenom
        };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
        this.currentUser.set(user);
      })
    );
  }

  signup(req: SignupRequest): Observable<any> {
    return this.http.post(`${this.API}/signup`, req);
  }

  createGerant(req: SignupRequest): Observable<any> {
    return this.http.post(`${this.API}/create-gerant`, req);
  }

  logout(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/auth/login']);
  }

  getToken(): string | null {
    return this.currentUser()?.token ?? null;
  }

  hasRole(role: string): boolean {
    return this.currentUser()?.roles.includes(`ROLE_${role}`) ?? false;
  }

  isSuperAdmin(): boolean { return this.hasRole('SUPER_ADMIN'); }
  isGerant(): boolean     { return this.hasRole('GERANT'); }
  isEmploye(): boolean    { return this.hasRole('EMPLOYE'); }
  isClient(): boolean     { return this.hasRole('CLIENT'); }

  redirectToDashboard(): void {
    const user = this.currentUser();
    if (!user) { this.router.navigate(['/auth/login']); return; }
    if (this.isSuperAdmin()) { this.router.navigate(['/super-admin']); return; }
    if (this.isGerant())     { this.router.navigate(['/gerant']); return; }
    if (this.isEmploye())    { this.router.navigate(['/employe']); return; }
    if (this.isClient())     { this.router.navigate(['/client']); return; }
  }

  private loadUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
}