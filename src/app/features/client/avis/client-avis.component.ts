import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { AvisResponse, ReservationResponse } from '../../../core/models/api.models';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-client-avis',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div style="max-width:860px;margin:0 auto;padding-bottom:40px">

  <!-- HEADER -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:28px">
    <div style="display:flex;align-items:center;gap:14px">
      <div style="width:46px;height:46px;border-radius:14px;background:linear-gradient(135deg,#f59e0b,#f97316);display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.1rem;box-shadow:0 4px 16px rgba(245,158,11,.3)">
        <i class="fas fa-star"></i>
      </div>
      <div>
        <div style="font-size:1.3rem;font-weight:800;color:#111">Mes Avis</div>
        <div style="font-size:.8rem;color:#888;margin-top:2px">
          {{ avis.length }} avis
          <span *ngIf="avgNote"> · Note moyenne <strong style="color:#d97706">{{ avgNote }}/5</strong></span>
        </div>
      </div>
    </div>
    <button (click)="openModal()"
      style="display:inline-flex;align-items:center;gap:7px;padding:10px 20px;border-radius:10px;background:linear-gradient(135deg,#f59e0b,#f97316);color:#fff;border:none;font-size:.875rem;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(245,158,11,.3)">
      <i class="fas fa-plus"></i> Laisser un avis
    </button>
  </div>

  <!-- LISTE AVIS -->
  <div *ngIf="avis.length > 0" style="display:flex;flex-direction:column;gap:12px">
    <div *ngFor="let a of avis"
      style="background:#fff;border:1.5px solid #e5e7eb;border-radius:16px;padding:20px;display:flex;align-items:flex-start;gap:14px">
      <div style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#f59e0b,#f97316);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.85rem;flex-shrink:0">
        {{ a.serviceNom?.charAt(0) }}
      </div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px;flex-wrap:wrap">
          <div>
            <div style="font-weight:700;font-size:.95rem;color:#111">{{ a.serviceNom }}</div>
            <div style="font-size:.75rem;color:#888;margin-top:1px">{{ a.dateAvis | date:'dd/MM/yyyy' }}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="display:flex;gap:2px">
              <i *ngFor="let n of [1,2,3,4,5]" class="fas fa-star"
                [style.color]="n <= a.note ? '#f59e0b' : '#e5e7eb'"
                style="font-size:.85rem"></i>
            </div>
            <span style="font-size:.75rem;font-weight:700;padding:2px 8px;border-radius:20px"
              [style.background]="a.note >= 4 ? 'rgba(16,185,129,.1)' : a.note >= 3 ? 'rgba(245,158,11,.1)' : 'rgba(239,68,68,.1)'"
              [style.color]="a.note >= 4 ? '#059669' : a.note >= 3 ? '#d97706' : '#dc2626'">
              {{ a.note }}/5
            </span>
          </div>
        </div>
        <p *ngIf="a.commentaire"
          style="font-size:.85rem;color:#555;font-style:italic;line-height:1.6;border-left:3px solid #f59e0b;padding-left:12px;margin:0">
          "{{ a.commentaire }}"
        </p>
      </div>
    </div>
  </div>

  <!-- VIDE -->
  <div *ngIf="avis.length === 0" style="text-align:center;padding:60px;color:#aaa">
    <i class="fas fa-star-half-alt" style="font-size:2.5rem;opacity:.2;display:block;margin-bottom:12px"></i>
    <p style="font-size:.9rem">Vous n'avez pas encore laissé d'avis.</p>
    <p style="font-size:.82rem;color:#bbb">Après une prestation terminée, partagez votre expérience !</p>
  </div>

  <!-- MODALE -->
  <div *ngIf="showModal"
    (click)="closeModal()"
    style="position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center">
    <div (click)="$event.stopPropagation()"
      style="background:#fff;border-radius:20px;overflow:hidden;width:90%;max-width:480px;box-shadow:0 32px 80px rgba(0,0,0,.25)">

      <!-- Header modal -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 24px;background:linear-gradient(135deg,#f59e0b,#f97316);color:#fff">
        <div style="display:flex;align-items:center;gap:10px">
          <i class="fas fa-star" style="font-size:1.1rem"></i>
          <div>
            <div style="font-weight:700;font-size:1rem">Laisser un avis</div>
            <div style="font-size:.75rem;opacity:.85">Partagez votre expérience</div>
          </div>
        </div>
        <button (click)="closeModal()" style="width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.2);border:none;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.8rem">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div style="padding:20px 24px;display:flex;flex-direction:column;gap:16px">

        <!-- Réservation -->
        <div>
          <label style="font-size:.8rem;font-weight:700;color:#555;display:block;margin-bottom:8px">
            <i class="fas fa-calendar-check" style="color:#f59e0b;margin-right:5px"></i> Réservation terminée *
          </label>
          <select [(ngModel)]="selectedReservationId"
            style="width:100%;padding:10px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:.875rem;color:#111;outline:none;background:#fff">
            <option [ngValue]="null">Sélectionner une réservation...</option>
            <option *ngFor="let r of terminees" [ngValue]="r.id">
              #{{ r.id }} — {{ r.serviceNom }} ({{ r.heureDebut | date:'dd/MM/yyyy' }})
            </option>
          </select>
          <div *ngIf="terminees.length === 0" style="margin-top:8px;font-size:.78rem;color:#f59e0b;background:#fffbeb;border:1px solid rgba(245,158,11,.2);border-radius:8px;padding:8px 12px">
            <i class="fas fa-info-circle"></i> Aucune réservation terminée disponible.
          </div>
        </div>

        <!-- Étoiles -->
        <div>
          <label style="font-size:.8rem;font-weight:700;color:#555;display:block;margin-bottom:10px">
            <i class="fas fa-star" style="color:#f59e0b;margin-right:5px"></i> Votre note *
          </label>
          <div style="display:flex;gap:10px;justify-content:center">
            <button *ngFor="let n of [1,2,3,4,5]" type="button" (click)="selectedNote = n"
              style="background:none;border:none;cursor:pointer;transition:transform .15s;padding:4px"
              [style.transform]="selectedNote >= n ? 'scale(1.15)' : 'scale(1)'">
              <i class="fas fa-star" style="font-size:2rem;transition:color .15s"
                [style.color]="selectedNote >= n ? '#f59e0b' : '#e5e7eb'"></i>
            </button>
          </div>
          <div style="text-align:center;margin-top:8px;font-size:.82rem;font-weight:600"
            [style.color]="selectedNote >= 4 ? '#059669' : selectedNote >= 3 ? '#d97706' : '#dc2626'">
            {{ noteLabel() }}
          </div>
        </div>

        <!-- Commentaire -->
        <div>
          <label style="font-size:.8rem;font-weight:700;color:#555;display:block;margin-bottom:8px">
            <i class="fas fa-comment" style="color:#f59e0b;margin-right:5px"></i> Commentaire
            <span style="font-weight:400;color:#9ca3af">(optionnel)</span>
          </label>
          <textarea [(ngModel)]="commentaire" rows="3"
            placeholder="Décrivez votre expérience..."
            style="width:100%;padding:10px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:.875rem;color:#111;outline:none;resize:vertical;box-sizing:border-box"
            onfocus="this.style.borderColor='#f59e0b'"
            onblur="this.style.borderColor='#e5e7eb'"></textarea>
        </div>

      </div>

      <div style="display:flex;justify-content:flex-end;gap:10px;padding:16px 24px;border-top:1px solid #f3f4f6;background:#f9fafb">
        <button type="button" (click)="closeModal()"
          style="padding:9px 20px;border-radius:10px;border:1.5px solid #e5e7eb;background:#fff;color:#555;font-size:.85rem;font-weight:600;cursor:pointer">
          Annuler
        </button>
        <button type="button" (click)="save()" [disabled]="loading"
          style="display:flex;align-items:center;gap:7px;padding:9px 22px;border-radius:10px;border:none;background:linear-gradient(135deg,#f59e0b,#f97316);color:#fff;font-size:.85rem;font-weight:700;cursor:pointer"
          [style.opacity]="loading ? '0.6' : '1'">
          <i class="fas fa-spinner fa-spin" *ngIf="loading"></i>
          <i class="fas fa-paper-plane" *ngIf="!loading"></i>
          {{ loading ? 'Envoi...' : 'Envoyer mon avis' }}
        </button>
      </div>
    </div>
  </div>

</div>`
})
export class ClientAvisComponent implements OnInit {
  private api   = inject(ApiService);
  private toast = inject(ToastService);

  avis:      AvisResponse[]        = [];
  terminees: ReservationResponse[] = [];
  showModal  = false;
  loading    = false;
  avgNote    = 0;

  // Variables ngModel directes — plus de FormGroup
  selectedReservationId: number | null = null;
  selectedNote    = 5;
  commentaire     = '';

  ngOnInit(): void { this.load(); }

  load(): void {
    forkJoin({ a: this.api.getAvis(), r: this.api.getReservations() }).subscribe(d => {
      this.avis = d.a.sort((a, b) => new Date(b.dateAvis).getTime() - new Date(a.dateAvis).getTime());
      const dejaNotees = new Set(d.a.map((a: any) => a.reservationId).filter(Boolean));
      this.terminees = d.r.filter(r => r.statut === 'TERMINEE' && !dejaNotees.has(r.id));
      this.avgNote   = d.a.length ? +( d.a.reduce((s, a) => s + a.note, 0) / d.a.length ).toFixed(1) : 0;
    });
  }

  noteLabel(): string {
    const l: Record<number, string> = { 1:'Très mauvais', 2:'Mauvais', 3:'Moyen', 4:'Bien', 5:'Excellent !' };
    return l[this.selectedNote] ?? '';
  }

  openModal(): void  { this.showModal = true; }
  closeModal(): void {
    this.showModal = false;
    this.selectedReservationId = null;
    this.selectedNote = 5;
    this.commentaire  = '';
  }

  save(): void {
    if (!this.selectedReservationId) {
      this.toast.error('Veuillez sélectionner une réservation');
      return;
    }
    if (!this.selectedNote || this.selectedNote < 1 || this.selectedNote > 5) {
      this.toast.error('Veuillez attribuer une note');
      return;
    }
    this.loading = true;
    this.api.createAvis({
      reservationId: this.selectedReservationId,
      note: this.selectedNote,
      commentaire: this.commentaire || ''
    }).subscribe({
      next: () => {
        this.toast.success('Avis envoyé, merci !');
        this.closeModal();
        this.load();
        this.loading = false;
      },
      error: (e: any) => {
        this.loading = false;
        const msg = e?.error?.message || e?.error || 'Erreur lors de l\'envoi de l\'avis';
        this.toast.error(msg);
      }
    });
  }
}