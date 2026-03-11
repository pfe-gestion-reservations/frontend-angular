import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-employe-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
  <div>
    <div class="page-header">
      <div>
        <div class="page-title"><div class="title-icon"><i class="fas fa-tachometer-alt"></i></div>Mon tableau de bord</div>
      </div>
    </div>
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-icon amber"><i class="fas fa-list-ol"></i></div><div class="stat-info"><div class="stat-value">{{ file }}</div><div class="stat-label">En file d'attente</div></div></div>
      <div class="stat-card"><div class="stat-icon blue"><i class="fas fa-calendar-check"></i></div><div class="stat-info"><div class="stat-value">{{ reservations }}</div><div class="stat-label">Réservations</div></div></div>
      <div class="stat-card"><div class="stat-icon purple"><i class="fas fa-star"></i></div><div class="stat-info"><div class="stat-value">{{ avisCount }}</div><div class="stat-label">Avis clients</div></div></div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title"><i class="fas fa-list-ol"></i> File d'attente du jour</div></div>
      @for (f of maFile; track f.id) {
        <div class="queue-card">
          <div class="queue-info">
            <div class="queue-name">{{ f.clientNom }} {{ f.clientPrenom }}</div>
            <div class="queue-service">{{ f.serviceNom }}</div>
          </div>
          <span class="badge" [ngClass]="sc(f.statut)">{{ f.statut }}</span>
        </div>
      }
      @empty { <div class="empty-state"><i class="fas fa-door-open"></i><h3>File vide</h3></div> }
    </div>
  </div>`
})
export class EmployeDashboardComponent implements OnInit {
  private api = inject(ApiService);
  file = 0; reservations = 0; avisCount = 0; maFile: any[] = [];
  ngOnInit() {
    forkJoin({ f: this.api.getFileAttente(), r: this.api.getReservations(), a: this.api.getAvis() }).subscribe(d => {
      this.maFile = d.f.filter(f => f.statut === 'EN_ATTENTE' || f.statut === 'APPELE');
      this.file = this.maFile.length; this.reservations = d.r.length; this.avisCount = d.a.length;
    });
  }
  sc(s: string) { return { 'badge-warning': s==='EN_ATTENTE', 'badge-info': s==='APPELE', 'badge-purple': s==='EN_COURS', 'badge-success': s==='TERMINE', 'badge-danger': s==='ANNULE' }; }
}