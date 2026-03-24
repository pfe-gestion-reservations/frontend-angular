import { Routes } from '@angular/router';
import { roleGuard } from './core/guards/auth.guard';

export const routes: Routes = [

  // 🔁 Redirection par défaut
  { path: '', redirectTo: '/auth/login', pathMatch: 'full' },

  // 🔐 AUTH
  {
    path: 'auth',
    loadChildren: () =>
      import('./features/auth/auth.routes')
        .then(m => m.authRoutes)
  },

  // 🛡️ SUPER ADMIN
  {
    path: 'super-admin',
    canActivate: [roleGuard(['SUPER_ADMIN'])],
    loadChildren: () =>
      import('./features/super-admin/super-admin.routes')
        .then(m => m.superAdminRoutes)
  },

  // 🧑‍💼 GÉRANT
  {
    path: 'gerant',
    canActivate: [roleGuard(['GERANT'])],
    loadChildren: () =>
      import('./features/gerant/gerant.routes')
        .then(m => m.gerantRoutes)
  },

  // 👷 EMPLOYÉ
  {
    path: 'employe',
    canActivate: [roleGuard(['EMPLOYE'])],
    loadChildren: () =>
      import('./features/employe/employe.routes')
        .then(m => m.employeRoutes)
  },

  // 👤 CLIENT
  {
    path: 'client',
    canActivate: [roleGuard(['CLIENT'])],
    loadChildren: () =>
      import('./features/client/client.routes')
        .then(m => m.clientRoutes)
  },

  // ❌ Route inconnue
  { path: '**', redirectTo: '/auth/login' }
];