import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { ClientResponse } from '../../../core/models/api.models';

@Component({
  selector: 'app-employe-clients',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
  <div>
    <div class="page-header">
      <div>
        <div class="page-title"><div class="title-icon"><i class="fas fa-user-friends"></i></div>Clients</div>
        <div class="page-subtitle">Tous les clients de l'entreprise</div>
      </div>
      <button class="btn btn-primary" (click)="openModal()"><i class="fas fa-plus"></i> Nouveau client</button>
    </div>
    <div class="card">
      <div class="table-container">
        <table>
          <thead><tr><th>#</th><th>Nom</th><th>Email</th><th>Téléphone</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            <tr *ngFor="let c of clients">
              <td>{{ c.id }}</td>
              <td><strong>{{ c.nom }} {{ c.prenom }}</strong></td>
              <td>{{ c.email }}</td>
              <td>{{ c.numtel }}</td>
              <td><span class="badge" [class.badge-success]="c.archived" [class.badge-danger]="!c.archived">{{ c.archived ? 'Actif' : 'Archivé' }}</span></td>
              <td><button class="btn btn-info btn-sm btn-icon" (click)="openModal(c)"><i class="fas fa-pen"></i></button></td>
            </tr>
            <tr *ngIf="clients.length === 0">
              <td colspan="6"><div class="empty-state"><i class="fas fa-user-friends"></i><h3>Aucun client</h3></div></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

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
                <label class="form-label" for="ecNom">Nom</label>
                <input id="ecNom" name="ecNom" formControlName="nom" class="form-control" [class.is-invalid]="form.get('nom')?.invalid && form.get('nom')?.touched">
              </div>
              <div class="form-group">
                <label class="form-label" for="ecPrenom">Prénom</label>
                <input id="ecPrenom" name="ecPrenom" formControlName="prenom" class="form-control" [class.is-invalid]="form.get('prenom')?.invalid && form.get('prenom')?.touched">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="ecEmail">Email</label>
              <input id="ecEmail" name="ecEmail" formControlName="email" type="email" class="form-control" [class.is-invalid]="form.get('email')?.invalid && form.get('email')?.touched">
            </div>
            <div class="form-group" *ngIf="!editing">
              <label class="form-label" for="ecPassword">Mot de passe</label>
              <input id="ecPassword" name="ecPassword" formControlName="password" type="password" class="form-control" [class.is-invalid]="form.get('password')?.invalid && form.get('password')?.touched">
            </div>
            <div class="form-group">
              <label class="form-label" for="ecNumtel">Téléphone</label>
              <input id="ecNumtel" name="ecNumtel" formControlName="numtel" class="form-control" placeholder="Ex: 12345678" [class.is-invalid]="form.get('numtel')?.invalid && form.get('numtel')?.touched">
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
    .is-invalid { border-color: var(--danger) !important; }
    .form-error { font-size: .76rem; color: var(--danger); margin-top: 4px; }
  `]
})
export class EmployeClientsComponent implements OnInit {
  private api   = inject(ApiService);
  private toast = inject(ToastService);
  private fb    = inject(FormBuilder);

  clients: ClientResponse[] = [];
  showModal = false;
  editing: ClientResponse | null = null;
  loading = false;

  form = this.fb.group({
    nom:      ['', Validators.required],
    prenom:   ['', Validators.required],
    email:    ['', [Validators.required, Validators.email]],
    password: [''],
    numtel:   ['', [Validators.required, Validators.pattern('^[0-9+\\s]{8,15}$')]]
  });

  ngOnInit(): void {
    this.api.getClients().subscribe(d => this.clients = d);
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

  closeModal(): void {
    this.showModal = false;
    this.form.reset();
    this.editing = null;
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    this.loading = true;
    const req = this.editing
      ? this.api.updateClient(this.editing.id, this.form.value as any)
      : this.api.createClient(this.form.value as any);
    req.subscribe({
      next: () => {
        this.toast.success('Client enregistré !');
        this.api.getClients().subscribe(d => this.clients = d);
        this.closeModal();
        this.loading = false;
      },
      error: () => { this.toast.error('Erreur lors de l\'enregistrement'); this.loading = false; }
    });
  }
}