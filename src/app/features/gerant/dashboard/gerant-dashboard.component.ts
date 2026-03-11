import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-gerant-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
  <div>
    <div class="page-header">
      <div>
        <div class="page-title"><div class="title-icon"><i class="fas fa-chart-bar"></i></div>Tableau de bord</div>
        <div class="page-subtitle">Vue d'ensemble de votre entreprise</div>
      </div>
    </div>
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-icon amber"><i class="fas fa-users"></i></div><div class="stat-info"><div class="stat-value">{{ stats.employes }}</div><div class="stat-label">Employés</div></div></div>
      <div class="stat-card"><div class="stat-icon blue"><i class="fas fa-user-friends"></i></div><div class="stat-info"><div class="stat-value">{{ stats.clients }}</div><div class="stat-label">Clients</div></div></div>
      <div class="stat-card"><div class="stat-icon purple"><i class="fas fa-concierge-bell"></i></div><div class="stat-info"><div class="stat-value">{{ stats.services }}</div><div class="stat-label">Services</div></div></div>
      <div class="stat-card"><div class="stat-icon green"><i class="fas fa-calendar-check"></i></div><div class="stat-info"><div class="stat-value">{{ stats.reservations }}</div><div class="stat-label">Réservations</div></div></div>
      <div class="stat-card"><div class="stat-icon cyan"><i class="fas fa-list-ol"></i></div><div class="stat-info"><div class="stat-value">{{ stats.file }}</div><div class="stat-label">File d'attente</div></div></div>
      <div class="stat-card"><div class="stat-icon amber"><i class="fas fa-star"></i></div><div class="stat-info"><div class="stat-value">{{ avgNote || '—' }}</div><div class="stat-label">Note moyenne</div></div></div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title"><i class="fas fa-calendar-alt"></i>Réservations récentes</div></div>
      <div class="table-container">
        <table>
          <thead><tr><th>Client</th><th>Employé</th><th>Service</th><th>Date</th><th>Statut</th></tr></thead>
          <tbody>
            @for (r of recentReservations; track r.id) {
              <tr>
                <td>{{ r.clientNom }}</td>
                <td>{{ r.employeNom }}</td>
                <td>{{ r.serviceNom }}</td>
                <td>{{ r.dateHeure | date:'dd/MM/yyyy HH:mm' }}</td>
                <td><span class="badge" [ngClass]="statutClass(r.statut)">{{ r.statut }}</span></td>
              </tr>
            }
            @empty { <tr><td colspan="5"><div class="empty-state"><i class="fas fa-calendar"></i><h3>Aucune réservation</h3></div></td></tr> }
          </tbody>
        </table>
      </div>
    </div>
  </div>`
})
export class GerantDashboardComponent implements OnInit {
  private api = inject(ApiService);
  stats = { employes: 0, clients: 0, services: 0, reservations: 0, file: 0 };
  recentReservations: any[] = [];
  avgNote = 0;

  ngOnInit() {
    forkJoin({
      e: this.api.getEmployes(), c: this.api.getClients(),
      s: this.api.getServices(), r: this.api.getReservations(),
      f: this.api.getFileAttente(), a: this.api.getAvis()
    }).subscribe(d => {
      this.stats = { employes: d.e.length, clients: d.c.length, services: d.s.length, reservations: d.r.length, file: d.f.length };
      this.recentReservations = d.r.slice(-5).reverse();
      this.avgNote = d.a.length ? +(d.a.reduce((s,a) => s+a.note, 0) / d.a.length).toFixed(1) : 0;
    });
  }

  statutClass(s: string) {
    return { 'badge-success': s==='TERMINEE', 'badge-warning': s==='EN_ATTENTE'||s==='EN_COURS', 'badge-info': s==='CONFIRMEE', 'badge-danger': s==='ANNULEE' };
  }
}
