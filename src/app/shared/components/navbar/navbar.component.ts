import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  template: `
  <header class="navbar">
    <div class="navbar-left">
      <div class="breadcrumb">Bonjour, <strong>{{ displayName }}</strong></div>
    </div>
    <div class="navbar-right">
      <div class="user-badge">
        <div class="user-avatar">{{ initials }}</div>
        <div>
          <div class="user-name">{{ displayName }}</div>
          <div class="user-role">{{ roleName }}</div>
        </div>
      </div>
    </div>
  </header>`,
  styles: [`
  .navbar {
    position: fixed; top: 0; right: 0; left: var(--sidebar-w);
    height: var(--navbar-h);
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 24px; z-index: 99;
    transition: left .3s ease;
  }
  .breadcrumb { font-size: .875rem; color: var(--text-secondary); }
  .breadcrumb strong { color: var(--text-primary); }
  .navbar-right { display: flex; align-items: center; gap: 16px; }
  .user-badge { display: flex; align-items: center; gap: 10px; cursor: default; }
  .user-avatar {
    width: 36px; height: 36px;
    background: var(--accent-glow);
    border: 1px solid rgba(240,165,0,.4);
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-display);
    font-size: .8rem; font-weight: 700; color: var(--accent);
  }
  .user-name { font-size: .8rem; font-weight: 600; color: var(--text-primary); }
  .user-role { font-size: .7rem; color: var(--accent); }
  `]
})
export class NavbarComponent {
  auth = inject(AuthService);

  get displayName(): string {
    const u = this.auth.currentUser();
    if (u?.prenom && u?.nom) return `${u.prenom} ${u.nom}`;
    return u?.email ?? '';
  }

  get initials(): string {
    const u = this.auth.currentUser();
    if (u?.prenom && u?.nom) return `${u.prenom[0]}${u.nom[0]}`.toUpperCase();
    return (u?.email ?? '').substring(0, 2).toUpperCase();
  }

  get roleName(): string {
    const roles = this.auth.currentUser()?.roles ?? [];
    if (roles.includes('ROLE_SUPER_ADMIN')) return 'Super Admin';
    if (roles.includes('ROLE_GERANT'))      return 'Gérant';
    if (roles.includes('ROLE_EMPLOYE'))     return 'Employé';
    if (roles.includes('ROLE_CLIENT'))      return 'Client';
    return '';
  }
}