import { Component, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
  <header class="navbar" [class.collapsed]="sidebarCollapsed">
    <div class="navbar-left">
      <div class="breadcrumb">
        <span class="bc-greeting">Bonjour,</span>
        <strong class="bc-name">{{ fullGreeting }}</strong>
      </div>
    </div>
    <div class="navbar-right">
      <div class="user-chip">
        <div class="chip-avatar">{{ initials }}</div>
        <div class="chip-info">
          <div class="chip-name">{{ displayName }}</div>
          <div class="chip-role">{{ roleName }}</div>
        </div>
      </div>
    </div>
  </header>`,
  styles: [`
    .navbar {
      position: fixed; top: 0; right: 0;
      left: var(--sidebar-w);
      height: var(--navbar-h);
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 24px;
      z-index: 99;
      transition: left .25s cubic-bezier(.4,0,.2,1);
      backdrop-filter: blur(8px);
    }
    .navbar.collapsed { left: 68px; }

    .navbar-left { display: flex; align-items: center; gap: 12px; }
    .breadcrumb { display: flex; align-items: center; gap: 5px; font-size: .825rem; }
    .bc-greeting { color: var(--text-muted); }
    .bc-name { color: var(--text-primary); font-weight: 700; letter-spacing: -0.01em; }

    .navbar-right { display: flex; align-items: center; gap: 12px; }

    .user-chip {
      display: flex; align-items: center; gap: 10px;
      padding: 5px 12px 5px 5px;
      background: var(--bg-elevated);
      border: 1px solid var(--border-md);
      border-radius: 99px;
      cursor: default;
      transition: border-color .15s;
    }
    .user-chip:hover { border-color: var(--border-strong); }

    .chip-avatar {
      width: 28px; height: 28px;
      background: var(--primary);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: .65rem; font-weight: 700;
      color: #fff;
      letter-spacing: 0.02em;
      flex-shrink: 0;
    }

    .chip-info { line-height: 1.3; }
    .chip-name { font-size: .75rem; font-weight: 600; color: var(--text-primary); white-space: nowrap; }
    .chip-role { font-size: .62rem; color: var(--primary); font-weight: 500; }
  `]
})
export class NavbarComponent {
  @Input() sidebarCollapsed = false;
  auth = inject(AuthService);

  get displayName(): string {
    const u = this.auth.currentUser();
    if (u?.prenom && u?.nom) return `${u.prenom} ${u.nom}`;
    return u?.email ?? '';
  }

  get fullGreeting(): string {
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