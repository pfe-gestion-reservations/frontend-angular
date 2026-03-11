import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-employe-reservations',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
  <div>
    <div class="page-header">
      <div>
        <div class="page-title"><div class="title-icon"><i class="fas fa-calendar-alt"></i></div>Réservations</div>
      </div>
      <button class="btn btn-primary" (click)="openModal()"><i class="fas fa-plus"></i> Nouvelle</button>
    </div>

    <div class="card">
      <div class="table-container">
        <table>
          <thead><tr><th>#</th><th>Client</th><th>Service</th><th>Date/Heure</th><th>Statut</th></tr></thead>
          <tbody>
            <tr *ngFor="let r of reservations">
              <td>{{ r.id }}</td>
              <td><strong>{{ r.clientNom }}</strong></td>
              <td>{{ r.serviceNom }}</td>
              <td>{{ r.heureDebut | date:'dd/MM/yyyy HH:mm' }}</td>
              <td><span class="badge" [ngClass]="sc(r.statut)">{{ r.statut }}</span></td>
            </tr>
            <tr *ngIf="reservations.length === 0">
              <td colspan="5"><div class="empty-state"><i class="fas fa-calendar"></i><h3>Aucune réservation</h3></div></td>
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

            <!-- CLIENT SEARCHABLE -->
            <div class="form-group">
              <label class="form-label" for="erClientSearch">Client</label>
              <div class="searchable-select" [class.open]="dropdowns.client">
                <div class="ss-input-wrap">
                  <i class="fas fa-search ss-icon"></i>
                  <input id="erClientSearch" name="erClientSearch" class="ss-input"
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

            <!-- SERVICE SEARCHABLE -->
            <div class="form-group">
              <label class="form-label" for="erServiceSearch">Service</label>
              <div class="searchable-select" [class.open]="dropdowns.service">
                <div class="ss-input-wrap">
                  <i class="fas fa-search ss-icon"></i>
                  <input id="erServiceSearch" name="erServiceSearch" class="ss-input"
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
                    <i class="fas fa-concierge-bell"></i> {{ s.nom }} ({{ s.dureeMinutes }} min)
                  </div>
                  <div class="ss-empty" *ngIf="filteredServices.length === 0">Aucun résultat</div>
                </div>
              </div>
              <input type="hidden" formControlName="serviceId">
            </div>

            <div class="form-group">
              <label class="form-label" for="erDate">Date et Heure</label>
              <input id="erDate" name="erDate" formControlName="heureDebut" type="datetime-local" class="form-control">
            </div>
            <div class="form-group">
              <label class="form-label" for="erNotes">Notes</label>
              <textarea id="erNotes" name="erNotes" formControlName="notes" class="form-control" placeholder="Remarques..." rows="2"></textarea>
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
    textarea.form-control { resize: vertical; min-height: 70px; }
  `]
})
export class EmployeReservationsComponent implements OnInit {
  private api   = inject(ApiService);
  private toast = inject(ToastService);
  private fb    = inject(FormBuilder);

  reservations: any[] = [];
  clients: any[]  = [];
  services: any[] = [];

  filteredClients: any[]  = [];
  filteredServices: any[] = [];

  showModal = false;
  loading   = false;

  search   = { client: '', service: '' };
  selected = { client: false, service: false };
  dropdowns = { client: false, service: false };

  form = this.fb.group({
    clientId:  ['', Validators.required],
    serviceId: ['', Validators.required],
    heureDebut: ['', Validators.required],
    notes:     ['']
  });

  ngOnInit(): void {
    forkJoin({
      r: this.api.getReservations(),
      c: this.api.getClients(),
      s: this.api.getServices()
    }).subscribe(d => {
      this.reservations    = d.r;
      this.clients         = d.c; this.filteredClients  = d.c;
      this.services        = d.s; this.filteredServices = d.s;
    });
  }

  filter(type: 'client' | 'service'): void {
    const q = this.search[type].toLowerCase();
    if (type === 'client')  this.filteredClients  = this.clients.filter(c => `${c.nom} ${c.prenom}`.toLowerCase().includes(q));
    if (type === 'service') this.filteredServices = this.services.filter(s => s.nom.toLowerCase().includes(q));
  }

  selectItem(type: 'client' | 'service', id: number, label: string): void {
    this.search[type]    = label;
    this.selected[type]  = true;
    this.dropdowns[type] = false;
    const ctrl = type === 'client' ? 'clientId' : 'serviceId';
    this.form.get(ctrl)?.setValue(String(id));
  }

  clearSelect(type: 'client' | 'service'): void {
    this.search[type]   = '';
    this.selected[type] = false;
    const ctrl = type === 'client' ? 'clientId' : 'serviceId';
    this.form.get(ctrl)?.setValue('');
    this.filter(type);
  }

  openModal(): void {
    this.showModal = true;
    this.search    = { client: '', service: '' };
    this.selected  = { client: false, service: false };
    this.dropdowns = { client: false, service: false };
    this.form.reset();
  }

  closeModal(): void {
    this.showModal = false;
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
    this.api.createReservation({
      clientId:  +v.clientId!,
      employeId: 0,
      serviceId: +v.serviceId!,
      heureDebut: v.heureDebut!,
      notes:     v.notes || ''
    }).subscribe({
      next: () => {
        this.toast.success('Réservation créée !');
        this.api.getReservations().subscribe(d => this.reservations = d);
        this.closeModal();
        this.loading = false;
      },
      error: () => { this.toast.error('Erreur'); this.loading = false; }
    });
  }

  sc(s: string) {
    return {
      'badge-success': s === 'TERMINEE',
      'badge-warning': s === 'EN_ATTENTE',
      'badge-info':    s === 'CONFIRMEE',
      'badge-purple':  s === 'EN_COURS',
      'badge-danger':  s === 'ANNULEE'
    };
  }
}