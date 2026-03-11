import { Component, OnInit, inject, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  EntrepriseResponse, SecteurResponse, GerantResponse,
  EmployeResponse, EmployeCheckResponse, RattachementRequest
} from '../../../core/models/api.models';

function phoneValidator(control: AbstractControl): ValidationErrors | null {
  const v = control.value || '';
  return /^[0-9+\s\-()]{0,20}$/.test(v) ? null : { invalidPhone: true };
}

@Component({
  selector: 'app-entreprises',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
  <div>
    <div class="page-header">
      <div>
        <div class="page-title"><div class="title-icon"><i class="fas fa-building"></i></div>Entreprises</div>
        <div class="page-subtitle">Gestion des entreprises clientes</div>
      </div>
      <button class="btn btn-primary" (click)="openModal()"><i class="fas fa-plus"></i> Nouvelle entreprise</button>
    </div>

    <div class="card">
      <div class="table-container">
        <table>
          <thead>
            <tr><th>#</th><th>Nom</th><th>Secteur</th><th>Gérant</th><th>Téléphone</th><th>Adresse</th><th>Actions</th></tr>
          </thead>
          <tbody>
            @for (e of entreprises; track e.id) {
              <tr (click)="openDetail(e)" style="cursor:pointer">
                <td>{{ e.id }}</td>
                <td><strong>{{ e.nom }}</strong></td>
                <td><span class="badge badge-amber">{{ e.secteurNom }}</span></td>
                <td>{{ e.gerantNom }} {{ e.gerantPrenom }}</td>
                <td>{{ e.telephone }}</td>
                <td>{{ e.adresse }}</td>
                <td>
                  <div style="display:flex;gap:6px">
                    <button class="btn btn-info btn-sm btn-icon" (click)="openModal(e);$event.stopPropagation()"><i class="fas fa-pen"></i></button>
                    <button class="btn btn-danger btn-sm btn-icon" (click)="delete(e);$event.stopPropagation()"><i class="fas fa-trash"></i></button>
                  </div>
                </td>
              </tr>
            }
            @empty {
              <tr><td colspan="7"><div class="empty-state"><i class="fas fa-building"></i><h3>Aucune entreprise</h3></div></td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- ═══ DÉTAIL ENTREPRISE ═══ -->
    @if (showDetail && detailEntreprise) {
      <div class="modal-overlay" (click)="closeDetail()">
        <div class="modal modal-lg" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="modal-title">
              <div class="detail-icon"><i class="fas fa-building"></i></div>
              {{ detailEntreprise.nom }}
            </div>
            <button class="modal-close" (click)="closeDetail()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">

            <!-- INFOS -->
            <div class="detail-section">
              <div class="detail-row">
                <span class="detail-label"><i class="fas fa-layer-group"></i> Secteur</span>
                <span class="badge badge-amber">{{ detailEntreprise.secteurNom }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label"><i class="fas fa-phone"></i> Téléphone</span>
                <span>{{ detailEntreprise.telephone }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label"><i class="fas fa-map-marker-alt"></i> Adresse</span>
                <span>{{ detailEntreprise.adresse }}</span>
              </div>
            </div>

            <!-- GÉRANT -->
            <div class="detail-block">
              <div class="detail-block-title"><i class="fas fa-user-tie"></i> Gérant</div>
              <div class="gerant-card">
                <div class="gerant-avatar">{{ detailEntreprise.gerantNom[0] }}{{ detailEntreprise.gerantPrenom[0] }}</div>
                <div class="gerant-name">{{ detailEntreprise.gerantNom }} {{ detailEntreprise.gerantPrenom }}</div>
              </div>
            </div>

            <!-- EMPLOYÉS -->
            <div class="detail-block">
              <div class="detail-block-title" style="justify-content:space-between">
                <span><i class="fas fa-users"></i> Employés <span class="count-badge">{{ detailEmployes.length }}</span></span>
                <button class="btn btn-primary btn-sm" (click)="openAddEmploye()">
                  <i class="fas fa-plus"></i> Ajouter
                </button>
              </div>

              <div *ngIf="loadingEmployes" class="detail-loading"><i class="fas fa-spinner fa-spin"></i> Chargement...</div>

              <div class="employes-list" *ngIf="!loadingEmployes">
                <div class="employe-item" *ngFor="let emp of detailEmployes">
                  <div class="emp-avatar">{{ emp.nom[0] }}{{ emp.prenom[0] }}</div>
                  <div class="emp-info">
                    <div class="emp-name">{{ emp.nom }} {{ emp.prenom }}</div>
                    <div class="emp-spec">{{ emp.specialite || 'Sans spécialité' }} · {{ emp.email }}</div>
                  </div>
                  <span class="emp-status" [class.archived]="emp.archived">
                    {{ emp.archived ? 'Archivé' : 'Actif' }}
                  </span>
                  <button *ngIf="!emp.archived" class="btn btn-danger btn-sm btn-icon"
                    (click)="archiverEmploye(emp)" title="Archiver">
                    <i class="fas fa-archive"></i>
                  </button>
                  <button *ngIf="emp.archived" class="btn btn-success btn-sm btn-icon"
                    (click)="desarchiverEmploye(emp)" title="Désarchiver">
                    <i class="fas fa-undo"></i>
                  </button>
                </div>
                <div class="empty-employes" *ngIf="detailEmployes.length === 0">
                  <i class="fas fa-users"></i> Aucun employé
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    }

    <!-- ═══ MODAL AJOUTER EMPLOYÉ ═══ -->
    @if (showAddEmploye) {
      <div class="modal-overlay z-top" (click)="closeAddEmploye()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="modal-title"><i class="fas fa-user-plus"></i> Ajouter un employé</div>
            <button class="modal-close" (click)="closeAddEmploye()"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">

            <!-- ÉTAPE 1 : saisir l'email -->
            @if (addStep === 'email') {
              <div class="step-section">
                <p class="step-hint">Entrez l'adresse email de l'employé pour vérifier s'il a déjà un compte.</p>
                <div class="form-group">
                  <label class="form-label">Email *</label>
                  <div style="display:flex;gap:8px">
                    <input [(ngModel)]="checkEmail" class="form-control" type="email"
                      placeholder="email@exemple.com" (keyup.enter)="doCheckEmail()">
                    <button class="btn btn-primary" (click)="doCheckEmail()" [disabled]="checkLoading">
                      @if (checkLoading) { <i class="fas fa-spinner fa-spin"></i> }
                      @else { Vérifier }
                    </button>
                  </div>
                </div>
              </div>
            }

            <!-- ÉTAPE 2A : OCCUPE -->
            @if (addStep === 'occupe') {
              <div class="alert alert-danger">
                <i class="fas fa-ban"></i>
                <div>
                  <strong>Employé déjà actif</strong><br>
                  {{ checkResult?.message }}
                </div>
              </div>
              <div class="step-actions">
                <button class="btn btn-secondary" (click)="resetAddEmploye()">
                  <i class="fas fa-arrow-left"></i> Retour
                </button>
              </div>
            }

            <!-- ÉTAPE 2B : LIBRE → proposer de rattacher -->
            @if (addStep === 'libre') {
              <div class="alert alert-info">
                <i class="fas fa-info-circle"></i>
                <div>
                  <strong>Compte existant · Employé libre</strong><br>
                  {{ checkResult?.nom }} {{ checkResult?.prenom }} ({{ checkResult?.email }})
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Spécialité (optionnel)</label>
                <input [(ngModel)]="specialiteRattach" class="form-control" placeholder="Ex: Coiffeur, Technicien...">
              </div>
              <div class="step-actions">
                <button class="btn btn-secondary" (click)="resetAddEmploye()"><i class="fas fa-arrow-left"></i> Retour</button>
                <button class="btn btn-primary" (click)="doRattacher()" [disabled]="addLoading">
                  @if (addLoading) { Rattachement... } @else { <i class="fas fa-link"></i> Ajouter à cette entreprise }
                </button>
              </div>
            }

            <!-- ÉTAPE 2C : NOUVEAU → formulaire création -->
            @if (addStep === 'nouveau') {
              <div class="alert alert-success">
                <i class="fas fa-user-plus"></i>
                <div><strong>Nouveau compte</strong> — aucun compte trouvé pour {{ checkEmail }}</div>
              </div>
              <form [formGroup]="addForm" (ngSubmit)="doCreateEmploye()">
                <div class="form-group">
                  <label class="form-label">Nom *</label>
                  <input formControlName="nom" class="form-control" [class.is-invalid]="addForm.get('nom')?.invalid && addForm.get('nom')?.touched">
                </div>
                <div class="form-group">
                  <label class="form-label">Prénom *</label>
                  <input formControlName="prenom" class="form-control" [class.is-invalid]="addForm.get('prenom')?.invalid && addForm.get('prenom')?.touched">
                </div>
                <div class="form-group">
                  <label class="form-label">Email *</label>
                  <input formControlName="email" class="form-control" type="email">
                </div>
                <div class="form-group">
                  <label class="form-label">Mot de passe * (min 6 caractères)</label>
                  <input formControlName="password" class="form-control" type="password"
                    [class.is-invalid]="addForm.get('password')?.invalid && addForm.get('password')?.touched">
                </div>
                <div class="form-group">
                  <label class="form-label">Spécialité</label>
                  <input formControlName="specialite" class="form-control" placeholder="Ex: Coiffeur, Technicien...">
                </div>
                <div class="step-actions">
                  <button type="button" class="btn btn-secondary" (click)="resetAddEmploye()"><i class="fas fa-arrow-left"></i> Retour</button>
                  <button type="submit" class="btn btn-primary" [disabled]="addLoading">
                    @if (addLoading) { Création... } @else { <i class="fas fa-save"></i> Créer l'employé }
                  </button>
                </div>
              </form>
            }

          </div>
        </div>
      </div>
    }

    <!-- ═══ MODAL CRÉATION / ÉDITION ENTREPRISE ═══ -->
    @if (showModal) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="modal-title"><i class="fas fa-building"></i> {{ editing ? 'Modifier' : 'Nouvelle' }} entreprise</div>
            <button class="modal-close" (click)="closeModal()"><i class="fas fa-times"></i></button>
          </div>
          <form [formGroup]="form" (ngSubmit)="save()">
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Nom *</label>
                <input formControlName="nom" class="form-control"
                  [class.is-invalid]="form.get('nom')?.invalid && form.get('nom')?.touched">
              </div>
              <div class="form-group">
                <label class="form-label">Adresse *</label>
                <input formControlName="adresse" class="form-control"
                  [class.is-invalid]="form.get('adresse')?.invalid && form.get('adresse')?.touched">
              </div>
              <div class="form-group">
                <label class="form-label">Téléphone *</label>
                <input formControlName="telephone" class="form-control"
                  (keypress)="onlyNumbers($event)"
                  [class.is-invalid]="form.get('telephone')?.invalid && form.get('telephone')?.touched">
                <div class="form-error" *ngIf="form.get('telephone')?.errors?.['invalidPhone'] && form.get('telephone')?.touched">
                  Numéro invalide
                </div>
              </div>

              <!-- SECTEUR -->
              <div class="form-group">
                <label class="form-label">Secteur *</label>
                <div class="cs-wrap" [class.open]="showSecteurDropdown" (click)="$event.stopPropagation()">
                  <div #secteurTrigger class="cs-trigger" (click)="openDrop('secteur')">
                    <span *ngIf="!selectedSecteur" class="cs-placeholder"><i class="fas fa-layer-group"></i> Choisir un secteur</span>
                    <span *ngIf="selectedSecteur" class="cs-value"><i class="fas fa-layer-group"></i> {{ selectedSecteur.nom }}</span>
                    <i class="fas fa-times cs-clear" *ngIf="selectedSecteur" (click)="clearSecteur();$event.stopPropagation()"></i>
                    <i class="fas fa-chevron-down cs-arrow"></i>
                  </div>
                  <div class="cs-dropdown" *ngIf="showSecteurDropdown">
                    <div style="padding:6px 8px">
                      <input class="cs-search" [(ngModel)]="secteurSearch" [ngModelOptions]="{standalone:true}"
                        placeholder="Rechercher..." (input)="filterSecteurs()" autocomplete="off">
                    </div>
                    <div class="cs-list">
                      <div class="cs-item" *ngFor="let s of filteredSecteurs"
                        [class.cs-selected]="selectedSecteur?.id === s.id"
                        (mousedown)="selectSecteur(s)">
                        {{ s.nom }}
                        <i class="fas fa-check" *ngIf="selectedSecteur?.id === s.id"></i>
                      </div>
                      <div class="cs-empty" *ngIf="filteredSecteurs.length === 0">Aucun résultat</div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- GÉRANT -->
              <div class="form-group">
                <label class="form-label">Gérant *</label>
                <div class="cs-wrap" [class.open]="showGerantDropdown" (click)="$event.stopPropagation()">
                  <div #gerantTrigger class="cs-trigger" (click)="openDrop('gerant')">
                    <ng-container *ngIf="!selectedGerant">
                      <span class="cs-placeholder"><i class="fas fa-user-tie"></i> Choisir un gérant</span>
                    </ng-container>
                    <ng-container *ngIf="selectedGerant && !showGerantDropdown">
                      <div class="cs-gerant-chip">
                        <div class="cs-avatar">{{ selectedGerant.nom[0] }}{{ selectedGerant.prenom[0] }}</div>
                        <div class="cs-chip-info">
                          <span class="cs-chip-name">{{ selectedGerant.nom }} {{ selectedGerant.prenom }}</span>
                          <span class="cs-chip-email">{{ selectedGerant.email }}</span>
                        </div>
                      </div>
                    </ng-container>
                    <ng-container *ngIf="showGerantDropdown">
                      <i class="fas fa-user-tie cs-icon"></i>
                      <input class="cs-inline-search" [(ngModel)]="gerantSearch" [ngModelOptions]="{standalone:true}"
                        placeholder="Rechercher un gérant..." (input)="filterGerants()" autocomplete="off">
                    </ng-container>
                    <i class="fas fa-times cs-clear" *ngIf="selectedGerant" (click)="clearGerant();$event.stopPropagation()"></i>
                    <i class="fas fa-chevron-down cs-arrow"></i>
                  </div>
                  <div class="cs-dropdown" *ngIf="showGerantDropdown">
                    <div class="cs-list">
                      <div class="cs-item cs-item-gerant" *ngFor="let g of filteredGerants"
                        [class.cs-selected]="selectedGerant?.id === g.id"
                        (mousedown)="selectGerant(g)">
                        <div class="cs-avatar">{{ g.nom[0] }}{{ g.prenom[0] }}</div>
                        <div class="cs-chip-info">
                          <span class="cs-chip-name">{{ g.nom }} {{ g.prenom }}</span>
                          <span class="cs-chip-email">{{ g.email }}</span>
                        </div>
                        <i class="fas fa-check" *ngIf="selectedGerant?.id === g.id"></i>
                      </div>
                      <div class="cs-empty" *ngIf="filteredGerants.length === 0">Aucun gérant disponible</div>
                    </div>
                  </div>
                </div>
                <div class="form-error" *ngIf="form.get('gerantId')?.invalid && form.get('gerantId')?.touched">
                  Veuillez choisir un gérant
                </div>
              </div>

            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" (click)="closeModal()">Annuler</button>
              <button type="submit" class="btn btn-primary" [disabled]="loading">
                @if (loading) { Enregistrement... } @else { <i class="fas fa-save"></i> Enregistrer }
              </button>
            </div>
          </form>
        </div>
      </div>
    }

  </div>`,
  styles: [`
    .modal-lg { max-width: 560px; }
    .z-top { z-index: 1100; }
    .is-invalid { border-color: var(--danger) !important; }
    .form-error { font-size: .76rem; color: var(--danger); margin-top: 4px; }

    .detail-icon { width:36px;height:36px;background:var(--accent-glow);border:1px solid rgba(240,165,0,.3);border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;color:var(--accent);margin-right:10px; }
    .detail-section { background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px;margin-bottom:16px;display:flex;flex-direction:column;gap:10px; }
    .detail-row { display:flex;justify-content:space-between;align-items:center;font-size:.875rem; }
    .detail-label { color:var(--text-muted);display:flex;align-items:center;gap:6px; }
    .detail-label i { color:var(--accent);width:14px; }
    .detail-block { margin-bottom:16px; }
    .detail-block-title { font-size:.8rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:10px;display:flex;align-items:center;gap:6px; }
    .detail-block-title i { color:var(--accent); }
    .count-badge { background:var(--accent-glow);border:1px solid rgba(240,165,0,.3);color:var(--accent);font-size:.72rem;padding:1px 7px;border-radius:20px;font-weight:700; }
    .gerant-card { display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-md); }
    .gerant-avatar { width:40px;height:40px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.9rem;flex-shrink:0; }
    .gerant-name { font-weight:600;font-size:.9rem; }
    .employes-list { display:flex;flex-direction:column;gap:8px; }
    .employe-item { display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-md); }
    .emp-avatar { width:34px;height:34px;border-radius:50%;background:var(--bg-card);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.8rem;color:var(--text-secondary);flex-shrink:0; }
    .emp-info { flex:1; }
    .emp-name { font-size:.875rem;font-weight:600; }
    .emp-spec { font-size:.75rem;color:var(--text-muted); }
    .emp-status { font-size:.72rem;padding:2px 8px;border-radius:20px;background:rgba(16,185,129,.15);color:#34d399;border:1px solid rgba(16,185,129,.3); }
    .emp-status.archived { background:rgba(239,68,68,.1);color:#f87171;border-color:rgba(239,68,68,.3); }
    .empty-employes, .detail-loading { text-align:center;padding:20px;color:var(--text-muted);font-size:.875rem; }

    /* alerts */
    .alert { display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border-radius:var(--radius-md);margin-bottom:14px;font-size:.875rem; }
    .alert i { margin-top:2px;flex-shrink:0; }
    .alert-danger { background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);color:#f87171; }
    .alert-info { background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.25);color:#60a5fa; }
    .alert-success { background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.25);color:#34d399; }

    .step-hint { font-size:.875rem;color:var(--text-muted);margin-bottom:12px; }
    .step-section { }
    .step-actions { display:flex;gap:8px;justify-content:flex-end;margin-top:16px; }

    /* CUSTOM SELECT */
    .cs-wrap { position:relative;user-select:none; }
    .cs-trigger { display:flex;align-items:center;justify-content:space-between;padding:9px 12px;border:1.5px solid var(--border);border-radius:var(--radius-md);background:var(--bg-secondary);cursor:pointer;transition:border-color .15s;min-height:42px;gap:8px; }
    .cs-trigger:hover { border-color:var(--accent); }
    .cs-wrap.open .cs-trigger { border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-glow); }
    .cs-placeholder { color:var(--text-muted);font-size:.875rem;display:flex;align-items:center;gap:7px; }
    .cs-value { font-size:.875rem;font-weight:500;color:var(--text-primary);display:flex;align-items:center;gap:7px; }
    .cs-value i,.cs-placeholder i { color:var(--accent);font-size:.8rem; }
    .cs-arrow { color:var(--text-muted);font-size:.7rem;flex-shrink:0;transition:transform .2s; }
    .cs-wrap.open .cs-arrow { transform:rotate(180deg);color:var(--accent); }
    .cs-clear { color:var(--text-muted);font-size:.72rem;flex-shrink:0;cursor:pointer;padding:2px 4px;border-radius:50%;transition:color .15s; }
    .cs-clear:hover { color:var(--danger); }
    .cs-dropdown { position:fixed;top:var(--dd-top,100%);left:var(--dd-left,0);width:var(--dd-width,200px);background:var(--bg-card);border:1.5px solid var(--border);border-radius:var(--radius-md);box-shadow:0 10px 30px rgba(0,0,0,.18);z-index:999;overflow:hidden;animation:dropIn .12s ease; }
    @keyframes dropIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
    .cs-search { width:100%;border:1px solid var(--border);border-radius:var(--radius-sm);padding:5px 8px;font-size:.8rem;background:var(--bg-secondary);color:var(--text-primary);outline:none; }
    .cs-inline-search { flex:1;border:none;background:none;outline:none;font-size:.875rem;color:var(--text-primary);min-width:0; }
    .cs-icon { color:var(--text-muted);font-size:.8rem;flex-shrink:0; }
    .cs-list { max-height:190px;overflow-y:auto; }
    .cs-item { display:flex;align-items:center;gap:9px;padding:9px 12px;cursor:pointer;font-size:.875rem;color:var(--text-primary);transition:background .12s; }
    .cs-item:hover { background:var(--bg-secondary); }
    .cs-item.cs-selected { background:var(--primary-light,rgba(59,130,246,.08)); }
    .cs-item .fa-check { color:var(--accent);font-size:.78rem;margin-left:auto;flex-shrink:0; }
    .cs-item-gerant { padding:8px 12px; }
    .cs-avatar { width:32px;height:32px;border-radius:50%;flex-shrink:0;background:var(--primary-light,rgba(59,130,246,.1));border:1.5px solid var(--primary-border,rgba(59,130,246,.2));display:flex;align-items:center;justify-content:center;font-size:.68rem;font-weight:700;color:var(--accent);text-transform:uppercase; }
    .cs-chip-info { display:flex;flex-direction:column;flex:1;min-width:0; }
    .cs-chip-name { font-size:.85rem;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
    .cs-chip-email { font-size:.73rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
    .cs-gerant-chip { display:flex;align-items:center;gap:8px;flex:1;min-width:0; }
    .cs-gerant-chip .cs-avatar { width:26px;height:26px;font-size:.62rem; }
    .cs-empty { padding:14px 12px;text-align:center;color:var(--text-muted);font-size:.85rem; }
  `]
})
export class EntreprisesComponent implements OnInit {
  private api   = inject(ApiService);
  private toast = inject(ToastService);
  private fb    = inject(FormBuilder);

  entreprises: EntrepriseResponse[] = [];
  secteurs:    SecteurResponse[]    = [];
  gerants:     GerantResponse[]     = [];
  filteredSecteurs: SecteurResponse[] = [];
  filteredGerants:  GerantResponse[]  = [];

  showModal = false;
  editing: EntrepriseResponse | null = null;
  loading = false;

  secteurSearch = '';
  selectedSecteur: SecteurResponse | null = null;
  gerantSearch = '';
  selectedGerant: GerantResponse | null = null;
  showSecteurDropdown = false;
  showGerantDropdown  = false;

  @ViewChild('secteurTrigger') secteurTrigger!: ElementRef;
  @ViewChild('gerantTrigger')  gerantTrigger!:  ElementRef;

  // Détail
  showDetail       = false;
  detailEntreprise: EntrepriseResponse | null = null;
  detailEmployes:  EmployeResponse[] = [];
  loadingEmployes  = false;

  // Ajout employé
  showAddEmploye = false;
  addStep: 'email' | 'nouveau' | 'libre' | 'occupe' = 'email';
  checkEmail = '';
  checkLoading = false;
  checkResult: EmployeCheckResponse | null = null;
  specialiteRattach = '';
  addLoading = false;

  addForm = this.fb.group({
    nom:       ['', Validators.required],
    prenom:    ['', Validators.required],
    email:     ['', [Validators.required, Validators.email]],
    password:  ['', [Validators.required, Validators.minLength(6)]],
    specialite: ['']
  });

  form = this.fb.group({
    nom:       ['', Validators.required],
    adresse:   ['', Validators.required],
    telephone: ['', [Validators.required, phoneValidator]],
    secteurId: ['', Validators.required],
    gerantId:  ['', Validators.required]
  });

  @HostListener('document:click')
  onDocumentClick(): void {
    this.showSecteurDropdown = false;
    this.showGerantDropdown  = false;
  }

  ngOnInit(): void {
    this.load();
    this.api.getSecteurs().subscribe(d => { this.secteurs = d; this.filteredSecteurs = d; });
    this.api.getGerantsDisponibles().subscribe(d => { this.gerants = d; this.filteredGerants = this.availableGerants(); });
  }

  load(): void { this.api.getEntreprises().subscribe(d => this.entreprises = d); }

  private availableGerants(): GerantResponse[] {
    const assignedIds = new Set(this.entreprises.map(e => e.gerantId));
    if (this.editing) assignedIds.delete(this.editing.gerantId);
    return this.gerants.filter(g => !assignedIds.has(g.id));
  }

  onlyNumbers(event: KeyboardEvent): boolean {
    if (!/[0-9+\s\-()\\b]/.test(event.key) && event.key.length === 1) { event.preventDefault(); return false; }
    return true;
  }

  openDrop(which: 'secteur' | 'gerant'): void {
    const refName = which === 'secteur' ? 'secteurTrigger' : 'gerantTrigger';
    setTimeout(() => {
      const el = (this as any)[refName]?.nativeElement as HTMLElement;
      if (el) {
        const r = el.getBoundingClientRect();
        document.documentElement.style.setProperty('--dd-top',   `${r.bottom + 5}px`);
        document.documentElement.style.setProperty('--dd-left',  `${r.left}px`);
        document.documentElement.style.setProperty('--dd-width', `${r.width}px`);
      }
    }, 0);
    if (which === 'secteur') { this.showSecteurDropdown = true; this.showGerantDropdown = false; this.filteredSecteurs = this.secteurs; }
    else { this.showGerantDropdown = true; this.showSecteurDropdown = false; this.filteredGerants = this.availableGerants(); }
  }

  clearSecteur(): void { this.selectedSecteur = null; this.secteurSearch = ''; this.form.get('secteurId')?.setValue(''); this.filteredSecteurs = this.secteurs; }
  clearGerant():  void { this.selectedGerant  = null; this.gerantSearch  = ''; this.form.get('gerantId')?.setValue('');  this.filteredGerants  = this.availableGerants(); }
  filterSecteurs(): void { const q = this.secteurSearch.toLowerCase(); this.filteredSecteurs = this.secteurs.filter(s => s.nom.toLowerCase().includes(q)); }
  filterGerants():  void { const q = this.gerantSearch.toLowerCase();  this.filteredGerants  = this.availableGerants().filter(g => `${g.nom} ${g.prenom} ${g.email}`.toLowerCase().includes(q)); }
  selectSecteur(s: SecteurResponse): void { this.selectedSecteur = s; this.form.get('secteurId')?.setValue(String(s.id)); this.showSecteurDropdown = false; }
  selectGerant(g: GerantResponse):   void { this.selectedGerant  = g; this.form.get('gerantId')?.setValue(String(g.id));  this.showGerantDropdown  = false; }

  openDetail(e: EntrepriseResponse): void {
    this.detailEntreprise = e;
    this.detailEmployes   = [];
    this.loadingEmployes  = true;
    this.showDetail       = true;
    this.api.getEmployesByEntreprise(e.id).subscribe({
      next: emps => { this.detailEmployes = emps; this.loadingEmployes = false; },
      error: ()   => { this.loadingEmployes = false; }
    });
  }
  closeDetail(): void { this.showDetail = false; this.detailEntreprise = null; this.detailEmployes = []; }

  // ── AJOUTER EMPLOYÉ ──
  openAddEmploye(): void { this.showAddEmploye = true; this.resetAddEmploye(); }
  closeAddEmploye(): void { this.showAddEmploye = false; }

  resetAddEmploye(): void {
    this.addStep = 'email';
    this.checkEmail = '';
    this.checkResult = null;
    this.specialiteRattach = '';
    this.addForm.reset();
  }

  doCheckEmail(): void {
    if (!this.checkEmail || !this.checkEmail.includes('@')) { this.toast.error('Email invalide'); return; }
    this.checkLoading = true;
    this.api.checkEmailEmploye(this.checkEmail, this.detailEntreprise?.id).subscribe({
      next: r => {
        this.checkResult = r;
        this.checkLoading = false;
        if (r.statut === 'NOUVEAU') {
          this.addForm.patchValue({ email: this.checkEmail });
          this.addStep = 'nouveau';
        } else if (r.statut === 'LIBRE') {
          this.addStep = 'libre';
        } else {
          this.addStep = 'occupe';
        }
      },
      error: (e) => {
        this.checkLoading = false;
        const msg = e?.error?.message || e?.error || 'Erreur lors de la vérification';
        this.toast.error(msg);
      }
    });
  }

  doRattacher(): void {
    if (!this.checkResult?.userId || !this.detailEntreprise) return;
    this.addLoading = true;
    const req: RattachementRequest = {
      userId: this.checkResult.userId,
      entrepriseId: this.detailEntreprise.id,
      specialite: this.specialiteRattach || undefined
    };
    this.api.rattacherEmploye(req).subscribe({
      next: () => {
        this.toast.success('Employé rattaché !');
        this.addLoading = false;
        this.closeAddEmploye();
        this.openDetail(this.detailEntreprise!);
      },
      error: (e) => { this.toast.error(e?.error?.message || 'Erreur'); this.addLoading = false; }
    });
  }

  doCreateEmploye(): void {
    if (this.addForm.invalid) { this.addForm.markAllAsTouched(); return; }
    this.addLoading = true;
    const v = this.addForm.value;
    this.api.createEmploye({ ...v as any, entrepriseId: this.detailEntreprise?.id }).subscribe({
      next: () => {
        this.toast.success('Employé créé !');
        this.addLoading = false;
        this.closeAddEmploye();
        this.openDetail(this.detailEntreprise!);
      },
      error: (e) => { this.toast.error(e?.error?.message || 'Erreur'); this.addLoading = false; }
    });
  }

  archiverEmploye(emp: EmployeResponse): void {
    this.api.archiverEmploye(emp.id).subscribe({
      next: () => { this.toast.success('Employé archivé'); this.openDetail(this.detailEntreprise!); },
      error: () => this.toast.error('Erreur')
    });
  }

  desarchiverEmploye(emp: EmployeResponse): void {
    this.api.desarchiverEmploye(emp.id).subscribe({
      next: () => { this.toast.success('Employé désarchivé'); this.openDetail(this.detailEntreprise!); },
      error: () => this.toast.error('Erreur')
    });
  }

  openModal(e?: EntrepriseResponse): void {
    this.editing = e ?? null;
    this.selectedSecteur = null; this.selectedGerant = null;
    this.secteurSearch = ''; this.gerantSearch = '';
    this.filteredSecteurs = this.secteurs; this.filteredGerants = this.availableGerants();
    if (e) {
      this.form.patchValue({ nom: e.nom, adresse: e.adresse, telephone: e.telephone });
      const s = this.secteurs.find(x => x.id === e.secteurId);
      const g = this.gerants.find(x => x.id === e.gerantId);
      if (s) this.selectSecteur(s);
      if (g) this.selectGerant(g);
    } else { this.form.reset(); }
    this.showModal = true;
  }
  closeModal(): void { this.showModal = false; this.form.reset(); this.editing = null; this.selectedSecteur = null; this.selectedGerant = null; }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true;
    const v = this.form.value;
    const body = { ...v, secteurId: +v.secteurId!, gerantId: +v.gerantId! } as any;
    const req = this.editing ? this.api.updateEntreprise(this.editing.id, body) : this.api.createEntreprise(body);
    req.subscribe({
      next: () => { this.toast.success('Entreprise enregistrée !'); this.load(); this.closeModal(); this.loading = false; },
      error: (e) => { this.toast.error(e?.error?.message || e?.error || 'Erreur'); this.loading = false; }
    });
  }

  delete(e: EntrepriseResponse): void {
    if (!confirm(`Supprimer "${e.nom}" ?`)) return;
    this.api.deleteEntreprise(e.id).subscribe({
      next: () => { this.toast.success('Supprimée'); this.load(); },
      error: () => this.toast.error('Erreur')
    });
  }
}