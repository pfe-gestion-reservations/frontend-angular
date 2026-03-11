import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-sa-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
  <div>
    <div class="page-header">
      <div>
        <div class="page-title">
          <div class="title-icon"><i class="fas fa-chart-pie"></i></div>
          Tableau de bord
        </div>
        <div class="page-subtitle">Vue globale de la plateforme</div>
      </div>
    </div>
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-icon amber"><i class="fas fa-layer-group"></i></div>
        <div class="stat-info">
          <div class="stat-value">{{ secteurs }}</div>
          <div class="stat-label">Secteurs</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon blue"><i class="fas fa-building"></i></div>
        <div class="stat-info">
          <div class="stat-value">{{ entreprises }}</div>
          <div class="stat-label">Entreprises</div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header">
        <div class="card-title"><i class="fas fa-info-circle"></i> Bienvenue Super Admin</div>
      </div>
      <p style="color:var(--text-secondary)">Vous gérez l'ensemble de la plateforme. Utilisez le menu latéral pour naviguer.</p>
    </div>
  </div>`
})
export class SaDashboardComponent implements OnInit {
  private api = inject(ApiService);
  secteurs = 0; entreprises = 0;
  ngOnInit(): void {
    forkJoin({ s: this.api.getSecteurs(), e: this.api.getEntreprises() }).subscribe(r => {
      this.secteurs = r.s.length; this.entreprises = r.e.length;
    });
  }
}
