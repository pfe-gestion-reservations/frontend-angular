import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ReservationResponse, AvisResponse } from '../../../core/models/api.models';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-gerant-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
  <div class="dash">

    <!-- Header -->
    <div class="page-header">
      <div>
        <div class="page-title">
          <div class="title-icon"><i class="fas fa-chart-bar"></i></div>
          Tableau de bord
        </div>
        <div class="page-subtitle">Bienvenue, <strong>{{ firstName }}</strong> — Vue d'ensemble de votre activité</div>
      </div>
      <button class="btn btn-secondary btn-sm" (click)="load()">
        <i class="fas fa-sync-alt" [class.fa-spin]="loading"></i> Actualiser
      </button>
    </div>

    <!-- KPI Row -->
    <div class="kpi-grid">
      <div class="kpi-card" routerLink="/gerant/employes">
        <div class="kpi-icon violet"><i class="fas fa-users"></i></div>
        <div class="kpi-body">
          <div class="kpi-value">{{ stats.employes }}</div>
          <div class="kpi-label">Employés actifs</div>
        </div>
      </div>
      <div class="kpi-card" routerLink="/gerant/clients">
        <div class="kpi-icon teal"><i class="fas fa-user-friends"></i></div>
        <div class="kpi-body">
          <div class="kpi-value">{{ stats.clients }}</div>
          <div class="kpi-label">Clients</div>
        </div>
      </div>
      <div class="kpi-card" routerLink="/gerant/services">
        <div class="kpi-icon amber"><i class="fas fa-concierge-bell"></i></div>
        <div class="kpi-body">
          <div class="kpi-value">{{ stats.services }}</div>
          <div class="kpi-label">Services actifs</div>
        </div>
      </div>
      <div class="kpi-card" routerLink="/gerant/reservations">
        <div class="kpi-icon indigo"><i class="fas fa-calendar-check"></i></div>
        <div class="kpi-body">
          <div class="kpi-value">{{ stats.reservations }}</div>
          <div class="kpi-label">Réservations</div>
        </div>
      </div>
      <div class="kpi-card" routerLink="/gerant/file-attente">
        <div class="kpi-icon blue"><i class="fas fa-list-ol"></i></div>
        <div class="kpi-body">
          <div class="kpi-value">{{ stats.file }}</div>
          <div class="kpi-label">File d'attente</div>
        </div>
      </div>
      <div class="kpi-card" routerLink="/gerant/avis">
        <div class="kpi-icon star"><i class="fas fa-star"></i></div>
        <div class="kpi-body">
          <div class="kpi-value">{{ avgNote ? avgNote : '—' }}</div>
          <div class="kpi-label">Note / 5</div>
        </div>
      </div>
    </div>

    <!-- Main content -->
    <div class="main-grid">

      <!-- Réservations récentes -->
      <div class="card">
        <div class="card-head">
          <div class="card-ttl"><i class="fas fa-calendar-alt"></i> Réservations récentes</div>
          <a routerLink="/gerant/reservations" class="see-all">Voir tout <i class="fas fa-arrow-right"></i></a>
        </div>
        <div class="res-list">
          <div class="res-row" *ngFor="let r of recentReservations">
            <div class="res-avatar" [style.background]="avatarColor(r.clientId)">
              {{ r.clientNom?.charAt(0) }}{{ r.clientPrenom?.charAt(0) }}
            </div>
            <div class="res-info">
              <div class="res-name">{{ r.clientNom }} {{ r.clientPrenom }}</div>
              <div class="res-svc">{{ r.serviceNom }}</div>
            </div>
            <div class="res-time">
              <div class="rt-date">{{ r.heureDebut | date:'dd/MM/yy' }}</div>
              <div class="rt-hour">{{ r.heureDebut | date:'HH:mm' }}</div>
            </div>
            <span class="res-badge" [ngClass]="statutClass(r.statut)">{{ statutLabel(r.statut) }}</span>
          </div>
          <div class="empty-state" *ngIf="recentReservations.length === 0">
            <i class="fas fa-calendar"></i>
            <h3>Aucune réservation</h3>
          </div>
        </div>
      </div>

      <!-- Side panel -->
      <div class="side-panel">

        <!-- Note moyenne -->
        <div class="card note-card" *ngIf="avgNote">
          <div class="card-head">
            <div class="card-ttl"><i class="fas fa-star"></i> Note moyenne</div>
          </div>
          <div class="note-display">
            <div class="note-big">{{ avgNote }}</div>
            <div class="note-details">
              <div class="note-stars">
                <i class="fas fa-star" *ngFor="let s of [1,2,3,4,5]" [class.lit]="s <= avgNote"></i>
              </div>
              <div class="note-count">{{ stats.avis }} avis</div>
            </div>
          </div>
        </div>

        <!-- Derniers avis -->
        <div class="card">
          <div class="card-head">
            <div class="card-ttl"><i class="fas fa-comment-dots"></i> Derniers avis</div>
            <a routerLink="/gerant/avis" class="see-all">Tout <i class="fas fa-arrow-right"></i></a>
          </div>
          <div class="avis-list">
            <div class="avis-item" *ngFor="let a of recentAvis">
              <div class="avis-av">{{ a.clientPrenom?.charAt(0) }}{{ a.clientNom?.charAt(0) }}</div>
              <div class="avis-body">
                <div class="avis-top">
                  <span class="avis-name">{{ a.clientPrenom }} {{ a.clientNom }}</span>
                  <span class="avis-date">{{ a.dateAvis | date:'dd/MM' }}</span>
                </div>
                <div class="avis-stars">
                  <i class="fas fa-star" *ngFor="let s of [1,2,3,4,5]" [class.lit]="s <= a.note"></i>
                </div>
                <div class="avis-comment" *ngIf="a.commentaire">"{{ a.commentaire }}"</div>
              </div>
            </div>
            <div class="empty-mini" *ngIf="recentAvis.length === 0">
              <i class="fas fa-star-half-alt"></i> Aucun avis pour le moment
            </div>
          </div>
        </div>

        <!-- Quick actions -->
        <div class="card">
          <div class="card-head">
            <div class="card-ttl"><i class="fas fa-bolt"></i> Actions rapides</div>
          </div>
          <div class="quick-actions">
            <a routerLink="/gerant/employes" class="qa-btn">
              <i class="fas fa-user-plus"></i> Ajouter employé
            </a>
            <a routerLink="/gerant/clients" class="qa-btn">
              <i class="fas fa-user-check"></i> Nouveau client
            </a>
            <a routerLink="/gerant/disponibilites" class="qa-btn">
              <i class="fas fa-clock"></i> Disponibilités
            </a>
            <a routerLink="/gerant/file-attente" class="qa-btn">
              <i class="fas fa-list-ol"></i> File d'attente
            </a>
          </div>
        </div>

      </div>
    </div>
  </div>`,
  styles: [`
    .dash { display: flex; flex-direction: column; gap: 20px; }

    /* KPI */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 12px;
    }
    @media (max-width: 1200px) { .kpi-grid { grid-template-columns: repeat(3, 1fr); } }
    @media (max-width: 768px)  { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }

    .kpi-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-xl);
      padding: 16px;
      display: flex; align-items: center; gap: 11px;
      cursor: pointer; text-decoration: none;
      transition: all .2s;
    }
    .kpi-card:hover {
      border-color: var(--border-md);
      box-shadow: var(--shadow-md);
      transform: translateY(-2px);
    }
    .kpi-icon {
      width: 38px; height: 38px;
      border-radius: var(--radius-md);
      display: flex; align-items: center; justify-content: center;
      font-size: .85rem; flex-shrink: 0;
    }
    .kpi-icon.indigo { background: rgba(99,102,241,.15); color: #818cf8; }
    .kpi-icon.violet { background: rgba(168,85,247,.15);  color: #c084fc; }
    .kpi-icon.teal   { background: rgba(20,184,166,.15);  color: #2dd4bf; }
    .kpi-icon.amber  { background: rgba(245,158,11,.15);  color: #fbbf24; }
    .kpi-icon.blue   { background: rgba(59,130,246,.15);  color: #60a5fa; }
    .kpi-icon.star   { background: rgba(245,158,11,.15);  color: #fbbf24; }

    .kpi-body { flex: 1; min-width: 0; }
    .kpi-value { font-size: 1.45rem; font-weight: 800; color: var(--text-primary); line-height: 1; letter-spacing: -0.03em; }
    .kpi-label { font-size: .65rem; font-weight: 600; color: var(--text-faint); text-transform: uppercase; letter-spacing: .06em; margin-top: 3px; }

    /* Main grid */
    .main-grid {
      display: grid;
      grid-template-columns: 1fr 320px;
      gap: 16px;
      align-items: start;
    }
    @media (max-width: 1100px) { .main-grid { grid-template-columns: 1fr; } }

    .card-head {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 14px; padding-bottom: 12px;
      border-bottom: 1px solid var(--border);
    }
    .card-ttl {
      display: flex; align-items: center; gap: 7px;
      font-size: .8rem; font-weight: 700; color: var(--text-primary);
    }
    .card-ttl i { color: var(--primary); font-size: .75rem; }
    .see-all {
      font-size: .7rem; font-weight: 600; color: var(--primary);
      display: flex; align-items: center; gap: 4px;
      transition: gap .15s;
    }
    .see-all:hover { gap: 7px; }

    /* Reservations */
    .res-list { display: flex; flex-direction: column; gap: 2px; }
    .res-row {
      display: flex; align-items: center; gap: 11px;
      padding: 10px 8px;
      border-radius: var(--radius-lg);
      transition: background .15s;
    }
    .res-row:hover { background: var(--bg-hover); }
    .res-avatar {
      width: 34px; height: 34px;
      border-radius: var(--radius-md);
      display: flex; align-items: center; justify-content: center;
      font-size: .68rem; font-weight: 700; color: #fff;
      flex-shrink: 0;
    }
    .res-info { flex: 1; min-width: 0; }
    .res-name { font-size: .8rem; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .res-svc  { font-size: .7rem; color: var(--text-faint); margin-top: 1px; }
    .res-time { text-align: right; flex-shrink: 0; }
    .rt-date  { font-size: .72rem; color: var(--text-secondary); font-weight: 500; }
    .rt-hour  { font-size: .68rem; color: var(--text-faint); font-family: var(--font-mono); }
    .res-badge {
      font-size: .62rem; font-weight: 700;
      padding: 2px 7px; border-radius: var(--radius-full);
      white-space: nowrap; flex-shrink: 0;
      border: 1px solid transparent;
      text-transform: uppercase; letter-spacing: .04em;
    }
    .b-success { background: var(--success-bg); color: var(--success); border-color: var(--success-border); }
    .b-info    { background: var(--info-bg);    color: var(--info);    border-color: var(--info-border); }
    .b-warning { background: var(--warning-bg); color: var(--warning); border-color: var(--warning-border); }
    .b-danger  { background: var(--danger-bg);  color: var(--danger);  border-color: var(--danger-border); }

    /* Side panel */
    .side-panel { display: flex; flex-direction: column; gap: 14px; }

    /* Note */
    .note-display { display: flex; align-items: center; gap: 16px; padding: 8px 0; }
    .note-big { font-size: 2.8rem; font-weight: 800; color: var(--text-primary); letter-spacing: -0.04em; line-height: 1; }
    .note-stars { display: flex; gap: 3px; margin-bottom: 4px; }
    .note-stars i { font-size: .8rem; color: var(--text-faint); }
    .note-stars i.lit { color: #f59e0b; }
    .note-count { font-size: .7rem; color: var(--text-faint); }

    /* Avis */
    .avis-list { display: flex; flex-direction: column; gap: 10px; }
    .avis-item { display: flex; align-items: flex-start; gap: 9px; }
    .avis-av {
      width: 28px; height: 28px;
      border-radius: 8px;
      background: var(--primary-light);
      border: 1px solid var(--primary-border);
      display: flex; align-items: center; justify-content: center;
      font-size: .62rem; font-weight: 700; color: var(--primary);
      flex-shrink: 0;
    }
    .avis-body { flex: 1; min-width: 0; }
    .avis-top { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 3px; }
    .avis-name { font-size: .75rem; font-weight: 600; color: var(--text-primary); }
    .avis-date { font-size: .65rem; color: var(--text-faint); }
    .avis-stars { display: flex; gap: 2px; margin-bottom: 3px; }
    .avis-stars i { font-size: .62rem; color: var(--text-faint); }
    .avis-stars i.lit { color: #f59e0b; }
    .avis-comment { font-size: .72rem; color: var(--text-muted); font-style: italic; line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .empty-mini { font-size: .75rem; color: var(--text-faint); text-align: center; padding: 12px 0; display: flex; align-items: center; gap: 6px; justify-content: center; }

    /* Quick actions */
    .quick-actions { display: flex; flex-direction: column; gap: 6px; }
    .qa-btn {
      display: flex; align-items: center; gap: 9px;
      padding: 9px 12px;
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      font-size: .78rem; font-weight: 600;
      color: var(--text-secondary);
      text-decoration: none;
      transition: all .15s;
    }
    .qa-btn i { color: var(--primary); font-size: .78rem; width: 14px; text-align: center; }
    .qa-btn:hover {
      background: var(--primary-light);
      border-color: var(--primary-border);
      color: var(--primary);
    }
  `]
})
export class GerantDashboardComponent implements OnInit {
  private api  = inject(ApiService);
  private auth = inject(AuthService);
  loading = false;

  stats = { employes: 0, clients: 0, services: 0, reservations: 0, file: 0, avis: 0 };
  recentReservations: ReservationResponse[] = [];
  recentAvis: AvisResponse[] = [];
  avgNote = 0;

  get firstName(): string {
    const u = this.auth.currentUser();
    return u?.prenom ?? '';
  }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    forkJoin({
      e: this.api.getEmployes(),
      c: this.api.getClients(),
      s: this.api.getServices(),
      r: this.api.getReservations(),
      f: this.api.getFileAttente(),
      a: this.api.getAvis()
    }).subscribe({
      next: d => {
        this.stats = {
          employes:     d.e.filter((e: any) => !e.archived).length,
          clients:      d.c.filter((c: any) => !c.archived).length,
          services:     d.s.filter((s: any) => !s.archived).length,
          reservations: d.r.length,
          file:         d.f.filter((f: any) => ['EN_ATTENTE','APPELE','EN_COURS'].includes(f.statut)).length,
          avis:         d.a.length
        };
        this.recentReservations = [...d.r]
          .sort((a, b) => new Date(b.heureDebut).getTime() - new Date(a.heureDebut).getTime())
          .slice(0, 6);
        this.recentAvis = [...d.a]
          .sort((a, b) => new Date(b.dateAvis).getTime() - new Date(a.dateAvis).getTime())
          .slice(0, 4);
        this.avgNote = d.a.length
          ? +(d.a.reduce((s: number, a: any) => s + a.note, 0) / d.a.length).toFixed(1)
          : 0;
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  avatarColor(id: number): string {
    const colors = ['#6366f1','#8b5cf6','#ec4899','#14b8a6','#f59e0b','#3b82f6','#10b981'];
    return colors[(id || 0) % colors.length];
  }

  statutLabel(s: string): string {
    const l: Record<string,string> = {
      EN_ATTENTE: 'En attente', CONFIRMEE: 'Confirmée',
      EN_COURS: 'En cours',    ANNULEE: 'Annulée',    TERMINEE: 'Terminée'
    };
    return l[s] ?? s;
  }

  statutClass(s: string): string {
    const m: Record<string,string> = {
      TERMINEE: 'b-success', CONFIRMEE: 'b-info',
      EN_ATTENTE: 'b-warning', EN_COURS: 'b-warning', ANNULEE: 'b-danger'
    };
    return m[s] ?? '';
  }
}