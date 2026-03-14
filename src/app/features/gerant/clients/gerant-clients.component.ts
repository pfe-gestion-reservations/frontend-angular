import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { ClientResponse } from '../../../core/models/api.models';

type ModalStep = 'tel-check' | 'result-found' | 'new-form';

const AV_COLORS = [
  '#2563eb','#16a34a','#d97706','#dc2626','#7c3aed',
  '#0284c7','#059669','#ea580c','#9333ea','#0891b2'
];

@Component({
  selector: 'app-gerant-clients',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
  <div>

    <!-- ══ HEADER ══════════════════════════════════════════════════════════ -->
    <div class="page-header">
      <div>
        <div class="page-title">
          <div class="title-icon"><i class="fas fa-user-friends"></i></div>
          Clients
        </div>
        <div class="page-subtitle">Base clients — {{ totalActifs }} actif(s), {{ totalArchives }} archivé(s)</div>
      </div>
      <div class="hdr-right">
        <div class="search-box">
          <i class="fas fa-search"></i>
          <input [(ngModel)]="searchQuery" (input)="applyFilter()" placeholder="Rechercher..." class="search-inp">
        </div>
        <button class="btn btn-secondary" (click)="showArchived=!showArchived; applyFilter()"
          [class.btn-active]="showArchived">
          <i class="fas fa-archive"></i>
          {{ showArchived ? 'Masquer archivés' : 'Archivés' }}
        </button>
        <button class="btn btn-primary" (click)="openCreate()">
          <i class="fas fa-plus"></i> Nouveau client
        </button>
      </div>
    </div>

    <!-- ══ STATS ════════════════════════════════════════════════════════════ -->
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-icon blue"><i class="fas fa-users"></i></div>
        <div>
          <div class="stat-value">{{ clients.length }}</div>
          <div class="stat-label">Total clients</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green"><i class="fas fa-user-check"></i></div>
        <div>
          <div class="stat-value">{{ totalActifs }}</div>
          <div class="stat-label">Actifs</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon amber"><i class="fas fa-user-clock"></i></div>
        <div>
          <div class="stat-value">{{ totalArchives }}</div>
          <div class="stat-label">Archivés</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon info"><i class="fas fa-phone"></i></div>
        <div>
          <div class="stat-value">{{ avecTel }}</div>
          <div class="stat-label">Avec téléphone</div>
        </div>
      </div>
    </div>

    <!-- ══ TABLE ════════════════════════════════════════════════════════════ -->
    <div class="card">
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Client</th>
              <th>Email</th>
              <th>Téléphone</th>
              <th>Créé par</th>
              <th>Statut</th>
              <th style="width:110px">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let c of filtered" [class.row-archived]="c.archived">
              <td>
                <div class="person-cell">
                  <div class="avatar" [style.background]="avColor(c)">{{ initials(c) }}</div>
                  <div>
                    <div class="person-name">{{ c.nom }} {{ c.prenom }}</div>
                    <div class="person-sub">#{{ c.id }}</div>
                  </div>
                </div>
              </td>
              <td>
                <div class="email-cell">
                  <i class="fas fa-envelope"></i>{{ c.email }}
                </div>
              </td>
              <td>
                <div class="phone-cell" *ngIf="c.numtel">
                  <i class="fas fa-phone"></i>{{ c.numtel }}
                </div>
                <span class="no-data" *ngIf="!c.numtel">—</span>
              </td>
              <td>
                <span class="source-badge" [class.source-signup]="!c.createdBy || c.createdBy==='Signup'">
                  <i class="fas" [class.fa-user-plus]="!c.createdBy||c.createdBy==='Signup'"
                    [class.fa-building]="c.createdBy && c.createdBy!=='Signup'"></i>
                  {{ c.createdBy || 'Signup' }}
                </span>
              </td>
              <td>
                <span class="badge" [class.badge-success]="!c.archived" [class.badge-warning]="c.archived">
                  <i class="fas" [class.fa-circle]="!c.archived" [class.fa-archive]="c.archived"
                    style="font-size:.55rem"></i>
                  {{ c.archived ? 'Archivé' : 'Actif' }}
                </span>
              </td>
              <td>
                <div class="row-actions">
                  <button class="btn btn-info btn-sm btn-icon" (click)="openEdit(c)" title="Modifier">
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
              <td colspan="6">
                <div class="empty-state">
                  <i class="fas fa-users-slash"></i>
                  <h3>{{ searchQuery ? 'Aucun résultat' : 'Aucun client' }}</h3>
                  <p>{{ searchQuery ? 'Essayez une autre recherche' : 'Ajoutez votre premier client via le bouton ci-dessus' }}</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ══ MODAL CRÉATION — flux téléphone ════════════════════════════════ -->
    <div class="modal-overlay" *ngIf="showModal && !editing" (click)="closeModal()">
      <div class="modal" (click)="$event.stopPropagation()">

        <div class="modal-progress" *ngIf="step !== 'tel-check'">
          <div class="mp-bar" [style.width]="step === 'result-found' ? '50%' : '80%'"></div>
        </div>

        <!-- STEP 1 : Téléphone -->
        <ng-container *ngIf="step === 'tel-check'">
          <div class="modal-header">
            <div class="modal-title"><i class="fas fa-user-plus"></i> Ajouter un client</div>
            <button class="modal-close" (click)="closeModal()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <div class="step-intro">
              <div class="step-num">1</div>
              <div>
                <div class="step-title">Vérification du numéro</div>
                <div class="step-desc">Entrez le numéro de téléphone pour savoir si un compte client existe déjà.</div>
              </div>
            </div>
            <div class="form-group" style="margin-top:20px">
              <label class="form-label">Numéro de téléphone *</label>
              <div class="tel-input-row">
                <div class="tel-flag"><i class="fas fa-phone"></i></div>
                <input [(ngModel)]="telToCheck" type="tel" class="form-control"
                  placeholder="Ex : 22 123 456"
                  (keyup.enter)="checkTelephone()" [disabled]="checking">
                <button class="btn btn-primary" (click)="checkTelephone()"
                  [disabled]="!telToCheck.trim() || checking">
                  <i class="fas fa-spinner fa-spin" *ngIf="checking"></i>
                  <i class="fas fa-search" *ngIf="!checking"></i>
                  {{ checking ? '' : 'Rechercher' }}
                </button>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeModal()">Annuler</button>
          </div>
        </ng-container>

        <!-- STEP 2 : Trouvé -->
        <ng-container *ngIf="step === 'result-found'">
          <div class="modal-header">
            <div class="modal-title" style="color:var(--success)">
              <i class="fas fa-user-check"></i> Client trouvé
            </div>
            <button class="modal-close" (click)="closeModal()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <div class="result-card green">
              <div class="rc-avatar green">
                {{ checkResult?.nom?.charAt(0) }}{{ checkResult?.prenom?.charAt(0) }}
              </div>
              <div class="rc-info">
                <div class="rc-name">{{ checkResult?.nom }} {{ checkResult?.prenom }}</div>
                <div class="rc-email">{{ checkResult?.email }}</div>
                <div class="rc-meta"><i class="fas fa-phone"></i> {{ checkResult?.numtel }}</div>
              </div>
              <span class="rc-badge green"><i class="fas fa-check-circle"></i> Compte existant</span>
            </div>
            <div class="info-box green">
              <i class="fas fa-info-circle"></i>
              Ce client a déjà un compte. Confirmez pour l'ajouter à la liste clients de votre entreprise.
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="step='tel-check'">
              <i class="fas fa-arrow-left"></i> Retour
            </button>
            <button class="btn btn-primary" (click)="associerClientExistant()" [disabled]="loading">
              <i class="fas fa-spinner fa-spin" *ngIf="loading"></i>
              <i class="fas fa-link" *ngIf="!loading"></i>
              {{ loading ? 'Ajout...' : 'Confirmer l\'ajout' }}
            </button>
          </div>
        </ng-container>

        <!-- STEP 3 : Nouveau -->
        <ng-container *ngIf="step === 'new-form'">
          <div class="modal-header">
            <div class="modal-title"><i class="fas fa-user-plus"></i> Nouveau client</div>
            <button class="modal-close" (click)="closeModal()"><i class="fas fa-times"></i></button>
          </div>
          <form [formGroup]="form" (ngSubmit)="save()">
            <div class="modal-body">
              <div class="new-account-hint">
                <div class="nah-icon"><i class="fas fa-user-plus"></i></div>
                <div>Aucun compte pour le <strong>{{ telToCheck }}</strong>. Créez un nouveau profil client.</div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Nom *</label>
                  <input formControlName="nom" class="form-control"
                    [class.is-invalid]="form.get('nom')?.invalid && form.get('nom')?.touched">
                </div>
                <div class="form-group">
                  <label class="form-label">Prénom *</label>
                  <input formControlName="prenom" class="form-control"
                    [class.is-invalid]="form.get('prenom')?.invalid && form.get('prenom')?.touched">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Email *</label>
                <input formControlName="email" type="email" class="form-control"
                  [class.is-invalid]="form.get('email')?.invalid && form.get('email')?.touched">
              </div>
              <div class="form-group">
                <label class="form-label">Mot de passe *</label>
                <input formControlName="password" type="password" class="form-control"
                  placeholder="Min. 6 caractères">
              </div>
              <div class="form-group">
                <label class="form-label">Téléphone</label>
                <input formControlName="numtel" class="form-control" [readonly]="true">
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" (click)="step='tel-check'">
                <i class="fas fa-arrow-left"></i> Retour
              </button>
              <button type="submit" class="btn btn-primary" [disabled]="loading">
                <i class="fas fa-spinner fa-spin" *ngIf="loading"></i>
                <i class="fas fa-save" *ngIf="!loading"></i>
                {{ loading ? 'Création...' : 'Créer le client' }}
              </button>
            </div>
          </form>
        </ng-container>

      </div>
    </div>

    <!-- ══ MODAL ÉDITION ════════════════════════════════════════════════════ -->
    <div class="modal-overlay" *ngIf="showModal && editing" (click)="closeModal()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="modal-title"><i class="fas fa-user-edit"></i> Modifier le client</div>
          <button class="modal-close" (click)="closeModal()"><i class="fas fa-times"></i></button>
        </div>
        <form [formGroup]="form" (ngSubmit)="save()">
          <div class="modal-body">
            <div class="edit-profile">
              <div class="avatar lg" [style.background]="avColor(editing)">{{ initials(editing) }}</div>
              <div>
                <div class="ep-name">{{ editing.nom }} {{ editing.prenom }}</div>
                <div class="ep-email">{{ editing.email }}</div>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Nom *</label>
                <input formControlName="nom" class="form-control">
              </div>
              <div class="form-group">
                <label class="form-label">Prénom *</label>
                <input formControlName="prenom" class="form-control">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Email</label>
              <input formControlName="email" type="email" class="form-control">
            </div>
            <div class="form-group">
              <label class="form-label">Téléphone *</label>
              <input formControlName="numtel" class="form-control">
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="closeModal()">Annuler</button>
            <button type="submit" class="btn btn-primary" [disabled]="loading">
              <i class="fas fa-spinner fa-spin" *ngIf="loading"></i>
              <i class="fas fa-save" *ngIf="!loading"></i>
              {{ loading ? 'Enregistrement...' : 'Enregistrer' }}
            </button>
          </div>
        </form>
      </div>
    </div>

  </div>`,

  styles: [`
    .hdr-right { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    .search-box { display:flex; align-items:center; gap:8px; border:1px solid var(--border-md); border-radius:var(--radius-md); padding:0 12px; background:var(--white); transition:border-color .15s, box-shadow .15s; }
    .search-box:focus-within { border-color:var(--primary); box-shadow:var(--shadow-accent); }
    .search-box i { color:var(--text-muted); font-size:.82rem; }
    .search-inp { border:none; background:none; padding:9px 0; font-size:.875rem; color:var(--text-primary); outline:none; width:190px; }
    .btn-active { border-color:var(--primary) !important; color:var(--primary) !important; background:var(--blue-50) !important; }

    .person-cell { display:flex; align-items:center; gap:10px; }
    .avatar { width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:.75rem; font-weight:700; color:white; flex-shrink:0; }
    .avatar.lg { width:48px; height:48px; font-size:.95rem; }
    .person-name { font-weight:600; font-size:.875rem; color:var(--text-primary); }
    .person-sub  { font-size:.72rem; color:var(--text-muted); }
    .email-cell  { display:flex; align-items:center; gap:6px; color:var(--text-secondary); font-size:.875rem; }
    .email-cell i { color:var(--text-muted); font-size:.72rem; }
    .phone-cell  { display:flex; align-items:center; gap:6px; color:var(--text-secondary); font-size:.875rem; }
    .phone-cell i { color:var(--text-muted); font-size:.72rem; }
    .source-badge { display:inline-flex; align-items:center; gap:4px; font-size:.73rem; font-weight:500; color:var(--text-secondary); background:var(--gray-100); border-radius:20px; padding:2px 8px; }
    .source-signup { background:var(--blue-50); color:var(--blue-700); }
    .no-data { color:var(--text-muted); font-size:.82rem; }
    .row-actions { display:flex; gap:5px; }
    .row-archived td { opacity:.55; }

    .modal-progress { height:3px; background:var(--gray-100); border-radius:var(--radius-xl) var(--radius-xl) 0 0; overflow:hidden; }
    .mp-bar { height:100%; background:var(--primary); transition:width .3s ease; }

    .step-intro { display:flex; align-items:flex-start; gap:12px; }
    .step-num { width:28px; height:28px; border-radius:50%; background:var(--primary); color:white; display:flex; align-items:center; justify-content:center; font-size:.78rem; font-weight:700; flex-shrink:0; }
    .step-title { font-weight:600; font-size:.9rem; color:var(--text-primary); }
    .step-desc  { font-size:.82rem; color:var(--text-secondary); margin-top:2px; line-height:1.5; }

    .tel-input-row { display:flex; gap:8px; align-items:center; }
    .tel-flag { width:42px; height:40px; background:var(--gray-50); border:1px solid var(--border-md); border-radius:var(--radius-md); display:flex; align-items:center; justify-content:center; color:var(--text-muted); flex-shrink:0; }
    .tel-input-row .form-control { flex:1; }

    .result-card { display:flex; align-items:center; gap:14px; border-radius:var(--radius-lg); padding:16px; border:1.5px solid; margin-bottom:14px; }
    .result-card.green { background:#f0fdf4; border-color:#bbf7d0; }
    .rc-avatar { width:46px; height:46px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:1rem; flex-shrink:0; color:white; }
    .rc-avatar.green { background:var(--success); }
    .rc-info { flex:1; }
    .rc-name  { font-weight:600; font-size:.95rem; color:var(--text-primary); }
    .rc-email { font-size:.8rem; color:var(--text-secondary); margin-top:2px; }
    .rc-meta  { font-size:.78rem; color:var(--text-muted); margin-top:3px; display:flex; align-items:center; gap:4px; }
    .rc-badge { display:inline-flex; align-items:center; gap:5px; padding:4px 10px; border-radius:20px; font-size:.75rem; font-weight:600; white-space:nowrap; flex-shrink:0; }
    .rc-badge.green { background:#dcfce7; color:var(--success); }

    .info-box { display:flex; align-items:flex-start; gap:10px; border-radius:var(--radius-md); padding:12px 14px; font-size:.84rem; line-height:1.6; color:var(--text-secondary); }
    .info-box i { flex-shrink:0; margin-top:2px; }
    .info-box.green { background:#f0fdf4; color:#15803d; }
    .info-box.green i { color:var(--success); }

    .new-account-hint { display:flex; align-items:center; gap:12px; background:var(--blue-50); border:1px solid var(--blue-200); border-radius:var(--radius-md); padding:12px 14px; font-size:.84rem; color:var(--blue-700); margin-bottom:20px; }
    .nah-icon { color:var(--primary); font-size:1.1rem; flex-shrink:0; }

    .edit-profile { display:flex; align-items:center; gap:14px; background:var(--gray-50); border:1px solid var(--border); border-radius:var(--radius-md); padding:14px 16px; margin-bottom:20px; }
    .ep-name  { font-weight:600; font-size:.95rem; color:var(--text-primary); }
    .ep-email { font-size:.8rem; color:var(--text-muted); margin-top:2px; }

    .is-invalid { border-color:var(--danger) !important; box-shadow:0 0 0 3px rgba(220,38,38,.08) !important; }
    .stat-value { font-size:1.5rem; font-weight:700; color:var(--text-primary); }
    .stat-label { font-size:.72rem; color:var(--text-secondary); text-transform:uppercase; letter-spacing:.04em; margin-top:1px; }
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

  step: ModalStep  = 'tel-check';
  telToCheck       = '';
  checking         = false;
  checkResult: any = null;

  form = this.fb.group({
    nom:      ['', Validators.required],
    prenom:   ['', Validators.required],
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    numtel:   ['', Validators.required]
  });

  get totalActifs()   { return this.clients.filter(c => !c.archived).length; }
  get totalArchives() { return this.clients.filter(c =>  c.archived).length; }
  get avecTel()       { return this.clients.filter(c => !!c.numtel).length; }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.api.getClients().subscribe(d => { this.clients = d; this.applyFilter(); });
  }

  applyFilter(): void {
    const q = this.searchQuery.toLowerCase();
    this.filtered = this.clients.filter(c => {
      const ms = !q || `${c.nom} ${c.prenom} ${c.email} ${c.numtel}`.toLowerCase().includes(q);
      return ms && (this.showArchived ? true : !c.archived);
    });
  }

  initials(c: ClientResponse) { return `${c.nom?.charAt(0)??''}${c.prenom?.charAt(0)??''}`.toUpperCase(); }
  avColor(c: ClientResponse)  { return AV_COLORS[(c.id || 0) % AV_COLORS.length]; }

  openCreate(): void {
    this.editing = null; this.step = 'tel-check';
    this.telToCheck = ''; this.checkResult = null; this.form.reset();
    this.form.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
    this.form.get('password')?.updateValueAndValidity();
    this.showModal = true;
  }

  openEdit(c: ClientResponse): void {
    this.editing = c;
    this.form.get('password')?.clearValidators();
    this.form.get('password')?.updateValueAndValidity();
    this.form.patchValue({ nom:c.nom, prenom:c.prenom, email:c.email, numtel:c.numtel });
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false; this.editing = null;
    this.form.reset(); this.telToCheck = ''; this.checkResult = null;
  }

  checkTelephone(): void {
    if (!this.telToCheck.trim()) return;
    this.checking = true;
    this.api.getClientByTelephone(this.telToCheck.trim()).subscribe({
      next: (res: any) => {
        this.checking = false; this.checkResult = res;
        if (res.status === 'FOUND') {
          this.step = 'result-found';
        } else {
          this.form.patchValue({ numtel: this.telToCheck.trim() });
          this.step = 'new-form';
        }
      },
      error: () => { this.checking = false; this.toast.error('Erreur lors de la recherche'); }
    });
  }

  associerClientExistant(): void {
    if (!this.checkResult) return;
    this.loading = true;
    this.api.createClient({ numtel: this.checkResult.numtel } as any).subscribe({
      next: () => {
        this.toast.success(`${this.checkResult.nom} ${this.checkResult.prenom} ajouté !`);
        this.load(); this.closeModal(); this.loading = false;
      },
      error: (err: any) => { this.toast.error(err?.error?.message||'Erreur'); this.loading = false; }
    });
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true;
    const obs = this.editing
      ? this.api.updateClient(this.editing.id, this.form.value as any)
      : this.api.createClient(this.form.value as any);
    obs.subscribe({
      next: () => {
        this.toast.success(this.editing ? 'Client modifié !' : 'Client créé !');
        this.load(); this.closeModal(); this.loading = false;
      },
      error: (err: any) => { this.toast.error(err?.error?.message||'Erreur'); this.loading = false; }
    });
  }

  archiver(c: ClientResponse): void {
    if (!confirm(`Archiver ${c.nom} ${c.prenom} ?`)) return;
    this.api.archiverClient(c.id).subscribe({ next:()=>{ this.toast.success('Archivé'); this.load(); }, error:()=>this.toast.error('Erreur') });
  }
  desarchiver(c: ClientResponse): void {
    this.api.desarchiverClient(c.id).subscribe({ next:()=>{ this.toast.success('Désarchivé'); this.load(); }, error:()=>this.toast.error('Erreur') });
  }
}