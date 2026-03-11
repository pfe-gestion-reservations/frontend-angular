import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { FileAttenteResponse, ClientResponse, ServiceResponse, ReservationResponse } from '../../../core/models/api.models';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-ma-file',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
  <div>
    <div class="page-header">
      <div>
        <div class="page-title"><div class="title-icon"><i class="fas fa-list-ol"></i></div>File d'attente</div>
        <div class="page-subtitle">Gérez la file d'attente de l'entreprise</div>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-primary" (click)="openModal()"><i class="fas fa-plus"></i> Ajouter à la file</button>
        <button class="btn btn-secondary" (click)="load()"><i class="fas fa-sync-alt"></i></button>
      </div>
    </div>
    <div class="queue-list">
      @for (f of fileAttente; track f.id) {
        <div class="queue-card">
          <div class="queue-position">{{ $index + 1 }}</div>
          <div class="queue-info">
            <div class="queue-name">{{ f.clientNom }} {{ f.clientPrenom }}</div>
            <div class="queue-service">{{ f.serviceNom }}</div>
            <div class="queue-time"><i class="fas fa-clock"></i> {{ f.heureArrivee | date:'HH:mm' }}</div>
          </div>
          <span class="badge" [ngClass]="sc(f.statut)">{{ f.statut }}</span>
          <div class="queue-actions">
            @if (f.statut === 'EN_ATTENTE') {
              <button class="btn btn-info btn-sm" (click)="appeler(f)"><i class="fas fa-bullhorn"></i> Appeler</button>
            }
            @if (f.statut === 'APPELE') {
              <button class="btn btn-success btn-sm" (click)="demarrer(f)"><i class="fas fa-play"></i> Démarrer</button>
            }
            @if (f.statut === 'EN_COURS') {
              <button class="btn btn-primary btn-sm" (click)="terminer(f)"><i class="fas fa-check"></i> Terminer</button>
            }
            @if (f.statut !== 'TERMINE' && f.statut !== 'ANNULE') {
              <button class="btn btn-danger btn-sm btn-icon" (click)="annuler(f)"><i class="fas fa-times"></i></button>
            }
          </div>
        </div>
      }
      @empty {
        <div class="empty-state"><i class="fas fa-door-open"></i><h3>File vide</h3><p>Ajoutez des clients à la file d'attente.</p></div>
      }
    </div>

    @if (showModal) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="modal-title"><i class="fas fa-user-plus"></i>Ajouter à la file</div>
            <button class="modal-close" (click)="closeModal()"><i class="fas fa-times"></i></button>
          </div>
          <form [formGroup]="form" (ngSubmit)="save()">
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Client</label>
                <select formControlName="clientId" class="form-control">
                  <option value="">-- Choisir --</option>
                  @for (c of clients; track c.id) { <option [value]="c.id">{{ c.nom }} {{ c.prenom }}</option> }
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Service</label>
                <select formControlName="serviceId" class="form-control">
                  <option value="">-- Choisir --</option>
                  @for (s of services; track s.id) { <option [value]="s.id">{{ s.nom }}</option> }
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Réservation liée</label>
                <select formControlName="reservationId" class="form-control">
                  <option value="">-- Choisir --</option>
                  @for (r of reservations; track r.id) { <option [value]="r.id">#{{ r.id }} — {{ r.clientNom }} ({{ r.statut }})</option> }
                </select>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" (click)="closeModal()">Annuler</button>
              <button type="submit" class="btn btn-primary" [disabled]="loading">
                @if (loading) { ... } @else { <i class="fas fa-plus"></i> Ajouter }
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  </div>`
})
export class MaFileComponent implements OnInit {
  private api = inject(ApiService); private toast = inject(ToastService); private fb = inject(FormBuilder);
  fileAttente: FileAttenteResponse[] = []; clients: ClientResponse[] = []; services: ServiceResponse[] = []; reservations: ReservationResponse[] = [];
  showModal = false; loading = false;
  form = this.fb.group({ clientId: ['', Validators.required], serviceId: ['', Validators.required], reservationId: ['', Validators.required] });

  ngOnInit() {
    this.load();
    forkJoin({ c: this.api.getClients(), s: this.api.getServices(), r: this.api.getReservations() })
      .subscribe(d => { this.clients = d.c; this.services = d.s; this.reservations = d.r; });
  }
  load() { this.api.getFileAttente().subscribe(d => this.fileAttente = d); }
  openModal() { this.showModal = true; }
  closeModal() { this.showModal = false; this.form.reset(); }
  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true;
    const v = this.form.value;
    this.api.ajouterFileAttente({ clientId: +v.clientId!, employeId: 0, serviceId: +v.serviceId!, reservationId: +v.reservationId! }).subscribe({
      next: () => { this.toast.success('Ajouté à la file !'); this.load(); this.closeModal(); this.loading = false; },
      error: () => { this.toast.error('Erreur'); this.loading = false; }
    });
  }
  appeler(f: FileAttenteResponse)  { this.api.appeler(f.id).subscribe({ next: () => { this.toast.info('Client appelé'); this.load(); }, error: () => this.toast.error('Erreur') }); }
  demarrer(f: FileAttenteResponse) { this.api.demarrer(f.id).subscribe({ next: () => { this.toast.success('Service démarré'); this.load(); }, error: () => this.toast.error('Erreur') }); }
  terminer(f: FileAttenteResponse) { this.api.terminer(f.id).subscribe({ next: () => { this.toast.success('Service terminé !'); this.load(); }, error: () => this.toast.error('Erreur') }); }
  annuler(f: FileAttenteResponse)  { this.api.annuler(f.id).subscribe({ next: () => { this.toast.warning('Annulé'); this.load(); }, error: () => this.toast.error('Erreur') }); }
  sc(s: string) { return { 'badge-warning': s==='EN_ATTENTE', 'badge-info': s==='APPELE', 'badge-purple': s==='EN_COURS', 'badge-success': s==='TERMINE', 'badge-danger': s==='ANNULE' }; }
}