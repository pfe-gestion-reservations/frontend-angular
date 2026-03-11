import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-client-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
  <div>
    <div class="page-header">
      <div>
        <div class="page-title"><div class="title-icon"><i class="fas fa-home"></i></div>Bienvenue</div>
        <div class="page-subtitle">Gérez vos rendez-vous facilement</div>
      </div>
    </div>
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-icon blue"><i class="fas fa-calendar-check"></i></div><div class="stat-info"><div class="stat-value">{{ total }}</div><div class="stat-label">Réservations</div></div></div>
      <div class="stat-card"><div class="stat-icon green"><i class="fas fa-check-circle"></i></div><div class="stat-info"><div class="stat-value">{{ terminees }}</div><div class="stat-label">Terminées</div></div></div>
      <div class="stat-card"><div class="stat-icon amber"><i class="fas fa-star"></i></div><div class="stat-info"><div class="stat-value">{{ avisCount }}</div><div class="stat-label">Avis laissés</div></div></div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title"><i class="fas fa-calendar-alt"></i>Mes prochains rendez-vous</div><a routerLink="/client/creneaux" class="btn btn-primary btn-sm"><i class="fas fa-plus"></i> Prendre RDV</a></div>
      <div class="table-container">
        <table>
          <thead><tr><th>Service</th><th>Employé</th><th>Date/Heure</th><th>Statut</th></tr></thead>
          <tbody>
            @for (r of upcoming; track r.id) {
              <tr>
                <td><strong>{{ r.serviceNom }}</strong></td>
                <td>{{ r.employeNom }}</td>
                <td>{{ r.dateHeure | date:'dd/MM/yyyy HH:mm' }}</td>
                <td><span class="badge" [ngClass]="sc(r.statut)">{{ r.statut }}</span></td>
              </tr>
            }
            @empty { <tr><td colspan="4"><div class="empty-state"><i class="fas fa-calendar"></i><h3>Aucun rendez-vous</h3></div></td></tr> }
          </tbody>
        </table>
      </div>
    </div>
  </div>`
})
export class ClientDashboardComponent implements OnInit {
  private api = inject(ApiService);
  total = 0; terminees = 0; avisCount = 0; upcoming: any[] = [];
  ngOnInit() {
    forkJoin({ r: this.api.getReservations(), a: this.api.getAvis() }).subscribe(d => {
      this.total = d.r.length;
      this.terminees = d.r.filter(r => r.statut === 'TERMINEE').length;
      this.avisCount = d.a.length;
      this.upcoming = d.r.filter(r => r.statut !== 'TERMINEE' && r.statut !== 'ANNULEE').slice(0, 5);
    });
  }
  sc(s: string) { return { 'badge-success': s==='TERMINEE', 'badge-warning': s==='EN_ATTENTE', 'badge-info': s==='CONFIRMEE', 'badge-purple': s==='EN_COURS', 'badge-danger': s==='ANNULEE' }; }
}
