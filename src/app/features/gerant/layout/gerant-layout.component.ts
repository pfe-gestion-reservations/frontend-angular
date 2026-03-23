import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent, NavGroup } from '../../../shared/components/sidebar/sidebar.component';
import { NavbarComponent } from '../../../shared/components/navbar/navbar.component';
import { gerantEntrepriseGuard } from '../../../core/guards/gerant.guard';

@Component({
  selector: 'app-gerant-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, NavbarComponent],
  template: `
  <div class="app-layout">
    <app-sidebar
      [groups]="navGroups"
      [collapsed]="collapsed()"
      roleName="Gérant"
      (toggleCollapse)="toggleCollapsed()" />
    <div class="main-content" [class.sidebar-collapsed]="collapsed()">
      <app-navbar [sidebarCollapsed]="collapsed()" />
      <main class="page-wrapper">
        <router-outlet />
      </main>
    </div>
  </div>`
})
export class GerantLayoutComponent {
  collapsed = signal(false);
  toggleCollapsed(): void { this.collapsed.set(!this.collapsed()); }

  navGroups: NavGroup[] = [
    {
      title: 'Vue générale',
      items: [
        { label: 'Tableau de bord', icon: 'fa-chart-bar', route: '/gerant/dashboard' }
      ]
    },
    {
      title: 'Mon équipe',
      items: [
        { label: 'Employés', icon: 'fa-users',         route: '/gerant/employes' },
        { label: 'Clients',  icon: 'fa-user-friends',  route: '/gerant/clients' }
      ]
    },
    {
      title: 'Offre',
      items: [
        { label: 'Services',       icon: 'fa-concierge-bell', route: '/gerant/services' },
        { label: 'Disponibilités', icon: 'fa-clock',          route: '/gerant/disponibilites' }
      ]
    },
    {
      title: 'Activité',
      items: [
        { label: 'Réservations',   icon: 'fa-calendar-alt', route: '/gerant/reservations' },
        { label: "File d'attente", icon: 'fa-list-ol',      route: '/gerant/file-attente' },
        { label: 'Avis clients',   icon: 'fa-star',         route: '/gerant/avis' }
      ]
    }
  ];
}