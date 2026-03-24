import { Routes } from '@angular/router';
import { ClientLayoutComponent } from './layout/client-layout.component';

export const clientRoutes: Routes = [
  {
    path: '',
    component: ClientLayoutComponent,
    children: [

      // 🔁 Redirection par défaut
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

      // 🏠 Dashboard
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./dashboard/client-dashboard.component')
            .then(m => m.ClientDashboardComponent)
      },

      // 📅 Réservations
      {
        path: 'reservations',
        loadComponent: () =>
          import('./reservations/client-reservations.component')
            .then(m => m.ClientReservationsComponent)
      },

      // 🛎️ Services
      {
        path: 'services',
        loadComponent: () =>
          import('./services/client-services.component')
            .then(m => m.ClientServicesComponent)
      },

      // ⭐ Avis
      {
        path: 'avis',
        loadComponent: () =>
          import('./avis/client-avis.component')
            .then(m => m.ClientAvisComponent)
      }
    ]
  }
];