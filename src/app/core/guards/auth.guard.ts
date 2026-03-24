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
  console.log('Guard called, user:', auth.currentUser());
  console.log('Checking roles:', roles);
  console.log('hasRole result:', roles.some(r => auth.hasRole(r)));
  if (!auth.currentUser()) { inject(Router).navigate(['/auth/login']); return false; }
  if (roles.some(r => auth.hasRole(r))) return true;
  auth.redirectToDashboard();
  return false;
};