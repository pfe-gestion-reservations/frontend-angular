import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { FileAttenteResponse, ReservationResponse } from '../../../core/models/api.models';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-gerant-file',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div>
    <div class="page-header">
      <div>
        <div class="page-title"><div class="title-icon"><i class="fas fa-list-ol"></i></div>File d'attente</div>
        <div class="page-subtitle">Salle d'attente en temps réel</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" (click)="showAddPanel = !showAddPanel">
          <i class="fas fa-plus"></i> Ajouter à la file
        </button>
        <button class="btn btn-secondary" (click)="load()">
          <i class="fas fa-sync-alt"></i> Actualiser
        </button>
      </div>
    </div>

    <!-- PANEL AJOUT -->
    <div class="add-panel" *ngIf="showAddPanel">
      <div class="add-panel-header">
        <div class="add-panel-title"><i class="fas fa-user-plus"></i> Ajouter un client à la file</div>
        <button class="btn-close-panel" (click)="showAddPanel = false"><i class="fas fa-times"></i></button>
      </div>
      <div class="add-panel-body">
        <div class="form-group">
          <label class="form-label" for="resSearch">Choisir une réservation confirmée</label>
          <div class="searchable-select" [class.open]="resDropdownOpen">
            <div class="ss-input-wrap">
              <i class="fas fa-search ss-icon"></i>
              <input id="resSearch" name="resSearch" class="ss-input"
                [(ngModel)]="resSearch"
                placeholder="Rechercher par client ou service..."
                (focus)="resDropdownOpen = true"
                (input)="filterReservations()">
              <button type="button" class="ss-clear" *ngIf="selectedReservation" (click)="clearResSelect()">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <div class="ss-dropdown" *ngIf="resDropdownOpen">
              <div class="ss-option" *ngFor="let r of filteredReservations"
                (mousedown)="selectReservation(r)">
                <i class="fas fa-calendar-check"></i>
                <div>
                  <strong>{{ r.clientNom }}</strong> — {{ r.serviceNom }}
                  <div class="ss-sub">{{ r.heureDebut | date:'dd/MM/yyyy HH:mm' }} · {{ r.employeNom }}</div>
                </div>
              </div>
              <div class="ss-empty" *ngIf="filteredReservations.length === 0">Aucune réservation confirmée</div>
            </div>
          </div>
        </div>

        <!-- RECAP -->
        <div class="recap-card" *ngIf="selectedReservation">
          <div class="recap-row"><span>Client</span><strong>{{ selectedReservation.clientNom }}</strong></div>
          <div class="recap-row"><span>Employé</span><strong>{{ selectedReservation.employeNom }}</strong></div>
          <div class="recap-row"><span>Service</span><strong>{{ selectedReservation.serviceNom }}</strong></div>
          <div class="recap-row"><span>RDV</span><strong>{{ selectedReservation.heureDebut | date:'dd/MM/yyyy HH:mm' }}</strong></div>
        </div>
      </div>
      <div class="add-panel-footer">
        <button class="btn btn-secondary" (click)="showAddPanel = false">Annuler</button>
        <button class="btn btn-primary" (click)="ajouterFile()" [disabled]="!selectedReservation || addLoading">
          <span *ngIf="addLoading">Ajout...</span>
          <span *ngIf="!addLoading"><i class="fas fa-user-plus"></i> Confirmer l'ajout</span>
        </button>
      </div>
    </div>

    <!-- FILE D'ATTENTE -->
    <div class="queue-list">
      <div class="queue-card" *ngFor="let f of fileAttente; let i = index"
           [class.queue-en-cours]="f.statut === 'EN_COURS'"
           [class.queue-appele]="f.statut === 'APPELE'">
        <div class="queue-position">{{ i + 1 }}</div>
        <div class="queue-info">
          <div class="queue-name">{{ f.clientNom }} {{ f.clientPrenom }}</div>
          <div class="queue-service">{{ f.serviceNom }} — <em>{{ f.employeNom }}</em></div>
          <div class="queue-times">
            <span><i class="fas fa-walking"></i> Arrivée : {{ f.heureArrivee | date:'HH:mm' }}</span>
            <span *ngIf="f.dateHeureRdv"><i class="fas fa-calendar-alt"></i> RDV : {{ f.dateHeureRdv | date:'HH:mm' }}</span>
          </div>
        </div>
        <span class="badge" [ngClass]="statutClass(f.statut)">{{ f.statut }}</span>
        <button class="btn btn-danger btn-sm"
          *ngIf="f.statut === 'EN_ATTENTE' || f.statut === 'APPELE' || f.statut === 'EN_COURS'"
          (click)="annuler(f)">
          <i class="fas fa-times"></i> Annuler
        </button>
      </div>
      <div class="empty-state" *ngIf="fileAttente.length === 0">
        <i class="fas fa-door-open"></i>
        <h3>File d'attente vide</h3>
        <p>Aucun client en attente.</p>
      </div>
    </div>
  </div>`,
  styles: [`
    /* ADD PANEL */
    .add-panel { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius-lg); margin-bottom: 20px; overflow: hidden; box-shadow: var(--shadow-sm); }
    .add-panel-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; background: var(--accent-glow); border-bottom: 1px solid var(--border); }
    .add-panel-title { font-size: .875rem; font-weight: 600; color: var(--accent); display: flex; align-items: center; gap: 8px; }
    .btn-close-panel { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px 6px; border-radius: var(--radius-sm); font-size: .8rem; }
    .btn-close-panel:hover { background: var(--bg-hover); }
    .add-panel-body { padding: 20px; }
    .add-panel-footer { display: flex; gap: 8px; justify-content: flex-end; padding: 12px 20px; border-top: 1px solid var(--border); background: var(--bg); }

    /* RECAP */
    .recap-card { background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 12px 16px; margin-top: 12px; display: flex; flex-direction: column; gap: 6px; }
    .recap-row { display: flex; justify-content: space-between; font-size: .82rem; color: var(--text-secondary); }
    .recap-row strong { color: var(--text-primary); }

    /* SEARCHABLE SELECT */
    .searchable-select { position: relative; }
    .ss-input-wrap { display: flex; align-items: center; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg-secondary); transition: border-color .15s; overflow: hidden; }
    .searchable-select.open .ss-input-wrap { border-color: var(--accent); }
    .ss-icon { padding: 0 10px; color: var(--text-muted); font-size: .8rem; flex-shrink: 0; }
    .ss-input { flex: 1; border: none; background: none; padding: 9px 8px 9px 0; font-size: .875rem; color: var(--text-primary); outline: none; width: 100%; }
    .ss-clear { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 0 10px; font-size: .75rem; }
    .ss-clear:hover { color: var(--danger); }
    .ss-dropdown { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); z-index: 200; max-height: 220px; overflow-y: auto; }
    .ss-option { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; font-size: .875rem; cursor: pointer; color: var(--text-primary); transition: background .1s; }
    .ss-option:hover { background: var(--bg-hover); color: var(--accent); }
    .ss-option i { color: var(--text-muted); font-size: .8rem; margin-top: 3px; flex-shrink: 0; }
    .ss-sub { font-size: .75rem; color: var(--text-muted); margin-top: 2px; }
    .ss-empty { padding: 10px 12px; font-size: .82rem; color: var(--text-muted); text-align: center; }

    /* QUEUE */
    .queue-list { display: flex; flex-direction: column; gap: 10px; }
    .queue-card { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 16px 20px; display: flex; align-items: center; gap: 16px; transition: border-color .2s; }
    .queue-card:hover { border-color: var(--accent); }
    .queue-card.queue-en-cours { border-left: 3px solid var(--success); }
    .queue-card.queue-appele  { border-left: 3px solid var(--info); }
    .queue-position { width: 36px; height: 36px; background: var(--accent-glow); border: 1px solid rgba(37,99,235,.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; color: var(--accent); font-size: .9rem; flex-shrink: 0; }
    .queue-info { flex: 1; }
    .queue-name { font-weight: 600; font-size: .9rem; color: var(--text-primary); }
    .queue-service { font-size: .8rem; color: var(--text-secondary); margin: 2px 0; }
    .queue-times { display: flex; gap: 12px; margin-top: 4px; }
    .queue-times span { font-size: .75rem; color: var(--text-muted); display: flex; align-items: center; gap: 4px; }
  `]
})
export class GerantFileComponent implements OnInit {
  private api   = inject(ApiService);
  private toast = inject(ToastService);

  fileAttente: FileAttenteResponse[]  = [];
  reservations: ReservationResponse[] = [];
  filteredReservations: ReservationResponse[] = [];

  showAddPanel    = false;
  addLoading      = false;
  resSearch       = '';
  resDropdownOpen = false;
  selectedReservation: ReservationResponse | null = null;

  ngOnInit(): void { this.load(); }

  load(): void {
    forkJoin({
      f: this.api.getFileAttente(),
      r: this.api.getReservations()
    }).subscribe(d => {
      this.fileAttente          = d.f;
      this.reservations         = d.r.filter(r => r.statut === 'CONFIRMEE');
      this.filteredReservations = this.reservations;
    });
  }

  filterReservations(): void {
    const q = this.resSearch.toLowerCase();
    this.filteredReservations = this.reservations.filter(r =>
      `${r.clientNom} ${r.serviceNom} ${r.employeNom}`.toLowerCase().includes(q)
    );
  }

  selectReservation(r: ReservationResponse): void {
    this.selectedReservation = r;
    this.resSearch           = `${r.clientNom} — ${r.serviceNom}`;
    this.resDropdownOpen     = false;
  }

  clearResSelect(): void {
    this.selectedReservation  = null;
    this.resSearch            = '';
    this.filteredReservations = this.reservations;
  }

  ajouterFile(): void {
    if (!this.selectedReservation) return;
    this.addLoading = true;
    const r = this.selectedReservation;
    this.api.ajouterFileAttente({
      clientId:      r.clientId,
      employeId:     r.employeId ?? 0,
      serviceId:     r.serviceId,
      reservationId: r.id
    }).subscribe({
      next: () => {
        this.toast.success('Client ajouté à la file !');
        this.showAddPanel        = false;
        this.selectedReservation = null;
        this.resSearch           = '';
        this.addLoading          = false;
        this.load();
      },
      error: () => { this.toast.error('Erreur lors de l\'ajout'); this.addLoading = false; }
    });
  }

  annuler(f: FileAttenteResponse): void {
    this.api.annulerAdmin(f.id).subscribe({
      next: () => { this.toast.success('Annulé'); this.load(); },
      error: () => this.toast.error('Erreur')
    });
  }

  statutClass(s: string) {
    return {
      'badge-warning': s === 'EN_ATTENTE',
      'badge-info':    s === 'APPELE',
      'badge-purple':  s === 'EN_COURS',
      'badge-success': s === 'TERMINE',
      'badge-danger':  s === 'ANNULE'
    };
  }
}