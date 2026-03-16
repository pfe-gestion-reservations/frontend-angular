import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { ServiceResponse, ConfigServiceResponse, EntrepriseResponse } from '../../../core/models/api.models';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-client-services',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
<div style="max-width:900px;margin:0 auto;padding-bottom:40px">

  <!-- HEADER -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:28px">
    <div style="display:flex;align-items:center;gap:14px">
      <div style="width:46px;height:46px;border-radius:14px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.1rem;box-shadow:0 4px 16px rgba(99,102,241,.3)">
        <i class="fas fa-concierge-bell"></i>
      </div>
      <div>
        <div style="font-size:1.3rem;font-weight:800;color:#111">Services disponibles</div>
        <div style="font-size:.8rem;color:#888;margin-top:2px">{{ services.length }} service(s) · Prenez rendez-vous en ligne</div>
      </div>
    </div>
    <a routerLink="/client/creneaux"
      style="display:inline-flex;align-items:center;gap:7px;padding:10px 20px;border-radius:10px;background:linear-gradient(135deg,#10b981,#3b82f6);color:#fff;font-size:.875rem;font-weight:700;text-decoration:none;box-shadow:0 4px 14px rgba(16,185,129,.3)">
      <i class="fas fa-calendar-plus"></i> Prendre RDV
    </a>
  </div>

  <!-- FILTRE ENTREPRISE -->
  <div *ngIf="entreprises.length > 1" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px">
    <button (click)="filtreId=null;filter()"
      style="padding:6px 14px;border-radius:20px;border:1.5px solid;font-size:.8rem;font-weight:600;cursor:pointer"
      [style.background]="filtreId===null?'#6366f1':'#fff'"
      [style.color]="filtreId===null?'#fff':'#555'"
      [style.borderColor]="filtreId===null?'#6366f1':'#e5e7eb'">
      Tous
    </button>
    <button *ngFor="let e of entreprises" (click)="filtreId=e.id;filter()"
      style="padding:6px 14px;border-radius:20px;border:1.5px solid;font-size:.8rem;font-weight:600;cursor:pointer"
      [style.background]="filtreId===e.id?'#6366f1':'#fff'"
      [style.color]="filtreId===e.id?'#fff':'#555'"
      [style.borderColor]="filtreId===e.id?'#6366f1':'#e5e7eb'">
      {{ e.nom }}
    </button>
  </div>

  <!-- LOADING -->
  <div *ngIf="loading" style="text-align:center;padding:60px;color:#888">
    <i class="fas fa-spinner fa-spin" style="margin-right:8px"></i> Chargement...
  </div>

  <!-- GRILLE SERVICES -->
  <div *ngIf="!loading" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px">
    <div *ngFor="let s of filtered"
      style="background:#fff;border:1.5px solid #e5e7eb;border-radius:16px;overflow:hidden;transition:box-shadow .2s,transform .15s"
      onmouseenter="this.style.boxShadow='0 8px 24px rgba(0,0,0,.08)';this.style.transform='translateY(-2px)'"
      onmouseleave="this.style.boxShadow='none';this.style.transform='none'">

      <!-- Bande colorée top -->
      <div style="height:4px" [style.background]="typeGradient(configMap.get(s.id)?.typeService)"></div>

      <div style="padding:18px">
        <!-- Icône + nom -->
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:.9rem;flex-shrink:0"
              [style.background]="typeColor(configMap.get(s.id)?.typeService) + '18'"
              [style.color]="typeColor(configMap.get(s.id)?.typeService)">
              <i [class]="typeIcon(configMap.get(s.id)?.typeService)"></i>
            </div>
            <div>
              <div style="font-weight:700;font-size:.95rem;color:#111">{{ s.nom }}</div>
              <div style="font-size:.72rem;color:#888;margin-top:1px">{{ getEntNom(s.entrepriseId) }}</div>
            </div>
          </div>
        </div>

        <!-- Description -->
        <p *ngIf="s.description" style="font-size:.82rem;color:#666;line-height:1.5;margin-bottom:12px">{{ s.description }}</p>

        <!-- Chips infos -->
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
          <span *ngIf="s.dureeMinutes || configMap.get(s.id)?.dureeMinutes"
            style="display:inline-flex;align-items:center;gap:4px;font-size:.72rem;padding:3px 9px;border-radius:20px;background:#f3f4f6;color:#555;border:1px solid #e5e7eb">
            <i class="fas fa-clock" style="font-size:.62rem"></i>
            {{ configMap.get(s.id)?.dureeMinutes ?? s.dureeMinutes }} min
          </span>
          <span *ngIf="s.tarif != null"
            style="display:inline-flex;align-items:center;gap:4px;font-size:.72rem;padding:3px 9px;border-radius:20px;background:#f0fdf4;color:#059669;border:1px solid rgba(16,185,129,.2)">
            <i class="fas fa-tag" style="font-size:.62rem"></i>
            {{ s.tarif | number:'1.2-2' }} DT
          </span>
          <span *ngIf="configMap.get(s.id)?.typeService"
            style="display:inline-flex;align-items:center;gap:4px;font-size:.72rem;padding:3px 9px;border-radius:20px;border:1px solid"
            [style.background]="typeColor(configMap.get(s.id)?.typeService) + '12'"
            [style.color]="typeColor(configMap.get(s.id)?.typeService)"
            [style.borderColor]="typeColor(configMap.get(s.id)?.typeService) + '30'">
            {{ typeLabel(configMap.get(s.id)?.typeService) }}
          </span>
        </div>

        <!-- Bouton -->
        <a routerLink="/client/creneaux"
          style="display:flex;align-items:center;justify-content:center;gap:7px;padding:9px;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:.82rem;font-weight:700;text-decoration:none;transition:opacity .15s"
          onmouseenter="this.style.opacity='.85'"
          onmouseleave="this.style.opacity='1'">
          <i class="fas fa-calendar-plus"></i> Réserver
        </a>
      </div>
    </div>
  </div>

  <div *ngIf="!loading && filtered.length === 0" style="text-align:center;padding:60px;color:#aaa">
    <i class="fas fa-concierge-bell" style="font-size:2.5rem;opacity:.2;display:block;margin-bottom:12px"></i>
    <p style="font-size:.9rem">Aucun service disponible</p>
  </div>

</div>`
})
export class ClientServicesComponent implements OnInit {
  private api = inject(ApiService);

  services:    ServiceResponse[]    = [];
  filtered:    ServiceResponse[]    = [];
  entreprises: EntrepriseResponse[] = [];
  configMap = new Map<number, ConfigServiceResponse>();
  filtreId: number | null = null;
  loading = false;

  readonly TYPE_CFG: Record<string, any> = {
    EMPLOYE_DEDIE:     { label:'Employé dédié',   icon:'fas fa-user-tie',    color:'#6366f1', gradient:'linear-gradient(90deg,#6366f1,#818cf8)' },
    RESSOURCE_PARTAGEE:{ label:'Ressource partagée',icon:'fas fa-layer-group',color:'#10b981', gradient:'linear-gradient(90deg,#10b981,#34d399)' },
    FILE_ATTENTE_PURE: { label:"File d'attente",   icon:'fas fa-list-ol',     color:'#f59e0b', gradient:'linear-gradient(90deg,#f59e0b,#fbbf24)' },
    HYBRIDE:           { label:'Hybride',           icon:'fas fa-random',      color:'#ec4899', gradient:'linear-gradient(90deg,#ec4899,#f472b6)' },
  };
  typeColor(t?: string|null): string    { return t ? (this.TYPE_CFG[t]?.color ?? '#6366f1') : '#6366f1'; }
  typeGradient(t?: string|null): string { return t ? (this.TYPE_CFG[t]?.gradient ?? 'linear-gradient(90deg,#6366f1,#818cf8)') : 'linear-gradient(90deg,#6366f1,#818cf8)'; }
  typeLabel(t?: string|null): string    { return t ? (this.TYPE_CFG[t]?.label ?? t) : ''; }
  typeIcon(t?: string|null): string     { return t ? (this.TYPE_CFG[t]?.icon ?? 'fas fa-concierge-bell') : 'fas fa-concierge-bell'; }
  getEntNom(id?: number): string        { return this.entreprises.find(e => e.id === id)?.nom ?? ''; }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    forkJoin({ s: this.api.getServices(), e: this.api.getEntreprises() }).subscribe({
      next: d => {
        this.services = d.s; this.entreprises = d.e;
        this.filtered = d.s;
        d.s.forEach(s => this.api.getConfigService(s.id).subscribe({ next: c => this.configMap.set(s.id, c), error: () => {} }));
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  filter(): void {
    this.filtered = this.filtreId ? this.services.filter(s => s.entrepriseId === this.filtreId) : this.services;
  }
}