import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent, NavGroup } from '../../../shared/components/sidebar/sidebar.component';
import { NavbarComponent } from '../../../shared/components/navbar/navbar.component';

@Component({
  selector: 'app-employe-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, NavbarComponent],
  template: `
    <div class="app-layout">
      <app-sidebar
        [groups]="navGroups"
        [collapsed]="collapsed()"
        roleName="Employé"
        (toggleCollapse)="toggleCollapsed()" />

      <div class="main-content" [class.sidebar-collapsed]="collapsed()">
        <app-navbar />
        <main class="page-wrapper">
          <router-outlet />
        </main>
      </div>
    </div>
  `
})
export class EmployeLayoutComponent {
  collapsed = signal(false);

  toggleCollapsed(): void {
    this.collapsed.set(!this.collapsed());
  }

  navGroups: NavGroup[] = [
    {
      title: 'Navigation',
      items: [
        { label: 'Tableau de bord', icon: 'fa-tachometer-alt', route: '/employe/dashboard' },
        { label: "File d’attente",  icon: 'fa-list-ol',        route: '/employe/file-attente' },
        { label: 'Réservations',    icon: 'fa-calendar-alt',   route: '/employe/reservations' },
        { label: 'Clients',         icon: 'fa-user-friends',   route: '/employe/clients' },
        { label: 'Mes avis',        icon: 'fa-star',           route: '/employe/avis' }
      ]
    }
  ];
}