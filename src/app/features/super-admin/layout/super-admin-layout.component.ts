import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent, NavGroup } from '../../../shared/components/sidebar/sidebar.component';
import { NavbarComponent } from '../../../shared/components/navbar/navbar.component';

@Component({
  selector: 'app-super-admin-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, NavbarComponent],
  template: `
  <div class="app-layout">
    <app-sidebar
      [groups]="navGroups"
      [collapsed]="collapsed()"
      roleName="Super Admin"
      (toggleCollapse)="toggleCollapsed()" />
    <div class="main-content" [class.sidebar-collapsed]="collapsed()">
      <app-navbar [sidebarCollapsed]="collapsed()" />
      <main class="page-wrapper">
        <router-outlet />
      </main>
    </div>
  </div>`
})
export class SuperAdminLayoutComponent {
  collapsed = signal(false);
  toggleCollapsed(): void { this.collapsed.set(!this.collapsed()); }

  navGroups: NavGroup[] = [
    {
      title: 'Vue générale',
      items: [
        { label: 'Tableau de bord', icon: 'fa-chart-pie',   route: '/super-admin/dashboard' }
      ]
    },
    {
      title: 'Organisation',
      items: [
        { label: 'Secteurs',      icon: 'fa-layer-group',  route: '/super-admin/secteurs' },
        { label: 'Entreprises',   icon: 'fa-building',     route: '/super-admin/entreprises' },
        { label: 'Gérants',       icon: 'fa-user-tie',     route: '/super-admin/gerants' },
        { label: 'Employés',      icon: 'fa-users-cog',    route: '/super-admin/employes' },
        { label: 'Clients',       icon: 'fa-user-friends', route: '/super-admin/clients' }
      ]
    },
    {
      title: 'Services',
      items: [
        { label: 'Services',        icon: 'fa-concierge-bell', route: '/super-admin/services' },
        { label: 'Disponibilités',  icon: 'fa-calendar-week',  route: '/super-admin/disponibilites' }
      ]
    },
    {
      title: 'Opérations',
      items: [
        { label: 'Réservations',   icon: 'fa-calendar-alt', route: '/super-admin/reservations' },
        { label: "File d'attente", icon: 'fa-list-ol',      route: '/super-admin/file-attente' }
      ]
    }
  ];
}