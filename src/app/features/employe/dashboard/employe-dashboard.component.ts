import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ReservationResponse, AvisResponse } from '../../../core/models/api.models';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-employe-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
  <div>
    <div class="page-header">
      <div>
        <div class="page-title">
          <div class="title-icon"><i class="fas fa-chart-bar"></i></div>
          Tableau de bord
        </div>
        <div class="page-subtitle">Bonjour, <strong>{{ userName }}</strong> — Vue d'ensemble de votre entreprise</div>
      </div>
      <button class="btn btn-secondary" (click)="load()">
        <i class="fas fa-sync"></i> Actualiser
      </button>
    </div>

    <!-- ══ STATS ══ -->
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-icon amber"><i class="fas fa-users"></i></div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.employes }}</div>
          <div class="stat-label">Employés actifs</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon blue"><i class="fas fa-user-friends"></i></div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.clients }}</div>
          <div class="stat-label">Clients</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon purple"><i class="fas fa-concierge-bell"></i></div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.services }}</div>
          <div class="stat-label">Services</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green"><i class="fas fa-calendar-check"></i></div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.reservations }}</div>
          <div class="stat-label">Réservations</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon cyan"><i class="fas fa-list-ol"></i></div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.file }}</div>
          <div class="stat-label">File d'attente</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon star"><i class="fas fa-star"></i></div>
        <div class="stat-info">
          <div class="stat-value">{{ avgNote ? avgNote + '/5' : '—' }}</div>
          <div class="stat-label">Note moyenne</div>
        </div>
      </div>
    </div>

    <!-- ══ 2 COLONNES ══ -->
    <div class="dash-grid">

      <!-- Réservations récentes -->
      <div class="card">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-calendar-alt"></i> Réservations récentes</div>
          <span class="card-count">{{ stats.reservations }}</span>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr><th>Client</th><th>Service</th><th>Date</th><th>Statut</th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let r of recentReservations">
                <td>
                  <div class="mini-person">
                    <div class="mini-avatar" [style.background]="'hsl('+ ((r.clientId??0)*47%360) +',55%,52%)'">
                      {{ r.clientNom?.charAt(0) }}{{ r.clientPrenom?.charAt(0) }}
                    </div>
                    {{ r.clientNom }} {{ r.clientPrenom }}
                  </div>
                </td>
                <td><span class="svc-tag">{{ r.serviceNom }}</span></td>
                <td class="date-cell">
                  <div>{{ r.heureDebut | date:'dd/MM/yyyy' }}</div>
                  <div class="time">{{ r.heureDebut | date:'HH:mm' }}</div>
                </td>
                <td>
                  <span class="badge" [ngClass]="statutClass(r.statut)">{{ statutLabel(r.statut) }}</span>
                </td>
              </tr>
              <tr *ngIf="recentReservations.length === 0">
                <td colspan="4">
                  <div class="empty-state">
                    <i class="fas fa-calendar"></i>
                    <h3>Aucune réservation</h3>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Derniers avis -->
      <div class="card">
        <div class="card-header">
          <div class="card-title"><i class="fas fa-star"></i> Derniers avis</div>
          <div class="avg-note" *ngIf="avgNote">
            <i class="fas fa-star" style="color:#f59e0b;font-size:.8rem"></i>
            <strong>{{ avgNote }}</strong>/5
          </div>
        </div>
        <div class="avis-list">
          <div class="avis-item" *ngFor="let a of recentAvis">
            <div class="avis-avatar">{{ a.clientPrenom?.charAt(0) }}{{ a.clientNom?.charAt(0) }}</div>
            <div class="avis-body">
              <div class="avis-top">
                <span class="avis-name">{{ a.clientPrenom }} {{ a.clientNom }}</span>
                <span class="avis-service">{{ a.serviceNom }}</span>
              </div>
              <div class="avis-stars">
                <i class="fas fa-star" *ngFor="let s of [1,2,3,4,5]" [class.lit]="s <= a.note"></i>
              </div>
              <div class="avis-comment" *ngIf="a.commentaire">"{{ a.commentaire }}"</div>
            </div>
            <div class="avis-date">{{ a.dateAvis | date:'dd/MM' }}</div>
          </div>
          <div class="empty-state" *ngIf="recentAvis.length === 0">
            <i class="fas fa-star-half-alt"></i>
            <h3>Aucun avis</h3>
          </div>
        </div>
      </div>

    </div>
  </div>`,
  styles: [`
    .dash-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
    @media (max-width:900px) { .dash-grid { grid-template-columns:1fr; } }

    .stat-grid { display:grid; grid-template-columns:repeat(6,1fr); gap:12px; margin-bottom:20px; }
    .stat-info { flex:1; }
    .stat-value { font-size:1.6rem; font-weight:800; color:var(--text-primary); line-height:1; }
    .stat-label { font-size:.7rem; color:var(--text-secondary); text-transform:uppercase; letter-spacing:.04em; margin-top:3px; }
    .stat-icon.purple { background:rgba(139,92,246,.12); color:#a78bfa; }
    .stat-icon.cyan   { background:rgba(6,182,212,.12);  color:#22d3ee; }
    .stat-icon.star   { background:rgba(245,158,11,.12); color:#fbbf24; }

    .card-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid var(--border); }
    .card-title { display:flex; align-items:center; gap:8px; font-weight:700; font-size:.9rem; color:var(--text-primary); }
    .card-title i { color:var(--primary); font-size:.85rem; }
    .card-count { font-size:.75rem; font-weight:600; color:var(--text-muted); background:var(--bg-secondary); border:1px solid var(--border); border-radius:20px; padding:2px 8px; }
    .avg-note { display:flex; align-items:center; gap:4px; font-size:.82rem; color:var(--text-secondary); }
    .avg-note strong { color:var(--text-primary); }

    .mini-person { display:flex; align-items:center; gap:8px; font-size:.875rem; font-weight:600; }
    .mini-avatar { width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:.65rem; font-weight:700; color:white; flex-shrink:0; }
    .svc-tag { font-size:.75rem; background:var(--blue-50,#eff6ff); color:var(--primary); padding:2px 8px; border-radius:20px; font-weight:600; }
    .date-cell { font-size:.82rem; color:var(--text-primary); }
    .time { font-size:.72rem; color:var(--text-muted); margin-top:1px; }

    .badge { display:inline-flex; align-items:center; padding:2px 8px; border-radius:20px; font-size:.7rem; font-weight:700; text-transform:uppercase; }
    .badge-success { background:rgba(16,185,129,.12); color:#10b981; }
    .badge-warning { background:rgba(245,158,11,.12); color:#f59e0b; }
    .badge-info    { background:rgba(59,130,246,.12);  color:#3b82f6; }
    .badge-danger  { background:rgba(239,68,68,.12);   color:#ef4444; }
    .badge-muted   { background:var(--bg-secondary);   color:var(--text-muted); border:1px solid var(--border); }

    .avis-list { display:flex; flex-direction:column; gap:10px; }
    .avis-item { display:flex; align-items:flex-start; gap:10px; padding:10px; background:var(--bg-secondary); border-radius:var(--radius-md); border:1px solid var(--border); }
    .avis-avatar { width:34px; height:34px; border-radius:50%; background:var(--primary); color:#fff; display:flex; align-items:center; justify-content:center; font-size:.72rem; font-weight:700; flex-shrink:0; }
    .avis-body { flex:1; min-width:0; }
    .avis-top { display:flex; align-items:center; gap:8px; margin-bottom:4px; flex-wrap:wrap; }
    .avis-name { font-weight:600; font-size:.85rem; color:var(--text-primary); }
    .avis-service { font-size:.72rem; background:rgba(245,158,11,.1); color:#d97706; padding:1px 7px; border-radius:20px; }
    .avis-stars { display:flex; gap:2px; margin-bottom:3px; }
    .avis-stars i { font-size:.7rem; color:#d1d5db; }
    .avis-stars i.lit { color:#f59e0b; }
    .avis-comment { font-size:.78rem; color:var(--text-secondary); font-style:italic; }
    .avis-date { font-size:.7rem; color:var(--text-muted); white-space:nowrap; margin-top:2px; flex-shrink:0; }

    .empty-state { text-align:center; padding:32px; }
    .empty-state i { font-size:1.8rem; color:var(--text-muted); opacity:.3; display:block; margin-bottom:8px; }
    .empty-state h3 { color:var(--text-secondary); font-size:.9rem; margin:0; }
  `]
})
export class EmployeDashboardComponent implements OnInit {
  private api  = inject(ApiService);
  private auth = inject(AuthService);

  stats = { employes: 0, clients: 0, services: 0, reservations: 0, file: 0 };
  recentReservations: ReservationResponse[] = [];
  recentAvis: AvisResponse[] = [];
  avgNote = 0;

  get userName(): string {
    const u = this.auth.currentUser();
    return u ? `${u.prenom ?? ''} ${u.nom ?? ''}`.trim() : '';
  }

  ngOnInit(): void { this.load(); }

  load(): void {
  forkJoin({
    e: this.api.getEmployes().pipe(catchError(() => of([]))),
    c: this.api.getClients().pipe(catchError(() => of([]))),
    s: this.api.getServices().pipe(catchError(() => of([]))),
    r: this.api.getReservations().pipe(catchError(() => of([]))),
    f: this.api.getFileAttente().pipe(catchError(() => of([]))),
    a: this.api.getAvis().pipe(catchError(() => of([])))
  }).subscribe(d => {
    this.stats = {
      employes:     d.e.filter((e: any) => !e.archived).length,
      clients:      d.c.filter((c: any) => !c.archived).length,
      services:     d.s.length,
      reservations: d.r.length,
      file:         d.f.filter((f: any) => ['EN_ATTENTE','APPELE','EN_COURS'].includes(f.statut)).length
    };
    this.recentReservations = [...d.r].sort((a: any, b: any) =>
      new Date(b.heureDebut).getTime() - new Date(a.heureDebut).getTime()
    ).slice(0, 5);
    this.recentAvis = [...d.a].sort((a: any, b: any) =>
      new Date(b.dateAvis).getTime() - new Date(a.dateAvis).getTime()
    ).slice(0, 5);
    this.avgNote = d.a.length
      ? +( d.a.reduce((s: number, a: any) => s + a.note, 0) / d.a.length ).toFixed(1)
      : 0;
  });
}

  statutLabel(s: string): string {
    const l: Record<string,string> = {
      EN_ATTENTE:'En attente', CONFIRMEE:'Confirmée',
      EN_COURS:'En cours', ANNULEE:'Annulée', TERMINEE:'Terminée'
    };
    return l[s] ?? s;
  }

  statutClass(s: string): Record<string,boolean> {
    return {
      'badge-success': s === 'TERMINEE',
      'badge-info':    s === 'CONFIRMEE',
      'badge-warning': s === 'EN_ATTENTE' || s === 'EN_COURS',
      'badge-danger':  s === 'ANNULEE',
      'badge-muted':   false
    };
  }
}