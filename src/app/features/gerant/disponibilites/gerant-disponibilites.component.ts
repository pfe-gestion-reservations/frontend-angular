import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { DisponibiliteResponse, ServiceResponse, JourSemaine } from '../../../core/models/api.models';

@Component({
  selector: 'app-gerant-disponibilites',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
  <div>
    <div class="page-header">
      <div>
        <div class="page-title"><div class="title-icon"><i class="fas fa-clock"></i></div>Disponibilités</div>
        <div class="page-subtitle">Planification des horaires par service</div>
      </div>
      <button class="btn btn-primary" (click)="openModal()"><i class="fas fa-plus"></i> Ajouter</button>
    </div>

    <!-- FILTRE SERVICE -->
    <div class="filter-wrap">
      <div class="searchable-select" [class.open]="filterDropdownOpen">
        <div class="ss-input-wrap">
          <i class="fas fa-search ss-icon"></i>
          <input class="ss-input"
            [(ngModel)]="filterSearch"
            placeholder="Filtrer par service..."
            (focus)="filterDropdownOpen = true"
            (input)="filterServicesList()">
          <button type="button" class="ss-clear" *ngIf="selectedFilterService" (click)="clearFilter()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="ss-dropdown" *ngIf="filterDropdownOpen">
          <div class="ss-option" (mousedown)="clearFilter()">
            <i class="fas fa-list"></i> Tous les services
          </div>
          <div class="ss-option" *ngFor="let s of filteredServicesList"
            (mousedown)="selectFilterService(s)">
            <i class="fas fa-concierge-bell"></i> {{ s.nom }}
          </div>
          <div class="ss-empty" *ngIf="filteredServicesList.length === 0">Aucun résultat</div>
        </div>
      </div>
    </div>

    <!-- TABLE -->
    <div class="card">
      <div class="table-container">
        <table>
          <thead>
            <tr><th>Service</th><th>Jour</th><th>Début</th><th>Fin</th><th>Actions</th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let d of filtered">
              <td><strong>{{ d.serviceNom }}</strong></td>
              <td><span class="badge badge-amber">{{ d.jour }}</span></td>
              <td>{{ d.heureDebut }}</td>
              <td>{{ d.heureFin }}</td>
              <td>
                <div style="display:flex;gap:6px">
                  <button class="btn btn-info btn-sm btn-icon" (click)="openModal(d)"><i class="fas fa-pen"></i></button>
                  <button class="btn btn-danger btn-sm btn-icon" (click)="delete(d)"><i class="fas fa-trash"></i></button>
                </div>
              </td>
            </tr>
            <tr *ngIf="filtered.length === 0">
              <td colspan="5">
                <div class="empty-state">
                  <i class="fas fa-clock"></i>
                  <h3>Aucune disponibilité</h3>
                  <p>{{ selectedFilterService ? 'Aucune disponibilité pour ce service' : 'Sélectionnez un service ou ajoutez une disponibilité' }}</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- MODAL -->
    <div class="modal-overlay" *ngIf="showModal" (click)="closeModal()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="modal-title"><i class="fas fa-clock"></i>{{ editing ? 'Modifier' : 'Ajouter' }} disponibilité</div>
          <button class="modal-close" (click)="closeModal()"><i class="fas fa-times"></i></button>
        </div>
        <form [formGroup]="form" (ngSubmit)="save()">
          <div class="modal-body">

            <!-- SERVICE SEARCHABLE -->
            <div class="form-group">
              <label class="form-label">Service *</label>
              <div class="searchable-select" [class.open]="modalDropdownOpen">
                <div class="ss-input-wrap">
                  <i class="fas fa-search ss-icon"></i>
                  <input class="ss-input"
                    [(ngModel)]="modalSearch" [ngModelOptions]="{standalone: true}"
                    placeholder="Rechercher un service..."
                    (focus)="modalDropdownOpen = true"
                    (input)="filterModalServices()">
                  <button type="button" class="ss-clear" *ngIf="modalSelectedService" (click)="clearModalSelect()">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
                <div class="ss-dropdown" *ngIf="modalDropdownOpen">
                  <div class="ss-option" *ngFor="let s of filteredModalServices"
                    (mousedown)="selectModalService(s)">
                    <i class="fas fa-concierge-bell"></i> {{ s.nom }}
                  </div>
                  <div class="ss-empty" *ngIf="filteredModalServices.length === 0">Aucun résultat</div>
                </div>
              </div>
              <input type="hidden" formControlName="serviceId">
            </div>

            <div class="form-group">
              <label class="form-label">Jour *</label>
              <select formControlName="jour" class="form-control">
                <option value="">-- Choisir un jour --</option>
                <option *ngFor="let j of jours" [value]="j">{{ j }}</option>
              </select>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Heure début *</label>
                <input formControlName="heureDebut" type="time" class="form-control">
              </div>
              <div class="form-group">
                <label class="form-label">Heure fin *</label>
                <input formControlName="heureFin" type="time" class="form-control">
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="closeModal()">Annuler</button>
            <button type="submit" class="btn btn-primary" [disabled]="loading">
              <span *ngIf="loading">Enregistrement...</span>
              <span *ngIf="!loading"><i class="fas fa-save"></i> Enregistrer</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>`,
  styles: [`
    .filter-wrap { max-width: 320px; margin-bottom: 20px; }
    .searchable-select { position: relative; }
    .ss-input-wrap { display: flex; align-items: center; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg-secondary); transition: border-color .15s; overflow: hidden; }
    .searchable-select.open .ss-input-wrap { border-color: var(--accent); }
    .ss-icon { padding: 0 10px; color: var(--text-muted); font-size: .8rem; flex-shrink: 0; }
    .ss-input { flex: 1; border: none; background: none; padding: 9px 8px 9px 0; font-size: .875rem; color: var(--text-primary); outline: none; width: 100%; }
    .ss-clear { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 0 10px; font-size: .75rem; }
    .ss-clear:hover { color: var(--danger); }
    .ss-dropdown { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); z-index: 200; max-height: 200px; overflow-y: auto; }
    .ss-option { display: flex; align-items: center; gap: 8px; padding: 9px 12px; font-size: .875rem; cursor: pointer; color: var(--text-primary); transition: background .1s; }
    .ss-option:hover { background: var(--bg-hover); color: var(--accent); }
    .ss-option i { color: var(--text-muted); font-size: .8rem; width: 14px; }
    .ss-empty { padding: 10px 12px; font-size: .82rem; color: var(--text-muted); text-align: center; }
  `]
})
export class GerantDisponibilitesComponent implements OnInit {
  private api   = inject(ApiService);
  private toast = inject(ToastService);
  private fb    = inject(FormBuilder);

  dispos:   DisponibiliteResponse[] = [];
  filtered: DisponibiliteResponse[] = [];
  services: ServiceResponse[]       = [];
  jours: JourSemaine[] = ['LUNDI','MARDI','MERCREDI','JEUDI','VENDREDI','SAMEDI','DIMANCHE'];

  showModal = false;
  editing: DisponibiliteResponse | null = null;
  loading = false;

  // Filtre table
  filterSearch = '';
  filterDropdownOpen = false;
  selectedFilterService: ServiceResponse | null = null;
  filteredServicesList: ServiceResponse[] = [];

  // Modal select
  modalSearch = '';
  modalDropdownOpen = false;
  modalSelectedService: ServiceResponse | null = null;
  filteredModalServices: ServiceResponse[] = [];

  form = this.fb.group({
    serviceId:  ['', Validators.required],
    jour:       ['', Validators.required],
    heureDebut: ['', Validators.required],
    heureFin:   ['', Validators.required]
  });

  ngOnInit(): void {
    this.api.getServices().subscribe(s => {
      this.services             = s;
      this.filteredServicesList = s;
      this.filteredModalServices = s;
      // Charger toutes les dispos de tous les services
      this.loadAllDispos();
    });
  }

  loadAllDispos(): void {
    if (this.services.length === 0) { this.dispos = []; this.filtered = []; return; }
    const all: DisponibiliteResponse[] = [];
    let done = 0;
    this.services.forEach(s => {
      this.api.getDispoByService(s.id).subscribe(d => {
        all.push(...d);
        done++;
        if (done === this.services.length) {
          this.dispos   = all;
          this.filtered = all;
        }
      });
    });
  }

  loadDispoByService(serviceId: number): void {
    this.api.getDispoByService(serviceId).subscribe(d => {
      this.dispos   = d;
      this.filtered = d;
    });
  }

  // ── FILTRE TABLE ──
  filterServicesList(): void {
    const q = this.filterSearch.toLowerCase();
    this.filteredServicesList = this.services.filter(s => s.nom.toLowerCase().includes(q));
  }

  selectFilterService(s: ServiceResponse): void {
    this.selectedFilterService = s;
    this.filterSearch          = s.nom;
    this.filterDropdownOpen    = false;
    this.loadDispoByService(s.id);
  }

  clearFilter(): void {
    this.selectedFilterService = null;
    this.filterSearch          = '';
    this.filterDropdownOpen    = false;
    this.filteredServicesList  = this.services;
    this.loadAllDispos();
  }

  // ── MODAL SELECT ──
  filterModalServices(): void {
    const q = this.modalSearch.toLowerCase();
    this.filteredModalServices = this.services.filter(s => s.nom.toLowerCase().includes(q));
  }

  selectModalService(s: ServiceResponse): void {
    this.modalSelectedService = s;
    this.modalSearch          = s.nom;
    this.modalDropdownOpen    = false;
    this.form.get('serviceId')?.setValue(String(s.id));
  }

  clearModalSelect(): void {
    this.modalSelectedService  = null;
    this.modalSearch           = '';
    this.filteredModalServices = this.services;
    this.form.get('serviceId')?.setValue('');
  }

  // ── CRUD ──
  openModal(d?: DisponibiliteResponse): void {
    this.editing              = d ?? null;
    this.modalSearch          = '';
    this.modalSelectedService = null;
    this.modalDropdownOpen    = false;
    this.filteredModalServices = this.services;

    if (d) {
      const svc = this.services.find(s => s.id === d.serviceId);
      if (svc) {
        this.modalSelectedService = svc;
        this.modalSearch = svc.nom;
      }
      this.form.setValue({
        serviceId:  String(d.serviceId),
        jour:       d.jour,
        heureDebut: d.heureDebut,
        heureFin:   d.heureFin
      });
    } else {
      this.form.reset();
    }
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal            = false;
    this.editing              = null;
    this.modalSearch          = '';
    this.modalSelectedService = null;
    this.form.reset();
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    this.loading = true;
    const v = this.form.value;
    const body = {
      serviceId:  Number(v.serviceId),
      jour:       v.jour as JourSemaine,
      heureDebut: v.heureDebut!,
      heureFin:   v.heureFin!
    };
    const req = this.editing
      ? this.api.updateDispo(this.editing.id, body)
      : this.api.createDispo(body);
    req.subscribe({
      next: () => {
        this.toast.success('Disponibilité enregistrée !');
        if (this.selectedFilterService) {
          this.loadDispoByService(body.serviceId);
        } else {
          this.loadAllDispos();
        }
        this.closeModal();
        this.loading = false;
      },
      error: () => { this.toast.error('Erreur'); this.loading = false; }
    });
  }

  delete(d: DisponibiliteResponse): void {
    if (!confirm('Supprimer cette disponibilité ?')) return;
    this.api.deleteDispo(d.id).subscribe({
      next: () => {
        this.toast.success('Supprimée');
        if (this.selectedFilterService) {
          this.loadDispoByService(d.serviceId);
        } else {
          this.loadAllDispos();
        }
      },
      error: () => this.toast.error('Erreur')
    });
  }
}