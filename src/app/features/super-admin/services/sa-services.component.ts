import { Component, OnInit, inject, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { ServiceResponse, ConfigServiceResponse, RessourceResponse, EntrepriseResponse, TypeService } from '../../../core/models/api.models';
import { forkJoin, of } from 'rxjs';

type ModalStep = 'type' | 'form';

@Component({
  selector: 'app-sa-services',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
  <div>
    <div class="page-header">
      <div>
        <div class="page-title"><div class="title-icon"><i class="fas fa-concierge-bell"></i></div>Services</div>
        <div class="page-subtitle">Gestion des services de toutes les entreprises</div>
      </div>
    </div>

    <!-- FILTRE PAR ENTREPRISE -->
    <div class="card" style="margin-bottom:16px;padding:16px">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <label style="font-size:.875rem;font-weight:600;color:var(--text-secondary)"><i class="fas fa-building"></i> Entreprise :</label>
        <select class="form-control" style="max-width:280px" [(ngModel)]="selectedEntrepriseId">
          <option [ngValue]="null">-- Toutes les entreprises --</option>
          <option *ngFor="let e of entreprises" [ngValue]="e.id">{{ e.nom }}</option>
        </select>
        <button class="btn btn-primary" (click)="openCreate()" [disabled]="!selectedEntrepriseId"
          [title]="!selectedEntrepriseId ? 'Sélectionnez une entreprise dabord' : 'Créer un service'">
          <i class="fas fa-plus"></i> Nouveau service
        </button>

      </div>
    </div>

    <!-- GRID -->
    <div class="services-grid">
      <div class="service-card" *ngFor="let s of filteredServices"
           (click)="openDetail(s)" style="cursor:pointer">
        <div class="service-header">
          <div class="service-header-top">
            <div class="type-badge" [ngClass]="'type-' + getConfig(s.id)?.typeService?.toLowerCase()">
              <i [class]="typeIcon(getConfig(s.id)?.typeService)"></i>
              {{ typeLabel(getConfig(s.id)?.typeService) }}
            </div>
            <div class="service-actions" (click)="$event.stopPropagation()">
              <button class="btn btn-info btn-sm btn-icon" (click)="openEdit(s)" title="Modifier"><i class="fas fa-pen"></i></button>
              <button class="btn btn-secondary btn-sm ressource-btn" (click)="openRessourcePanel(s)"
                *ngIf="getConfig(s.id)?.ressourceObligatoire" title="Gérer les ressources">
                <i class="fas fa-cubes"></i> Ressources
              </button>
              <button class="btn btn-danger btn-sm btn-icon" (click)="confirmerSuppression(s)" title="Supprimer"><i class="fas fa-trash"></i></button>
            </div>
          </div>
          <div class="ent-badge">{{ getEntNom(s.entrepriseId) }}</div>
        </div>
        <h3 class="service-name">{{ s.nom }}</h3>
        <p class="service-desc">{{ s.description || 'Aucune description' }}</p>
        <div class="service-meta">
          <span><i class="fas fa-clock"></i> {{ s.dureeMinutes }} min</span>
          <span class="service-price">{{ s.tarif != null ? (s.tarif | number:'1.2-2') + ' DT' : 'Gratuit' }}</span>
        </div>
        <div class="config-summary" *ngIf="getConfig(s.id) as c">
          <span *ngIf="c.employeObligatoire" class="badge-flag"><i class="fas fa-user-tie"></i> Employé requis</span>
          <span *ngIf="c.ressourceObligatoire" class="badge-flag"><i class="fas fa-layer-group"></i> Ressource requise</span>
          <span *ngIf="c.reservationEnGroupe" class="badge-flag"><i class="fas fa-users"></i> {{ c.capaciteMinPersonnes }}-{{ c.capaciteMaxPersonnes }} pers.</span>
          <span *ngIf="c.fileAttenteActive" class="badge-flag"><i class="fas fa-list-ol"></i> File active</span>
        </div>
        <div class="no-config" *ngIf="!getConfig(s.id)"><i class="fas fa-exclamation-triangle"></i> Configuration manquante</div>
      </div>
      <div class="empty-state" *ngIf="filteredServices.length === 0">
        <i class="fas fa-concierge-bell"></i>
        <h3>Aucun service{{ selectedEntrepriseId ? ' pour cette entreprise' : '' }}</h3>
        <p *ngIf="!selectedEntrepriseId">Sélectionnez une entreprise pour créer des services</p>
      </div>
    </div>

    <!-- ═══ MODAL DÉTAIL SERVICE ═══ -->
    <div class="modal-overlay" *ngIf="showDetail" (click)="closeDetail()">
      <div class="modal modal-detail" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="modal-title">
            <div class="type-pill" *ngIf="getConfig(detailService!.id) as c"
                 [ngClass]="'type-' + c.typeService?.toLowerCase()">
              <i [class]="typeIcon(c.typeService)"></i> {{ typeLabel(c.typeService) }}
            </div>
            {{ detailService?.nom }}
            <span class="ent-label">{{ getEntNom(detailService?.entrepriseId ?? null) }}</span>
          </div>
          <button class="modal-close" (click)="closeDetail()"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body" *ngIf="detailService as s">
          <div class="detail-section">
            <p *ngIf="s.description" class="detail-desc">{{ s.description }}</p>
            <div class="detail-row">
              <div class="detail-item">
                <div class="detail-label"><i class="fas fa-clock"></i> Durée</div>
                <div class="detail-value">{{ s.dureeMinutes }} min</div>
              </div>
              <div class="detail-item">
                <div class="detail-label"><i class="fas fa-tag"></i> Tarif</div>
                <div class="detail-value" style="color:var(--accent);font-weight:700">
                  {{ s.tarif != null ? (s.tarif | number:'1.2-2') + ' DT' : 'Gratuit' }}
                  <span *ngIf="s.tarif != null && getConfig(s.id)?.tarifParPersonne"
                        style="font-size:.75rem;color:var(--text-muted);font-weight:400"> × pers.</span>
                </div>
              </div>
            </div>
          </div>
          <ng-container *ngIf="getConfig(s.id) as c">
            <div class="detail-section" *ngIf="c.reservationEnGroupe || c.annulationHeures || c.avanceReservationJours">
              <div class="detail-section-title">Règles</div>
              <div class="detail-row">
                <div class="detail-item" *ngIf="c.reservationEnGroupe">
                  <div class="detail-label"><i class="fas fa-users"></i> Groupe</div>
                  <div class="detail-value">{{ c.capaciteMinPersonnes }} – {{ c.capaciteMaxPersonnes }} pers.</div>
                </div>
                <div class="detail-item" *ngIf="c.annulationHeures">
                  <div class="detail-label"><i class="fas fa-ban"></i> Annulation</div>
                  <div class="detail-value">Avant {{ c.annulationHeures }}h</div>
                </div>
                <div class="detail-item" *ngIf="c.avanceReservationJours">
                  <div class="detail-label"><i class="fas fa-calendar-alt"></i> Avance max</div>
                  <div class="detail-value">{{ c.avanceReservationJours }} jours</div>
                </div>
              </div>
            </div>
            <div class="detail-section" *ngIf="c.ressourceObligatoire">
              <div class="detail-section-title">
                <i class="fas fa-layer-group" style="color:var(--accent);margin-right:6px"></i>
                Ressources disponibles
                <span class="ressource-count">{{ detailRessources.length }}</span>
              </div>
              <div class="ressource-blocs">
                <div class="ressource-bloc" *ngFor="let r of detailRessources">
                  <div class="ressource-bloc-icon"><i class="fas fa-cube"></i></div>
                  <div class="ressource-bloc-info">
                    <div class="ressource-bloc-nom">{{ r.nom }}</div>
                    <div class="ressource-bloc-meta">
                      <span *ngIf="r.description" class="ressource-bloc-desc">{{ r.description }}</span>
                    </div>
                  </div>
                </div>
                <div *ngIf="detailRessources.length === 0" style="color:var(--text-muted);font-size:.85rem;padding:12px 0">
                  Aucune ressource configurée
                </div>
              </div>
            </div>
          </ng-container>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" (click)="closeDetail()">Fermer</button>
          <button class="btn btn-info" (click)="closeDetail(); openEdit(detailService!)">
            <i class="fas fa-pen"></i> Modifier
          </button>
        </div>
      </div>
    </div>

    <!-- ═══ ÉTAPE 1 : TYPE ═══ -->
    <div class="modal-overlay" *ngIf="showModal && step === 'type'" (click)="closeModal()">
      <div class="modal modal-type" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="modal-title">
            <i class="fas fa-magic"></i> Quel type de service ?
            <span class="ent-label">{{ getEntNom(selectedEntrepriseId) }}</span>
          </div>
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

    <!-- ═══ ÉTAPE 2 : FORMULAIRE ═══ -->
    <div class="modal-overlay" *ngIf="showModal && step === 'form'" (click)="closeModal()">
      <div class="modal modal-lg" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="modal-title">
            <button class="back-btn" *ngIf="!editingService" (click)="step = 'type'"><i class="fas fa-arrow-left"></i></button>
            <div class="type-pill" [ngClass]="'type-' + selectedType?.toLowerCase()">
              <i [class]="typeIcon(selectedType)"></i> {{ typeLabel(selectedType) }}
            </div>
            {{ editingService ? 'Modifier' : 'Nouveau' }} service
            <span class="ent-label">{{ getEntNom(selectedEntrepriseId) }}</span>
          </div>
          <button class="modal-close" (click)="closeModal()"><i class="fas fa-times"></i></button>
        </div>
        <form [formGroup]="form" (ngSubmit)="save()">
          <div class="modal-body">
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
              <div class="form-group" *ngIf="form.get('tarif')?.value != null && selectedType === 'RESSOURCE_PARTAGEE'">
                <label class="form-label">Mode de tarification</label>
                <div style="display:flex;gap:8px;margin-top:4px">
                  <button type="button"
                    [class]="!form.get('tarifParPersonne')?.value ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'"
                    (click)="form.get('tarifParPersonne')?.setValue(false)">
                    <i class="fas fa-tag"></i> Tarif fixe
                  </button>
                  <button type="button"
                    [class]="form.get('tarifParPersonne')?.value ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'"
                    (click)="form.get('tarifParPersonne')?.setValue(true)">
                    <i class="fas fa-users"></i> Tarif × personnes
                  </button>
                </div>
                <small style="color:var(--text-muted);font-size:.75rem;margin-top:4px;display:block">
                  {{ form.get('tarifParPersonne')?.value
                    ? 'Prix = ' + (form.get('tarif')?.value || 0) + ' DT × nombre de personnes'
                    : 'Prix fixe = ' + (form.get('tarif')?.value || 0) + ' DT par réservation' }}
                </small>
              </div>
            </div>
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

              <!-- ══ RESSOURCES INLINE (création uniquement) ══ -->
              <ng-container *ngIf="!editingService">
                <div class="section-title" style="margin-top:18px">
                  <i class="fas fa-layer-group" style="margin-right:6px;color:var(--accent)"></i>
                  Ressources (terrains, salles…)
                  <span class="optional" style="margin-left:6px;text-transform:none;letter-spacing:0">Vous pourrez ajouter d'autres plus tard</span>
                </div>
                <div class="inline-ressources-list" *ngIf="inlineRessources.length > 0">
                  <div class="inline-ressource-item" *ngFor="let r of inlineRessources; let i = index">
                    <div class="inline-ressource-info">
                      <span class="inline-ressource-name"><i class="fas fa-cube"></i> {{ r.nom }}</span>
                      <span *ngIf="r.description" class="inline-ressource-desc">{{ r.description }}</span>
                    </div>
                    <button type="button" class="btn btn-danger btn-sm btn-icon" (click)="removeInlineRessource(i)" title="Supprimer">
                      <i class="fas fa-times"></i>
                    </button>
                  </div>
                </div>
                <!-- ⚠️ Avertissement ressource obligatoire -->
                <div *ngIf="inlineRessources.length === 0 && !editingService"
                  style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.35);border-radius:10px;margin-bottom:10px;font-size:.82rem;color:#f87171">
                  <i class="fas fa-exclamation-circle" style="font-size:1rem;flex-shrink:0"></i>
                  <span><strong>Au moins une ressource est obligatoire</strong> pour ce type de service (terrain, salle, équipement…)</span>
                </div>

                <div class="inline-add-ressource">
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
            <div class="config-auto">
              <div class="config-auto-title"><i class="fas fa-magic"></i> Configuration automatique</div>
              <div class="config-auto-flags">
                <div class="auto-flag" [class.active]="autoFlags.employeObligatoire"><i class="fas fa-user-tie"></i> Employé obligatoire</div>
                <div class="auto-flag" [class.active]="autoFlags.ressourceObligatoire"><i class="fas fa-layer-group"></i> Ressource obligatoire</div>
                <div class="auto-flag" [class.active]="autoFlags.reservationEnGroupe"><i class="fas fa-users"></i> Réservation en groupe</div>
                <div class="auto-flag" [class.active]="autoFlags.fileAttenteActive"><i class="fas fa-list-ol"></i> File d'attente active</div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="closeModal()">Annuler</button>
            <button type="submit" class="btn btn-primary"
              [disabled]="loading || (selectedType === 'RESSOURCE_PARTAGEE' && !editingService && inlineRessources.length === 0)"
              [title]="selectedType === 'RESSOURCE_PARTAGEE' && !editingService && inlineRessources.length === 0 ? 'Ajoutez au moins une ressource' : ''">
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
              <div class="form-group" style="flex:2"><input formControlName="nom" class="form-control" placeholder="Nom (ex: Terrain 1)"></div>

              <div class="form-group" style="flex:1"><input formControlName="description" class="form-control" placeholder="Description"></div>
              <button type="submit" class="btn btn-primary" [disabled]="loadingRessource"><i class="fas fa-plus"></i></button>
            </div>
          </form>
          <div class="ressources-list">
            <div class="ressource-item" *ngFor="let r of ressources">
              <div class="ressource-info">
                <strong>{{ r.nom }}</strong>
                <span *ngIf="r.description" class="ressource-desc">{{ r.description }}</span>
              </div>
              <div class="ressource-actions">
                <button *ngIf="!r.archived" class="btn btn-danger btn-sm btn-icon" (click)="archiverRessource(r)"><i class="fas fa-archive"></i></button>
                <button *ngIf="r.archived" class="btn btn-success btn-sm btn-icon" (click)="desarchiverRessource(r)"><i class="fas fa-undo"></i></button>
              </div>
            </div>
            <div class="empty-state" *ngIf="ressources.length === 0"><i class="fas fa-layer-group"></i><p>Aucune ressource</p></div>
          </div>
        </div>
      </div>
    </div>

  </div>`,
  styles: [`
    .ressource-btn { display:flex;align-items:center;gap:5px;padding:4px 10px;font-size:.78rem;font-weight:600;border-radius:var(--radius-md);white-space:nowrap; }
    .dup-overlay { position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center; }
    .dup-popup { background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);padding:32px 28px;text-align:center;max-width:340px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.4); }
    .dup-icon { font-size:2.4rem;margin-bottom:12px; }
    .dup-title { font-size:1.1rem;font-weight:700;margin-bottom:8px; }
    .dup-msg { font-size:.875rem;color:var(--text-muted);margin-bottom:20px;line-height:1.5; }
    .services-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px; }
    .service-card { background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px;transition:all .25s; }
    .service-card:hover { border-color:var(--accent);box-shadow:var(--shadow-accent); }
    .service-header { display:flex;flex-direction:column;gap:6px;margin-bottom:10px; }
    .service-header-top { display:flex;align-items:center;justify-content:space-between;gap:6px; }
    .service-actions { display:flex;gap:4px;margin-left:auto; }
    .service-name { font-weight:700;font-size:1rem;margin-bottom:4px; }
    .service-desc { font-size:.8rem;color:var(--text-secondary);margin-bottom:12px;min-height:32px; }
    .service-meta { display:flex;justify-content:space-between;font-size:.8rem;color:var(--text-secondary);margin-bottom:10px; }
    .service-price { font-weight:700;color:var(--accent); }
    .config-summary { display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;padding-top:8px;border-top:1px solid var(--border); }
    .badge-flag { font-size:.72rem;padding:3px 8px;background:var(--accent-glow);border:1px solid rgba(240,165,0,.25);border-radius:20px;color:var(--text-secondary); }
    .badge-flag i { color:var(--accent);margin-right:3px; }
    .no-config { font-size:.75rem;color:var(--danger);margin-top:8px;padding-top:8px;border-top:1px solid var(--border); }
    .ent-badge { font-size:.7rem;background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;padding:2px 8px;color:var(--text-muted);display:inline-block;align-self:flex-start; }
    .ent-label { font-size:.78rem;color:var(--accent);font-weight:600;margin-left:8px; }
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
    .auto-flag.active { background:var(--accent-glow);border-color:rgba(240,165,0,.3);color:var(--text-primary); }
    .auto-flag.active i { color:var(--accent); }
    .btn-add-ressource { display:flex;align-items:center;gap:6px;font-size:.8rem;padding:7px 14px;border-radius:var(--radius-md);border-style:dashed;width:100%;justify-content:center;margin-top:8px; }
    .inline-ressources-list { display:flex;flex-direction:column;gap:6px;margin-bottom:8px; }
    .inline-ressource-item { display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-md); }
    .inline-ressource-info { display:flex;align-items:center;gap:10px;font-size:.82rem;flex:1; }
    .inline-ressource-name { font-weight:600;color:var(--text-primary); }
    .inline-ressource-name i { color:var(--accent);margin-right:4px; }
    .inline-ressource-cap,.inline-ressource-desc { color:var(--text-muted);font-size:.78rem; }
    .inline-ressource-form { background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px;margin-top:8px; }
    .inline-ressource-actions { display:flex;gap:8px;justify-content:flex-end;margin-top:10px; }
    .ressource-add-form .form-row { align-items:flex-end;gap:8px; }
    .ressource-add-form .form-group { margin-bottom:0; }
    .ressources-list { margin-top:16px;display:flex;flex-direction:column;gap:8px; }
    .ressource-item { display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-md); }
    .ressource-item.archived { opacity:.6; }
    .ressource-info { display:flex;align-items:center;gap:12px;font-size:.875rem; }
    .ressource-cap,.ressource-desc { color:var(--text-muted);font-size:.8rem; }
    .ressource-actions { display:flex;gap:6px; }
    /* DETAIL MODAL */
    .modal-detail { max-width:520px; }
    .detail-section { padding:14px 0;border-bottom:1px solid var(--border); }
    .detail-section:last-child { border-bottom:none; }
    .detail-section-title { font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:12px; }
    .detail-desc { font-size:.875rem;color:var(--text-secondary);margin-bottom:14px;line-height:1.6; }
    .detail-row { display:flex;gap:20px;flex-wrap:wrap; }
    .detail-item { display:flex;flex-direction:column;gap:4px;min-width:100px; }
    .detail-label { font-size:.75rem;color:var(--text-muted);font-weight:600; }
    .detail-label i { margin-right:4px; }
    .detail-value { font-size:.95rem;font-weight:600;color:var(--text-primary); }
    .ressource-count { display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:var(--accent-glow);border:1px solid rgba(240,165,0,.3);font-size:.72rem;font-weight:700;color:var(--accent);margin-left:6px; }
    .ressource-blocs { display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-top:10px; }
    .ressource-bloc { display:flex;align-items:center;gap:10px;padding:12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-md);transition:border-color .2s; }
    .ressource-bloc:hover { border-color:var(--accent); }
    .ressource-bloc-icon { width:34px;height:34px;border-radius:var(--radius-sm);background:rgba(16,185,129,.15);color:#34d399;display:flex;align-items:center;justify-content:center;font-size:.9rem;flex-shrink:0; }
    .ressource-bloc-info { display:flex;flex-direction:column;gap:3px;min-width:0; }
    .ressource-bloc-nom { font-weight:700;font-size:.85rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
    .ressource-bloc-meta { display:flex;flex-wrap:wrap;gap:6px;font-size:.75rem;color:var(--text-muted); }
    .ressource-bloc-meta i { margin-right:2px; }
  `]
})
export class SaServicesComponent implements OnInit {
  private api   = inject(ApiService);
  private toast = inject(ToastService);
  private fb    = inject(FormBuilder);
  private renderer = inject(Renderer2);

  services:    ServiceResponse[]                  = [];
  entreprises: EntrepriseResponse[]               = [];
  configs:     Map<number, ConfigServiceResponse> = new Map();
  ressources:  RessourceResponse[]                = [];

  selectedEntrepriseId: number | null             = null;
  selectedService:      ServiceResponse | null    = null;
  editingService:       ServiceResponse | null    = null;

  showModal        = false;
  showRessourcePanel = false;
  step: ModalStep  = 'type';
  selectedType: TypeService | null = null;
  loading          = false;
  loadingRessource = false;

  form = this.fb.group({
    nom:                    ['', Validators.required],
    description:            [''],
    dureeMinutes:           [null as number | null],
    tarif:                  [null as number | null],
    tarifParPersonne:       [false],
    capaciteMinPersonnes:   [null as number | null],
    capaciteMaxPersonnes:   [null as number | null],
    annulationHeures:       [null as number | null],
    avanceReservationJours: [null as number | null]
  });

  ressourceForm = this.fb.group({
    nom:         ['', Validators.required],
    description: [''],
    
  });

  inlineRessourceForm = this.fb.group({
    nom:         ['', Validators.required],
    description: [''],
    
  });

  showDuplicatePopup = false;

  // Detail modal
  showDetail        = false;
  detailService:    ServiceResponse | null   = null;
  detailRessources: RessourceResponse[]      = [];

  // Ressources inline (création RESSOURCE_PARTAGEE)
  inlineRessources: { nom: string; description: string }[] = [];
  showInlineRessourceForm = false;

  get filteredServices(): ServiceResponse[] {
    return this.services.filter(s => !this.selectedEntrepriseId || s.entrepriseId === this.selectedEntrepriseId);
  }

  get autoFlags() {
    return {
      employeObligatoire:   this.selectedType === 'EMPLOYE_DEDIE' || this.selectedType === 'HYBRIDE',
      ressourceObligatoire: this.selectedType === 'RESSOURCE_PARTAGEE' || this.selectedType === 'HYBRIDE',
      reservationEnGroupe:  this.selectedType === 'RESSOURCE_PARTAGEE',
      fileAttenteActive:    true
    };
  }

  get nomPlaceholder(): string {
    const p: Partial<Record<TypeService, string>> = {
      EMPLOYE_DEDIE: 'Ex: Coupe homme, Consultation médecin...', RESSOURCE_PARTAGEE: 'Ex: Location terrain padel...',
      FILE_ATTENTE_PURE: 'Ex: Consultation pharmacie...', HYBRIDE: 'Ex: Vidange, Révision générale...'
    };
    return this.selectedType ? (p[this.selectedType] ?? 'Nom du service') : 'Nom du service';
  }

  get dureePlaceholder(): string {
    const p: Partial<Record<TypeService, string>> = {
      EMPLOYE_DEDIE: '30 (coupe) / 90 (coloration)', RESSOURCE_PARTAGEE: '90 (padel) / 60 (tennis)', HYBRIDE: '60 (vidange)'
    };
    return this.selectedType ? (p[this.selectedType] ?? '30') : '30';
  }

  typeLabel(t?: TypeService | null): string {
    const l: Partial<Record<TypeService, string>> = { EMPLOYE_DEDIE: 'Employé dédié', RESSOURCE_PARTAGEE: 'Ressource partagée', FILE_ATTENTE_PURE: "File d'attente", HYBRIDE: 'Hybride' };
    return t ? (l[t] ?? t) : '';
  }

  typeIcon(t?: TypeService | null): string {
    const i: Partial<Record<TypeService, string>> = { EMPLOYE_DEDIE: 'fas fa-user-tie', RESSOURCE_PARTAGEE: 'fas fa-layer-group', FILE_ATTENTE_PURE: 'fas fa-list-ol', HYBRIDE: 'fas fa-random' };
    return t ? (i[t] ?? 'fas fa-concierge-bell') : 'fas fa-concierge-bell';
  }

  getConfig(id: number): ConfigServiceResponse | undefined { return this.configs.get(id); }
  getEntNom(id: number | null): string { return this.entreprises.find(e => e.id === id)?.nom ?? ''; }

  openDetail(s: ServiceResponse): void {
    this.detailService = s;
    this.detailRessources = [];
    const c = this.configs.get(s.id);
    if (c?.ressourceObligatoire) {
      this.api.getRessourcesByService(s.id).subscribe(r => this.detailRessources = r);
    }
    this.showDetail = true;
  }

  closeDetail(): void { this.showDetail = false; this.detailService = null; this.detailRessources = []; }

  ngOnInit(): void {
    forkJoin({ s: this.api.getServices(), e: this.api.getEntreprises() }).subscribe(d => {
      this.services    = d.s;
      this.entreprises = d.e;
      d.s.forEach(s => this.api.getConfigService(s.id).subscribe({ next: c => this.configs.set(s.id, c), error: () => {} }));
    });
  }

  openCreate(): void {
    if (!this.selectedEntrepriseId) return;
    this.editingService = null;
    this.selectedType   = null;
    this.form.reset();
    this.inlineRessources = [];
    this.showInlineRessourceForm = false;
    this.inlineRessourceForm.reset();
    this.step      = 'type';
    this.showModal = true;
  }

  selectType(t: TypeService): void {
    this.selectedType = t;
    const duree = this.form.get('dureeMinutes');
    const cMin  = this.form.get('capaciteMinPersonnes');
    const cMax  = this.form.get('capaciteMaxPersonnes');
    duree?.clearValidators(); cMin?.clearValidators(); cMax?.clearValidators();
    if (t !== 'FILE_ATTENTE_PURE') duree?.setValidators(Validators.required);
    if (t === 'RESSOURCE_PARTAGEE') { cMin?.setValidators(Validators.required); cMax?.setValidators(Validators.required); }
    duree?.updateValueAndValidity(); cMin?.updateValueAndValidity(); cMax?.updateValueAndValidity();
    this.step = 'form';
  }

  openEdit(s: ServiceResponse): void {
    this.editingService      = s;
    this.selectedEntrepriseId = s.entrepriseId;
    const c = this.configs.get(s.id);
    this.selectedType = c?.typeService ?? null;
    if (this.selectedType) this.selectType(this.selectedType);
    this.form.patchValue({
      nom: s.nom, description: s.description ?? '', dureeMinutes: s.dureeMinutes, tarif: s.tarif,
      capaciteMinPersonnes: c?.capaciteMinPersonnes ?? null, capaciteMaxPersonnes: c?.capaciteMaxPersonnes ?? null,
      annulationHeures: c?.annulationHeures ?? null, avanceReservationJours: c?.avanceReservationJours ?? null,
      tarifParPersonne: c?.tarifParPersonne ?? false
    });
    this.step      = 'form';
    this.showModal = true;
  }

  // Ressources inline
  addInlineRessource(): void {
    this.inlineRessourceForm.markAllAsTouched();
    if (this.inlineRessourceForm.invalid) return;
    const v = this.inlineRessourceForm.getRawValue();
    this.inlineRessources.push({ nom: v.nom!, description: v.description || '' });
    this.inlineRessourceForm.reset();
    this.showInlineRessourceForm = false;
  }

  removeInlineRessource(index: number): void {
    this.inlineRessources.splice(index, 1);
  }

  cancelInlineRessource(): void {
    this.inlineRessourceForm.reset();
    this.showInlineRessourceForm = false;
  }

  openBodyDialog(type: 'duplicate', customMsg?: string): void {
    const overlay = this.renderer.createElement('div');
    this.renderer.setStyle(overlay, 'position', 'fixed');
    this.renderer.setStyle(overlay, 'inset', '0');
    this.renderer.setStyle(overlay, 'background', 'rgba(0,0,0,0.65)');
    this.renderer.setStyle(overlay, 'z-index', '99999');
    this.renderer.setStyle(overlay, 'display', 'flex');
    this.renderer.setStyle(overlay, 'align-items', 'center');
    this.renderer.setStyle(overlay, 'justify-content', 'center');
    const box = this.renderer.createElement('div');
    this.renderer.setStyle(box, 'background', '#1e1e2e');
    this.renderer.setStyle(box, 'border', '1px solid rgba(255,255,255,0.1)');
    this.renderer.setStyle(box, 'border-radius', '16px');
    this.renderer.setStyle(box, 'padding', '36px 32px');
    this.renderer.setStyle(box, 'text-align', 'center');
    this.renderer.setStyle(box, 'max-width', '380px');
    this.renderer.setStyle(box, 'width', '90%');
    this.renderer.setStyle(box, 'box-shadow', '0 24px 64px rgba(0,0,0,0.6)');
    this.renderer.setStyle(box, 'font-family', 'inherit');
    const close = () => this.renderer.removeChild(document.body, overlay);
    const msg = customMsg || 'Un service identique (même nom, durée, tarif) est déjà actif dans cette entreprise.';
    box.innerHTML = `
      <div style="font-size:2.5rem;margin-bottom:14px">⚠️</div>
      <div style="font-size:1.1rem;font-weight:700;color:#fff;margin-bottom:8px">Service déjà existant</div>
      <div style="font-size:.875rem;color:#aaa;margin-bottom:24px;line-height:1.6">${msg}</div>
      <button id="dup-ok" style="background:#6366f1;color:#fff;border:none;padding:10px 28px;border-radius:8px;font-size:.9rem;font-weight:600;cursor:pointer">OK</button>
    `;
    this.renderer.appendChild(overlay, box);
    this.renderer.appendChild(document.body, overlay);
    box.querySelector('#dup-ok')!.addEventListener('click', close);
    overlay.addEventListener('click', (e: Event) => { if (e.target === overlay) close(); });
  }



  closeModal(): void {
    this.showModal = false;
    this.editingService = null;
    this.selectedType = null;
    this.form.reset();
    this.inlineRessources = [];
    this.showInlineRessourceForm = false;
    this.inlineRessourceForm.reset();
  }

  save(): void {
    if (this.form.invalid || !this.selectedType || !this.selectedEntrepriseId) { this.form.markAllAsTouched(); return; }
    if (!this.editingService && this.selectedType === 'RESSOURCE_PARTAGEE' && this.inlineRessources.length === 0) {
      this.toast.error('Veuillez ajouter au moins une ressource avant de créer ce service.');
      return;
    }
    this.loading = true;
    const v     = this.form.getRawValue();
    const flags = this.autoFlags;
    console.log('[DEBUG save()] selectedType:', this.selectedType, '| editingService:', !!this.editingService, '| inlineRessources:', JSON.stringify(this.inlineRessources));
    const serviceBody: any = { nom: v.nom!, description: v.description || '', dureeMinutes: v.dureeMinutes ?? 0, tarif: v.tarif ?? null, entrepriseId: this.selectedEntrepriseId, typeService: this.selectedType };
    // RESSOURCE_PARTAGEE : envoyer les ressources inline dans le body (back les crée atomiquement)
    if (!this.editingService && this.selectedType === 'RESSOURCE_PARTAGEE') {
      serviceBody.ressources = this.inlineRessources;
    }
    console.log('[DEBUG] serviceBody envoyé:', JSON.stringify(serviceBody));
    const configBody  = { typeService: this.selectedType, dureeMinutes: v.dureeMinutes, capaciteMinPersonnes: v.capaciteMinPersonnes, capaciteMaxPersonnes: v.capaciteMaxPersonnes, ...flags, annulationHeures: v.annulationHeures, avanceReservationJours: v.avanceReservationJours, tarifParPersonne: v.tarifParPersonne ?? false };

    // ── Vérification doublon côté frontend (avant appel API) ──
    if (!this.editingService && this.selectedType !== 'RESSOURCE_PARTAGEE') {
      const sameEnt = this.services.filter(s => s.entrepriseId === this.selectedEntrepriseId);
      const doublon = sameEnt.find(s =>
        s.nom.trim().toLowerCase() === (v.nom || '').trim().toLowerCase() &&
        s.dureeMinutes === (v.dureeMinutes ?? 0) &&
        String(s.tarif ?? '') === String(v.tarif ?? '')
      );
      if (doublon) {
        this.loading = false;
        this.closeModal();
        this.openBodyDialog('duplicate');
        return;
      }
    }

    if (this.editingService) {
      this.api.updateService(this.editingService.id, serviceBody).subscribe({
        next: (s) => {
          this.api.saveConfigService({ ...configBody, serviceId: s.id } as any).subscribe({
            next: () => {
              this.toast.success('Service modifié !');
              forkJoin({ s: this.api.getServices(), e: this.api.getEntreprises() }).subscribe(d => {
                this.services = d.s;
                d.s.forEach(sv => this.api.getConfigService(sv.id).subscribe({ next: c => this.configs.set(sv.id, c), error: () => {} }));
              });
              this.closeModal(); this.loading = false;
            },
            error: () => { this.toast.error('Config échouée'); this.loading = false; }
          });
        },
        error: () => { this.toast.error('Erreur'); this.loading = false; }
      });
    } else {
      this.api.createService(serviceBody).subscribe({
        next: (s) => {
          const finish = () => { this.toast.success('Service créé !'); this.reloadAll(); this.closeModal(); this.loading = false; };
          // RESSOURCE_PARTAGEE : le back crée config + ressources atomiquement
          if (this.selectedType === 'RESSOURCE_PARTAGEE') { finish(); return; }
          this.api.saveConfigService({ ...configBody, serviceId: s.id } as any).subscribe({
            next: () => {
              finish();
            },
            error: () => { this.toast.error('Config échouée'); this.loading = false; }
          });
        },
        error: (err) => {
          this.closeModal();
          if (err?.status === 409) {
            const errMsg = err?.error?.message || (typeof err?.error === 'string' ? err?.error : null);
            this.openBodyDialog('duplicate', errMsg || undefined);
          } else {
            this.toast.error('Erreur lors de la création');
          }
          this.loading = false;
        }
      });
    }
  }

  private reloadAll(): void {
    forkJoin({ s: this.api.getServices(), e: this.api.getEntreprises() }).subscribe(d => {
      this.services = d.s;
      d.s.forEach(sv => this.api.getConfigService(sv.id).subscribe({ next: c => this.configs.set(sv.id, c), error: () => {} }));
    });
  }

  confirmerSuppression(s: ServiceResponse): void {
    const config = this.configs.get(s.id);
    const isRessourcePartagee = config?.typeService === 'RESSOURCE_PARTAGEE';

    forkJoin({
      reservations: this.api.getReservations(),
      fileAttente: this.api.getFileAttente(),
      // Pour RESSOURCE_PARTAGEE : les ressources sont supprimées automatiquement, elles ne bloquent pas
      ressources: isRessourcePartagee ? of([]) : this.api.getRessourcesByService(s.id),
    }).subscribe({
      next: ({ reservations, fileAttente, ressources }) => {
        const resLiees = reservations.filter(r => r.serviceId === s.id);
        const fileLiee = fileAttente.filter(f => f.serviceId === s.id);
        const hasLinks = resLiees.length > 0 || fileLiee.length > 0 || ressources.length > 0;

        if (hasLinks) {
          this.openLinkedDialog(s, resLiees.length, fileLiee.length, ressources.length);
        } else {
          this._showDeleteConfirm(s);
        }
      },
      error: () => {
        // En cas d'erreur de vérification, on tente la suppression directement
        this._showDeleteConfirm(s);
      }
    });
  }

  private _showDeleteConfirm(s: ServiceResponse): void {
    const config = this.configs.get(s.id);
    const isRessourcePartagee = config?.typeService === 'RESSOURCE_PARTAGEE';
    const nbRessources = isRessourcePartagee
      ? (this.ressources.length > 0 ? this.ressources.length : null)
      : null;

    const overlay = this.renderer.createElement('div');
    this.renderer.setStyle(overlay, 'position', 'fixed');
    this.renderer.setStyle(overlay, 'inset', '0');
    this.renderer.setStyle(overlay, 'background', 'rgba(0,0,0,0.65)');
    this.renderer.setStyle(overlay, 'z-index', '99999');
    this.renderer.setStyle(overlay, 'display', 'flex');
    this.renderer.setStyle(overlay, 'align-items', 'center');
    this.renderer.setStyle(overlay, 'justify-content', 'center');

    const box = this.renderer.createElement('div');
    this.renderer.setStyle(box, 'background', '#1e1e2e');
    this.renderer.setStyle(box, 'border', '1px solid rgba(239,68,68,.3)');
    this.renderer.setStyle(box, 'border-radius', '16px');
    this.renderer.setStyle(box, 'padding', '32px 28px');
    this.renderer.setStyle(box, 'text-align', 'center');
    this.renderer.setStyle(box, 'max-width', '380px');
    this.renderer.setStyle(box, 'width', '90%');
    this.renderer.setStyle(box, 'box-shadow', '0 24px 64px rgba(0,0,0,0.6)');
    this.renderer.setStyle(box, 'font-family', 'inherit');

    const close = () => this.renderer.removeChild(document.body, overlay);

    const ressourceWarning = isRessourcePartagee
      ? `<div style="display:flex;align-items:center;gap:8px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.25);
             border-radius:10px;padding:10px 14px;margin-bottom:18px;text-align:left;font-size:.8rem;color:#6ee7b7">
           <span style="font-size:1.1rem;flex-shrink:0">🧩</span>
           <span>Les ressources associées (terrains, salles…) seront <strong>supprimées automatiquement</strong> avec ce service.</span>
         </div>`
      : '';

    box.innerHTML = `
      <div style="font-size:2.2rem;margin-bottom:12px">🗑️</div>
      <div style="font-size:1.05rem;font-weight:700;color:#fff;margin-bottom:8px">
        Supprimer ce service ?
      </div>
      <div style="font-size:.875rem;color:#94a3b8;margin-bottom:14px;line-height:1.5">
        <strong style="color:#fff">${s.nom}</strong>
      </div>
      ${ressourceWarning}
      <div style="font-size:.78rem;color:#f87171;margin-bottom:22px">
        ⚠️ Cette action est irréversible.
      </div>
      <div style="display:flex;gap:10px;justify-content:center">
        <button id="del-cancel"
          style="background:transparent;color:#aaa;border:1px solid rgba(255,255,255,0.15);
          padding:9px 20px;border-radius:8px;font-size:.875rem;cursor:pointer">
          Annuler
        </button>
        <button id="del-ok"
          style="background:#ef4444;color:#fff;border:none;
          padding:9px 22px;border-radius:8px;font-size:.875rem;font-weight:700;cursor:pointer">
          Supprimer
        </button>
      </div>
    `;

    this.renderer.appendChild(overlay, box);
    this.renderer.appendChild(document.body, overlay);

    box.querySelector('#del-cancel')!.addEventListener('click', close);
    box.querySelector('#del-ok')!.addEventListener('click', () => {
      close();
      this.api.deleteService(s.id).subscribe({
        next: () => { this.toast.success('Service supprimé'); this.reloadAll(); },
        error: (err) => {
          if (err.status === 409 || err.status === 400) {
            this.openLinkedDialog(s, 0, 0, 0);
            return;
          }
          this.toast.error('Erreur lors de la suppression');
        }
      });
    });

    overlay.addEventListener('click', (e: Event) => { if (e.target === overlay) close(); });
  }

  openRessourcePanel(s: ServiceResponse): void {
    this.selectedService = s;
    this.ressourceForm.reset();
    this.api.getRessourcesByService(s.id).subscribe(r => this.ressources = r);
    this.showRessourcePanel = true;
  }
  closeRessourcePanel(): void { this.showRessourcePanel = false; this.selectedService = null; this.ressources = []; }

  saveRessource(): void {
    if (this.ressourceForm.invalid || !this.selectedService) return;
    this.loadingRessource = true;
    const v = this.ressourceForm.getRawValue();
    this.api.createRessource({ nom: v.nom!, description: v.description || '', serviceId: this.selectedService.id }).subscribe({
      next: () => { this.toast.success('Ressource ajoutée !'); this.api.getRessourcesByService(this.selectedService!.id).subscribe(r => this.ressources = r); this.ressourceForm.reset(); this.loadingRessource = false; },
      error: () => { this.toast.error('Erreur'); this.loadingRessource = false; }
    });
  }
  archiverRessource(r: RessourceResponse): void {
    this._confirmAction({
      icon: '📦',
      title: 'Archiver cette ressource ?',
      message: `<strong style="color:#fff">${r.nom}</strong><br><span style="font-size:.8rem;color:#94a3b8">La ressource ne sera plus disponible à la réservation.</span>`,
      confirmLabel: 'Archiver',
      confirmColor: '#d97706',
      onConfirm: () => this.api.archiverRessource(r.id).subscribe({
        next: () => this.api.getRessourcesByService(this.selectedService!.id).subscribe(res => this.ressources = res),
        error: () => this.toast.error('Erreur')
      })
    });
  }

  desarchiverRessource(r: RessourceResponse): void {
    this._confirmAction({
      icon: '✅',
      title: 'Réactiver cette ressource ?',
      message: `<strong style="color:#fff">${r.nom}</strong><br><span style="font-size:.8rem;color:#94a3b8">La ressource sera de nouveau disponible à la réservation.</span>`,
      confirmLabel: 'Réactiver',
      confirmColor: '#16a34a',
      onConfirm: () => this.api.desarchiverRessource(r.id).subscribe({
        next: () => this.api.getRessourcesByService(this.selectedService!.id).subscribe(res => this.ressources = res),
        error: () => this.toast.error('Erreur')
      })
    });
  }

  private _confirmAction(opts: {
    icon: string; title: string; message: string;
    confirmLabel: string; confirmColor: string; onConfirm: () => void;
  }): void {
    const overlay = this.renderer.createElement('div');
    this.renderer.setStyle(overlay, 'position', 'fixed');
    this.renderer.setStyle(overlay, 'inset', '0');
    this.renderer.setStyle(overlay, 'background', 'rgba(0,0,0,0.65)');
    this.renderer.setStyle(overlay, 'z-index', '99999');
    this.renderer.setStyle(overlay, 'display', 'flex');
    this.renderer.setStyle(overlay, 'align-items', 'center');
    this.renderer.setStyle(overlay, 'justify-content', 'center');
    const box = this.renderer.createElement('div');
    this.renderer.setStyle(box, 'background', '#1e1e2e');
    this.renderer.setStyle(box, 'border', '1px solid rgba(255,255,255,0.1)');
    this.renderer.setStyle(box, 'border-radius', '16px');
    this.renderer.setStyle(box, 'padding', '32px 28px');
    this.renderer.setStyle(box, 'text-align', 'center');
    this.renderer.setStyle(box, 'max-width', '360px');
    this.renderer.setStyle(box, 'width', '90%');
    this.renderer.setStyle(box, 'box-shadow', '0 24px 64px rgba(0,0,0,0.6)');
    this.renderer.setStyle(box, 'font-family', 'inherit');
    const close = () => this.renderer.removeChild(document.body, overlay);
    box.innerHTML = `
      <div style="font-size:2.2rem;margin-bottom:12px">${opts.icon}</div>
      <div style="font-size:1.05rem;font-weight:700;color:#fff;margin-bottom:10px">${opts.title}</div>
      <div style="font-size:.875rem;color:#94a3b8;margin-bottom:22px;line-height:1.6">${opts.message}</div>
      <div style="display:flex;gap:10px;justify-content:center">
        <button id="ca-cancel" style="background:transparent;color:#aaa;border:1px solid rgba(255,255,255,0.15);padding:9px 20px;border-radius:8px;font-size:.875rem;cursor:pointer">Annuler</button>
        <button id="ca-ok" style="background:${opts.confirmColor};color:#fff;border:none;padding:9px 22px;border-radius:8px;font-size:.875rem;font-weight:700;cursor:pointer">${opts.confirmLabel}</button>
      </div>
    `;
    this.renderer.appendChild(overlay, box);
    this.renderer.appendChild(document.body, overlay);
    box.querySelector('#ca-cancel')!.addEventListener('click', close);
    box.querySelector('#ca-ok')!.addEventListener('click', () => { close(); opts.onConfirm(); });
    overlay.addEventListener('click', (e: Event) => { if (e.target === overlay) close(); });
  }

  openLinkedDialog(s: ServiceResponse, nbReservations: number, nbFileAttente: number, nbRessources: number): void {
    const overlay = this.renderer.createElement('div');
    this.renderer.setStyle(overlay, 'position', 'fixed');
    this.renderer.setStyle(overlay, 'inset', '0');
    this.renderer.setStyle(overlay, 'background', 'rgba(0,0,0,0.7)');
    this.renderer.setStyle(overlay, 'z-index', '99999');
    this.renderer.setStyle(overlay, 'display', 'flex');
    this.renderer.setStyle(overlay, 'align-items', 'center');
    this.renderer.setStyle(overlay, 'justify-content', 'center');

    const box = this.renderer.createElement('div');
    this.renderer.setStyle(box, 'background', '#1e1e2e');
    this.renderer.setStyle(box, 'border', '1px solid rgba(245,158,11,.4)');
    this.renderer.setStyle(box, 'border-radius', '18px');
    this.renderer.setStyle(box, 'padding', '32px 28px 28px');
    this.renderer.setStyle(box, 'text-align', 'center');
    this.renderer.setStyle(box, 'max-width', '440px');
    this.renderer.setStyle(box, 'width', '92%');
    this.renderer.setStyle(box, 'box-shadow', '0 24px 64px rgba(0,0,0,0.7)');
    this.renderer.setStyle(box, 'font-family', 'inherit');

    const close = () => this.renderer.removeChild(document.body, overlay);

    // Build dynamic list of linked items
    const items: string[] = [];
    if (nbReservations > 0) items.push(`
      <div style="display:flex;align-items:center;gap:10px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);
           border-radius:10px;padding:10px 14px;text-align:left">
        <span style="font-size:1.3rem">📅</span>
        <div>
          <div style="color:#fff;font-weight:600;font-size:.88rem">Réservations</div>
          <div style="color:#f87171;font-size:.8rem">${nbReservations} réservation${nbReservations > 1 ? 's' : ''} liée${nbReservations > 1 ? 's' : ''}</div>
        </div>
      </div>`);
    if (nbFileAttente > 0) items.push(`
      <div style="display:flex;align-items:center;gap:10px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);
           border-radius:10px;padding:10px 14px;text-align:left">
        <span style="font-size:1.3rem">🕐</span>
        <div>
          <div style="color:#fff;font-weight:600;font-size:.88rem">File d'attente</div>
          <div style="color:#fbbf24;font-size:.8rem">${nbFileAttente} entrée${nbFileAttente > 1 ? 's' : ''} en file d'attente</div>
        </div>
      </div>`);
    if (nbRessources > 0) items.push(`
      <div style="display:flex;align-items:center;gap:10px;background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.2);
           border-radius:10px;padding:10px 14px;text-align:left">
        <span style="font-size:1.3rem">🧩</span>
        <div>
          <div style="color:#fff;font-weight:600;font-size:.88rem">Ressources</div>
          <div style="color:#818cf8;font-size:.8rem">${nbRessources} ressource${nbRessources > 1 ? 's' : ''} associée${nbRessources > 1 ? 's' : ''}</div>
        </div>
      </div>`);

    // Fallback if called from error handler (no counts)
    const itemsHtml = items.length > 0
      ? `<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:22px">${items.join('')}</div>`
      : `<div style="font-size:.88rem;color:#aaa;margin-bottom:22px;line-height:1.6">
           Ce service est lié à des <strong style="color:#fff">réservations, ressources ou configurations</strong> existantes.
         </div>`;

    box.innerHTML = `
      <div style="width:52px;height:52px;background:rgba(245,158,11,.12);border:2px solid rgba(245,158,11,.35);
           border-radius:50%;display:flex;align-items:center;justify-content:center;
           font-size:1.6rem;margin:0 auto 16px">⚠️</div>

      <div style="font-size:1.1rem;font-weight:700;color:#fff;margin-bottom:6px">
        Suppression impossible
      </div>

      <div style="font-size:.82rem;color:#94a3b8;margin-bottom:18px;line-height:1.5">
        Le service <strong style="color:#f1f5f9">${s.nom}</strong> ne peut pas être supprimé
        car il est encore lié aux éléments suivants :
      </div>

      ${itemsHtml}

      <div style="font-size:.78rem;color:#64748b;margin-bottom:20px;line-height:1.5;background:rgba(255,255,255,.03);
           border-radius:8px;padding:10px;border:1px solid rgba(255,255,255,.06)">
        💡 Supprimez ou dissociez d'abord ces éléments, puis réessayez.
      </div>

      <button id="linked-ok"
        style="background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;
        padding:11px 36px;border-radius:10px;font-size:.9rem;font-weight:600;cursor:pointer;
        width:100%;transition:opacity .2s"
        onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
        Compris
      </button>
    `;

    this.renderer.appendChild(overlay, box);
    this.renderer.appendChild(document.body, overlay);

    box.querySelector('#linked-ok')!.addEventListener('click', close);
    overlay.addEventListener('click', (e: Event) => { if (e.target === overlay) close(); });
  }
}