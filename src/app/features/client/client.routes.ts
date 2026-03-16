import { Routes } from '@angular/router';
import { ClientLayoutComponent } from './layout/client-layout.component';

export const clientRoutes: Routes = [
  {
    path: '',
    component: ClientLayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard',    loadComponent: () => import('./dashboard/client-dashboard.component').then(m => m.ClientDashboardComponent) },
      { path: 'reservations', loadComponent: () => import('./reservations/client-reservations.component').then(m => m.ClientReservationsComponent) },
      { path: 'services',     loadComponent: () => import('./services/client-services.component').then(m => m.ClientServicesComponent) },
      { path: 'avis',         loadComponent: () => import('./avis/client-avis.component').then(m => m.ClientAvisComponent) },
    ]
  }
];