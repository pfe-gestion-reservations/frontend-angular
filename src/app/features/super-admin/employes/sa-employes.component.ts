import { Component, OnInit, OnDestroy, inject, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { EmployeResponse, EntrepriseResponse, ReservationResponse, FileAttenteResponse } from '../../../core/models/api.models';
import { forkJoin } from 'rxjs';

type ModalStep = 'email-check' | 'result-employe-exists' | 'result-other-role' | 'result-archived' | 'new-form';

const AV_COLORS = [
  '#2563eb','#16a34a','#d97706','#dc2626','#7c3aed',
  '#0284c7','#059669','#ea580c','#9333ea','#0891b2'
];

@Component({
  selector: 'app-sa-employes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './sa-employes.component.html',
  styleUrls: ['./sa-employes.component.css']
})
export class SaEmployesComponent implements OnInit, OnDestroy {
  private api      = inject(ApiService);
  private toast    = inject(ToastService);
  private fb       = inject(FormBuilder);
  private renderer = inject(Renderer2);

  employes:     EmployeResponse[]    = [];
  filtered:     EmployeResponse[]    = [];
  entreprises:  EntrepriseResponse[] = [];
  filteredEnts: EntrepriseResponse[] = [];

  showModal    = false;
  editing: EmployeResponse | null = null;
  loading      = false;
  showArchived = false;
  searchQuery  = '';

  selectedEntrepriseId: number | null = null;
  entDropOpen = false;
  entSearch   = '';

  step: ModalStep  = 'email-check';
  emailToCheck     = '';
  checking         = false;
  checkResult: any = null;

  // Dropdown entreprise dans le modal new-form
  modalEntDropOpen  = false;
  modalEntSearch    = '';
  filteredModalEnts: EntrepriseResponse[] = [];
  selectedModalEnt: EntrepriseResponse | null = null;

  form = this.fb.group({
    nom:          ['', Validators.required],
    prenom:       ['', Validators.required],
    email:        ['', [Validators.required, Validators.email]],
    password:     ['', [Validators.required, Validators.minLength(6)]],
    specialite:   [''],
    entrepriseId: [null as number | null, Validators.required]
  });

  editForm = this.fb.group({
    nom:        ['', Validators.required],
    prenom:     ['', Validators.required],
    email:      ['', [Validators.required, Validators.email]],
    password:   [''],
    specialite: ['']
  });

  get totalActifs()   { return this.employes.filter(e => !e.archived).length; }
  get totalArchives() { return this.employes.filter(e =>  e.archived).length; }

  private clickListener = () => { this.entDropOpen = false; };

  ngOnInit(): void {
    document.addEventListener('click', this.clickListener);
    this.api.getEntreprises().subscribe(e => {
      this.entreprises = e;
      this.filteredEnts = [...e];
      this.filteredModalEnts = [...e];
    });
    this.load();
  }
  ngOnDestroy(): void { document.removeEventListener('click', this.clickListener); }

  load(): void {
    const obs = this.selectedEntrepriseId
      ? this.api.getEmployesByEntreprise(this.selectedEntrepriseId)
      : this.api.getEmployes();
    obs.subscribe(d => { this.employes = d; this.applyFilter(); });
  }

  // Recharge la liste PUIS exécute le callback (évite le refresh manuel)
  private reloadThen(cb: () => void): void {
    const obs = this.selectedEntrepriseId
      ? this.api.getEmployesByEntreprise(this.selectedEntrepriseId)
      : this.api.getEmployes();
    obs.subscribe(d => { this.employes = d; this.applyFilter(); cb(); });
  }

  applyFilter(): void {
    const q = this.searchQuery.toLowerCase();
    this.filtered = this.employes.filter(e => {
      const ms = !q || `${e.nom} ${e.prenom} ${e.email} ${e.specialite}`.toLowerCase().includes(q);
      return ms && (this.showArchived ? true : !e.archived);
    });
  }

  getEntNom(id: number | null) { return this.entreprises.find(e => e.id === id)?.nom || ''; }

  filterEnts() {
    const q = this.entSearch.toLowerCase();
    this.filteredEnts = this.entreprises.filter(e => e.nom.toLowerCase().includes(q));
  }
  selectEnt(e: EntrepriseResponse) { this.selectedEntrepriseId = e.id; this.entDropOpen = false; this.load(); }
  clearEnt() { this.selectedEntrepriseId = null; this.entSearch = ''; this.filteredEnts = [...this.entreprises]; this.entDropOpen = false; this.load(); }

  initials(e: EmployeResponse) { return `${e.nom?.charAt(0)??''}${e.prenom?.charAt(0)??''}`.toUpperCase(); }
  avColor(e: EmployeResponse)  { return AV_COLORS[(e.id || 0) % AV_COLORS.length]; }

  openCreate(): void {
    this.editing = null;
    this.step = 'email-check';
    this.emailToCheck = '';
    this.checkResult = null;
    this.selectedModalEnt = null;
    this.modalEntSearch = '';
    this.filteredModalEnts = [...this.entreprises];
    this.form.reset();
    this.showModal = true;
  }

  openEdit(e: EmployeResponse): void {
    this.editing = e;
    this.editForm.patchValue({ nom: e.nom, prenom: e.prenom, email: e.email, specialite: e.specialite });
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editing = null;
    this.form.reset();
    this.editForm.reset();
    this.emailToCheck = '';
    this.checkResult = null;
    this.selectedModalEnt = null;
    this.modalEntSearch = '';
    this.modalEntDropOpen = false;
  }

  // ── Vérification email ──────────────────────────────────────────────────
  checkEmail(): void {
    if (!this.emailToCheck.trim()) return;
    this.checking = true;
    this.api.checkEmployeEmail(this.emailToCheck.trim(), this.selectedEntrepriseId ?? undefined).subscribe({
      next: (res: any) => {
        this.checking = false;
        this.checkResult = res;
        const s = res.status;
        // ── Archivé en priorité absolue ─────────────────────────────────
        if (res.archived) {
          this.step = 'result-archived';
        } else if (s === 'FREE' || s === 'BUSY' || s === 'ALREADY_IN_THIS_COMPANY') {
          // Email appartient à un employé (actif, libre ou rattaché)
          this.step = 'result-employe-exists';
        } else if (s === 'EMAIL_OTHER_ROLE') {
          // Email appartient à un autre rôle (client, gérant, SA...)
          this.step = 'result-other-role';
        } else {
          // NOT_FOUND → formulaire création
          this.form.patchValue({ email: this.emailToCheck.trim() });
          this.step = 'new-form';
        }
      },
      error: () => { this.checking = false; this.toast.error('Erreur lors de la vérification'); }
    });
  }

  // ── Désarchiver depuis modal ────────────────────────────────────────────
  desarchiverDepuisModal(): void {
    const id = this.checkResult?.id ?? this.checkResult?.userId;
    if (!id) { this.toast.error('ID employé introuvable'); return; }
    this.loading = true;
    this.api.desarchiverEtRattacherEmploye(id).subscribe({
      next: () => {
        this.closeModal();
        this.reloadThen(() => {
          this.loading = false;
          this.toast.success('Employé désarchivé et rattaché !');
        });
      },
      error: (e: any) => { this.toast.error(e?.error?.message || 'Erreur'); this.loading = false; }
    });
  }

  // ── Dropdown entreprise dans le modal ──────────────────────────────────
  filterModalEnts(): void {
    const q = this.modalEntSearch.toLowerCase();
    this.filteredModalEnts = this.entreprises.filter(e => e.nom.toLowerCase().includes(q));
  }
  selectModalEnt(e: EntrepriseResponse): void {
    this.selectedModalEnt = e;
    this.form.patchValue({ entrepriseId: e.id });
    this.modalEntDropOpen = false;
  }
  clearModalEnt(): void {
    this.selectedModalEnt = null;
    this.form.patchValue({ entrepriseId: null });
    this.modalEntSearch = '';
    this.filteredModalEnts = [...this.entreprises];
  }

  // ── Créer nouveau employé ───────────────────────────────────────────────
  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true;
    this.api.createEmploye(this.form.value as any).subscribe({
      next: () => { this.closeModal(); this.reloadThen(() => { this.loading = false; this.toast.success('Employé créé !'); }); },
      error: (err: any) => { this.toast.error(err?.error?.message || 'Erreur'); this.loading = false; }
    });
  }

  saveEdit(): void {
    if (this.editForm.invalid || !this.editing) { this.editForm.markAllAsTouched(); return; }
    this.loading = true;
    this.api.updateEmploye(this.editing.id, this.editForm.value as any).subscribe({
      next: () => { this.closeModal(); this.reloadThen(() => { this.loading = false; this.toast.success('Modifié !'); }); },
      error: () => { this.toast.error('Erreur'); this.loading = false; }
    });
  }

  supprimer(e: EmployeResponse): void {
    // On charge d'abord les données réelles avant d'afficher quoi que ce soit
    forkJoin({
      reservations: this.api.getReservations(),
      fileAttente:  this.api.getFileAttente()
    }).subscribe({
      next: ({ reservations, fileAttente }) => {
        const resLiees  = reservations.filter(r => r.employeId === e.id);
        const fileLiees = fileAttente.filter(f => f.employeId === e.id);
        const hasLinks  = e.entrepriseId != null || resLiees.length > 0 || fileLiees.length > 0;

        if (hasLinks) {
          // Relations détectées → pop-up de blocage directement
          this._openLinkedDialog(e, resLiees, fileLiees);
        } else {
          // Rien de lié → pop-up de confirmation
          this._showDeleteConfirm(e);
        }
      },
      error: () => {
        // En cas d'erreur de vérification, on affiche quand même la confirmation
        this._showDeleteConfirm(e);
      }
    });
  }

  private _showDeleteConfirm(e: EmployeResponse): void {
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
    box.innerHTML = `
      <div style="font-size:2.2rem;margin-bottom:12px">🗑️</div>
      <div style="font-size:1.05rem;font-weight:700;color:#fff;margin-bottom:8px">Supprimer cet employé ?</div>
      <div style="font-size:.875rem;color:#94a3b8;margin-bottom:14px;line-height:1.5">
        <strong style="color:#fff">${e.nom} ${e.prenom}</strong>
      </div>
      <div style="font-size:.78rem;color:#f87171;margin-bottom:22px">⚠️ Cette action est irréversible.</div>
      <div style="display:flex;gap:10px;justify-content:center">
        <button id="del-cancel" style="background:transparent;color:#aaa;border:1px solid rgba(255,255,255,0.15);padding:9px 20px;border-radius:8px;font-size:.875rem;cursor:pointer">Annuler</button>
        <button id="del-ok" style="background:#ef4444;color:#fff;border:none;padding:9px 22px;border-radius:8px;font-size:.875rem;font-weight:700;cursor:pointer">Supprimer</button>
      </div>
    `;
    this.renderer.appendChild(overlay, box);
    this.renderer.appendChild(document.body, overlay);
    box.querySelector('#del-cancel')!.addEventListener('click', close);
    box.querySelector('#del-ok')!.addEventListener('click', () => {
      close();
      this.api.supprimerEmploye(e.id).subscribe({
        next: () => { this.reloadThen(() => this.toast.success('Employé supprimé définitivement.')); },
        error: () => { this.toast.error('Erreur lors de la suppression'); }
      });
    });
    overlay.addEventListener('click', (ev: Event) => { if (ev.target === overlay) close(); });
  }

  private _openLinkedDialog(e: EmployeResponse, reservations: ReservationResponse[], fileAttente: FileAttenteResponse[]): void {
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

    const items: string[] = [];

    // ── Entreprise ────────────────────────────────────────────────────
    if (e.entrepriseId != null) {
      const entNom = e.entrepriseNom || this.entreprises.find(ent => ent.id === e.entrepriseId)?.nom || '';
      items.push(`
        <div style="display:flex;align-items:center;gap:12px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.25);border-radius:10px;padding:12px 16px;text-align:left">
          <span style="font-size:1.5rem;flex-shrink:0">🏢</span>
          <div>
            <div style="color:#6ee7b7;font-weight:700;font-size:.88rem;margin-bottom:3px">Entreprise rattachée</div>
            <div style="color:#94a3b8;font-size:.78rem">${entNom}</div>
          </div>
        </div>`);
    }

    // ── Réservations ──────────────────────────────────────────────────
    if (reservations.length > 0) {
      const nbActives   = reservations.filter(r => r.statut === 'EN_ATTENTE' || r.statut === 'CONFIRMEE' || r.statut === 'EN_COURS').length;
      const nbTerminees = reservations.filter(r => r.statut === 'TERMINEE').length;
      const nbAnnulees  = reservations.filter(r => r.statut === 'ANNULEE').length;
      const details = [
        nbActives   > 0 ? `<span style="color:#fbbf24">${nbActives} active${nbActives > 1 ? 's' : ''}</span>` : '',
        nbTerminees > 0 ? `<span style="color:#94a3b8">${nbTerminees} terminée${nbTerminees > 1 ? 's' : ''}</span>` : '',
        nbAnnulees  > 0 ? `<span style="color:#f87171">${nbAnnulees} annulée${nbAnnulees > 1 ? 's' : ''}</span>` : ''
      ].filter(Boolean).join(' · ');
      items.push(`
        <div style="display:flex;align-items:center;gap:12px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:10px;padding:12px 16px;text-align:left">
          <span style="font-size:1.5rem;flex-shrink:0">📅</span>
          <div>
            <div style="color:#f87171;font-weight:700;font-size:.88rem;margin-bottom:3px">
              ${reservations.length} réservation${reservations.length > 1 ? 's' : ''}
            </div>
            <div style="font-size:.78rem">${details}</div>
          </div>
        </div>`);
    }

    // ── File d'attente ────────────────────────────────────────────────
    if (fileAttente.length > 0) {
      const nbEnCours  = fileAttente.filter(f => String(f.statut) === 'EN_ATTENTE' || String(f.statut) === 'APPELE' || String(f.statut) === 'EN_COURS').length;
      const nbTermines = fileAttente.filter(f => String(f.statut) === 'TERMINE').length;
      const details = [
        nbEnCours  > 0 ? `<span style="color:#fbbf24">${nbEnCours} en cours</span>` : '',
        nbTermines > 0 ? `<span style="color:#94a3b8">${nbTermines} terminée${nbTermines > 1 ? 's' : ''}</span>` : ''
      ].filter(Boolean).join(' · ');
      items.push(`
        <div style="display:flex;align-items:center;gap:12px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:10px;padding:12px 16px;text-align:left">
          <span style="font-size:1.5rem;flex-shrink:0">🕐</span>
          <div>
            <div style="color:#fbbf24;font-weight:700;font-size:.88rem;margin-bottom:3px">
              ${fileAttente.length} entrée${fileAttente.length > 1 ? 's' : ''} en file d'attente
            </div>
            <div style="font-size:.78rem">${details}</div>
          </div>
        </div>`);
    }

    box.innerHTML = `
      <div style="width:52px;height:52px;background:rgba(245,158,11,.12);border:2px solid rgba(245,158,11,.35);
           border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.6rem;margin:0 auto 16px">⚠️</div>
      <div style="font-size:1.1rem;font-weight:700;color:#fff;margin-bottom:6px">Suppression impossible</div>
      <div style="font-size:.82rem;color:#94a3b8;margin-bottom:18px;line-height:1.5">
        <strong style="color:#f1f5f9">${e.nom} ${e.prenom}</strong> est encore lié aux éléments suivants :
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:18px">${items.join('')}</div>
      <div style="font-size:.76rem;color:#64748b;margin-bottom:20px;line-height:1.5;background:rgba(255,255,255,.03);
           border-radius:8px;padding:10px;border:1px solid rgba(255,255,255,.06)">
        💡 Supprimez ou dissociez ces éléments, puis réessayez.<br>
        <span style="color:#475569">Ou <strong style="color:#94a3b8">archivez</strong> l'employé pour le désactiver sans perdre les données.</span>
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
    overlay.addEventListener('click', (ev: Event) => { if (ev.target === overlay) close(); });
  }

  archiver(e: EmployeResponse): void {
    this.api.archiverEmploye(e.id).subscribe({
      next: () => { this.reloadThen(() => this.toast.success('Archivé')); },
      error: () => this.toast.error('Erreur')
    });
  }

  desarchiver(e: EmployeResponse): void {
    this.api.desarchiverEmploye(e.id).subscribe({
      next: () => { this.reloadThen(() => this.toast.success('Désarchivé')); },
      error: () => this.toast.error('Erreur')
    });
  }
}