import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

type BloqueReason =
  | 'GERANT_ARCHIVE'
  | 'GERANT_SANS_ENTREPRISE'
  | 'EMPLOYE_ARCHIVE'
  | 'EMPLOYE_SANS_ENTREPRISE'
  | 'CLIENT_ARCHIVE'
  | 'COMPTE_ARCHIVE';

interface BloqueConfig {
  icon: string;
  iconColor: string;
  iconBg: string;
  borderColor: string;
  title: string;
  message: string;
}

const CONFIGS: Record<BloqueReason, BloqueConfig> = {
  GERANT_ARCHIVE: {
    icon: 'fas fa-user-slash',
    iconColor: '#ef4444',
    iconBg: 'rgba(239,68,68,.12)',
    borderColor: 'rgba(239,68,68,.3)',
    title: 'Compte archivé',
    message: 'Votre compte gérant a été archivé par l\'administrateur.<br>Contactez-le pour réactiver votre accès.'
  },
  GERANT_SANS_ENTREPRISE: {
    icon: 'fas fa-building',
    iconColor: '#f59e0b',
    iconBg: 'rgba(245,158,11,.12)',
    borderColor: 'rgba(245,158,11,.3)',
    title: 'Compte non assigné',
    message: 'Votre compte gérant n\'est pas encore associé à une entreprise.<br>Veuillez contacter votre administrateur.'
  },
  EMPLOYE_ARCHIVE: {
    icon: 'fas fa-user-slash',
    iconColor: '#ef4444',
    iconBg: 'rgba(239,68,68,.12)',
    borderColor: 'rgba(239,68,68,.3)',
    title: 'Compte archivé',
    message: 'Votre compte employé a été archivé.<br>Contactez l\'administrateur ou le gérant de votre entreprise.'
  },
  EMPLOYE_SANS_ENTREPRISE: {
    icon: 'fas fa-unlink',
    iconColor: '#f59e0b',
    iconBg: 'rgba(245,158,11,.12)',
    borderColor: 'rgba(245,158,11,.3)',
    title: 'Compte non rattaché',
    message: 'Votre compte employé n\'est rattaché à aucune entreprise.<br>Contactez l\'administrateur pour être affecté.'
  },
  CLIENT_ARCHIVE: {
    icon: 'fas fa-user-slash',
    iconColor: '#ef4444',
    iconBg: 'rgba(239,68,68,.12)',
    borderColor: 'rgba(239,68,68,.3)',
    title: 'Compte archivé',
    message: 'Votre compte client a été archivé.<br>Contactez l\'administrateur pour réactiver votre accès.'
  },
  COMPTE_ARCHIVE: {
    icon: 'fas fa-ban',
    iconColor: '#ef4444',
    iconBg: 'rgba(239,68,68,.12)',
    borderColor: 'rgba(239,68,68,.3)',
    title: 'Compte désactivé',
    message: 'Votre compte a été désactivé.<br>Contactez l\'administrateur pour plus d\'informations.'
  }
};

@Component({
  selector: 'app-compte-bloque',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="block-page">
      <div class="block-card">

        <div class="block-icon"
             [style.background]="cfg.iconBg"
             [style.border-color]="cfg.borderColor">
          <i [class]="cfg.icon" [style.color]="cfg.iconColor"></i>
        </div>

        <h1 class="block-title">{{ cfg.title }}</h1>
        <p class="block-msg" [innerHTML]="cfg.message"></p>

        <div class="block-user" *ngIf="displayEmail">
          <div class="bu-avatar">{{ initials }}</div>
          <div>
            <div class="bu-name" *ngIf="displayName">{{ displayName }}</div>
            <div class="bu-email">{{ displayEmail }}</div>
          </div>
        </div>

        <button class="btn-back" (click)="backToLogin()">
          <i class="fas fa-arrow-left"></i> Retour à la connexion
        </button>
      </div>
    </div>
  `,
  styles: [`
    .block-page {
      min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
      background: var(--bg-primary, #0f1117); padding: 20px;
    }
    .block-card {
      background: var(--bg-card, #1a1d27);
      border: 1px solid var(--border, #2a2d3a);
      border-radius: 20px; padding: 48px 40px;
      max-width: 440px; width: 100%;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,.4);
      animation: slideUp .3s cubic-bezier(.34,1.56,.64,1);
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(24px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .block-icon {
      width: 72px; height: 72px; border-radius: 50%;
      border: 2px solid transparent;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 24px; font-size: 1.8rem;
    }
    .block-title {
      font-size: 1.35rem; font-weight: 700;
      color: var(--text-primary, #f2f2f8); margin-bottom: 12px;
    }
    .block-msg {
      font-size: .9rem; color: var(--text-muted, #9ca3af);
      line-height: 1.7; margin-bottom: 28px;
    }
    .block-user {
      display: flex; align-items: center; gap: 12px;
      background: var(--bg-secondary, #1e2130);
      border: 1px solid var(--border, #2a2d3a);
      border-radius: 12px; padding: 14px 16px;
      margin-bottom: 28px; text-align: left;
    }
    .bu-avatar {
      width: 40px; height: 40px; border-radius: 50%;
      background: var(--accent, #6366f1); color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: .85rem; flex-shrink: 0;
    }
    .bu-name  { font-weight: 600; font-size: .9rem; color: var(--text-primary, #f2f2f8); }
    .bu-email { font-size: .78rem; color: var(--text-muted, #9ca3af); margin-top: 2px; }
    .btn-back {
      width: 100%; padding: 11px; border-radius: 10px; cursor: pointer;
      background: rgba(99,102,241,.1); border: 1px solid rgba(99,102,241,.3);
      color: #818cf8; font-size: .875rem; font-weight: 600;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      transition: background .15s; font-family: inherit;
    }
    .btn-back:hover { background: rgba(99,102,241,.2); }
  `]
})
export class CompteBloqueComponent implements OnInit {
  private router = inject(Router);

  reason!: BloqueReason;
  cfg!: BloqueConfig;
  displayEmail = '';
  displayName  = '';

  get initials(): string {
    if (this.displayName) {
      const parts = this.displayName.trim().split(' ');
      return (parts[0]?.charAt(0) + (parts[1]?.charAt(0) ?? '')).toUpperCase();
    }
    return this.displayEmail?.charAt(0)?.toUpperCase() ?? '?';
  }

  ngOnInit(): void {
    const state       = history.state;
    this.reason       = state?.reason ?? 'GERANT_SANS_ENTREPRISE';
    this.displayEmail = state?.email  ?? '';
    this.displayName  = state?.name   ?? '';
    this.cfg = CONFIGS[this.reason] ?? CONFIGS['GERANT_SANS_ENTREPRISE'];
  }

  backToLogin(): void {
    this.router.navigate(['/auth/login']);
  }
}