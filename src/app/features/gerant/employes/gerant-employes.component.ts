import { Component, OnInit, OnDestroy, inject, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { EmployeResponse, ReservationResponse, FileAttenteResponse } from '../../../core/models/api.models';
import { forkJoin } from 'rxjs';

type ModalStep = 'email-check' | 'result-busy' | 'result-free' | 'result-already' | 'result-other-role' | 'result-archived' | 'new-form';

const AV_COLORS = [
  '#2563eb','#16a34a','#d97706','#dc2626','#7c3aed',
  '#0284c7','#059669','#ea580c','#9333ea','#0891b2'
];

@Component({
  selector: 'app-gerant-employes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './gerant-employes.component.html',
  styleUrls: ['./gerant-employes.component.css']
})
export class GerantEmployesComponent implements OnInit, OnDestroy {
  private api      = inject(ApiService);
  private toast    = inject(ToastService);
  private auth     = inject(AuthService);
  private fb       = inject(FormBuilder);
  private renderer = inject(Renderer2);

  employes:  EmployeResponse[] = [];
  filtered:  EmployeResponse[] = [];

  showModal    = false;
  editing: EmployeResponse | null = null;
  loading      = false;
  searchQuery  = '';
  showArchived = false;

  emailError = '';

  selectedEmploye: EmployeResponse | null = null;

  step: ModalStep  = 'email-check';
  emailToCheck     = '';
  checking         = false;
  checkResult: any = null;

  form = this.fb.group({
    nom:        ['', Validators.required],
    prenom:     ['', Validators.required],
    email:      ['', [Validators.required, Validators.email]],
    password:   ['', [Validators.required, Validators.minLength(6)]],
    specialite: ['']
  });

  editForm = this.fb.group({
    nom:        ['', Validators.required],
    prenom:     ['', Validators.required],
    email:      ['', [Validators.required, Validators.email]],
    password:   [''],
    specialite: ['']
  });

  get entrepriseId(): number | null { return this.auth.getEntrepriseId(); }
  get totalActifs()   { return this.employes.filter(e => !e.archived).length; }
  get totalArchives() { return this.employes.filter(e =>  e.archived).length; }

  ngOnInit(): void { this.load(); }
  ngOnDestroy(): void {}

  load(): void {
    this.api.getEmployes().subscribe(d => {
      this.employes = d;
      this.applyFilter();
      if (this.selectedEmploye) {
        this.selectedEmploye = d.find(e => e.id === this.selectedEmploye!.id) ?? null;
      }
    });
  }

  private reloadThen(cb: () => void): void {
    this.api.getEmployes().subscribe(d => {
      this.employes = d;
      this.applyFilter();
      cb();
    });
  }

  applyFilter(): void {
    const q = this.searchQuery.toLowerCase();
    this.filtered = this.employes.filter(e => {
      const ms = !q || `${e.nom} ${e.prenom} ${e.email} ${e.specialite ?? ''}`.toLowerCase().includes(q);
      return ms && (this.showArchived ? true : !e.archived);
    });
  }

  initials(e: EmployeResponse) { return `${e.nom?.charAt(0)??''}${e.prenom?.charAt(0)??''}`.toUpperCase(); }
  avColor(e: EmployeResponse)  { return AV_COLORS[(e.id || 0) % AV_COLORS.length]; }

  openDrawer(e: EmployeResponse): void { this.selectedEmploye = e; }
  closeDrawer(): void                  { this.selectedEmploye = null; }

  openCreate(): void {
    this.editing = null;
    this.step = 'email-check';
    this.emailToCheck = '';
    this.emailError = '';
    this.checkResult = null;
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
    this.emailError = '';
    this.checkResult = null;
  }

  // ── Vérification email ──────────────────────────────────────────────────
  checkEmail(): void {
    this.emailError = '';
    const email = this.emailToCheck.trim();
    if (!email) return;

    const emailRegex = /^[a-zA-Z0-9._%+\-]{4,}@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      this.emailError = 'Email invalide — au moins 4 caractères avant le @';
      return;
    }

    this.checking = true;
    this.api.checkEmployeEmail(email, this.entrepriseId ?? undefined).subscribe({
      next: (res: any) => {
        this.checking = false;
        this.checkResult = res;
        const s = res.status ?? res.statut;
        if      (s === 'FREE' && res.archived)         this.step = 'result-archived';
        else if (s === 'LIBRE' && res.archived)        this.step = 'result-archived';
        else if (s === 'FREE')                         this.step = 'result-free';
        else if (s === 'BUSY')                         this.step = 'result-busy';
        else if (s === 'ALREADY_IN_THIS_COMPANY')      this.step = 'result-already';
        else if (s === 'EMAIL_OTHER_ROLE')             this.step = 'result-other-role';
        else if (s === 'NOT_FOUND') {
          this.form.patchValue({ email });
          this.step = 'new-form';
        }
      },
      error: () => { this.checking = false; this.toast.error('Erreur lors de la vérification'); }
    });
  }

  // ── Rattacher un employé libre ──────────────────────────────────────────
  rattacher(): void {
    if (!this.checkResult?.email) return;
    this.loading = true;
    this.api.rattacherEmploye({ email: this.checkResult.email }).subscribe({
      next: () => {
        this.closeModal();
        this.reloadThen(() => { this.loading = false; this.toast.success('Employé rattaché à votre entreprise !'); });
      },
      error: (e: any) => { this.toast.error(e?.error?.message || 'Erreur'); this.loading = false; }
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
        this.reloadThen(() => { this.loading = false; this.toast.success('Employé réactivé et ajouté à votre entreprise !'); });
      },
      error: (e: any) => { this.toast.error(e?.error?.message || 'Erreur'); this.loading = false; }
    });
  }

  // ── Créer un nouvel employé ─────────────────────────────────────────────
  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true;
    this.api.createEmploye({ ...this.form.value as any }).subscribe({
      next: () => {
        this.closeModal();
        this.reloadThen(() => { this.loading = false; this.toast.success('Employé créé !'); });
      },
      error: (err: any) => { this.toast.error(err?.error?.message || 'Erreur'); this.loading = false; }
    });
  }

  saveEdit(): void {
    if (this.editForm.invalid || !this.editing) { this.editForm.markAllAsTouched(); return; }
    this.loading = true;
    this.api.updateEmploye(this.editing.id, this.editForm.value as any).subscribe({
      next: () => {
        this.closeModal();
        this.reloadThen(() => { this.loading = false; this.toast.success('Modifié !'); });
      },
      error: () => { this.toast.error('Erreur'); this.loading = false; }
    });
  }

  // ── Suppression avec vérification des liens ─────────────────────────────
  supprimer(e: EmployeResponse): void {
    forkJoin({
      reservations: this.api.getReservations(),
      fileAttente:  this.api.getFileAttente()
    }).subscribe({
      next: ({ reservations, fileAttente }) => {
        const resLiees  = reservations.filter(r => r.employeId === e.id);
        const fileLiees = fileAttente.filter(f => f.employeId === e.id);
        const hasLinks  = resLiees.length > 0 || fileLiees.length > 0;
        if (hasLinks) this._openLinkedDialog(e, resLiees, fileLiees);
        else          this._showDeleteConfirm(e);
      },
      error: () => this._showDeleteConfirm(e)
    });
  }

  private _showDeleteConfirm(e: EmployeResponse): void {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const overlay = this.renderer.createElement('div');
    this.renderer.setStyle(overlay, 'position', 'fixed');
    this.renderer.setStyle(overlay, 'inset', '0');
    this.renderer.setStyle(overlay, 'background', 'rgba(0,0,0,0.6)');
    this.renderer.setStyle(overlay, 'z-index', '99999');
    this.renderer.setStyle(overlay, 'display', 'flex');
    this.renderer.setStyle(overlay, 'align-items', 'center');
    this.renderer.setStyle(overlay, 'justify-content', 'center');
    this.renderer.setStyle(overlay, 'backdrop-filter', 'blur(4px)');

    const box = this.renderer.createElement('div');
    const bg     = isDark ? '#16161f' : '#ffffff';
    const border = isDark ? 'rgba(239,68,68,.25)' : '#fecaca';
    const text   = isDark ? '#f2f2f8' : '#0f0f1a';
    const muted  = isDark ? '#a2a2b8' : '#7070a0';
    const btnCancelBg     = isDark ? 'rgba(255,255,255,.06)' : '#f4f4f8';
    const btnCancelBorder = isDark ? 'rgba(255,255,255,.12)' : '#e2e2f0';
    const btnCancelColor  = isDark ? '#a2a2b8' : '#4a4a6a';

    this.renderer.setStyle(box, 'background', bg);
    this.renderer.setStyle(box, 'border', `1px solid ${border}`);
    this.renderer.setStyle(box, 'border-radius', '20px');
    this.renderer.setStyle(box, 'padding', '32px 28px');
    this.renderer.setStyle(box, 'text-align', 'center');
    this.renderer.setStyle(box, 'max-width', '380px');
    this.renderer.setStyle(box, 'width', '90%');
    this.renderer.setStyle(box, 'box-shadow', isDark ? '0 24px 64px rgba(0,0,0,0.6)' : '0 16px 48px rgba(0,0,0,0.15)');
    this.renderer.setStyle(box, 'font-family', 'Plus Jakarta Sans, sans-serif');

    const close = () => this.renderer.removeChild(document.body, overlay);

    box.innerHTML = `
      <div style="width:52px;height:52px;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);
           border-radius:14px;display:flex;align-items:center;justify-content:center;
           font-size:1.3rem;margin:0 auto 16px;color:#ef4444">
        <i class="fas fa-trash-alt"></i>
      </div>
      <div style="font-size:1rem;font-weight:700;color:${text};margin-bottom:8px;letter-spacing:-0.01em">
        Supprimer cet employé ?
      </div>
      <div style="font-size:.82rem;color:${muted};margin-bottom:8px;line-height:1.5">
        <strong style="color:${text}">${e.nom} ${e.prenom}</strong>
      </div>
      <div style="font-size:.75rem;color:#ef4444;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);
           border-radius:8px;padding:8px 12px;margin-bottom:22px">
        <i class="fas fa-exclamation-triangle" style="margin-right:5px"></i>
        Cette action est irréversible.
      </div>
      <div style="display:flex;gap:8px;justify-content:center">
        <button id="del-cancel" style="background:${btnCancelBg};color:${btnCancelColor};
          border:1px solid ${btnCancelBorder};padding:9px 20px;border-radius:8px;
          font-size:.82rem;font-weight:600;cursor:pointer;font-family:inherit">Annuler</button>
        <button id="del-ok" style="background:#ef4444;color:#fff;border:none;
          padding:9px 22px;border-radius:8px;font-size:.82rem;font-weight:700;
          cursor:pointer;font-family:inherit">
          <i class="fas fa-trash-alt" style="margin-right:5px"></i>Supprimer
        </button>
      </div>
    `;

    this.renderer.appendChild(overlay, box);
    this.renderer.appendChild(document.body, overlay);
    box.querySelector('#del-cancel')!.addEventListener('click', close);
    box.querySelector('#del-ok')!.addEventListener('click', () => {
      close();
      this.api.supprimerEmploye(e.id).subscribe({
        next: () => { this.reloadThen(() => this.toast.success('Employé supprimé définitivement.')); },
        error: () => this.toast.error('Erreur lors de la suppression')
      });
    });
    overlay.addEventListener('click', (ev: Event) => { if (ev.target === overlay) close(); });
  }

  private _openLinkedDialog(e: EmployeResponse, reservations: ReservationResponse[], fileAttente: FileAttenteResponse[]): void {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const overlay = this.renderer.createElement('div');
    this.renderer.setStyle(overlay, 'position', 'fixed');
    this.renderer.setStyle(overlay, 'inset', '0');
    this.renderer.setStyle(overlay, 'background', 'rgba(0,0,0,0.6)');
    this.renderer.setStyle(overlay, 'z-index', '99999');
    this.renderer.setStyle(overlay, 'display', 'flex');
    this.renderer.setStyle(overlay, 'align-items', 'center');
    this.renderer.setStyle(overlay, 'justify-content', 'center');
    this.renderer.setStyle(overlay, 'backdrop-filter', 'blur(4px)');

    const box = this.renderer.createElement('div');
    const bg    = isDark ? '#16161f' : '#ffffff';
    const text  = isDark ? '#f2f2f8' : '#0f0f1a';
    const muted = isDark ? '#a2a2b8' : '#7070a0';
    const sub   = isDark ? '#78788c' : '#9090b0';
    const hintBg     = isDark ? 'rgba(255,255,255,.04)' : '#f4f4f8';
    const hintBorder = isDark ? 'rgba(255,255,255,.08)' : '#e2e2f0';

    this.renderer.setStyle(box, 'background', bg);
    this.renderer.setStyle(box, 'border', `1px solid ${isDark ? 'rgba(255,255,255,.1)' : '#e2e2f0'}`);
    this.renderer.setStyle(box, 'border-radius', '20px');
    this.renderer.setStyle(box, 'padding', '28px 24px');
    this.renderer.setStyle(box, 'text-align', 'center');
    this.renderer.setStyle(box, 'max-width', '440px');
    this.renderer.setStyle(box, 'width', '92%');
    this.renderer.setStyle(box, 'box-shadow', isDark ? '0 24px 64px rgba(0,0,0,0.6)' : '0 16px 48px rgba(0,0,0,0.15)');
    this.renderer.setStyle(box, 'font-family', 'Plus Jakarta Sans, sans-serif');

    const close = () => this.renderer.removeChild(document.body, overlay);
    const items: string[] = [];

    if (e.entrepriseId != null) {
      const entNom = e.entrepriseNom || '';
      items.push(`
        <div style="display:flex;align-items:center;gap:12px;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);border-radius:12px;padding:12px 14px;text-align:left">
          <div style="width:34px;height:34px;background:rgba(34,197,94,.12);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#22c55e;font-size:.9rem">
            <i class="fas fa-building"></i>
          </div>
          <div>
            <div style="color:#22c55e;font-weight:700;font-size:.82rem;margin-bottom:2px">Entreprise rattachée</div>
            <div style="color:${muted};font-size:.74rem">${entNom}</div>
          </div>
        </div>`);
    }

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
        <div style="display:flex;align-items:center;gap:12px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.18);border-radius:12px;padding:12px 14px;text-align:left">
          <div style="width:34px;height:34px;background:rgba(239,68,68,.1);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#ef4444;font-size:.9rem">
            <i class="fas fa-calendar-alt"></i>
          </div>
          <div>
            <div style="color:#ef4444;font-weight:700;font-size:.82rem;margin-bottom:2px">
              ${reservations.length} réservation${reservations.length > 1 ? 's' : ''}
            </div>
            <div style="font-size:.74rem">${details}</div>
          </div>
        </div>`);
    }

    if (fileAttente.length > 0) {
      const nbEnCours  = fileAttente.filter(f => String(f.statut) === 'EN_ATTENTE' || String(f.statut) === 'APPELE' || String(f.statut) === 'EN_COURS').length;
      const nbTermines = fileAttente.filter(f => String(f.statut) === 'TERMINE').length;
      const details = [
        nbEnCours  > 0 ? `<span style="color:#fbbf24">${nbEnCours} en cours</span>` : '',
        nbTermines > 0 ? `<span style="color:#94a3b8">${nbTermines} terminée${nbTermines > 1 ? 's' : ''}</span>` : ''
      ].filter(Boolean).join(' · ');
      items.push(`
        <div style="display:flex;align-items:center;gap:12px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.18);border-radius:12px;padding:12px 14px;text-align:left">
          <div style="width:34px;height:34px;background:rgba(245,158,11,.1);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#f59e0b;font-size:.9rem">
            <i class="fas fa-list-ol"></i>
          </div>
          <div>
            <div style="color:#f59e0b;font-weight:700;font-size:.82rem;margin-bottom:2px">
              ${fileAttente.length} entrée${fileAttente.length > 1 ? 's' : ''} en file d'attente
            </div>
            <div style="font-size:.74rem">${details}</div>
          </div>
        </div>`);
    }

    box.innerHTML = `
      <div style="width:48px;height:48px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.3);
           border-radius:14px;display:flex;align-items:center;justify-content:center;
           font-size:1.2rem;margin:0 auto 14px;color:#f59e0b">
        <i class="fas fa-exclamation-triangle"></i>
      </div>
      <div style="font-size:.98rem;font-weight:700;color:${text};margin-bottom:6px;letter-spacing:-0.01em">
        Suppression impossible
      </div>
      <div style="font-size:.8rem;color:${muted};margin-bottom:16px;line-height:1.5">
        <strong style="color:${text}">${e.nom} ${e.prenom}</strong> est encore lié aux éléments suivants :
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;text-align:left">
        ${items.join('')}
      </div>
      <div style="font-size:.74rem;color:${sub};background:${hintBg};
           border-radius:10px;padding:10px 12px;border:1px solid ${hintBorder};
           margin-bottom:18px;text-align:left;line-height:1.6">
        <i class="fas fa-lightbulb" style="color:#6366f1;margin-right:5px"></i>
        Supprimez ou dissociez ces éléments, puis réessayez.<br>
        <span>Ou <strong style="color:${muted}">archivez</strong> l'employé pour le désactiver sans perdre les données.</span>
      </div>
      <button id="linked-ok"
        style="background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;
        padding:10px 0;border-radius:10px;font-size:.85rem;font-weight:700;cursor:pointer;
        width:100%;font-family:inherit;box-shadow:0 2px 8px rgba(99,102,241,.35)">
        <i class="fas fa-check" style="margin-right:6px"></i>Compris
      </button>
    `;

    this.renderer.appendChild(overlay, box);
    this.renderer.appendChild(document.body, overlay);
    box.querySelector('#linked-ok')!.addEventListener('click', close);
    overlay.addEventListener('click', (ev: Event) => { if (ev.target === overlay) close(); });
  }

  // ── Archivage avec confirmation ─────────────────────────────────────────
  confirmerArchivage(e: EmployeResponse): void {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const overlay = this.renderer.createElement('div');
    this.renderer.setStyle(overlay, 'position', 'fixed');
    this.renderer.setStyle(overlay, 'inset', '0');
    this.renderer.setStyle(overlay, 'background', 'rgba(0,0,0,0.6)');
    this.renderer.setStyle(overlay, 'z-index', '99999');
    this.renderer.setStyle(overlay, 'display', 'flex');
    this.renderer.setStyle(overlay, 'align-items', 'center');
    this.renderer.setStyle(overlay, 'justify-content', 'center');
    this.renderer.setStyle(overlay, 'backdrop-filter', 'blur(4px)');

    const box = this.renderer.createElement('div');
    const bg     = isDark ? '#16161f' : '#ffffff';
    const border = isDark ? 'rgba(245,158,11,.3)' : '#fde68a';
    const text   = isDark ? '#f2f2f8' : '#0f0f1a';
    const muted  = isDark ? '#a2a2b8' : '#7070a0';
    const btnCancelBg     = isDark ? 'rgba(255,255,255,.06)' : '#f4f4f8';
    const btnCancelBorder = isDark ? 'rgba(255,255,255,.12)' : '#e2e2f0';
    const btnCancelColor  = isDark ? '#a2a2b8' : '#4a4a6a';

    this.renderer.setStyle(box, 'background', bg);
    this.renderer.setStyle(box, 'border', `1px solid ${border}`);
    this.renderer.setStyle(box, 'border-radius', '20px');
    this.renderer.setStyle(box, 'padding', '32px 28px');
    this.renderer.setStyle(box, 'text-align', 'center');
    this.renderer.setStyle(box, 'max-width', '380px');
    this.renderer.setStyle(box, 'width', '90%');
    this.renderer.setStyle(box, 'box-shadow', isDark ? '0 24px 64px rgba(0,0,0,0.6)' : '0 16px 48px rgba(0,0,0,0.15)');
    this.renderer.setStyle(box, 'font-family', 'Plus Jakarta Sans, sans-serif');

    const close = () => this.renderer.removeChild(document.body, overlay);

    box.innerHTML = `
      <div style="width:52px;height:52px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.3);
           border-radius:14px;display:flex;align-items:center;justify-content:center;
           font-size:1.3rem;margin:0 auto 16px;color:#f59e0b">
        <i class="fas fa-archive"></i>
      </div>
      <div style="font-size:1rem;font-weight:700;color:${text};margin-bottom:8px">Supprimer cet employé ?</div>
      <div style="font-size:.82rem;color:${muted};margin-bottom:8px">
        <strong style="color:${text}">${e.nom} ${e.prenom}</strong>
      </div>
      <div style="font-size:.75rem;color:${muted};background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.15);
           border-radius:8px;padding:8px 12px;margin-bottom:22px;line-height:1.5">
        <i class="fas fa-info-circle" style="margin-right:5px;color:#f59e0b"></i>
        L'employé sera désactivé mais ses données seront conservées.
      </div>
      <div style="display:flex;gap:8px;justify-content:center">
        <button id="arch-cancel" style="background:${btnCancelBg};color:${btnCancelColor};
          border:1px solid ${btnCancelBorder};padding:9px 20px;border-radius:8px;
          font-size:.82rem;font-weight:600;cursor:pointer;font-family:inherit">Annuler</button>
        <button id="arch-ok" style="background:#f59e0b;color:#fff;border:none;
          padding:9px 22px;border-radius:8px;font-size:.82rem;font-weight:700;
          cursor:pointer;font-family:inherit">
          <i class="fas fa-archive" style="margin-right:5px"></i>Supprimer
        </button>
      </div>
    `;

    this.renderer.appendChild(overlay, box);
    this.renderer.appendChild(document.body, overlay);
    box.querySelector('#arch-cancel')!.addEventListener('click', close);
    box.querySelector('#arch-ok')!.addEventListener('click', () => {
      close();
      this.api.archiverEmploye(e.id).subscribe({
        next: () => { this.reloadThen(() => this.toast.success('Employé archivé')); },
        error: () => this.toast.error('Erreur lors de l\'archivage')
      });
    });
    overlay.addEventListener('click', (ev: Event) => { if (ev.target === overlay) close(); });
  }

  desarchiver(e: EmployeResponse): void {
    this.api.desarchiverEmploye(e.id).subscribe({
      next: () => { this.reloadThen(() => this.toast.success('Désarchivé')); },
      error: () => this.toast.error('Erreur')
    });
  }
}