import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { ClientResponse } from '../../../core/models/api.models';

@Component({
  selector: 'app-gerant-clients',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
  <div>
    <div class="page-header">
      <div>
        <div class="page-title"><div class="title-icon"><i class="fas fa-user-friends"></i></div>Clients</div>
        <div class="page-subtitle">Base clients de l'entreprise</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn btn-secondary" (click)="showArchived = !showArchived; applyFilter()"
          [style.background]="showArchived ? 'var(--accent-glow)' : ''"
          [style.border-color]="showArchived ? 'var(--accent)' : ''"
          [style.color]="showArchived ? 'var(--accent)' : ''">
          <i class="fas fa-archive"></i> {{ showArchived ? 'Masquer archivés' : 'Afficher archivés' }}
        </button>
        <button class="btn btn-primary" (click)="openModal()"><i class="fas fa-plus"></i> Nouveau client</button>
      </div>
    </div>

    <!-- FILTRE ARCHIVÉS -->
    <div class="filter-bar">
      <div class="search-input-wrap">
        <i class="fas fa-search"></i>
        <input class="form-control" placeholder="Rechercher un client..." (input)="search($event)">
      </div>

    </div>

    <div class="card">
      <div class="table-container">
        <table>
          <thead>
            <tr><th>#</th><th>Nom</th><th>Email</th><th>Téléphone</th><th>Créé par</th><th>Statut</th><th>Actions</th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let c of filtered" [class.row-archived]="c.archived">
              <td>{{ c.id }}</td>
              <td><strong>{{ c.nom }} {{ c.prenom }}</strong></td>
              <td>{{ c.email }}</td>
              <td>{{ c.numtel }}</td>
              <td><span class="badge badge-secondary">{{ c.createdBy || 'Signup' }}</span></td>
              <td>
                <span class="badge" [class.badge-success]="!c.archived" [class.badge-warning]="c.archived">
                  {{ c.archived ? 'Archivé' : 'Actif' }}
                </span>
              </td>
              <td>
                <div style="display:flex;gap:6px">
                  <button class="btn btn-info btn-sm btn-icon" (click)="openModal(c)" title="Modifier">
                    <i class="fas fa-pen"></i>
                  </button>
                  <button *ngIf="!c.archived" class="btn btn-danger btn-sm btn-icon"
                    (click)="archiver(c)" title="Archiver">
                    <i class="fas fa-archive"></i>
                  </button>
                  <button *ngIf="c.archived" class="btn btn-success btn-sm btn-icon"
                    (click)="desarchiver(c)" title="Désarchiver">
                    <i class="fas fa-undo"></i>
                  </button>
                </div>
              </td>
            </tr>
            <tr *ngIf="filtered.length === 0">
              <td colspan="7">
                <div class="empty-state"><i class="fas fa-user-friends"></i><h3>Aucun client</h3></div>
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
          <div class="modal-title"><i class="fas fa-user"></i>{{ editing ? 'Modifier' : 'Nouveau' }} client</div>
          <button class="modal-close" (click)="closeModal()"><i class="fas fa-times"></i></button>
        </div>
        <form [formGroup]="form" (ngSubmit)="save()">
          <div class="modal-body">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Nom *</label>
                <input formControlName="nom" class="form-control" [class.is-invalid]="form.get('nom')?.invalid && form.get('nom')?.touched">
              </div>
              <div class="form-group">
                <label class="form-label">Prénom *</label>
                <input formControlName="prenom" class="form-control" [class.is-invalid]="form.get('prenom')?.invalid && form.get('prenom')?.touched">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Email *</label>
              <input formControlName="email" type="email" class="form-control" [class.is-invalid]="form.get('email')?.invalid && form.get('email')?.touched">
            </div>
            <div class="form-group" *ngIf="!editing">
              <label class="form-label">Mot de passe *</label>
              <input formControlName="password" type="password" class="form-control" [class.is-invalid]="form.get('password')?.invalid && form.get('password')?.touched">
            </div>
            <div class="form-group">
              <label class="form-label">Téléphone *</label>
              <input formControlName="numtel" class="form-control" placeholder="Ex: 12345678"
                [class.is-invalid]="form.get('numtel')?.invalid && form.get('numtel')?.touched">
              <div class="form-error" *ngIf="form.get('numtel')?.errors?.['pattern'] && form.get('numtel')?.touched">
                Numéro invalide (chiffres uniquement)
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
    .filter-bar { display:flex;align-items:center;gap:16px;margin-bottom:16px; }
    .search-input-wrap { display:flex;align-items:center;gap:8px;flex:1;max-width:360px;border:1px solid var(--border);border-radius:var(--radius-md);padding:0 12px;background:var(--bg-secondary); }
    .search-input-wrap i { color:var(--text-muted); }
    .search-input-wrap .form-control { border:none;background:none;padding:9px 0; }
    .toggle-archived { display:flex;align-items:center;gap:8px;font-size:.875rem;color:var(--text-secondary);cursor:pointer;white-space:nowrap; }
    .toggle-archived input { accent-color:var(--accent); }
    .row-archived td { opacity:.6; }
    .is-invalid { border-color:var(--danger) !important; }
    .form-error { font-size:.76rem;color:var(--danger);margin-top:4px; }
  `]
})
export class GerantClientsComponent implements OnInit {
  private api   = inject(ApiService);
  private toast = inject(ToastService);
  private fb    = inject(FormBuilder);

  clients:  ClientResponse[] = [];
  filtered: ClientResponse[] = [];
  showModal    = false;
  editing: ClientResponse | null = null;
  loading      = false;
  showArchived = false;
  searchQuery  = '';

  form = this.fb.group({
    nom:      ['', Validators.required],
    prenom:   ['', Validators.required],
    email:    ['', [Validators.required, Validators.email]],
    password: [''],
    numtel:   ['', [Validators.required, Validators.pattern('^[0-9+\\s]{8,15}$')]]
  });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.api.getClients().subscribe(d => { this.clients = d; this.applyFilter(); });
  }

  search(e: Event): void {
    this.searchQuery = (e.target as HTMLInputElement).value.toLowerCase();
    this.applyFilter();
  }

  applyFilter(): void {
    const list = this.clients.filter(c => {
      const matchSearch = `${c.nom} ${c.prenom} ${c.email}`.toLowerCase().includes(this.searchQuery);
      const matchArchived = this.showArchived ? true : !c.archived;
      return matchSearch && matchArchived;
    });
    this.filtered = [...list.filter(c => !c.archived), ...list.filter(c => c.archived)];
  }

  openModal(c?: ClientResponse): void {
    this.editing = c ?? null;
    if (c) {
      this.form.get('password')?.clearValidators();
      this.form.patchValue({ nom: c.nom, prenom: c.prenom, email: c.email, numtel: c.numtel, password: '' });
    } else {
      this.form.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
      this.form.reset();
    }
    this.form.get('password')?.updateValueAndValidity();
    this.showModal = true;
  }

  closeModal(): void { this.showModal = false; this.form.reset(); this.editing = null; }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); this.toast.error('Veuillez remplir tous les champs'); return; }
    this.loading = true;
    const req = this.editing
      ? this.api.updateClient(this.editing.id, this.form.value as any)
      : this.api.createClient(this.form.value as any);
    req.subscribe({
      next: () => { this.toast.success('Client enregistré !'); this.load(); this.closeModal(); this.loading = false; },
      error: () => { this.toast.error('Erreur'); this.loading = false; }
    });
  }

  archiver(c: ClientResponse): void {
    if (!confirm(`Archiver le client "${c.nom} ${c.prenom}" ?`)) return;
    this.api.archiverClient(c.id).subscribe({
      next: () => { this.toast.success('Client archivé'); this.load(); },
      error: () => this.toast.error('Erreur')
    });
  }

  desarchiver(c: ClientResponse): void {
    this.api.desarchiverClient(c.id).subscribe({
      next: () => { this.toast.success('Client désarchivé'); this.load(); },
      error: () => this.toast.error('Erreur')
    });
  }
}