import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { CreneauResponse, ServiceResponse, EmployeResponse } from '../../../core/models/api.models';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-client-creneaux',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
  <div>
    <div class="page-header">
      <div><div class="page-title"><div class="title-icon"><i class="fas fa-clock"></i></div>Créneaux disponibles</div><div class="page-subtitle">Consultez les horaires et prenez rendez-vous</div></div>
    </div>
    <div class="card" style="margin-bottom:24px">
      <div class="card-header"><div class="card-title"><i class="fas fa-filter"></i>Filtres</div></div>
      <form [formGroup]="filterForm" (ngSubmit)="loadCreneaux()">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Employé</label>
            <select formControlName="employeId" class="form-control">
              <option value="">-- Choisir --</option>
              @for (e of employes; track e.id) { <option [value]="e.id">{{ e.nom }} {{ e.prenom }}</option> }
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Service</label>
            <select formControlName="serviceId" class="form-control">
              <option value="">-- Choisir --</option>
              @for (s of services; track s.id) { <option [value]="s.id">{{ s.nom }}</option> }
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Date</label>
            <input formControlName="date" type="date" class="form-control">
          </div>
        </div>
        <button type="submit" class="btn btn-primary" [disabled]="loading"><i class="fas fa-search"></i> Rechercher</button>
      </form>
    </div>

    @if (creneaux.length > 0) {
      <div class="card">
        <div class="card-header"><div class="card-title"><i class="fas fa-calendar-check"></i>{{ creneaux.length }} créneau(x) disponible(s)</div></div>
        <div class="creneau-grid">
          @for (c of creneaux; track c.heureDebut) {
            <div class="creneau-slot" [class.selected]="selectedCreneau?.heureDebut === c.heureDebut" (click)="selectCreneau(c)">
              <div>{{ c.heureDebut }}</div>
              <div style="font-size:.75rem;color:var(--text-muted)">{{ c.heureFin }}</div>
            </div>
          }
        </div>
        @if (selectedCreneau) {
          <div style="margin-top:20px;padding:16px;background:var(--accent-glow);border:1px solid rgba(240,165,0,.3);border-radius:var(--radius-md)">
            <div style="color:var(--accent);font-weight:600;margin-bottom:10px"><i class="fas fa-check-circle"></i> Créneau sélectionné : {{ selectedCreneau.heureDebut }} — {{ selectedCreneau.heureFin }}</div>
            <button class="btn btn-primary" (click)="confirmerRdv()" [disabled]="loading">
              @if (loading) { Confirmation... } @else { <i class="fas fa-calendar-plus"></i> Confirmer le RDV }
            </button>
          </div>
        }
      </div>
    } @else if (searched) {
      <div class="empty-state"><i class="fas fa-calendar-times"></i><h3>Aucun créneau disponible</h3><p>Essayez une autre date ou un autre employé.</p></div>
    }
  </div>`
})
export class ClientCreneauxComponent implements OnInit {
  private api = inject(ApiService); private toast = inject(ToastService); private fb = inject(FormBuilder);
  creneaux: CreneauResponse[] = []; employes: EmployeResponse[] = []; services: ServiceResponse[] = [];
  selectedCreneau: CreneauResponse | null = null; loading = false; searched = false;
  filterForm = this.fb.group({ serviceId: ['', Validators.required], date: ['', Validators.required] });

  ngOnInit() { forkJoin({ e: this.api.getEmployes(), s: this.api.getServices() }).subscribe(d => { this.employes = d.e; this.services = d.s; }); }
  loadCreneaux() {
    if (this.filterForm.invalid) { this.filterForm.markAllAsTouched(); return; }
    this.loading = true; const v = this.filterForm.value;
    this.api.getCreneaux(+v.serviceId!, v.date!).subscribe({ next: d => { this.creneaux = d; this.searched = true; this.loading = false; }, error: () => { this.toast.error('Erreur'); this.loading = false; } });
  }
  selectCreneau(c: CreneauResponse) { this.selectedCreneau = this.selectedCreneau?.heureDebut === c.heureDebut ? null : c; }
  confirmerRdv() { this.toast.success('Fonctionnalité disponible via le chatbot ou en agence !'); }
}