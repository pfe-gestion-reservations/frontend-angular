import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent, NavItem } from '../../../shared/components/sidebar/sidebar.component';
import { NavbarComponent } from '../../../shared/components/navbar/navbar.component';

@Component({
  selector: 'app-gerant-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, NavbarComponent],
  template: `
  <div class="app-layout">
    <app-sidebar [items]="navItems" [collapsed]="collapsed()" roleName="Gerant"
      (toggleCollapse)="toggleCollapsed()" />
    <div class="main-content" [class.sidebar-collapsed]="collapsed()">
      <app-navbar />
      <main class="page-wrapper"><router-outlet /></main>
    </div>
  </div>`
})
export class GerantLayoutComponent {
  collapsed = signal(false);
  toggleCollapsed(): void { this.collapsed.set(!this.collapsed()); }
  navItems: NavItem[] = [
    { label: 'Tableau de bord',  icon: 'fa-chart-bar',     route: '/gerant/dashboard' },
    { label: 'Employes',         icon: 'fa-users',          route: '/gerant/employes' },
    { label: 'Services',         icon: 'fa-concierge-bell', route: '/gerant/services' },
    { label: 'Clients',          icon: 'fa-user-friends',   route: '/gerant/clients' },
    { label: 'Reservations',     icon: 'fa-calendar-alt',   route: '/gerant/reservations' },
    { label: 'Disponibilites',   icon: 'fa-clock',          route: '/gerant/disponibilites' },
    { label: 'File attente',     icon: 'fa-list-ol',        route: '/gerant/file-attente' },
    { label: 'Avis clients',     icon: 'fa-star',           route: '/gerant/avis' }
  ];
}
