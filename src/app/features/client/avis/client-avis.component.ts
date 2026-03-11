import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { AvisResponse, ReservationResponse } from '../../../core/models/api.models';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-client-avis',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
  <div>
    <div class="page-header">
      <div><div class="page-title"><div class="title-icon"><i class="fas fa-star"></i></div>Mes Avis</div></div>
      <button class="btn btn-primary" (click)="openModal()"><i class="fas fa-plus"></i> Laisser un avis</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px">
      @for (a of avis; track a.id) {
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div style="font-weight:600;font-size:.95rem">{{ a.serviceNom }}</div>
            <div class="stars">@for (i of [1,2,3,4,5]; track i) { <i class="fas fa-star star" [class.filled]="i<=a.note"></i> }</div>
          </div>
          <div style="font-size:.8rem;color:var(--text-secondary);margin-bottom:8px">Employé : {{ a.employeNom }} — {{ a.dateAvis | date:'dd/MM/yyyy' }}</div>
          @if (a.commentaire) { <p style="font-size:.875rem;font-style:italic;border-left:2px solid var(--accent);padding-left:12px">"{{ a.commentaire }}"</p> }
        </div>
      }
      @empty { <div class="empty-state"><i class="fas fa-star"></i><h3>Aucun avis</h3><p>Partagez votre expérience après une prestation.</p></div> }
    </div>

    @if (showModal) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header"><div class="modal-title"><i class="fas fa-star"></i>Laisser un avis</div><button class="modal-close" (click)="closeModal()"><i class="fas fa-times"></i></button></div>
          <form [formGroup]="form" (ngSubmit)="save()">
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Réservation terminée</label>
                <select formControlName="reservationId" class="form-control">
                  <option value="">-- Choisir --</option>
                  @for (r of terminees; track r.id) { <option [value]="r.id">#{{ r.id }} — {{ r.serviceNom }} ({{ r.heureDebut | date:'dd/MM' }})</option> }
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Note (1 à 5)</label>
                <div style="display:flex;gap:12px;margin-top:8px">
                  @for (n of [1,2,3,4,5]; track n) {
                    <button type="button" (click)="setNote(n)" style="background:none;border:none;font-size:1.6rem;cursor:pointer;transition:transform .1s"
                      [style.color]="currentNote >= n ? 'var(--accent)' : 'var(--text-muted)'"
                      [style.transform]="currentNote === n ? 'scale(1.3)' : 'scale(1)'">
                      <i class="fas fa-star"></i>
                    </button>
                  }
                </div>
              </div>
              <div class="form-group"><label class="form-label">Commentaire (optionnel)</label><textarea formControlName="commentaire" class="form-control" placeholder="Votre expérience..."></textarea></div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" (click)="closeModal()">Annuler</button>
              <button type="submit" class="btn btn-primary" [disabled]="loading">@if (loading) { ... } @else { <i class="fas fa-paper-plane"></i> Envoyer }</button>
            </div>
          </form>
        </div>
      </div>
    }
  </div>`
})
export class ClientAvisComponent implements OnInit {
  private api = inject(ApiService); private toast = inject(ToastService); private fb = inject(FormBuilder);
  avis: AvisResponse[] = []; terminees: ReservationResponse[] = []; showModal = false; loading = false; currentNote = 5;
  form = this.fb.group({ reservationId: ['', Validators.required], note: [5, Validators.required], commentaire: [''] });
  ngOnInit() { forkJoin({ a: this.api.getAvis(), r: this.api.getReservations() }).subscribe(d => { this.avis = d.a; this.terminees = d.r.filter(r => r.statut === 'TERMINEE'); }); }
  setNote(n: number) { this.currentNote = n; this.form.patchValue({ note: n }); }
  openModal() { this.showModal = true; }
  closeModal() { this.showModal = false; this.form.reset({ note: 5 }); this.currentNote = 5; }
  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true;
    const v = this.form.value;
    this.api.createAvis({ reservationId: +v.reservationId!, note: v.note!, commentaire: v.commentaire || '' }).subscribe({
      next: () => { this.toast.success('Avis envoyé !'); this.api.getAvis().subscribe(d => this.avis = d); this.closeModal(); this.loading = false; },
      error: (e) => { this.toast.error(e?.error || 'Erreur'); this.loading = false; }
    });
  }
}