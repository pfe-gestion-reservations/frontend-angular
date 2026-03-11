import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { ReservationResponse } from '../../../core/models/api.models';

@Component({
  selector: 'app-client-reservations',
  standalone: true,
  imports: [CommonModule],
  template: `
  <div>
    <div class="page-header">
      <div><div class="page-title"><div class="title-icon"><i class="fas fa-calendar-check"></i></div>Mes Réservations</div></div>
    </div>
    <div class="card">
      <div class="table-container">
        <table>
          <thead><tr><th>#</th><th>Service</th><th>Employé</th><th>Date/Heure</th><th>Statut</th><th>Notes</th></tr></thead>
          <tbody>
            @for (r of reservations; track r.id) {
              <tr>
                <td>{{ r.id }}</td>
                <td><strong>{{ r.serviceNom }}</strong></td>
                <td>{{ r.employeNom }}</td>
                <td>{{ r.heureDebut | date:'dd/MM/yyyy HH:mm' }}</td>
                <td><span class="badge" [ngClass]="sc(r.statut)">{{ r.statut }}</span></td>
                <td style="color:var(--text-secondary);font-size:.8rem">{{ r.notes || '—' }}</td>
              </tr>
            }
            @empty { <tr><td colspan="6"><div class="empty-state"><i class="fas fa-calendar"></i><h3>Aucune réservation</h3></div></td></tr> }
          </tbody>
        </table>
      </div>
    </div>
  </div>`
})
export class ClientReservationsComponent implements OnInit {
  private api = inject(ApiService);
  reservations: ReservationResponse[] = [];
  ngOnInit() { this.api.getReservations().subscribe(d => this.reservations = d); }
  sc(s: string) { return { 'badge-success': s==='TERMINEE', 'badge-warning': s==='EN_ATTENTE', 'badge-info': s==='CONFIRMEE', 'badge-purple': s==='EN_COURS', 'badge-danger': s==='ANNULEE' }; }
}