import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent, NavItem } from '../../../shared/components/sidebar/sidebar.component';
import { NavbarComponent } from '../../../shared/components/navbar/navbar.component';

@Component({
  selector: 'app-client-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, NavbarComponent],
  template: `
  <div class="app-layout">
    <app-sidebar [items]="navItems" [collapsed]="collapsed()" roleName="Client"
      (toggleCollapse)="toggleCollapsed()" />
    <div class="main-content" [class.sidebar-collapsed]="collapsed()">
      <app-navbar />
      <main class="page-wrapper"><router-outlet /></main>
    </div>
  </div>`
})
export class ClientLayoutComponent {
  collapsed = signal(false);
  toggleCollapsed(): void { this.collapsed.set(!this.collapsed()); }
  navItems: NavItem[] = [
    { label: 'Accueil',          icon: 'fa-home',           route: '/client/dashboard' },
    { label: 'Mes reservations', icon: 'fa-calendar-check', route: '/client/reservations' },
    { label: 'Services',         icon: 'fa-concierge-bell', route: '/client/services' },
    { label: 'Creneaux',         icon: 'fa-clock',          route: '/client/creneaux' },
    { label: 'Mes avis',         icon: 'fa-star',           route: '/client/avis' }
  ];
}
