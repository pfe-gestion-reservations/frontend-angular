import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { ServiceResponse, ConfigServiceResponse, RessourceResponse, TypeService } from '../../../core/models/api.models';

type ModalStep = 'type' | 'form';

@Component({
  selector: 'app-gerant-services',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
  <div>
    <div class="page-header">
      <div>
        <div class="page-title"><div class="title-icon"><i class="fas fa-concierge-bell"></i></div>Services</div>
        <div class="page-subtitle">Catalogue des prestations de votre entreprise</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn btn-primary" (click)="openCreate()">
          <i class="fas fa-plus"></i> Nouveau service
        </button>
        <button class="btn btn-secondary" (click)="showArchived = !showArchived"
          [style.background]="showArchived ? 'var(--accent-glow)' : ''"
          [style.border-color]="showArchived ? 'var(--accent)' : ''"
          [style.color]="showArchived ? 'var(--accent)' : ''">
          <i class="fas fa-archive"></i> {{ showArchived ? 'Masquer archivés' : 'Afficher archivés' }}
        </button>
      </div>
    </div>

    <!-- GRID -->
    <div class="services-grid">
      <div class="service-card" *ngFor="let s of displayedServices" [class.archived]="s.archived">
        <div class="service-header">
          <div class="type-badge" [ngClass]="'type-' + getConfig(s.id)?.typeService?.toLowerCase()">
            <i [class]="typeIcon(getConfig(s.id)?.typeService)"></i>
            {{ typeLabel(getConfig(s.id)?.typeService) }}
          </div>
          <div class="service-actions">
            <button class="btn btn-info btn-sm btn-icon" (click)="openEdit(s)" title="Modifier"><i class="fas fa-pen"></i></button>
            <button class="btn btn-secondary btn-sm ressource-btn" (click)="openRessourcePanel(s)"
              *ngIf="getConfig(s.id)?.ressourceObligatoire" title="Gérer les ressources">
              <i class="fas fa-cubes"></i> Ressources
            </button>
            <button *ngIf="!s.archived" class="btn btn-danger btn-sm btn-icon" (click)="archiver(s)"><i class="fas fa-archive"></i></button>
            <button *ngIf="s.archived" class="btn btn-success btn-sm btn-icon" (click)="desarchiver(s)"><i class="fas fa-undo"></i></button>
          </div>
        </div>
        <div class="archived-badge" *ngIf="s.archived"><i class="fas fa-archive"></i> Archivé</div>
        <h3 class="service-name">{{ s.nom }}</h3>
        <p class="service-desc">{{ s.description || 'Aucune description' }}</p>
        <div class="service-meta">
          <span><i class="fas fa-clock"></i> {{ s.dureeMinutes }} min</span>
          <span class="service-price">{{ s.tarif != null ? (s.tarif | number:'1.2-2') + ' DT' : 'Gratuit' }}</span>
        </div>
        <!-- CONFIG SUMMARY -->
        <div class="config-summary" *ngIf="getConfig(s.id) as c">
          <span *ngIf="c.employeObligatoire" class="badge-flag"><i class="fas fa-user-tie"></i> Employé requis</span>
          <span *ngIf="c.ressourceObligatoire" class="badge-flag"><i class="fas fa-layer-group"></i> Ressource requise</span>
          <span *ngIf="c.reservationEnGroupe" class="badge-flag"><i class="fas fa-users"></i> {{ c.capaciteMinPersonnes }}-{{ c.capaciteMaxPersonnes }} pers.</span>
          <span *ngIf="c.fileAttenteActive" class="badge-flag"><i class="fas fa-list-ol"></i> File active</span>
        </div>
        <div class="no-config" *ngIf="!getConfig(s.id)">
          <i class="fas fa-exclamation-triangle"></i> Configuration manquante
        </div>
      </div>
      <div class="empty-state" *ngIf="displayedServices.length === 0">
        <i class="fas fa-concierge-bell"></i>
        <h3>Aucun service</h3>
        <p>Cliquez sur "Nouveau service" pour commencer</p>
      </div>
    </div>

    <!-- ═══ MODAL CRÉATION — ÉTAPE 1 : CHOISIR LE TYPE ═══ -->
    <div class="modal-overlay" *ngIf="showModal && step === 'type'" (click)="closeModal()">
      <div class="modal modal-type" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="modal-title"><i class="fas fa-magic"></i> Quel type de service ?</div>
          <button class="modal-close" (click)="closeModal()"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <div class="type-grid">

            <button class="type-card" (click)="selectType('EMPLOYE_DEDIE')">
              <div class="type-card-icon type-employe"><i class="fas fa-user-tie"></i></div>
              <div class="type-card-label">Employé dédié</div>
              <div class="type-card-desc">Le client choisit un praticien spécifique</div>
              <div class="type-card-examples">Coiffure · Médecin · Esthétique</div>
            </button>

            <button class="type-card" (click)="selectType('RESSOURCE_PARTAGEE')">
              <div class="type-card-icon type-ressource"><i class="fas fa-layer-group"></i></div>
              <div class="type-card-label">Ressource partagée</div>
              <div class="type-card-desc">Le client réserve un espace ou équipement</div>
              <div class="type-card-examples">Padel · Tennis · Salle de sport</div>
            </button>

            <button class="type-card" (click)="selectType('FILE_ATTENTE_PURE')">
              <div class="type-card-icon type-file"><i class="fas fa-list-ol"></i></div>
              <div class="type-card-label">File d'attente pure</div>
              <div class="type-card-desc">Le client arrive et prend un numéro</div>
              <div class="type-card-examples">Pharmacie · Administration · Banque</div>
            </button>

            <button class="type-card" (click)="selectType('HYBRIDE')">
              <div class="type-card-icon type-hybride"><i class="fas fa-random"></i></div>
              <div class="type-card-label">Hybride</div>
              <div class="type-card-desc">Créneau + ressource + file d'attente</div>
              <div class="type-card-examples">Garage · Clinique · Laboratoire</div>
            </button>

          </div>
        </div>
      </div>
    </div>

    <!-- ═══ MODAL — ÉTAPE 2 : FORMULAIRE ADAPTÉ AU TYPE ═══ -->
    <div class="modal-overlay" *ngIf="showModal && step === 'form'" (click)="closeModal()">
      <div class="modal modal-lg" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="modal-title">
            <button class="back-btn" *ngIf="!editingService" (click)="step = 'type'" title="Retour">
              <i class="fas fa-arrow-left"></i>
            </button>
            <div class="type-pill" [ngClass]="'type-' + selectedType?.toLowerCase()">
              <i [class]="typeIcon(selectedType)"></i> {{ typeLabel(selectedType) }}
            </div>
            {{ editingService ? 'Modifier' : 'Nouveau' }} service
          </div>
          <button class="modal-close" (click)="closeModal()"><i class="fas fa-times"></i></button>
        </div>

        <form [formGroup]="form" (ngSubmit)="save()">
          <div class="modal-body">

            <!-- INFOS DE BASE — commun à tous les types -->
            <div class="section-title">Informations générales</div>
            <div class="form-group">
              <label class="form-label">Nom du service *</label>
              <input formControlName="nom" class="form-control" [placeholder]="nomPlaceholder"
                [class.is-invalid]="form.get('nom')?.invalid && form.get('nom')?.touched">
            </div>
            <div class="form-group">
              <label class="form-label">Description</label>
              <textarea formControlName="description" class="form-control" rows="2" placeholder="Description optionnelle..."></textarea>
            </div>
            <div class="form-row">
              <div class="form-group" *ngIf="selectedType !== 'FILE_ATTENTE_PURE'">
                <label class="form-label">Durée d'un créneau (min) *</label>
                <input formControlName="dureeMinutes" type="number" class="form-control" [placeholder]="dureePlaceholder"
                  [class.is-invalid]="form.get('dureeMinutes')?.invalid && form.get('dureeMinutes')?.touched">
              </div>
              <div class="form-group">
                <label class="form-label">Tarif (DT) <span class="optional">optionnel</span></label>
                <input formControlName="tarif" type="number" step="0.01" class="form-control" placeholder="Laisser vide si gratuit">
              </div>
            </div>

            <!-- RESSOURCE_PARTAGEE — capacité groupe -->
            <ng-container *ngIf="selectedType === 'RESSOURCE_PARTAGEE'">
              <div class="section-title">Capacité par réservation</div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Personnes minimum *</label>
                  <input formControlName="capaciteMinPersonnes" type="number" class="form-control" placeholder="Ex: 2"
                    [class.is-invalid]="form.get('capaciteMinPersonnes')?.invalid && form.get('capaciteMinPersonnes')?.touched">
                </div>
                <div class="form-group">
                  <label class="form-label">Personnes maximum *</label>
                  <input formControlName="capaciteMaxPersonnes" type="number" class="form-control" placeholder="Ex: 4"
                    [class.is-invalid]="form.get('capaciteMaxPersonnes')?.invalid && form.get('capaciteMaxPersonnes')?.touched">
                </div>
              </div>

              <!-- ══ SECTION RESSOURCES INLINE (création uniquement) ══ -->
              <ng-container *ngIf="!editingService">
                <div class="section-title" style="margin-top:18px">
                  <i class="fas fa-layer-group" style="margin-right:6px;color:var(--accent)"></i>
                  Ressources (terrains, salles…)
                  <span style="margin-left:6px;font-size:.75rem;color:var(--danger);font-weight:600;text-transform:none;letter-spacing:0">* obligatoire — au moins 1</span>
                </div>

                <!-- liste des ressources déjà ajoutées -->
                <div class="inline-ressources-list" *ngIf="inlineRessources.length > 0">
                  <div class="inline-ressource-item" *ngFor="let r of inlineRessources; let i = index">
                    <div class="inline-ressource-info">
                      <span class="inline-ressource-name"><i class="fas fa-cube"></i> {{ r.nom }}</span>
                      <span class="inline-ressource-cap"><i class="fas fa-users"></i> {{ r.capacite }}</span>
                      <span *ngIf="r.description" class="inline-ressource-desc">{{ r.description }}</span>
                    </div>
                    <button type="button" class="btn btn-danger btn-sm btn-icon" (click)="removeInlineRessource(i)" title="Supprimer">
                      <i class="fas fa-times"></i>
                    </button>
                  </div>
                </div>

                <!-- formulaire ajout ressource inline -->
                <div class="inline-add-ressource" [class.open]="showInlineRessourceForm">
                  <ng-container *ngIf="!showInlineRessourceForm">
                    <button type="button" class="btn btn-secondary btn-add-ressource" (click)="showInlineRessourceForm=true">
                      <i class="fas fa-plus"></i> Ajouter une ressource
                    </button>
                  </ng-container>
                  <ng-container *ngIf="showInlineRessourceForm">
                    <div class="inline-ressource-form" [formGroup]="inlineRessourceForm">
                      <div class="form-row" style="align-items:flex-end;gap:8px">
                        <div class="form-group" style="flex:2;margin-bottom:0">
                          <label class="form-label">Nom *</label>
                          <input formControlName="nom" class="form-control" placeholder="Ex: Terrain 1, Salle A…"
                            [class.is-invalid]="inlineRessourceForm.get('nom')?.invalid && inlineRessourceForm.get('nom')?.touched">
                        </div>
                        <div class="form-group" style="flex:1;margin-bottom:0">
                          <label class="form-label">Capacité</label>
                          <input formControlName="capacite" type="number" class="form-control" placeholder="Ex: 4">
                        </div>
                        <div class="form-group" style="flex:2;margin-bottom:0">
                          <label class="form-label">Description</label>
                          <input formControlName="description" class="form-control" placeholder="Optionnel">
                        </div>
                      </div>
                      <div class="inline-ressource-actions">
                        <button type="button" class="btn btn-secondary btn-sm" (click)="cancelInlineRessource()">Annuler</button>
                        <button type="button" class="btn btn-primary btn-sm" (click)="addInlineRessource()">
                          <i class="fas fa-check"></i> Ajouter
                        </button>
                      </div>
                    </div>
                  </ng-container>
                </div>
              </ng-container>
            </ng-container>

            <!-- RÈGLES — commun sauf FILE_ATTENTE_PURE -->
            <ng-container *ngIf="selectedType !== 'FILE_ATTENTE_PURE'">
              <div class="section-title">Règles de réservation</div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Annulation avant (heures)</label>
                  <input formControlName="annulationHeures" type="number" class="form-control" placeholder="Ex: 2">
                  <small class="form-hint">Laisser vide = annulation libre</small>
                </div>
                <div class="form-group">
                  <label class="form-label">Réservation max à l'avance (jours)</label>
                  <input formControlName="avanceReservationJours" type="number" class="form-control" placeholder="Ex: 30">
                  <small class="form-hint">Laisser vide = pas de limite</small>
                </div>
              </div>
            </ng-container>

            <!-- RÉCAPITULATIF CONFIG AUTO -->
            <div class="config-auto">
              <div class="config-auto-title"><i class="fas fa-magic"></i> Configuration automatique</div>
              <div class="config-auto-flags">
                <div class="auto-flag" [class.active]="autoFlags.employeObligatoire">
                  <i class="fas fa-user-tie"></i> Employé obligatoire
                </div>
                <div class="auto-flag" [class.active]="autoFlags.ressourceObligatoire">
                  <i class="fas fa-layer-group"></i> Ressource obligatoire
                </div>
                <div class="auto-flag" [class.active]="autoFlags.reservationEnGroupe">
                  <i class="fas fa-users"></i> Réservation en groupe
                </div>
                <div class="auto-flag" [class.active]="autoFlags.fileAttenteActive">
                  <i class="fas fa-list-ol"></i> File d'attente active
                </div>
              </div>
            </div>

          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="closeModal()">Annuler</button>
            <button type="submit" class="btn btn-primary" [disabled]="loading">
              <span *ngIf="loading"><i class="fas fa-spinner fa-spin"></i> Enregistrement...</span>
              <span *ngIf="!loading"><i class="fas fa-save"></i> {{ editingService ? 'Modifier' : 'Créer le service' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- ═══ PANEL RESSOURCES ═══ -->
    <div class="modal-overlay" *ngIf="showRessourcePanel" (click)="closeRessourcePanel()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="modal-title"><i class="fas fa-layer-group"></i> Ressources — {{ selectedService?.nom }}</div>
          <button class="modal-close" (click)="closeRessourcePanel()"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <form [formGroup]="ressourceForm" (ngSubmit)="saveRessource()" class="ressource-add-form">
            <div class="form-row">
              <div class="form-group" style="flex:2">
                <input formControlName="nom" class="form-control" placeholder="Nom (ex: Terrain 1)">
              </div>
              <div class="form-group" style="flex:1">
                <input formControlName="capacite" type="number" class="form-control" placeholder="Capacité">
              </div>
              <div class="form-group" style="flex:1">
                <input formControlName="description" class="form-control" placeholder="Description">
              </div>
              <button type="submit" class="btn btn-primary" [disabled]="loadingRessource"><i class="fas fa-plus"></i></button>
            </div>
          </form>
          <div class="ressources-list">
            <div class="ressource-item" *ngFor="let r of ressources" [class.archived]="r.archived">
              <div class="ressource-info">
                <strong>{{ r.nom }}</strong>
                <span class="ressource-cap"><i class="fas fa-users"></i> {{ r.capacite }}</span>
                <span *ngIf="r.description" class="ressource-desc">{{ r.description }}</span>
              </div>
              <div class="ressource-actions">
                <button *ngIf="!r.archived" class="btn btn-danger btn-sm btn-icon" (click)="archiverRessource(r)"><i class="fas fa-archive"></i></button>
                <button *ngIf="r.archived" class="btn btn-success btn-sm btn-icon" (click)="desarchiverRessource(r)"><i class="fas fa-undo"></i></button>
              </div>
            </div>
            <div class="empty-state" *ngIf="ressources.length === 0">
              <i class="fas fa-layer-group"></i><p>Aucune ressource — ajoutez-en ci-dessus</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ══ POPUP DOUBLON ACTIF ══ -->
    <div class="dup-overlay" *ngIf="showDuplicatePopup" (click)="showDuplicatePopup=false">
      <div class="dup-popup" (click)="$event.stopPropagation()">
        <div class="dup-icon" style="color:#ef4444"><i class="fas fa-exclamation-circle"></i></div>
        <div class="dup-title">Service déjà existant</div>
        <div class="dup-msg">Un service avec le même nom, prix et durée existe déjà dans votre entreprise.</div>
        <button class="btn btn-primary" (click)="showDuplicatePopup=false">OK, compris</button>
      </div>
    </div>

    <!-- ══ POPUP DOUBLON ARCHIVÉ ══ -->
    <div class="dup-overlay" *ngIf="showArchivedPopup" (click)="showArchivedPopup=false">
      <div class="dup-popup" (click)="$event.stopPropagation()">
        <div class="dup-icon" style="color:#f59e0b"><i class="fas fa-archive"></i></div>
        <div class="dup-title">Service archivé</div>
        <div class="dup-msg">Ce service existe déjà mais est archivé. Voulez-vous le désarchiver ?</div>
        <div style="display:flex;gap:8px;justify-content:center">
          <button class="btn btn-secondary" (click)="showArchivedPopup=false">Non</button>
          <button class="btn btn-primary" (click)="confirmDesarchiver()"><i class="fas fa-undo"></i> Oui, désarchiver</button>
        </div>
      </div>
    </div>
  </div>`,
  styles: [`
    .ressource-btn { display:flex;align-items:center;gap:5px;padding:4px 10px;font-size:.78rem;font-weight:600;border-radius:var(--radius-md);white-space:nowrap; }
    .dup-overlay { position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center; }
    .dup-popup { background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);padding:32px 28px;text-align:center;max-width:340px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.4); }
    .dup-icon { font-size:2.4rem;margin-bottom:12px; }
    .dup-title { font-size:1.1rem;font-weight:700;margin-bottom:8px; }
    .dup-msg { font-size:.875rem;color:var(--text-muted);margin-bottom:20px;line-height:1.5; }
    .services-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px; }
    .service-card { background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px;transition:all .25s; }
    .service-card:hover { border-color:var(--accent);box-shadow:var(--shadow-accent); }
    .service-card.archived { opacity:.6;border-style:dashed; }
    .service-header { display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px; }
    .service-actions { display:flex;gap:4px; }
    .service-name { font-weight:700;font-size:1rem;margin-bottom:4px; }
    .service-desc { font-size:.8rem;color:var(--text-secondary);margin-bottom:12px;min-height:32px; }
    .service-meta { display:flex;justify-content:space-between;font-size:.8rem;color:var(--text-secondary);margin-bottom:10px; }
    .service-price { font-weight:700;color:var(--accent); }
    .archived-badge { font-size:.7rem;color:var(--text-muted);margin-bottom:4px; }
    .config-summary { display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;padding-top:8px;border-top:1px solid var(--border); }
    .badge-flag { font-size:.72rem;padding:3px 8px;background:var(--accent-glow);border:1px solid rgba(240,165,0,.25);border-radius:20px;color:var(--text-secondary); }
    .badge-flag i { color:var(--accent);margin-right:3px; }
    .no-config { font-size:.75rem;color:var(--danger);margin-top:8px;padding-top:8px;border-top:1px solid var(--border); }
    .no-config i { margin-right:4px; }
    .type-badge { display:inline-flex;align-items:center;gap:5px;font-size:.72rem;font-weight:600;padding:4px 10px;border-radius:20px; }
    .type-employe_dedie { background:rgba(99,102,241,.15);color:#818cf8;border:1px solid rgba(99,102,241,.3); }
    .type-ressource_partagee { background:rgba(16,185,129,.15);color:#34d399;border:1px solid rgba(16,185,129,.3); }
    .type-file_attente_pure { background:rgba(245,158,11,.15);color:#fbbf24;border:1px solid rgba(245,158,11,.3); }
    .type-hybride { background:rgba(239,68,68,.15);color:#f87171;border:1px solid rgba(239,68,68,.3); }
    .modal-type { max-width:640px; }
    .type-grid { display:grid;grid-template-columns:1fr 1fr;gap:14px; }
    .type-card { background:var(--bg-secondary);border:2px solid var(--border);border-radius:var(--radius-lg);padding:20px;cursor:pointer;transition:all .2s;text-align:left;width:100%; }
    .type-card:hover { border-color:var(--accent);background:var(--accent-glow);transform:translateY(-2px);box-shadow:var(--shadow-accent); }
    .type-card-icon { width:48px;height:48px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;font-size:1.3rem;margin-bottom:12px; }
    .type-employe { background:rgba(99,102,241,.2);color:#818cf8; }
    .type-ressource { background:rgba(16,185,129,.2);color:#34d399; }
    .type-file { background:rgba(245,158,11,.2);color:#fbbf24; }
    .type-hybride { background:rgba(239,68,68,.2);color:#f87171; }
    .type-card-label { font-weight:700;font-size:.95rem;margin-bottom:4px; }
    .type-card-desc { font-size:.8rem;color:var(--text-secondary);margin-bottom:6px; }
    .type-card-examples { font-size:.75rem;color:var(--text-muted);font-style:italic; }
    .modal-lg { max-width:580px; }
    .back-btn { background:none;border:none;color:var(--text-secondary);cursor:pointer;padding:4px 8px;border-radius:var(--radius-sm);margin-right:6px;transition:color .15s; }
    .back-btn:hover { color:var(--accent); }
    .type-pill { display:inline-flex;align-items:center;gap:5px;font-size:.75rem;font-weight:600;padding:3px 10px;border-radius:20px;margin-right:8px; }
    .section-title { font-size:.8rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin:16px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--border); }
    .form-hint { font-size:.75rem;color:var(--text-muted);margin-top:3px;display:block; }
    .is-invalid { border-color:var(--danger) !important; }
    textarea.form-control { resize:vertical;min-height:60px; }
    .optional { font-size:.75rem;color:var(--text-muted);font-weight:400;margin-left:4px; }
    .config-auto { background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px;margin-top:16px; }
    .config-auto-title { font-size:.8rem;font-weight:600;color:var(--text-muted);margin-bottom:10px; }
    .config-auto-flags { display:grid;grid-template-columns:1fr 1fr;gap:8px; }
    .auto-flag { display:flex;align-items:center;gap:8px;font-size:.8rem;padding:8px 10px;border-radius:var(--radius-sm);border:1px solid var(--border);color:var(--text-muted);transition:all .2s; }
    .auto-flag i { font-size:.85rem; }
    .auto-flag.active { background:var(--accent-glow);border-color:rgba(240,165,0,.3);color:var(--text-primary); }
    .auto-flag.active i { color:var(--accent); }
    /* Ressources inline */
    .btn-add-ressource { display:flex;align-items:center;gap:6px;font-size:.8rem;padding:7px 14px;border-radius:var(--radius-md);border-style:dashed;width:100%;justify-content:center;margin-top:8px; }
    .inline-ressources-list { display:flex;flex-direction:column;gap:6px;margin-bottom:8px; }
    .inline-ressource-item { display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-md); }
    .inline-ressource-info { display:flex;align-items:center;gap:10px;font-size:.82rem;flex:1; }
    .inline-ressource-name { font-weight:600;color:var(--text-primary); }
    .inline-ressource-name i { color:var(--accent);margin-right:4px; }
    .inline-ressource-cap,.inline-ressource-desc { color:var(--text-muted);font-size:.78rem; }
    .inline-ressource-form { background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px;margin-top:8px; }
    .inline-ressource-actions { display:flex;gap:8px;justify-content:flex-end;margin-top:10px; }
    /* Panel ressources */
    .ressource-add-form .form-row { align-items:flex-end;gap:8px; }
    .ressource-add-form .form-group { margin-bottom:0; }
    .ressources-list { margin-top:16px;display:flex;flex-direction:column;gap:8px; }
    .ressource-item { display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-md); }
    .ressource-item.archived { opacity:.6; }
    .ressource-info { display:flex;align-items:center;gap:12px;font-size:.875rem; }
    .ressource-cap,.ressource-desc { color:var(--text-muted);font-size:.8rem; }
    .ressource-actions { display:flex;gap:6px; }
  `]
})
export class GerantServicesComponent implements OnInit {
  private api   = inject(ApiService);
  private toast = inject(ToastService);
  private fb    = inject(FormBuilder);

  services: ServiceResponse[]           = [];
  showArchived = false;
  showDuplicatePopup = false;
  showArchivedPopup  = false;
  archivedServiceId: number | null = null;

  get displayedServices(): ServiceResponse[] {
    return this.showArchived ? this.services : this.services.filter(s => !s.archived);
  }
  configs:  Map<number, ConfigServiceResponse> = new Map();
  ressources: RessourceResponse[]       = [];
  selectedService: ServiceResponse | null = null;
  editingService:  ServiceResponse | null = null;

  showModal        = false;
  showRessourcePanel = false;
  step: ModalStep  = 'type';
  selectedType: TypeService | null = null;
  loading         = false;
  loadingRessource = false;

  // Ressources inline (pour création RESSOURCE_PARTAGEE)
  inlineRessources: { nom: string; description: string; capacite: number }[] = [];
  showInlineRessourceForm = false;

  form = this.fb.group({
    nom:                    ['', Validators.required],
    description:            [''],
    dureeMinutes:           [null as number | null],
    tarif:                  [null as number | null],
    capaciteMinPersonnes:   [null as number | null],
    capaciteMaxPersonnes:   [null as number | null],
    annulationHeures:       [null as number | null],
    avanceReservationJours: [null as number | null]
  });

  ressourceForm = this.fb.group({
    nom:         ['', Validators.required],
    description: [''],
    capacite:    [1]
  });

  inlineRessourceForm = this.fb.group({
    nom:         ['', Validators.required],
    description: [''],
    capacite:    [1]
  });

  get autoFlags() {
    return {
      employeObligatoire:  this.selectedType === 'EMPLOYE_DEDIE' || this.selectedType === 'HYBRIDE',
      ressourceObligatoire: this.selectedType === 'RESSOURCE_PARTAGEE' || this.selectedType === 'HYBRIDE',
      reservationEnGroupe:  this.selectedType === 'RESSOURCE_PARTAGEE',
      fileAttenteActive:    true  // RESSOURCE_PARTAGEE appartient aussi à la file d'attente
    };
  }

  get nomPlaceholder(): string {
    const p: Partial<Record<TypeService, string>> = {
      EMPLOYE_DEDIE:      'Ex: Coupe homme, Consultation médecin...',
      RESSOURCE_PARTAGEE: 'Ex: Location terrain padel, Salle de sport...',
      FILE_ATTENTE_PURE:  'Ex: Consultation pharmacie, Guichet admin...',
      HYBRIDE:            'Ex: Vidange, Révision générale...'
    };
    return this.selectedType ? (p[this.selectedType] ?? 'Nom du service') : 'Nom du service';
  }

  get dureePlaceholder(): string {
    const p: Partial<Record<TypeService, string>> = {
      EMPLOYE_DEDIE:      '30 (coupe) / 90 (coloration)',
      RESSOURCE_PARTAGEE: '90 (padel) / 60 (tennis)',
      HYBRIDE:            '60 (vidange) / 120 (révision)'
    };
    return this.selectedType ? (p[this.selectedType] ?? '30') : '30';
  }

  typeLabel(t?: TypeService | null): string {
    const l: Partial<Record<TypeService, string>> = {
      EMPLOYE_DEDIE: 'Employé dédié', RESSOURCE_PARTAGEE: 'Ressource partagée',
      FILE_ATTENTE_PURE: "File d'attente", HYBRIDE: 'Hybride'
    };
    return t ? (l[t] ?? t) : '';
  }

  typeIcon(t?: TypeService | null): string {
    const i: Partial<Record<TypeService, string>> = {
      EMPLOYE_DEDIE: 'fas fa-user-tie', RESSOURCE_PARTAGEE: 'fas fa-layer-group',
      FILE_ATTENTE_PURE: 'fas fa-list-ol', HYBRIDE: 'fas fa-random'
    };
    return t ? (i[t] ?? 'fas fa-concierge-bell') : 'fas fa-concierge-bell';
  }

  getConfig(serviceId: number): ConfigServiceResponse | undefined {
    return this.configs.get(serviceId);
  }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.api.getServices().subscribe(services => {
      this.services = services;
      services.forEach(s => {
        this.api.getConfigService(s.id).subscribe({
          next: c => this.configs.set(s.id, c),
          error: () => {}
        });
      });
    });
  }

  openCreate(): void {
    this.editingService = null;
    this.selectedType   = null;
    this.form.reset();
    this.inlineRessources = [];
    this.showInlineRessourceForm = false;
    this.inlineRessourceForm.reset({ capacite: 1 });
    this.step      = 'type';
    this.showModal = true;
  }

  selectType(t: TypeService): void {
    this.selectedType = t;
    const duree = this.form.get('dureeMinutes');
    const cMin  = this.form.get('capaciteMinPersonnes');
    const cMax  = this.form.get('capaciteMaxPersonnes');

    duree?.clearValidators();
    cMin?.clearValidators();
    cMax?.clearValidators();

    if (t !== 'FILE_ATTENTE_PURE') duree?.setValidators(Validators.required);
    if (t === 'RESSOURCE_PARTAGEE') {
      cMin?.setValidators(Validators.required);
      cMax?.setValidators(Validators.required);
    }

    duree?.updateValueAndValidity();
    cMin?.updateValueAndValidity();
    cMax?.updateValueAndValidity();

    this.step = 'form';
  }

  openEdit(s: ServiceResponse): void {
    this.editingService = s;
    const c = this.configs.get(s.id);
    this.selectedType = c?.typeService ?? null;

    if (this.selectedType) this.selectType(this.selectedType);

    this.form.patchValue({
      nom: s.nom, description: s.description ?? '',
      dureeMinutes: s.dureeMinutes, tarif: s.tarif,
      capaciteMinPersonnes: c?.capaciteMinPersonnes ?? null,
      capaciteMaxPersonnes: c?.capaciteMaxPersonnes ?? null,
      annulationHeures: c?.annulationHeures ?? null,
      avanceReservationJours: c?.avanceReservationJours ?? null
    });

    this.step      = 'form';
    this.showModal = true;
  }

  // Ressources inline
  addInlineRessource(): void {
    this.inlineRessourceForm.markAllAsTouched();
    if (this.inlineRessourceForm.invalid) return;
    const v = this.inlineRessourceForm.getRawValue();
    this.inlineRessources.push({ nom: v.nom!, description: v.description || '', capacite: v.capacite ?? 1 });
    this.inlineRessourceForm.reset({ capacite: 1 });
    this.showInlineRessourceForm = false;
  }

  removeInlineRessource(index: number): void {
    this.inlineRessources.splice(index, 1);
  }

  cancelInlineRessource(): void {
    this.inlineRessourceForm.reset({ capacite: 1 });
    this.showInlineRessourceForm = false;
  }

  confirmDesarchiver(): void {
    if (!this.archivedServiceId) return;
    this.api.desarchiverService(this.archivedServiceId).subscribe({
      next: () => {
        this.toast.success('Service désarchivé !');
        this.load();
        this.showArchivedPopup = false;
      },
      error: () => this.toast.error('Erreur lors du désarchivage')
    });
  }

  closeModal(): void {
    this.showModal      = false;
    this.editingService = null;
    this.selectedType   = null;
    this.form.reset();
    this.inlineRessources = [];
    this.showInlineRessourceForm = false;
    this.inlineRessourceForm.reset({ capacite: 1 });
  }

  save(): void {
    if (this.form.invalid || !this.selectedType) { this.form.markAllAsTouched(); return; }

    // ── RESSOURCE_PARTAGEE : au moins 1 ressource obligatoire ──
    if (!this.editingService && this.selectedType === 'RESSOURCE_PARTAGEE' && this.inlineRessources.length === 0) {
      this.toast.error('Veuillez ajouter au moins une ressource (terrain, salle…) avant de créer ce service.');
      return;
    }

    this.loading = true;
    const v = this.form.getRawValue();
    const flags = this.autoFlags;

    const serviceBody: any = {
      nom: v.nom!, description: v.description || '',
      dureeMinutes: v.dureeMinutes ?? 0, tarif: v.tarif ?? null,
      typeService: this.selectedType
    };

    // Envoyer les ressources inline dans le body (le backend les crée atomiquement)
    if (!this.editingService && this.selectedType === 'RESSOURCE_PARTAGEE') {
      serviceBody.ressources = this.inlineRessources;
    }

    const configBody = {
      typeService:            this.selectedType,
      dureeMinutes:           v.dureeMinutes,
      capaciteMinPersonnes:   v.capaciteMinPersonnes,
      capaciteMaxPersonnes:   v.capaciteMaxPersonnes,
      ressourceObligatoire:   flags.ressourceObligatoire,
      employeObligatoire:     flags.employeObligatoire,
      reservationEnGroupe:    flags.reservationEnGroupe,
      fileAttenteActive:      flags.fileAttenteActive,
      annulationHeures:       v.annulationHeures,
      avanceReservationJours: v.avanceReservationJours
    };

    // ── Vérification doublon côté frontend (avant appel API) ──
    if (!this.editingService && this.selectedType !== 'RESSOURCE_PARTAGEE') {
      const doublon = this.services.find(s =>
        s.nom.trim().toLowerCase() === (v.nom || '').trim().toLowerCase() &&
        s.dureeMinutes === (v.dureeMinutes ?? 0) &&
        String(s.tarif ?? '') === String(v.tarif ?? '')
      );
      if (doublon) {
        this.loading = false;
        if (!doublon.archived) {
          this.closeModal();
          this.showDuplicatePopup = true;
        } else {
          this.archivedServiceId = doublon.id;
          this.closeModal();
          this.showArchivedPopup = true;
        }
        return;
      }
    }

    if (this.editingService) {
      this.api.updateService(this.editingService.id, serviceBody).subscribe({
        next: (s) => {
          const fullConfig = { ...configBody, serviceId: s.id };
          this.api.saveConfigService(fullConfig as any).subscribe({
            next: () => { this.toast.success('Service modifié !'); this.load(); this.closeModal(); this.loading = false; },
            error: () => { this.toast.error('Erreur config'); this.loading = false; }
          });
        },
        error: () => { this.toast.error('Erreur'); this.loading = false; }
      });
    } else {
      this.api.createService(serviceBody).subscribe({
        next: (s) => {
          const fullConfig = { ...configBody, serviceId: s.id };
          this.api.saveConfigService(fullConfig as any).subscribe({
            next: () => {
              // Pour RESSOURCE_PARTAGEE les ressources sont créées côté backend (atomique)
              this.toast.success('Service créé !'); this.load(); this.closeModal(); this.loading = false;
            },
            error: () => { this.toast.error('Service créé mais config échouée'); this.load(); this.closeModal(); this.loading = false; }
          });
        },
        error: (err) => {
          this.closeModal();
          if (err?.status === 409) {
            this.showDuplicatePopup = true;
          } else if (err?.status === 410) {
            const body = err?.error || '';
            const bodyStr = typeof body === 'string' ? body : (body?.message || JSON.stringify(body));
            const match = bodyStr.match(/ARCHIVED:(\d+)/);
            this.archivedServiceId = match ? +match[1] : null;
            this.showArchivedPopup = true;
          } else {
            this.toast.error('Erreur lors de la création');
          }
          this.loading = false;
        }
      });
    }
  }

  archiver(s: ServiceResponse): void {
    this.api.archiverService(s.id).subscribe({ next: () => { this.toast.success('Archivé'); this.load(); }, error: () => this.toast.error('Erreur') });
  }
  desarchiver(s: ServiceResponse): void {
    this.api.desarchiverService(s.id).subscribe({ next: () => { this.toast.success('Désarchivé'); this.load(); }, error: () => this.toast.error('Erreur') });
  }

  openRessourcePanel(s: ServiceResponse): void {
    this.selectedService = s;
    this.ressourceForm.reset({ capacite: 1 });
    this.api.getRessourcesByService(s.id).subscribe(r => this.ressources = r);
    this.showRessourcePanel = true;
  }
  closeRessourcePanel(): void { this.showRessourcePanel = false; this.selectedService = null; this.ressources = []; }

  saveRessource(): void {
    if (this.ressourceForm.invalid || !this.selectedService) return;
    this.loadingRessource = true;
    const v = this.ressourceForm.getRawValue();
    this.api.createRessource({ nom: v.nom!, description: v.description || '', capacite: v.capacite ?? 1, serviceId: this.selectedService.id }).subscribe({
      next: () => { this.toast.success('Ressource ajoutée !'); this.api.getRessourcesByService(this.selectedService!.id).subscribe(r => this.ressources = r); this.ressourceForm.reset({ capacite: 1 }); this.loadingRessource = false; },
      error: () => { this.toast.error('Erreur'); this.loadingRessource = false; }
    });
  }
  archiverRessource(r: RessourceResponse): void {
    this.api.archiverRessource(r.id).subscribe({ next: () => this.api.getRessourcesByService(this.selectedService!.id).subscribe(res => this.ressources = res), error: () => this.toast.error('Erreur') });
  }
  desarchiverRessource(r: RessourceResponse): void {
    this.api.desarchiverRessource(r.id).subscribe({ next: () => this.api.getRessourcesByService(this.selectedService!.id).subscribe(res => this.ressources = res), error: () => this.toast.error('Erreur') });
  }
}