import { Routes } from '@angular/router';
import { SuperAdminLayoutComponent } from './layout/super-admin-layout.component';

export const superAdminRoutes: Routes = [
  {
    path: '',
    component: SuperAdminLayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard',      loadComponent: () => import('./dashboard/sa-dashboard.component').then(m => m.SaDashboardComponent) },
      { path: 'secteurs',       loadComponent: () => import('./secteurs/secteurs.component').then(m => m.SecteursComponent) },
      { path: 'entreprises',    loadComponent: () => import('./entreprises/entreprises.component').then(m => m.EntreprisesComponent) },
      { path: 'gerants',        loadComponent: () => import('./gerants/gerants.component').then(m => m.GerantsComponent) },
      { path: 'employes',       loadComponent: () => import('./employes/sa-employes.component').then(m => m.SaEmployesComponent) },
      { path: 'clients',        loadComponent: () => import('./clients/sa-clients.component').then(m => m.SaClientsComponent) },
      { path: 'services',       loadComponent: () => import('./services/sa-services.component').then(m => m.SaServicesComponent) },
      { path: 'disponibilites', loadComponent: () => import('./disponibilites/sa-disponibilites.component').then(m => m.SaDisponibilitesComponent) }
    ]
  }
];