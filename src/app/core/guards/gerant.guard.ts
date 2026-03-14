import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const gerantEntrepriseGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (!auth.isGerant()) {
    router.navigate(['/auth/login']);
    return false;
  }

  if (!auth.gerantHasEntreprise()) {
    router.navigate(['/gerant/no-entreprise']);
    return false;
  }

  return true;
};