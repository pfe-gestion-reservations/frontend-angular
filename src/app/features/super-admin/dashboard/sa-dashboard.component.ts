import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-sa-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
  <div class="dash">

    <!-- Header -->
    <div class="page-header">
      <div>
        <div class="page-title">
          <div class="title-icon"><i class="fas fa-chart-pie"></i></div>
          Tableau de bord
        </div>
        <div class="page-subtitle">Vue globale de la plateforme BookSpace</div>
      </div>
      <button class="btn btn-secondary btn-sm" (click)="load()">
        <i class="fas fa-sync-alt" [class.fa-spin]="loading"></i> Actualiser
      </button>
    </div>

    <!-- KPI Grid -->
    <div class="kpi-grid">
      <div class="kpi-card" routerLink="/super-admin/entreprises">
        <div class="kpi-icon indigo"><i class="fas fa-building"></i></div>
        <div class="kpi-body">
          <div class="kpi-value">{{ stats.entreprises }}</div>
          <div class="kpi-label">Entreprises</div>
        </div>
        <div class="kpi-trend up"><i class="fas fa-arrow-right"></i></div>
      </div>
      <div class="kpi-card" routerLink="/super-admin/gerants">
        <div class="kpi-icon violet"><i class="fas fa-user-tie"></i></div>
        <div class="kpi-body">
          <div class="kpi-value">{{ stats.gerants }}</div>
          <div class="kpi-label">Gérants</div>
        </div>
        <div class="kpi-trend up"><i class="fas fa-arrow-right"></i></div>
      </div>
      <div class="kpi-card" routerLink="/super-admin/employes">
        <div class="kpi-icon blue"><i class="fas fa-users-cog"></i></div>
        <div class="kpi-body">
          <div class="kpi-value">{{ stats.employes }}</div>
          <div class="kpi-label">Employés</div>
        </div>
        <div class="kpi-trend up"><i class="fas fa-arrow-right"></i></div>
      </div>
      <div class="kpi-card" routerLink="/super-admin/clients">
        <div class="kpi-icon teal"><i class="fas fa-user-friends"></i></div>
        <div class="kpi-body">
          <div class="kpi-value">{{ stats.clients }}</div>
          <div class="kpi-label">Clients</div>
        </div>
        <div class="kpi-trend up"><i class="fas fa-arrow-right"></i></div>
      </div>
      <div class="kpi-card" routerLink="/super-admin/services">
        <div class="kpi-icon amber"><i class="fas fa-concierge-bell"></i></div>
        <div class="kpi-body">
          <div class="kpi-value">{{ stats.services }}</div>
          <div class="kpi-label">Services</div>
        </div>
        <div class="kpi-trend up"><i class="fas fa-arrow-right"></i></div>
      </div>
      <div class="kpi-card" routerLink="/super-admin/secteurs">
        <div class="kpi-icon green"><i class="fas fa-layer-group"></i></div>
        <div class="kpi-body">
          <div class="kpi-value">{{ stats.secteurs }}</div>
          <div class="kpi-label">Secteurs</div>
        </div>
        <div class="kpi-trend up"><i class="fas fa-arrow-right"></i></div>
      </div>
    </div>

    <!-- Main grid -->
    <div class="main-grid">

      <!-- Entreprises list -->
      <div class="card">
        <div class="card-head">
          <div class="card-ttl"><i class="fas fa-building"></i> Entreprises récentes</div>
          <a routerLink="/super-admin/entreprises" class="see-all">Voir tout <i class="fas fa-arrow-right"></i></a>
        </div>
        <div class="ent-list">
          <div class="ent-row" *ngFor="let e of recentEntreprises">
            <div class="ent-logo">{{ e.nom[0] }}</div>
            <div class="ent-info">
              <div class="ent-name">{{ e.nom }}</div>
              <div class="ent-meta">{{ e.secteurNom }}</div>
            </div>
            <div class="ent-gerant">
              <div class="gerant-chip">
                <div class="gc-av">{{ e.gerantNom[0] }}{{ e.gerantPrenom[0] }}</div>
                <span>{{ e.gerantNom }}</span>
              </div>
            </div>
          </div>
          <div class="empty-state" *ngIf="recentEntreprises.length === 0">
            <i class="fas fa-building"></i>
            <h3>Aucune entreprise</h3>
          </div>
        </div>
      </div>

      <!-- Quick access -->
      <div class="quick-panel">
        <div class="card">
          <div class="card-head">
            <div class="card-ttl"><i class="fas fa-bolt"></i> Accès rapide</div>
          </div>
          <div class="quick-grid">
            <a routerLink="/super-admin/gerants" class="quick-item">
              <div class="qi-icon violet"><i class="fas fa-user-plus"></i></div>
              <span>Ajouter gérant</span>
            </a>
            <a routerLink="/super-admin/entreprises" class="quick-item">
              <div class="qi-icon indigo"><i class="fas fa-plus-circle"></i></div>
              <span>Nouvelle entreprise</span>
            </a>
            <a routerLink="/super-admin/services" class="quick-item">
              <div class="qi-icon amber"><i class="fas fa-concierge-bell"></i></div>
              <span>Gérer services</span>
            </a>
            <a routerLink="/super-admin/secteurs" class="quick-item">
              <div class="qi-icon green"><i class="fas fa-layer-group"></i></div>
              <span>Secteurs</span>
            </a>
            <a routerLink="/super-admin/clients" class="quick-item">
              <div class="qi-icon teal"><i class="fas fa-users"></i></div>
              <span>Clients</span>
            </a>
            <a routerLink="/super-admin/reservations" class="quick-item">
              <div class="qi-icon blue"><i class="fas fa-calendar-alt"></i></div>
              <span>Réservations</span>
            </a>
          </div>
        </div>

        <!-- Platform health -->
        <div class="card health-card">
          <div class="card-head">
            <div class="card-ttl"><i class="fas fa-heartbeat"></i> Plateforme</div>
            <span class="health-badge"><i class="fas fa-circle"></i> Opérationnelle</span>
          </div>
          <div class="health-rows">
            <div class="health-row">
              <span class="hr-label">Entreprises actives</span>
              <div class="hr-bar-wrap">
                <div class="hr-bar" [style.width]="stats.entreprises > 0 ? '100%' : '0%'"></div>
              </div>
              <span class="hr-val">{{ stats.entreprises }}</span>
            </div>
            <div class="health-row">
              <span class="hr-label">Services déployés</span>
              <div class="hr-bar-wrap">
                <div class="hr-bar blue" [style.width]="stats.services > 0 ? '80%' : '0%'"></div>
              </div>
              <span class="hr-val">{{ stats.services }}</span>
            </div>
            <div class="health-row">
              <span class="hr-label">Taux d'occupation</span>
              <div class="hr-bar-wrap">
                <div class="hr-bar amber" style="width:65%"></div>
              </div>
              <span class="hr-val">65%</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>`,
  styles: [`
    .dash { display: flex; flex-direction: column; gap: 24px; }

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
      display: flex; align-items: center; gap: 12px;
      cursor: pointer;
      transition: all .2s;
      text-decoration: none;
    }
    .kpi-card:hover {
      border-color: var(--border-md);
      box-shadow: var(--shadow-md);
      transform: translateY(-2px);
    }
    .kpi-icon {
      width: 40px; height: 40px;
      border-radius: var(--radius-lg);
      display: flex; align-items: center; justify-content: center;
      font-size: .9rem; flex-shrink: 0;
    }
    .kpi-icon.indigo { background: rgba(99,102,241,.15); color: #818cf8; }
    .kpi-icon.violet { background: rgba(168,85,247,.15);  color: #c084fc; }
    .kpi-icon.blue   { background: rgba(59,130,246,.15);  color: #60a5fa; }
    .kpi-icon.teal   { background: rgba(20,184,166,.15);  color: #2dd4bf; }
    .kpi-icon.amber  { background: rgba(245,158,11,.15);  color: #fbbf24; }
    .kpi-icon.green  { background: rgba(34,197,94,.15);   color: #4ade80; }

    .kpi-body { flex: 1; }
    .kpi-value { font-size: 1.5rem; font-weight: 800; color: var(--text-primary); line-height: 1; letter-spacing: -0.03em; }
    .kpi-label { font-size: .68rem; font-weight: 600; color: var(--text-faint); text-transform: uppercase; letter-spacing: .06em; margin-top: 3px; }
    .kpi-trend { color: var(--text-faint); font-size: .7rem; }

    /* Main grid */
    .main-grid {
      display: grid;
      grid-template-columns: 1fr 380px;
      gap: 16px;
    }
    @media (max-width: 1100px) { .main-grid { grid-template-columns: 1fr; } }

    .card-head {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 16px; padding-bottom: 12px;
      border-bottom: 1px solid var(--border);
    }
    .card-ttl {
      display: flex; align-items: center; gap: 7px;
      font-size: .82rem; font-weight: 700; color: var(--text-primary);
    }
    .card-ttl i { color: var(--primary); font-size: .78rem; }
    .see-all {
      font-size: .72rem; font-weight: 600; color: var(--primary);
      display: flex; align-items: center; gap: 4px;
      transition: gap .15s;
    }
    .see-all:hover { gap: 7px; }

    /* Entreprises list */
    .ent-list { display: flex; flex-direction: column; gap: 2px; }
    .ent-row {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 12px;
      border-radius: var(--radius-lg);
      transition: background .15s;
      cursor: default;
    }
    .ent-row:hover { background: var(--bg-hover); }
    .ent-logo {
      width: 36px; height: 36px;
      background: var(--primary-light);
      border: 1px solid var(--primary-border);
      border-radius: var(--radius-md);
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: .85rem;
      color: var(--primary); flex-shrink: 0;
    }
    .ent-info { flex: 1; }
    .ent-name { font-size: .825rem; font-weight: 600; color: var(--text-primary); }
    .ent-meta { font-size: .7rem; color: var(--text-faint); margin-top: 1px; }
    .gerant-chip {
      display: flex; align-items: center; gap: 6px;
      font-size: .72rem; color: var(--text-muted);
    }
    .gc-av {
      width: 22px; height: 22px;
      background: var(--bg-hover);
      border: 1px solid var(--border-md);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: .58rem; font-weight: 700; color: var(--text-secondary);
    }

    /* Quick panel */
    .quick-panel { display: flex; flex-direction: column; gap: 16px; }
    .quick-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .quick-item {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      padding: 14px 10px;
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: var(--radius-xl);
      cursor: pointer; text-decoration: none;
      transition: all .2s;
      text-align: center;
    }
    .quick-item:hover {
      border-color: var(--primary-border);
      background: var(--primary-light);
      transform: translateY(-2px);
    }
    .quick-item span { font-size: .72rem; font-weight: 600; color: var(--text-secondary); line-height: 1.3; }
    .quick-item:hover span { color: var(--primary); }
    .qi-icon {
      width: 36px; height: 36px;
      border-radius: var(--radius-md);
      display: flex; align-items: center; justify-content: center;
      font-size: .85rem;
    }
    .qi-icon.indigo { background: rgba(99,102,241,.15);  color: #818cf8; }
    .qi-icon.violet { background: rgba(168,85,247,.15);  color: #c084fc; }
    .qi-icon.amber  { background: rgba(245,158,11,.15);  color: #fbbf24; }
    .qi-icon.green  { background: rgba(34,197,94,.15);   color: #4ade80; }
    .qi-icon.teal   { background: rgba(20,184,166,.15);  color: #2dd4bf; }
    .qi-icon.blue   { background: rgba(59,130,246,.15);  color: #60a5fa; }

    /* Health */
    .health-badge {
      display: flex; align-items: center; gap: 5px;
      font-size: .68rem; font-weight: 600;
      color: var(--success);
      background: var(--success-bg);
      border: 1px solid var(--success-border);
      border-radius: var(--radius-full);
      padding: 3px 9px;
    }
    .health-badge i { font-size: .45rem; animation: pulse 2s infinite; }
    .health-rows { display: flex; flex-direction: column; gap: 12px; }
    .health-row { display: flex; align-items: center; gap: 10px; }
    .hr-label { font-size: .72rem; color: var(--text-muted); width: 130px; flex-shrink: 0; }
    .hr-bar-wrap {
      flex: 1; height: 5px;
      background: var(--bg-hover);
      border-radius: 99px; overflow: hidden;
    }
    .hr-bar {
      height: 100%;
      background: var(--primary);
      border-radius: 99px;
      transition: width .6s ease;
    }
    .hr-bar.blue  { background: var(--info); }
    .hr-bar.amber { background: var(--warning); }
    .hr-val { font-size: .72rem; font-weight: 700; color: var(--text-secondary); width: 28px; text-align: right; }
  `]
})
export class SaDashboardComponent implements OnInit {
  private api = inject(ApiService);
  loading = false;

  stats = { secteurs: 0, entreprises: 0, gerants: 0, employes: 0, clients: 0, services: 0 };
  recentEntreprises: any[] = [];

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    forkJoin({
      s: this.api.getSecteurs(),
      e: this.api.getEntreprises(),
      g: this.api.getGerants(),
      emp: this.api.getEmployes(),
      c: this.api.getClients(),
      svc: this.api.getServices()
    }).subscribe({
      next: r => {
        this.stats = {
          secteurs:    r.s.length,
          entreprises: r.e.length,
          gerants:     r.g.length,
          employes:    r.emp.filter((e: any) => !e.archived).length,
          clients:     r.c.filter((c: any) => !c.archived).length,
          services:    r.svc.filter((s: any) => !s.archived).length
        };
        this.recentEntreprises = r.e.slice(-5).reverse();
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }
}