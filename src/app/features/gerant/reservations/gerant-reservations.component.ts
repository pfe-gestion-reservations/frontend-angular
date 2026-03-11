import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { ReservationResponse, ClientResponse, EmployeResponse, ServiceResponse, CreneauResponse, StatutReservation } from '../../../core/models/api.models';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-gerant-reservations',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
  <div>
    <div class="page-header">
      <div>
        <div class="page-title"><div class="title-icon"><i class="fas fa-calendar-alt"></i></div>Réservations</div>
        <div class="page-subtitle">Gestion des rendez-vous</div>
      </div>
      <button class="btn btn-primary" (click)="openModal()"><i class="fas fa-plus"></i> Nouvelle réservation</button>
    </div>

    <div class="card">
      <div class="table-container">
        <table>
          <thead><tr><th>#</th><th>Client</th><th>Employé</th><th>Service</th><th>Date/Heure</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            <tr *ngFor="let r of reservations">
              <td>{{ r.id }}</td>
              <td><strong>{{ r.clientNom }}</strong></td>
              <td>{{ r.employeNom }}</td>
              <td>{{ r.serviceNom }}</td>
              <td>{{ r.heureDebut | date:'dd/MM/yyyy HH:mm' }}</td>
              <td><span class="badge" [ngClass]="statutClass(r.statut)">{{ r.statut }}</span></td>
              <td>
                <select class="form-control stat-select" (change)="changeStatut(r, $event)">
                  <option value="">Changer statut</option>
                  <option *ngFor="let s of statuts" [value]="s">{{ s }}</option>
                </select>
              </td>
            </tr>
            <tr *ngIf="reservations.length === 0">
              <td colspan="7"><div class="empty-state"><i class="fas fa-calendar"></i><h3>Aucune réservation</h3></div></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- MODAL -->
    <div class="modal-overlay" *ngIf="showModal" (click)="closeModal()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="modal-title"><i class="fas fa-calendar-plus"></i>Nouvelle réservation</div>
          <button class="modal-close" (click)="closeModal()"><i class="fas fa-times"></i></button>
        </div>
        <form [formGroup]="form" (ngSubmit)="save()">
          <div class="modal-body">

            <!-- CLIENT -->
            <div class="form-group">
              <label class="form-label" for="rClientSearch">Client</label>
              <div class="searchable-select" [class.open]="dropdowns.client">
                <div class="ss-input-wrap">
                  <i class="fas fa-search ss-icon"></i>
                  <input id="rClientSearch" name="rClientSearch" class="ss-input"
                    [(ngModel)]="search.client" [ngModelOptions]="{standalone: true}"
                    placeholder="Rechercher un client..."
                    (focus)="dropdowns.client = true"
                    (input)="filter('client')">
                  <button type="button" class="ss-clear" *ngIf="selected.client" (click)="clearSelect('client')">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
                <div class="ss-dropdown" *ngIf="dropdowns.client">
                  <div class="ss-option" *ngFor="let c of filteredClients"
                    (mousedown)="selectItem('client', c.id, c.nom + ' ' + c.prenom)">
                    <i class="fas fa-user"></i> {{ c.nom }} {{ c.prenom }}
                  </div>
                  <div class="ss-empty" *ngIf="filteredClients.length === 0">Aucun résultat</div>
                </div>
              </div>
              <input type="hidden" formControlName="clientId">
            </div>

            <!-- EMPLOYE -->
            <div class="form-group">
              <label class="form-label" for="rEmployeSearch">Employé</label>
              <div class="searchable-select" [class.open]="dropdowns.employe">
                <div class="ss-input-wrap">
                  <i class="fas fa-search ss-icon"></i>
                  <input id="rEmployeSearch" name="rEmployeSearch" class="ss-input"
                    [(ngModel)]="search.employe" [ngModelOptions]="{standalone: true}"
                    placeholder="Rechercher un employé..."
                    (focus)="dropdowns.employe = true"
                    (input)="filter('employe')">
                  <button type="button" class="ss-clear" *ngIf="selected.employe" (click)="clearSelect('employe')">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
                <div class="ss-dropdown" *ngIf="dropdowns.employe">
                  <div class="ss-option" *ngFor="let e of filteredEmployes"
                    (mousedown)="selectItem('employe', e.id, e.nom + ' ' + e.prenom)">
                    <i class="fas fa-user-tie"></i> {{ e.nom }} {{ e.prenom }}
                  </div>
                  <div class="ss-empty" *ngIf="filteredEmployes.length === 0">Aucun résultat</div>
                </div>
              </div>
              <input type="hidden" formControlName="employeId">
            </div>

            <!-- SERVICE -->
            <div class="form-group">
              <label class="form-label" for="rServiceSearch">Service</label>
              <div class="searchable-select" [class.open]="dropdowns.service">
                <div class="ss-input-wrap">
                  <i class="fas fa-search ss-icon"></i>
                  <input id="rServiceSearch" name="rServiceSearch" class="ss-input"
                    [(ngModel)]="search.service" [ngModelOptions]="{standalone: true}"
                    placeholder="Rechercher un service..."
                    (focus)="dropdowns.service = true"
                    (input)="filter('service')">
                  <button type="button" class="ss-clear" *ngIf="selected.service" (click)="clearSelect('service')">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
                <div class="ss-dropdown" *ngIf="dropdowns.service">
                  <div class="ss-option" *ngFor="let s of filteredServices"
                    (mousedown)="selectItem('service', s.id, s.nom + ' (' + s.dureeMinutes + ' min)')">
                    <i class="fas fa-concierge-bell"></i> {{ s.nom }} ({{ s.dureeMinutes }} min) — {{ s.tarif }} DT
                  </div>
                  <div class="ss-empty" *ngIf="filteredServices.length === 0">Aucun résultat</div>
                </div>
              </div>
              <input type="hidden" formControlName="serviceId">
            </div>

            <!-- DATE -->
            <div class="form-group">
              <label class="form-label" for="rDate">Date</label>
              <input id="rDate" name="rDate" type="date" class="form-control"
                [(ngModel)]="selectedDate" [ngModelOptions]="{standalone: true}"
                (change)="onDateChange()"
                [min]="today">
            </div>

            <!-- CRENEAUX -->
            <div class="form-group" *ngIf="selectedDate">
              <label class="form-label">Créneau disponible</label>
              <div class="creneaux-loading" *ngIf="loadingCreneaux">
                <i class="fas fa-spinner fa-spin"></i> Chargement des créneaux...
              </div>
              <div class="creneaux-grid" *ngIf="!loadingCreneaux && creneaux.length > 0">
                <button type="button" class="creneau-btn"
                  *ngFor="let c of creneaux"
                  [class.selected]="selectedCreneau === c.heureDebut"
                  (click)="selectCreneau(c)">
                  <i class="fas fa-clock"></i>
                  {{ c.heureDebut }} – {{ c.heureFin }}
                </button>
              </div>
              <div class="creneaux-empty" *ngIf="!loadingCreneaux && creneaux.length === 0 && canLoadCreneaux()">
                <i class="fas fa-calendar-times"></i>
                Aucun créneau disponible pour cette date
              </div>
              <div class="creneaux-hint" *ngIf="!canLoadCreneaux() && selectedDate">
                <i class="fas fa-info-circle"></i>
                Sélectionnez un employé et un service pour voir les créneaux
              </div>
              <input type="hidden" formControlName="heureDebut">
            </div>

            <div class="form-group">
              <label class="form-label" for="rNotes">Notes</label>
              <textarea id="rNotes" name="rNotes" formControlName="notes" class="form-control" placeholder="Remarques..." rows="2"></textarea>
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
    .stat-select { width: auto; padding: 4px 8px; font-size: .78rem; }

    /* SEARCHABLE SELECT */
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

    /* CRENEAUX */
    .creneaux-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
    .creneau-btn { padding: 7px 14px; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg-secondary); color: var(--text-secondary); font-size: .82rem; cursor: pointer; transition: all .15s; display: flex; align-items: center; gap: 6px; }
    .creneau-btn:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-glow); }
    .creneau-btn.selected { border-color: var(--accent); background: var(--accent-glow); color: var(--accent); font-weight: 600; }
    .creneaux-loading { color: var(--text-muted); font-size: .82rem; padding: 8px 0; }
    .creneaux-empty { color: var(--danger); font-size: .82rem; padding: 8px 0; display: flex; align-items: center; gap: 6px; }
    .creneaux-hint { color: var(--text-muted); font-size: .82rem; padding: 8px 0; display: flex; align-items: center; gap: 6px; font-style: italic; }
    textarea.form-control { resize: vertical; min-height: 70px; }
  `]
})
export class GerantReservationsComponent implements OnInit {
  private api   = inject(ApiService);
  private toast = inject(ToastService);
  private fb    = inject(FormBuilder);

  reservations: ReservationResponse[] = [];
  clients: ClientResponse[]   = [];
  employes: EmployeResponse[] = [];
  services: ServiceResponse[] = [];
  creneaux: CreneauResponse[] = [];

  filteredClients: ClientResponse[]   = [];
  filteredEmployes: EmployeResponse[] = [];
  filteredServices: ServiceResponse[] = [];

  showModal       = false;
  loading         = false;
  loadingCreneaux = false;
  selectedDate    = '';
  selectedCreneau = '';
  today           = new Date().toISOString().split('T')[0];

  statuts: StatutReservation[] = ['EN_ATTENTE', 'CONFIRMEE', 'EN_COURS', 'TERMINEE', 'ANNULEE'];

  search    = { client: '', employe: '', service: '' };
  selected  = { client: false, employe: false, service: false };
  dropdowns = { client: false, employe: false, service: false };

  // IDs sélectionnés
  selectedEmployeId = 0;
  selectedServiceId = 0;

  form = this.fb.group({
    clientId:  ['', Validators.required],
    employeId: ['', Validators.required],
    serviceId: ['', Validators.required],
    heureDebut: ['', Validators.required],
    notes:     ['']
  });

  ngOnInit(): void {
    forkJoin({
      r: this.api.getReservations(),
      c: this.api.getClients(),
      e: this.api.getEmployes(),
      s: this.api.getServices()
    }).subscribe(d => {
      this.reservations    = d.r;
      this.clients         = d.c; this.filteredClients  = d.c;
      this.employes        = d.e; this.filteredEmployes = d.e;
      this.services        = d.s; this.filteredServices = d.s;
    });
  }

  canLoadCreneaux(): boolean {
    return this.selectedEmployeId > 0 && this.selectedServiceId > 0;
  }

  onDateChange(): void {
    this.creneaux       = [];
    this.selectedCreneau = '';
    this.form.get('heureDebut')?.setValue('');
    if (!this.canLoadCreneaux() || !this.selectedDate) return;
    this.loadCreneaux();
  }

  loadCreneaux(): void {
    if (!this.canLoadCreneaux() || !this.selectedDate) return;
    this.loadingCreneaux = true;
    this.creneaux        = [];
    this.selectedCreneau = '';
    this.form.get('heureDebut')?.setValue('');
    this.api.getCreneaux(this.selectedServiceId, this.selectedDate).subscribe({
      next: d => { this.creneaux = d; this.loadingCreneaux = false; },
      error: () => { this.loadingCreneaux = false; this.toast.error('Erreur lors du chargement des créneaux'); }
    });
  }

  selectCreneau(c: CreneauResponse): void {
    this.selectedCreneau = c.heureDebut;
    const heureDebut = `${this.selectedDate}T${c.heureDebut}`;
    this.form.get('heureDebut')?.setValue(heureDebut);
  }

  filter(type: 'client' | 'employe' | 'service'): void {
    const q = this.search[type].toLowerCase();
    if (type === 'client')  this.filteredClients  = this.clients.filter(c => `${c.nom} ${c.prenom}`.toLowerCase().includes(q));
    if (type === 'employe') this.filteredEmployes = this.employes.filter(e => `${e.nom} ${e.prenom}`.toLowerCase().includes(q));
    if (type === 'service') this.filteredServices = this.services.filter(s => s.nom.toLowerCase().includes(q));
  }

  selectItem(type: 'client' | 'employe' | 'service', id: number, label: string): void {
    this.search[type]    = label;
    this.selected[type]  = true;
    this.dropdowns[type] = false;
    const ctrl = type === 'client' ? 'clientId' : type === 'employe' ? 'employeId' : 'serviceId';
    this.form.get(ctrl)?.setValue(String(id));

    if (type === 'employe') {
      this.selectedEmployeId = id;
      this.creneaux = []; this.selectedCreneau = '';
      this.form.get('heureDebut')?.setValue('');
      if (this.selectedDate && this.canLoadCreneaux()) this.loadCreneaux();
    }
    if (type === 'service') {
      this.selectedServiceId = id;
      this.creneaux = []; this.selectedCreneau = '';
      this.form.get('heureDebut')?.setValue('');
      if (this.selectedDate && this.canLoadCreneaux()) this.loadCreneaux();
    }
  }

  clearSelect(type: 'client' | 'employe' | 'service'): void {
    this.search[type]   = '';
    this.selected[type] = false;
    const ctrl = type === 'client' ? 'clientId' : type === 'employe' ? 'employeId' : 'serviceId';
    this.form.get(ctrl)?.setValue('');
    if (type === 'employe') { this.selectedEmployeId = 0; this.creneaux = []; }
    if (type === 'service') { this.selectedServiceId = 0; this.creneaux = []; }
    this.filter(type);
  }

  openModal(): void {
    this.showModal       = true;
    this.search          = { client: '', employe: '', service: '' };
    this.selected        = { client: false, employe: false, service: false };
    this.dropdowns       = { client: false, employe: false, service: false };
    this.creneaux        = [];
    this.selectedDate    = '';
    this.selectedCreneau = '';
    this.selectedEmployeId = 0;
    this.selectedServiceId = 0;
    this.form.reset();
  }

  closeModal(): void {
    this.showModal = false;
    this.form.reset();
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Veuillez sélectionner un client, employé, service et créneau');
      return;
    }
    this.loading = true;
    const v = this.form.value;
    const body = {
      clientId:  +v.clientId!,
      employeId: +v.employeId!,
      serviceId: +v.serviceId!,
      heureDebut: v.heureDebut,
      notes:     v.notes || ''
    } as any;
    this.api.createReservation(body).subscribe({
      next: () => {
        this.toast.success('Réservation créée !');
        this.api.getReservations().subscribe(d => this.reservations = d);
        this.closeModal();
        this.loading = false;
      },
      error: () => { this.toast.error('Erreur'); this.loading = false; }
    });
  }

  changeStatut(r: ReservationResponse, e: Event): void {
    const s = (e.target as HTMLSelectElement).value as StatutReservation;
    if (!s) return;
    this.api.changerStatutReservation(r.id, s).subscribe({
      next: () => { this.toast.success('Statut modifié'); this.api.getReservations().subscribe(d => this.reservations = d); },
      error: () => this.toast.error('Erreur')
    });
  }

  statutClass(s: string) {
    return {
      'badge-success': s === 'TERMINEE',
      'badge-warning': s === 'EN_ATTENTE',
      'badge-info':    s === 'CONFIRMEE',
      'badge-purple':  s === 'EN_COURS',
      'badge-danger':  s === 'ANNULEE'
    };
  }
}