import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent, NavItem } from '../../../shared/components/sidebar/sidebar.component';
import { NavbarComponent } from '../../../shared/components/navbar/navbar.component';

@Component({
  selector: 'app-employe-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, NavbarComponent],
  template: `
  <div class="app-layout">
    <app-sidebar [items]="navItems" [collapsed]="collapsed()" roleName="Employe"
      (toggleCollapse)="toggleCollapsed()" />
    <div class="main-content" [class.sidebar-collapsed]="collapsed()">
      <app-navbar />
      <main class="page-wrapper"><router-outlet /></main>
    </div>
  </div>`
})
export class EmployeLayoutComponent {
  collapsed = signal(false);
  toggleCollapsed(): void { this.collapsed.set(!this.collapsed()); }
  navItems: NavItem[] = [
    { label: 'Tableau de bord', icon: 'fa-tachometer-alt', route: '/employe/dashboard' },
    { label: 'Ma File',         icon: 'fa-list-ol',        route: '/employe/ma-file' },
    { label: 'Reservations',    icon: 'fa-calendar-alt',   route: '/employe/reservations' },
    { label: 'Clients',         icon: 'fa-user-friends',   route: '/employe/clients' },
    { label: 'Mes Avis',        icon: 'fa-star',           route: '/employe/avis' }
  ];
}
