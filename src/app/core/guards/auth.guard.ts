import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (auth.currentUser()) return true;
  inject(Router).navigate(['/auth/login']);
  return false;
};

export const roleGuard = (roles: string[]): CanActivateFn => () => {
  const auth = inject(AuthService);
  if (!auth.currentUser()) { inject(Router).navigate(['/auth/login']); return false; }
  if (roles.some(r => auth.hasRole(r))) return true;
  auth.redirectToDashboard();
  return false;
};
