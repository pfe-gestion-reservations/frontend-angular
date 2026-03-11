import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { EmployeResponse } from '../../../core/models/api.models';

@Component({
  selector: 'app-gerant-employes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
  <div>
    <div class="page-header">
      <div>
        <div class="page-title"><div class="title-icon"><i class="fas fa-users"></i></div>Employés</div>
        <div class="page-subtitle">Gestion de votre équipe</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn btn-secondary" (click)="showArchived = !showArchived; applyFilter()"
          [style.background]="showArchived ? 'var(--accent-glow)' : ''"
          [style.border-color]="showArchived ? 'var(--accent)' : ''"
          [style.color]="showArchived ? 'var(--accent)' : ''">
          <i class="fas fa-archive"></i> {{ showArchived ? 'Masquer archivés' : 'Afficher archivés' }}
        </button>
        <button class="btn btn-primary" (click)="openModal()"><i class="fas fa-plus"></i> Nouvel employé</button>
      </div>
    </div>

    <!-- FILTRE -->
    <div class="filter-bar">
      <div class="search-input-wrap">
        <i class="fas fa-search"></i>
        <input class="form-control" placeholder="Rechercher un employé..." (input)="search($event)">
      </div>

    </div>

    <div class="card">
      <div class="table-container">
        <table>
          <thead>
            <tr><th>#</th><th>Nom</th><th>Email</th><th>Spécialité</th><th>Statut</th><th>Actions</th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let e of filtered" [class.row-archived]="e.archived">
              <td>{{ e.id }}</td>
              <td><strong>{{ e.nom }} {{ e.prenom }}</strong></td>
              <td>{{ e.email }}</td>
              <td>{{ e.specialite || '—' }}</td>
              <td>
                <span class="badge" [class.badge-success]="!e.archived" [class.badge-warning]="e.archived">
                  {{ e.archived ? 'Archivé' : 'Actif' }}
                </span>
              </td>
              <td>
                <div style="display:flex;gap:6px">
                  <button class="btn btn-info btn-sm btn-icon" (click)="openModal(e)" title="Modifier">
                    <i class="fas fa-pen"></i>
                  </button>
                  <button *ngIf="!e.archived" class="btn btn-danger btn-sm btn-icon"
                    (click)="archiver(e)" title="Archiver">
                    <i class="fas fa-archive"></i>
                  </button>
                  <button *ngIf="e.archived" class="btn btn-success btn-sm btn-icon"
                    (click)="desarchiver(e)" title="Désarchiver">
                    <i class="fas fa-undo"></i>
                  </button>
                </div>
              </td>
            </tr>
            <tr *ngIf="filtered.length === 0">
              <td colspan="6">
                <div class="empty-state"><i class="fas fa-users"></i><h3>Aucun employé</h3></div>
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
          <div class="modal-title"><i class="fas fa-user"></i>{{ editing ? 'Modifier' : 'Nouvel' }} employé</div>
          <button class="modal-close" (click)="closeModal()"><i class="fas fa-times"></i></button>
        </div>
        <form [formGroup]="form" (ngSubmit)="save()">
          <div class="modal-body">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Nom *</label>
                <input formControlName="nom" class="form-control" placeholder="Dupont">
              </div>
              <div class="form-group">
                <label class="form-label">Prénom *</label>
                <input formControlName="prenom" class="form-control" placeholder="Marie">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Email *</label>
              <input formControlName="email" type="email" class="form-control">
            </div>
            <div class="form-group" *ngIf="!editing">
              <label class="form-label">Mot de passe *</label>
              <input formControlName="password" type="password" class="form-control" placeholder="••••••••">
            </div>
            <div class="form-group">
              <label class="form-label">Spécialité</label>
              <input formControlName="specialite" class="form-control" placeholder="Secrétaire, Accueil...">
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
  `]
})
export class GerantEmployesComponent implements OnInit {
  private api   = inject(ApiService);
  private toast = inject(ToastService);
  private fb    = inject(FormBuilder);

  employes: EmployeResponse[] = [];
  filtered: EmployeResponse[] = [];
  showModal    = false;
  editing: EmployeResponse | null = null;
  loading      = false;
  showArchived = false;
  searchQuery  = '';

  form = this.fb.group({
    nom:       ['', Validators.required],
    prenom:    ['', Validators.required],
    email:     ['', [Validators.required, Validators.email]],
    password:  [''],
    specialite:['']
  });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.api.getEmployes().subscribe(d => { this.employes = d; this.applyFilter(); });
  }

  search(e: Event): void {
    this.searchQuery = (e.target as HTMLInputElement).value.toLowerCase();
    this.applyFilter();
  }

  applyFilter(): void {
    const list = this.employes.filter(e => {
      const matchSearch = `${e.nom} ${e.prenom} ${e.email}`.toLowerCase().includes(this.searchQuery);
      const matchArchived = this.showArchived ? true : !e.archived;
      return matchSearch && matchArchived;
    });
    this.filtered = [...list.filter(e => !e.archived), ...list.filter(e => e.archived)];
  }

  openModal(e?: EmployeResponse): void {
    this.editing = e ?? null;
    if (e) {
      this.form.get('password')?.clearValidators();
      this.form.patchValue({ nom: e.nom, prenom: e.prenom, email: e.email, specialite: e.specialite });
    } else {
      this.form.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
      this.form.reset();
    }
    this.form.get('password')?.updateValueAndValidity();
    this.showModal = true;
  }

  closeModal(): void { this.showModal = false; this.form.reset(); this.editing = null; }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true;
    const req = this.editing
      ? this.api.updateEmploye(this.editing.id, this.form.value as any)
      : this.api.createEmploye(this.form.value as any);
    req.subscribe({
      next: () => { this.toast.success('Employé enregistré !'); this.load(); this.closeModal(); this.loading = false; },
      error: () => { this.toast.error('Erreur'); this.loading = false; }
    });
  }

  archiver(e: EmployeResponse): void {
    if (!confirm(`Archiver l'employé "${e.nom} ${e.prenom}" ?`)) return;
    this.api.archiverEmploye(e.id).subscribe({
      next: () => { this.toast.success('Employé archivé'); this.load(); },
      error: () => this.toast.error('Erreur')
    });
  }

  desarchiver(e: EmployeResponse): void {
    this.api.desarchiverEmploye(e.id).subscribe({
      next: () => { this.toast.success('Employé désarchivé'); this.load(); },
      error: () => this.toast.error('Erreur')
    });
  }
}