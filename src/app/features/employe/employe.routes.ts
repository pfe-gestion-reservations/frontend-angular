import { Routes } from '@angular/router';
import { EmployeLayoutComponent } from './layout/employe-layout.component';

export const employeRoutes: Routes = [
  {
    path: '',
    component: EmployeLayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard',   loadComponent: () => import('./dashboard/employe-dashboard.component').then(m => m.EmployeDashboardComponent) },
      { path: 'ma-file',     loadComponent: () => import('./ma-file/ma-file.component').then(m => m.MaFileComponent) },
      { path: 'reservations',loadComponent: () => import('./reservations/employe-reservations.component').then(m => m.EmployeReservationsComponent) },
      { path: 'clients',     loadComponent: () => import('./clients/employe-clients.component').then(m => m.EmployeClientsComponent) },
      { path: 'avis',        loadComponent: () => import('./avis/employe-avis.component').then(m => m.EmployeAvisComponent) }
    ]
  }
];
