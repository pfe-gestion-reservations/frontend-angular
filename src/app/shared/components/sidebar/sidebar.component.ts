import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

export interface NavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
  <aside class="sidebar" [class.collapsed]="collapsed">
    <div class="sidebar-logo">
      <div class="logo-icon">
        <i class="fas fa-calendar-check"></i>
      </div>

      <div class="logo-text" *ngIf="!collapsed">
        <span class="logo-name">Book Space</span>
        <span class="logo-role">{{ roleName }}</span>
      </div>

      <button class="sidebar-toggle" (click)="onToggle()">
        <i class="fas"
           [class.fa-chevron-left]="!collapsed"
           [class.fa-chevron-right]="collapsed">
        </i>
      </button>
    </div>

    <nav class="sidebar-nav">
      <a *ngFor="let item of items"
         [routerLink]="item.route"
         routerLinkActive="active"
         [routerLinkActiveOptions]="{ exact: true }"
         class="nav-item">

        <i class="fas" [ngClass]="item.icon"></i>
        <span *ngIf="!collapsed">{{ item.label }}</span>
      </a>
    </nav>

    <div class="sidebar-footer">
      <button class="nav-item logout-btn" (click)="auth.logout()">
        <i class="fas fa-sign-out-alt"></i>
        <span *ngIf="!collapsed">Deconnexion</span>
      </button>
    </div>
  </aside>
  `,
  styles: [`
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    width: var(--sidebar-w);
    height: 100vh;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    transition: width .3s ease;
    z-index: 100;
    overflow: hidden;
  }

  .sidebar.collapsed {
    width: 72px;
  }

  .sidebar-logo {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 20px 16px;
    border-bottom: 1px solid var(--border);
    min-height: var(--navbar-h);
  }

  .logo-icon {
    width: 38px;
    height: 38px;
    min-width: 38px;
    background: var(--accent-glow);
    border: 1px solid rgba(240,165,0,.4);
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent);
    font-size: 1rem;
  }

  .logo-text {
    flex: 1;
    overflow: hidden;
  }

  .logo-name {
    font-family: var(--font-display);
    font-size: .95rem;
    font-weight: 800;
    color: var(--text-primary);
    display: block;
  }

  .logo-role {
    font-size: .7rem;
    color: var(--accent);
    font-weight: 600;
  }

.sidebar-toggle {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-muted);
  cursor: pointer;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  font-size: .85rem;
  transition: all .2s;
  margin-left: auto;
  min-width: 32px;
  min-height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sidebar-toggle:hover {
  color: var(--accent);
  background: var(--bg-hover);
  border-color: var(--accent);
}

  .sidebar-nav {
    flex: 1;
    padding: 12px 8px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    text-decoration: none;
    font-size: .875rem;
    font-weight: 500;
    transition: all .2s;
    cursor: pointer;
    border: none;
    background: none;
    width: 100%;
    text-align: left;
  }

  .nav-item i {
    width: 18px;
    text-align: center;
    font-size: .95rem;
    flex-shrink: 0;
  }

  .nav-item:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .nav-item.active {
    background: var(--accent-glow);
    color: var(--accent);
    border: 1px solid rgba(240,165,0,.2);
  }

  .sidebar-footer {
    padding: 8px;
    border-top: 1px solid var(--border);
  }

  .logout-btn {
    color: var(--danger) !important;
  }

  .logout-btn:hover {
    background: rgba(248,81,73,.1) !important;
  }
  `]
})
export class SidebarComponent {
  @Input() items: NavItem[] = [];
  @Input() collapsed = false;
  @Input() roleName = '';

  @Output() toggleCollapse = new EventEmitter<void>();

  auth = inject(AuthService);

  onToggle(): void {
    this.toggleCollapse.emit();
  }
}