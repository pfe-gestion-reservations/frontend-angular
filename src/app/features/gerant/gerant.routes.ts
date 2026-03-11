import { Routes } from '@angular/router';
import { GerantLayoutComponent } from './layout/gerant-layout.component';

export const gerantRoutes: Routes = [
  {
    path: '',
    component: GerantLayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard',      loadComponent: () => import('./dashboard/gerant-dashboard.component').then(m => m.GerantDashboardComponent) },
      { path: 'employes',       loadComponent: () => import('./employes/gerant-employes.component').then(m => m.GerantEmployesComponent) },
      { path: 'services',       loadComponent: () => import('./services/gerant-services.component').then(m => m.GerantServicesComponent) },
      { path: 'clients',        loadComponent: () => import('./clients/gerant-clients.component').then(m => m.GerantClientsComponent) },
      { path: 'reservations',   loadComponent: () => import('./reservations/gerant-reservations.component').then(m => m.GerantReservationsComponent) },
      { path: 'disponibilites', loadComponent: () => import('./disponibilites/gerant-disponibilites.component').then(m => m.GerantDisponibilitesComponent) },
      { path: 'file-attente',   loadComponent: () => import('./file-attente/gerant-file.component').then(m => m.GerantFileComponent) },
      { path: 'avis',           loadComponent: () => import('./avis/gerant-avis.component').then(m => m.GerantAvisComponent) }
    ]
  }
];
