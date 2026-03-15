import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent, NavItem } from '../../../shared/components/sidebar/sidebar.component';
import { NavbarComponent } from '../../../shared/components/navbar/navbar.component';

@Component({
  selector: 'app-super-admin-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, NavbarComponent],
  template: `
  <div class="app-layout">
    <app-sidebar [items]="navItems" [collapsed]="collapsed()" roleName="Super Admin"
      (toggleCollapse)="toggleCollapsed()" />
    <div class="main-content" [class.sidebar-collapsed]="collapsed()">
      <app-navbar />
      <main class="page-wrapper"><router-outlet /></main>
    </div>
  </div>`
})
export class SuperAdminLayoutComponent {
  collapsed = signal(false);
  toggleCollapsed(): void { this.collapsed.set(!this.collapsed()); }
  navItems: NavItem[] = [
    { label: 'Tableau de bord', icon: 'fa-chart-pie',      route: '/super-admin/dashboard' },
    { label: 'Secteurs',        icon: 'fa-layer-group',    route: '/super-admin/secteurs' },
    { label: 'Entreprises',     icon: 'fa-building',       route: '/super-admin/entreprises' },
    { label: 'Gérants',         icon: 'fa-user-tie',       route: '/super-admin/gerants' },
    { label: 'Employés',        icon: 'fa-users-cog',      route: '/super-admin/employes' },
    { label: 'Services',        icon: 'fa-concierge-bell', route: '/super-admin/services' },
    { label: 'Disponibilités',  icon: 'fa-calendar-week',  route: '/super-admin/disponibilites' },
    { label: 'File d\'attente', icon: 'fa-list-ol',        route: '/super-admin/file-attente' },
    { label: 'Clients',         icon: 'fa-user-friends',   route: '/super-admin/clients' },
    { label: 'Réservations',    icon: 'fa-layer-group',    route: '/super-admin/reservations' }
  ];
}