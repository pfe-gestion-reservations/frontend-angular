import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { EmployeResponse } from '../../../core/models/api.models';

type ModalStep = 'email-check' | 'result-free' | 'result-busy' | 'result-already' | 'new-form';

const AV_COLORS = [
  '#2563eb','#16a34a','#d97706','#dc2626','#7c3aed',
  '#0284c7','#059669','#ea580c','#9333ea','#0891b2'
];

@Component({
  selector: 'app-gerant-employes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
  <div>

    <!-- ══ HEADER ══════════════════════════════════════════════════════════ -->
    <div class="page-header">
      <div>
        <div class="page-title">
          <div class="title-icon"><i class="fas fa-users-cog"></i></div>
          Employés
        </div>
        <div class="page-subtitle">Gérez votre équipe — {{ totalActifs }} actif(s), {{ totalArchives }} archivé(s)</div>
      </div>
      <div class="hdr-right">
        <div class="search-box">
          <i class="fas fa-search"></i>
          <input [(ngModel)]="searchQuery" (input)="applyFilter()" placeholder="Rechercher..." class="search-inp">
        </div>
        <button class="btn btn-secondary" (click)="showArchived=!showArchived; applyFilter()"
          [class.btn-active]="showArchived">
          <i class="fas fa-archive"></i>
          {{ showArchived ? 'Masquer archivés' : 'Archivés ({{ totalArchives }})' }}
        </button>
        <button class="btn btn-primary" (click)="openCreate()">
          <i class="fas fa-plus"></i> Nouvel employé
        </button>
      </div>
    </div>

    <!-- ══ STATS CARDS ══════════════════════════════════════════════════════ -->
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-icon blue"><i class="fas fa-users"></i></div>
        <div>
          <div class="stat-value">{{ employes.length }}</div>
          <div class="stat-label">Total employés</div>
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
        <div class="stat-icon purple"><i class="fas fa-star"></i></div>
        <div>
          <div class="stat-value">{{ totalSpecialistes }}</div>
          <div class="stat-label">Spécialistes</div>
        </div>
      </div>
    </div>

    <!-- ══ TABLE ══════════════════════════════════════════════════════════ -->
    <div class="card">
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Employé</th>
              <th>Email</th>
              <th>Spécialité</th>
              <th>Statut</th>
              <th style="width:110px">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let e of filtered" [class.row-archived]="e.archived">
              <td>
                <div class="person-cell">
                  <div class="avatar" [style.background]="avColor(e)">{{ initials(e) }}</div>
                  <div>
                    <div class="person-name">{{ e.nom }} {{ e.prenom }}</div>
                    <div class="person-sub">#{{ e.id }}</div>
                  </div>
                </div>
              </td>
              <td>
                <div class="email-cell">
                  <i class="fas fa-envelope"></i>{{ e.email }}
                </div>
              </td>
              <td>
                <span class="specialite-pill" *ngIf="e.specialite">
                  <i class="fas fa-star"></i> {{ e.specialite }}
                </span>
                <span class="no-data" *ngIf="!e.specialite">—</span>
              </td>
              <td>
                <span class="badge" [class.badge-success]="!e.archived" [class.badge-warning]="e.archived">
                  <i class="fas" [class.fa-circle]="!e.archived" [class.fa-archive]="e.archived"
                    style="font-size:.55rem"></i>
                  {{ e.archived ? 'Archivé' : 'Actif' }}
                </span>
              </td>
              <td>
                <div class="row-actions">
                  <button class="btn btn-info btn-sm btn-icon" (click)="openEdit(e)" title="Modifier">
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
              <td colspan="5">
                <div class="empty-state">
                  <i class="fas fa-users-slash"></i>
                  <h3>{{ searchQuery ? 'Aucun résultat' : 'Aucun employé' }}</h3>
                  <p>{{ searchQuery ? 'Essayez une autre recherche' : 'Ajoutez votre premier employé via le bouton ci-dessus' }}</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ══ MODAL CRÉATION — flux email ════════════════════════════════════ -->
    <div class="modal-overlay" *ngIf="showModal && !editing" (click)="closeModal()">
      <div class="modal" (click)="$event.stopPropagation()">

        <!-- Indicateur de progression -->
        <div class="modal-progress" *ngIf="step !== 'email-check'">
          <div class="mp-bar" [style.width]="progressWidth()"></div>
        </div>

        <!-- ── STEP 1 : Email ── -->
        <ng-container *ngIf="step === 'email-check'">
          <div class="modal-header">
            <div class="modal-title"><i class="fas fa-user-plus"></i> Ajouter un employé</div>
            <button class="modal-close" (click)="closeModal()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <div class="step-intro">
              <div class="step-num">1</div>
              <div>
                <div class="step-title">Vérification du compte</div>
                <div class="step-desc">Entrez l'email pour savoir si un compte existe déjà dans le système.</div>
              </div>
            </div>
            <div class="form-group" style="margin-top:20px">
              <label class="form-label">Adresse email *</label>
              <div class="input-icon-wrap">
                <i class="fas fa-envelope iw-icon"></i>
                <input [(ngModel)]="emailToCheck" type="email" class="form-control iw-input"
                  placeholder="employe@exemple.com"
                  (keyup.enter)="checkEmail()"
                  [disabled]="checking">
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeModal()">Annuler</button>
            <button class="btn btn-primary" (click)="checkEmail()"
              [disabled]="!emailToCheck.trim() || checking">
              <i class="fas fa-spinner fa-spin" *ngIf="checking"></i>
              <i class="fas fa-search" *ngIf="!checking"></i>
              {{ checking ? 'Vérification...' : 'Vérifier' }}
            </button>
          </div>
        </ng-container>

        <!-- ── STEP 2a : FREE ── -->
        <ng-container *ngIf="step === 'result-free'">
          <div class="modal-header">
            <div class="modal-title" style="color:var(--success)">
              <i class="fas fa-user-check"></i> Compte disponible
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
                <div class="rc-meta" *ngIf="checkResult?.specialite">
                  <i class="fas fa-star"></i> {{ checkResult?.specialite }}
                </div>
              </div>
              <span class="rc-badge green"><i class="fas fa-check-circle"></i> Disponible</span>
            </div>
            <div class="info-box green">
              <i class="fas fa-info-circle"></i>
              Cet employé a déjà un compte et est <strong>libre</strong>. Vous pouvez l'associer directement à votre entreprise.
            </div>
            <div class="form-group" style="margin-top:16px">
              <label class="form-label">Spécialité <span class="opt-label">(optionnel)</span></label>
              <input [(ngModel)]="specialiteOverride" class="form-control"
                placeholder="Ex : Accueil, Caissier...">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="step='email-check'">
              <i class="fas fa-arrow-left"></i> Retour
            </button>
            <button class="btn btn-primary" (click)="associerEmployeLibre()" [disabled]="loading">
              <i class="fas fa-spinner fa-spin" *ngIf="loading"></i>
              <i class="fas fa-link" *ngIf="!loading"></i>
              {{ loading ? 'Association...' : 'Associer à mon entreprise' }}
            </button>
          </div>
        </ng-container>

        <!-- ── STEP 2b : BUSY ── -->
        <ng-container *ngIf="step === 'result-busy'">
          <div class="modal-header">
            <div class="modal-title" style="color:var(--warning)">
              <i class="fas fa-user-lock"></i> Employé non disponible
            </div>
            <button class="modal-close" (click)="closeModal()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <div class="result-card amber">
              <div class="rc-avatar amber">
                {{ checkResult?.nom?.charAt(0) }}{{ checkResult?.prenom?.charAt(0) }}
              </div>
              <div class="rc-info">
                <div class="rc-name">{{ checkResult?.nom }} {{ checkResult?.prenom }}</div>
                <div class="rc-email">{{ checkResult?.email }}</div>
              </div>
              <span class="rc-badge amber"><i class="fas fa-lock"></i> Occupé</span>
            </div>
            <div class="info-box amber">
              <i class="fas fa-exclamation-triangle"></i>
              Cet employé est déjà rattaché à l'entreprise <strong>« {{ checkResult?.entrepriseNom }} »</strong>.
              Un employé ne peut appartenir qu'à une seule entreprise à la fois.
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="step='email-check'">
              <i class="fas fa-arrow-left"></i> Retour
            </button>
            <button class="btn btn-secondary" (click)="closeModal()">Fermer</button>
          </div>
        </ng-container>

        <!-- ── STEP 2c : ALREADY ── -->
        <ng-container *ngIf="step === 'result-already'">
          <div class="modal-header">
            <div class="modal-title" style="color:var(--primary)">
              <i class="fas fa-info-circle"></i> Déjà dans votre équipe
            </div>
            <button class="modal-close" (click)="closeModal()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <div class="result-card blue">
              <div class="rc-avatar blue">
                {{ checkResult?.nom?.charAt(0) }}{{ checkResult?.prenom?.charAt(0) }}
              </div>
              <div class="rc-info">
                <div class="rc-name">{{ checkResult?.nom }} {{ checkResult?.prenom }}</div>
                <div class="rc-email">{{ checkResult?.email }}</div>
              </div>
              <span class="rc-badge blue"><i class="fas fa-building"></i> Votre équipe</span>
            </div>
            <div class="info-box blue">
              <i class="fas fa-users"></i>
              Cet employé fait <strong>déjà partie de votre entreprise</strong>. Retrouvez-le dans la liste.
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="step='email-check'">
              <i class="fas fa-arrow-left"></i> Retour
            </button>
            <button class="btn btn-secondary" (click)="closeModal()">Fermer</button>
          </div>
        </ng-container>

        <!-- ── STEP 3 : Nouveau ── -->
        <ng-container *ngIf="step === 'new-form'">
          <div class="modal-header">
            <div class="modal-title"><i class="fas fa-user-plus"></i> Créer un nouvel employé</div>
            <button class="modal-close" (click)="closeModal()"><i class="fas fa-times"></i></button>
          </div>
          <form [formGroup]="form" (ngSubmit)="save()">
            <div class="modal-body">
              <div class="new-account-hint">
                <div class="nah-icon"><i class="fas fa-user-plus"></i></div>
                <div>
                  Aucun compte trouvé pour <strong>{{ emailToCheck }}</strong>.
                  Créez un nouveau profil employé.
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Nom *</label>
                  <input formControlName="nom" class="form-control"
                    [class.is-invalid]="form.get('nom')?.invalid && form.get('nom')?.touched"
                    placeholder="Dupont">
                </div>
                <div class="form-group">
                  <label class="form-label">Prénom *</label>
                  <input formControlName="prenom" class="form-control"
                    [class.is-invalid]="form.get('prenom')?.invalid && form.get('prenom')?.touched"
                    placeholder="Jean">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Email</label>
                <input formControlName="email" type="email" class="form-control" [readonly]="true">
              </div>
              <div class="form-group">
                <label class="form-label">Mot de passe *</label>
                <input formControlName="password" type="password" class="form-control"
                  placeholder="Min. 6 caractères"
                  [class.is-invalid]="form.get('password')?.invalid && form.get('password')?.touched">
              </div>
              <div class="form-group">
                <label class="form-label">Spécialité <span class="opt-label">(optionnel)</span></label>
                <input formControlName="specialite" class="form-control"
                  placeholder="Ex : Coiffure, Massage...">
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" (click)="step='email-check'">
                <i class="fas fa-arrow-left"></i> Retour
              </button>
              <button type="submit" class="btn btn-primary" [disabled]="loading">
                <i class="fas fa-spinner fa-spin" *ngIf="loading"></i>
                <i class="fas fa-save" *ngIf="!loading"></i>
                {{ loading ? 'Création...' : 'Créer l\'employé' }}
              </button>
            </div>
          </form>
        </ng-container>

      </div>
    </div>

    <!-- ══ MODAL ÉDITION ══════════════════════════════════════════════════ -->
    <div class="modal-overlay" *ngIf="showModal && editing" (click)="closeModal()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="modal-title"><i class="fas fa-user-edit"></i> Modifier l'employé</div>
          <button class="modal-close" (click)="closeModal()"><i class="fas fa-times"></i></button>
        </div>
        <form [formGroup]="form" (ngSubmit)="save()">
          <div class="modal-body">
            <!-- Mini profil de l'employé édité -->
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
              <label class="form-label">Email *</label>
              <input formControlName="email" type="email" class="form-control">
            </div>
            <div class="form-group">
              <label class="form-label">Spécialité <span class="opt-label">(optionnel)</span></label>
              <input formControlName="specialite" class="form-control">
            </div>
            <div class="form-group">
              <label class="form-label">
                Nouveau mot de passe
                <span class="opt-label">(laisser vide pour ne pas changer)</span>
              </label>
              <input formControlName="password" type="password" class="form-control"
                placeholder="Nouveau mot de passe...">
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
    /* ── Toolbar ── */
    .hdr-right { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    .search-box {
      display:flex; align-items:center; gap:8px;
      border:1px solid var(--border-md); border-radius:var(--radius-md);
      padding:0 12px; background:var(--white);
      transition:border-color .15s, box-shadow .15s;
    }
    .search-box:focus-within { border-color:var(--primary); box-shadow:var(--shadow-accent); }
    .search-box i { color:var(--text-muted); font-size:.82rem; }
    .search-inp { border:none; background:none; padding:9px 0; font-size:.875rem;
      color:var(--text-primary); outline:none; width:190px; }
    .btn-active { border-color:var(--primary) !important; color:var(--primary) !important; background:var(--blue-50) !important; }

    /* ── Table ── */
    .person-cell { display:flex; align-items:center; gap:10px; }
    .avatar {
      width:36px; height:36px; border-radius:50%;
      display:flex; align-items:center; justify-content:center;
      font-size:.75rem; font-weight:700; color:white; flex-shrink:0;
    }
    .avatar.lg { width:48px; height:48px; font-size:.95rem; }
    .person-name { font-weight:600; font-size:.875rem; color:var(--text-primary); }
    .person-sub  { font-size:.72rem; color:var(--text-muted); }
    .email-cell  { display:flex; align-items:center; gap:6px; color:var(--text-secondary); font-size:.875rem; }
    .email-cell i { color:var(--text-muted); font-size:.72rem; }
    .specialite-pill {
      display:inline-flex; align-items:center; gap:4px;
      background:var(--purple-bg); color:var(--purple);
      border-radius:20px; padding:2px 10px; font-size:.73rem; font-weight:600;
    }
    .specialite-pill i { font-size:.62rem; }
    .no-data { color:var(--text-muted); font-size:.82rem; }
    .row-actions { display:flex; gap:5px; }
    .row-archived td { opacity:.55; }

    /* ── Modal progress bar ── */
    .modal-progress { height:3px; background:var(--gray-100); border-radius:var(--radius-xl) var(--radius-xl) 0 0; overflow:hidden; }
    .mp-bar { height:100%; background:var(--primary); transition:width .3s ease; }

    /* ── Step intro ── */
    .step-intro { display:flex; align-items:flex-start; gap:12px; }
    .step-num {
      width:28px; height:28px; border-radius:50%;
      background:var(--primary); color:white;
      display:flex; align-items:center; justify-content:center;
      font-size:.78rem; font-weight:700; flex-shrink:0;
    }
    .step-title { font-weight:600; font-size:.9rem; color:var(--text-primary); }
    .step-desc  { font-size:.82rem; color:var(--text-secondary); margin-top:2px; line-height:1.5; }

    /* ── Input with icon ── */
    .input-icon-wrap { position:relative; }
    .iw-icon { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-muted); font-size:.82rem; }
    .iw-input { padding-left:36px !important; }

    /* ── Result cards ── */
    .result-card {
      display:flex; align-items:center; gap:14px;
      border-radius:var(--radius-lg); padding:16px;
      border:1.5px solid; margin-bottom:14px;
    }
    .result-card.green { background:#f0fdf4; border-color:#bbf7d0; }
    .result-card.amber { background:var(--warning-bg); border-color:#fde68a; }
    .result-card.blue  { background:var(--blue-50); border-color:var(--blue-200); }

    .rc-avatar {
      width:46px; height:46px; border-radius:50%;
      display:flex; align-items:center; justify-content:center;
      font-weight:700; font-size:1rem; flex-shrink:0; color:white;
    }
    .rc-avatar.green { background:var(--success); }
    .rc-avatar.amber { background:var(--warning); }
    .rc-avatar.blue  { background:var(--primary); }

    .rc-info { flex:1; }
    .rc-name  { font-weight:600; font-size:.95rem; color:var(--text-primary); }
    .rc-email { font-size:.8rem; color:var(--text-secondary); margin-top:2px; }
    .rc-meta  { font-size:.78rem; color:var(--text-muted); margin-top:3px; display:flex; align-items:center; gap:4px; }
    .rc-meta i { font-size:.65rem; }

    .rc-badge {
      display:inline-flex; align-items:center; gap:5px;
      padding:4px 10px; border-radius:20px; font-size:.75rem; font-weight:600;
      white-space:nowrap; flex-shrink:0;
    }
    .rc-badge.green { background:#dcfce7; color:var(--success); }
    .rc-badge.amber { background:#fef3c7; color:var(--warning); }
    .rc-badge.blue  { background:var(--blue-100); color:var(--blue-700); }

    /* ── Info boxes ── */
    .info-box {
      display:flex; align-items:flex-start; gap:10px;
      border-radius:var(--radius-md); padding:12px 14px;
      font-size:.84rem; line-height:1.6; color:var(--text-secondary);
    }
    .info-box i { flex-shrink:0; margin-top:2px; }
    .info-box.green { background:#f0fdf4; color:#15803d; }
    .info-box.green i { color:var(--success); }
    .info-box.amber { background:var(--warning-bg); color:#92400e; }
    .info-box.amber i { color:var(--warning); }
    .info-box.blue  { background:var(--blue-50); color:var(--blue-700); }
    .info-box.blue i { color:var(--primary); }

    /* ── New account hint ── */
    .new-account-hint {
      display:flex; align-items:center; gap:12px;
      background:var(--blue-50); border:1px solid var(--blue-200);
      border-radius:var(--radius-md); padding:12px 14px;
      font-size:.84rem; color:var(--blue-700); margin-bottom:20px;
    }
    .nah-icon { color:var(--primary); font-size:1.1rem; flex-shrink:0; }

    /* ── Edit profile ── */
    .edit-profile {
      display:flex; align-items:center; gap:14px;
      background:var(--gray-50); border:1px solid var(--border);
      border-radius:var(--radius-md); padding:14px 16px; margin-bottom:20px;
    }
    .ep-name  { font-weight:600; font-size:.95rem; color:var(--text-primary); }
    .ep-email { font-size:.8rem; color:var(--text-muted); margin-top:2px; }

    /* ── Misc ── */
    .opt-label { font-weight:400; color:var(--text-muted); font-size:.75rem; margin-left:4px; }
    .is-invalid { border-color:var(--danger) !important; box-shadow:0 0 0 3px rgba(220,38,38,.08) !important; }
    .stat-value { font-size:1.5rem; font-weight:700; color:var(--text-primary); }
    .stat-label { font-size:.72rem; color:var(--text-secondary); text-transform:uppercase; letter-spacing:.04em; margin-top:1px; }
  `]
})
export class GerantEmployesComponent implements OnInit {
  private api   = inject(ApiService);
  private toast = inject(ToastService);
  private fb    = inject(FormBuilder);

  employes:  EmployeResponse[] = [];
  filtered:  EmployeResponse[] = [];
  showModal    = false;
  editing: EmployeResponse | null = null;
  loading      = false;
  showArchived = false;
  searchQuery  = '';

  step: ModalStep        = 'email-check';
  emailToCheck           = '';
  checking               = false;
  checkResult: any       = null;
  specialiteOverride     = '';

  form = this.fb.group({
    nom:       ['', Validators.required],
    prenom:    ['', Validators.required],
    email:     ['', [Validators.required, Validators.email]],
    password:  [''],
    specialite:['']
  });

  get totalActifs()       { return this.employes.filter(e => !e.archived).length; }
  get totalArchives()     { return this.employes.filter(e =>  e.archived).length; }
  get totalSpecialistes() { return this.employes.filter(e => !!e.specialite && !e.archived).length; }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.api.getEmployes().subscribe(d => { this.employes = d; this.applyFilter(); });
  }

  applyFilter(): void {
    const q = this.searchQuery.toLowerCase();
    this.filtered = this.employes.filter(e => {
      const ms = !q || `${e.nom} ${e.prenom} ${e.email} ${e.specialite}`.toLowerCase().includes(q);
      return ms && (this.showArchived ? true : !e.archived);
    });
  }

  initials(e: EmployeResponse) { return `${e.nom?.charAt(0)??''}${e.prenom?.charAt(0)??''}`.toUpperCase(); }
  avColor(e: EmployeResponse)  { return AV_COLORS[(e.id || 0) % AV_COLORS.length]; }

  progressWidth(): string {
    const map: Record<string, string> = {
      'result-free':'50%','result-busy':'50%','result-already':'50%','new-form':'80%'
    };
    return map[this.step] ?? '0%';
  }

  openCreate(): void {
    this.editing = null; this.step = 'email-check';
    this.emailToCheck = ''; this.checkResult = null; this.specialiteOverride = '';
    this.form.reset(); this.showModal = true;
  }

  openEdit(e: EmployeResponse): void {
    this.editing = e;
    this.form.patchValue({ nom:e.nom, prenom:e.prenom, email:e.email, specialite:e.specialite });
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false; this.editing = null;
    this.form.reset(); this.emailToCheck = ''; this.checkResult = null;
  }

  checkEmail(): void {
    if (!this.emailToCheck.trim()) return;
    this.checking = true;
    this.api.checkEmployeEmail(this.emailToCheck.trim()).subscribe({
      next: (res: any) => {
        this.checking = false; this.checkResult = res;
        switch (res.status) {
          case 'FREE':                   this.step = 'result-free';    break;
          case 'BUSY':                   this.step = 'result-busy';    break;
          case 'ALREADY_IN_THIS_COMPANY':this.step = 'result-already'; break;
          default:
            this.form.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
            this.form.get('password')?.updateValueAndValidity();
            this.form.patchValue({ email: this.emailToCheck.trim() });
            this.step = 'new-form';
        }
      },
      error: () => { this.checking = false; this.toast.error('Erreur lors de la vérification'); }
    });
  }

  associerEmployeLibre(): void {
    if (!this.checkResult) return;
    this.loading = true;
    const req = {
      nom: this.checkResult.nom, prenom: this.checkResult.prenom,
      email: this.checkResult.email, password: '',
      specialite: this.specialiteOverride || this.checkResult.specialite || ''
    };
    this.api.createEmploye(req as any).subscribe({
      next: () => {
        this.toast.success(`${this.checkResult.nom} ${this.checkResult.prenom} associé avec succès !`);
        this.load(); this.closeModal(); this.loading = false;
      },
      error: (err: any) => { this.toast.error(err?.error?.message||'Erreur'); this.loading = false; }
    });
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true;
    const obs = this.editing
      ? this.api.updateEmploye(this.editing.id, this.form.value as any)
      : this.api.createEmploye(this.form.value as any);
    obs.subscribe({
      next: () => {
        this.toast.success(this.editing ? 'Employé modifié !' : 'Employé créé !');
        this.load(); this.closeModal(); this.loading = false;
      },
      error: (err: any) => { this.toast.error(err?.error?.message||'Erreur'); this.loading = false; }
    });
  }

  archiver(e: EmployeResponse): void {
    if (!confirm(`Archiver ${e.nom} ${e.prenom} ?`)) return;
    this.api.archiverEmploye(e.id).subscribe({
      next: () => { this.toast.success('Archivé'); this.load(); },
      error: () => this.toast.error('Erreur')
    });
  }
  desarchiver(e: EmployeResponse): void {
    this.api.desarchiverEmploye(e.id).subscribe({
      next: () => { this.toast.success('Désarchivé'); this.load(); },
      error: () => this.toast.error('Erreur')
    });
  }
}