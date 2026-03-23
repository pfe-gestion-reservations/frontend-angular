import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

export interface NavItem {
  label: string;
  icon: string;
  route: string;
  badge?: number;
}

export interface NavGroup {
  title?: string;
  items: NavItem[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
  <aside class="sidebar" [class.collapsed]="collapsed">

    <!-- Logo -->
    <div class="sidebar-logo">
      <div class="logo-mark">
        <i class="fas fa-calendar-check"></i>
      </div>
      <div class="logo-text" *ngIf="!collapsed">
        <span class="logo-name">BookSpace</span>
        <span class="logo-badge">{{ roleName }}</span>
      </div>
      <button class="toggle-btn" (click)="onToggle()" [title]="collapsed ? 'Expand' : 'Collapse'">
        <i class="fas" [class.fa-chevron-left]="!collapsed" [class.fa-chevron-right]="collapsed"></i>
      </button>
    </div>

    <!-- Navigation -->
    <nav class="sidebar-nav">
      <ng-container *ngFor="let group of navGroups">
        <div class="nav-group-title" *ngIf="group.title && !collapsed">{{ group.title }}</div>
        <a *ngFor="let item of group.items"
           [routerLink]="item.route"
           routerLinkActive="active"
           [routerLinkActiveOptions]="{ exact: item.route.endsWith('dashboard') }"
           class="nav-item"
           [title]="collapsed ? item.label : ''">
          <div class="nav-icon">
            <i class="fas" [ngClass]="item.icon"></i>
          </div>
          <span class="nav-label" *ngIf="!collapsed">{{ item.label }}</span>
          <span class="nav-badge" *ngIf="item.badge && item.badge > 0 && !collapsed">{{ item.badge }}</span>
          <span class="nav-badge-dot" *ngIf="item.badge && item.badge > 0 && collapsed"></span>
        </a>
      </ng-container>
    </nav>

    <!-- Footer -->
    <div class="sidebar-footer">
      <!-- Theme toggle -->
      <button class="theme-toggle" (click)="toggleTheme()" [title]="isDark() ? 'Mode clair' : 'Mode sombre'">
        <div class="theme-track">
          <i class="fas fa-moon theme-icon dark-icon"></i>
          <i class="fas fa-sun theme-icon light-icon"></i>
          <div class="theme-thumb" [class.light]="!isDark()"></div>
        </div>
        <span *ngIf="!collapsed" class="theme-label">{{ isDark() ? 'Mode sombre' : 'Mode clair' }}</span>
      </button>

      <!-- User profile -->
      <div class="sidebar-user" [class.collapsed]="collapsed">
        <div class="user-avatar-wrap">
          <div class="user-av">{{ initials }}</div>
          <div class="user-status"></div>
        </div>
        <div class="user-info" *ngIf="!collapsed">
          <div class="user-name">{{ displayName }}</div>
          <div class="user-role">{{ roleName }}</div>
        </div>
        <button class="logout-btn" (click)="auth.logout()" [title]="'Se déconnecter'" *ngIf="!collapsed">
          <i class="fas fa-sign-out-alt"></i>
        </button>
      </div>

      <button class="nav-item logout-item" (click)="auth.logout()" *ngIf="collapsed" title="Se déconnecter">
        <div class="nav-icon"><i class="fas fa-sign-out-alt"></i></div>
      </button>
    </div>

  </aside>`,
  styles: [`
    .sidebar {
      position: fixed; top: 0; left: 0;
      width: var(--sidebar-w);
      height: 100vh;
      background: var(--bg-secondary);
      border-right: 1px solid var(--border);
      display: flex; flex-direction: column;
      transition: width .25s cubic-bezier(.4,0,.2,1);
      z-index: 100;
      overflow: hidden;
    }
    .sidebar.collapsed { width: 68px; }

    /* Logo */
    .sidebar-logo {
      display: flex; align-items: center; gap: 10px;
      padding: 14px 14px;
      border-bottom: 1px solid var(--border);
      min-height: var(--navbar-h);
      flex-shrink: 0;
    }
    .logo-mark {
      width: 36px; height: 36px;
      min-width: 36px;
      background: var(--primary);
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: .9rem;
      box-shadow: 0 2px 8px rgba(99,102,241,0.4);
      flex-shrink: 0;
    }
    .logo-text { flex: 1; overflow: hidden; }
    .logo-name {
      font-size: .92rem; font-weight: 800;
      color: var(--text-primary);
      display: block;
      letter-spacing: -0.02em;
      white-space: nowrap;
    }
    .logo-badge {
      font-size: .62rem; font-weight: 600;
      color: var(--primary);
      background: var(--primary-light);
      border: 1px solid var(--primary-border);
      border-radius: 4px;
      padding: 1px 6px;
      display: inline-block;
      margin-top: 2px;
      letter-spacing: 0.02em;
    }
    .toggle-btn {
      background: var(--bg-hover);
      border: 1px solid var(--border-md);
      color: var(--text-faint);
      cursor: pointer;
      padding: 6px 8px;
      border-radius: 6px;
      font-size: .72rem;
      transition: all .15s;
      margin-left: auto;
      flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      width: 28px; height: 28px;
    }
    .toggle-btn:hover { color: var(--primary); border-color: var(--primary); background: var(--primary-light); }

    /* Nav */
    .sidebar-nav {
      flex: 1;
      padding: 10px 8px;
      overflow-y: auto;
      display: flex; flex-direction: column;
      gap: 1px;
    }
    .nav-group-title {
      font-size: .6rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .1em;
      color: var(--text-faint);
      padding: 10px 8px 4px;
    }
    .nav-item {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 10px;
      border-radius: 8px;
      color: var(--text-muted);
      text-decoration: none;
      font-size: .8rem;
      font-weight: 500;
      transition: all .15s;
      cursor: pointer;
      border: none;
      background: none;
      width: 100%;
      text-align: left;
      position: relative;
    }
    .nav-item:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }
    .nav-item.active {
      background: var(--primary-light);
      color: var(--primary);
    }
    .nav-item.active .nav-icon { color: var(--primary); }
    .nav-icon {
      width: 18px; text-align: center;
      font-size: .85rem;
      flex-shrink: 0;
      color: var(--text-faint);
      transition: color .15s;
    }
    .nav-item:hover .nav-icon { color: var(--text-secondary); }
    .nav-label { flex: 1; white-space: nowrap; overflow: hidden; }
    .nav-badge {
      background: var(--primary);
      color: #fff;
      font-size: .6rem;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 99px;
      min-width: 18px;
      text-align: center;
    }
    .nav-badge-dot {
      width: 6px; height: 6px;
      background: var(--primary);
      border-radius: 50%;
      position: absolute;
      top: 8px; right: 8px;
    }

    /* Footer */
    .sidebar-footer {
      padding: 8px;
      border-top: 1px solid var(--border);
      display: flex; flex-direction: column; gap: 4px;
      flex-shrink: 0;
    }

    /* Theme toggle */
    .theme-toggle {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 10px;
      border-radius: 8px;
      border: none;
      background: none;
      cursor: pointer;
      transition: background .15s;
      width: 100%;
    }
    .theme-toggle:hover { background: var(--bg-hover); }
    .theme-track {
      width: 36px; height: 20px;
      background: var(--bg-active);
      border: 1px solid var(--border-md);
      border-radius: 99px;
      position: relative;
      flex-shrink: 0;
      transition: background .2s;
    }
    .theme-icon {
      position: absolute; top: 50%;
      transform: translateY(-50%);
      font-size: .55rem;
      transition: opacity .2s;
    }
    .dark-icon  { left: 5px;  color: var(--indigo-300); opacity: 1; }
    .light-icon { right: 5px; color: #f59e0b; opacity: 0.4; }
    .theme-thumb {
      position: absolute;
      top: 2px; left: 2px;
      width: 14px; height: 14px;
      background: var(--primary);
      border-radius: 50%;
      transition: transform .2s cubic-bezier(.34,1.56,.64,1);
      box-shadow: 0 1px 4px rgba(0,0,0,0.3);
    }
    .theme-thumb.light {
      transform: translateX(16px);
      background: #f59e0b;
    }
    .theme-label { font-size: .76rem; font-weight: 500; color: var(--text-muted); white-space: nowrap; }

    /* User */
    .sidebar-user {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 10px;
      border-radius: 8px;
      transition: background .15s;
    }
    .sidebar-user:hover { background: var(--bg-hover); }
    .sidebar-user.collapsed { justify-content: center; padding: 8px; }
    .user-avatar-wrap { position: relative; flex-shrink: 0; }
    .user-av {
      width: 30px; height: 30px;
      background: var(--primary);
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-size: .7rem; font-weight: 700;
      color: #fff;
      letter-spacing: 0.02em;
    }
    .user-status {
      position: absolute; bottom: -1px; right: -1px;
      width: 8px; height: 8px;
      background: var(--success);
      border: 2px solid var(--bg-secondary);
      border-radius: 50%;
    }
    .user-info { flex: 1; overflow: hidden; }
    .user-name {
      font-size: .76rem; font-weight: 600;
      color: var(--text-primary);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .user-role { font-size: .65rem; color: var(--text-faint); }
    .logout-btn {
      background: none; border: none; cursor: pointer;
      color: var(--text-faint); padding: 4px;
      border-radius: 5px; font-size: .78rem;
      transition: all .15s;
      flex-shrink: 0;
    }
    .logout-btn:hover { color: var(--danger); background: var(--danger-bg); }
    .logout-item { color: var(--danger) !important; }
    .logout-item:hover { background: var(--danger-bg) !important; }
    .logout-item .nav-icon { color: var(--danger) !important; }
  `]
})
export class SidebarComponent {
  @Input() items: NavItem[] = [];
  @Input() groups: NavGroup[] = [];
  @Input() collapsed = false;
  @Input() roleName = '';
  @Output() toggleCollapse = new EventEmitter<void>();

  auth = inject(AuthService);
  private _isDark = signal(true);

  get isDark() { return this._isDark; }

  get navGroups(): NavGroup[] {
    if (this.groups.length) return this.groups;
    return [{ items: this.items }];
  }

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

  ngOnInit(): void {
    const saved = localStorage.getItem('bs-theme');
    const dark = saved ? saved === 'dark' : true;
    this._isDark.set(dark);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }

  toggleTheme(): void {
    const next = !this._isDark();
    this._isDark.set(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    localStorage.setItem('bs-theme', next ? 'dark' : 'light');
  }

  onToggle(): void { this.toggleCollapse.emit(); }
}