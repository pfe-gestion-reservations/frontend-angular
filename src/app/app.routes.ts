import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/auth/login', pathMatch: 'full' },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.authRoutes)
  },
  {
    path: 'super-admin',
    canActivate: [roleGuard(['SUPER_ADMIN'])],
    loadChildren: () => import('./features/super-admin/super-admin.routes').then(m => m.superAdminRoutes)
  },
  {
    path: 'gerant',
    canActivate: [roleGuard(['GERANT'])],
    loadChildren: () => import('./features/gerant/gerant.routes').then(m => m.gerantRoutes)
  },
  {
    path: 'employe',
    canActivate: [roleGuard(['EMPLOYE'])],
    loadChildren: () => import('./features/employe/employe.routes').then(m => m.employeRoutes)
  },
  {
    path: 'client',
    canActivate: [roleGuard(['CLIENT'])],
    loadChildren: () => import('./features/client/client.routes').then(m => m.clientRoutes)
  },
  { path: '**', redirectTo: '/auth/login' }
];
