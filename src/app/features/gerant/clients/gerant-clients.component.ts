import { Component, OnInit, inject, HostListener, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { ClientResponse, ReservationResponse, FileAttenteResponse } from '../../../core/models/api.models';
import { forkJoin } from 'rxjs';

type ModalStep =
  | 'tel-check' | 'tel-found' | 'tel-archived'
  | 'email-check' | 'email-client-actif' | 'email-archived' | 'email-other-role'
  | 'already-associated' | 'new-form';

const AV_COLORS = [
  '#2563eb','#16a34a','#d97706','#dc2626','#7c3aed',
  '#0284c7','#059669','#ea580c','#9333ea','#0891b2'
];

@Component({
  selector: 'app-gerant-clients',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './gerant-clients.component.html',
  styleUrls: ['./gerant-clients.component.css']
})
export class GerantClientsComponent implements OnInit {
  private api      = inject(ApiService);
  private toast    = inject(ToastService);
  private fb       = inject(FormBuilder);
  private renderer = inject(Renderer2);
  private auth     = inject(AuthService);

  clients:  ClientResponse[] = [];
  filtered: ClientResponse[] = [];

  showModal     = false;
  editing: ClientResponse | null = null;
  loading       = false;
  searchQuery   = '';
  showArchived  = false;

  // Détail
  selectedClient: ClientResponse | null = null;

  // Flux création
  step: ModalStep  = 'tel-check';
  telToCheck       = '';
  emailToCheck     = '';
  checking         = false;
  checkResult: any = null;
  telError         = '';
  emailError       = '';

  form = this.fb.group({
    nom:      ['', Validators.required],
    prenom:   ['', Validators.required],
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    numtel:   ['']
  });

  editForm = this.fb.group({
    nom:      ['', Validators.required],
    prenom:   ['', Validators.required],
    email:    ['', [Validators.required, Validators.email]],
    password: [''],
    numtel:   ['', Validators.required]
  });


  @HostListener('document:click')
  onDocumentClick() { /* ferme dropdowns si besoin */ }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.api.getClients().subscribe(d => { this.clients = d; this.applyFilter(); });
  }

  applyFilter(): void {
    const q = this.searchQuery.toLowerCase();
    this.filtered = this.clients.filter(c => {
      const matchArchive = !c.archived;
      const matchSearch  = !q || `${c.nom} ${c.prenom} ${c.email} ${c.numtel ?? ''}`.toLowerCase().includes(q);
      return matchArchive && matchSearch;
    });
  }

  initials(c: ClientResponse) { return `${c.nom?.charAt(0)??''}${c.prenom?.charAt(0)??''}`.toUpperCase(); }
  avColor(c: ClientResponse)  { return AV_COLORS[(c.id || 0) % AV_COLORS.length]; }

  // ── Détail ────────────────────────────────────────────────────────────
  openDetail(c: ClientResponse): void { this.selectedClient = c; }
  closeDetail(): void                 { this.selectedClient = null; }

  // ── Création ─────────────────────────────────────────────────────────
  openCreate(): void {
    this.editing = null;
    this.step = 'tel-check';
    this.telToCheck = ''; this.emailToCheck = '';
    this.checkResult = null; this.telError = ''; this.emailError = '';
    this.form.reset();
    this.showModal = true;
  }

  openEdit(c: ClientResponse): void {
    this.editing = c;
    this.editForm.patchValue({ nom: c.nom, prenom: c.prenom, email: c.email, numtel: c.numtel, password: '' });
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false; this.editing = null;
    this.form.reset(); this.editForm.reset();
    this.telToCheck = ''; this.emailToCheck = '';
    this.checkResult = null; this.telError = ''; this.emailError = '';
  }

  // ÉTAPE 1 : vérifier le numéro
  checkTelephone(): void {
    this.telError = '';
    const tel = this.telToCheck.trim();
    if (!tel) return;
    if (!/^[0-9]{8,}$/.test(tel)) { this.telError = 'Numéro invalide — au moins 8 chiffres'; return; }
    this.checking = true;
    this.api.getClientByTelephone(tel).subscribe({
      next: (res: any) => {
        this.checking = false;
        this.checkResult = res;
        if      (res.status === 'ARCHIVED')      this.step = 'tel-archived';
        else if (res.status === 'ALREADY_TAKEN') this.step = 'tel-found';
        else                                     this.step = 'email-check';
      },
      error: () => { this.checking = false; this.toast.error('Erreur lors de la vérification'); }
    });
  }

  // ÉTAPE 2 : vérifier l'email
  checkEmail(): void {
    this.emailError = '';
    const email = this.emailToCheck.trim();
    if (!email) return;
    const emailRegex = /^[a-zA-Z0-9._%+\-]{4,}@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) { this.emailError = 'Email invalide — au moins 4 caractères avant le @'; return; }
    this.checking = true;
    this.api.checkClientEmail(email).subscribe({
      next: (res: any) => {
        this.checking = false;
        this.checkResult = res;
        if      (res.status === 'NOT_FOUND')            { this.form.patchValue({ email, numtel: this.telToCheck.trim() }); this.step = 'new-form'; }
        else if (res.status === 'ROLE_CLIENT')          this.step = 'email-client-actif';
        else if (res.status === 'ROLE_CLIENT_ARCHIVED') this.step = 'email-archived';
        else                                            this.step = 'email-other-role';
      },
      error: () => { this.checking = false; this.toast.error('Erreur lors de la vérification'); }
    });
  }

  // Associer un client existant à mon entreprise
  associerClientExistant(): void {
    const clientId     = this.checkResult?.clientId;
    const entrepriseId = this.auth.getEntrepriseId();
    if (!clientId || !entrepriseId) { this.toast.error('Données manquantes'); return; }
    this.loading = true;
    this.api.associerClientAEntreprise(clientId, entrepriseId).subscribe({
      next: () => {
        this.toast.success(`${this.checkResult.nom} ${this.checkResult.prenom} ajouté à votre entreprise !`);
        this.closeModal(); this.load(); this.loading = false;
      },
      error: (e: any) => {
        this.loading = false;
        if (e?.error?.error === 'ALREADY_ASSOCIATED') this.step = 'already-associated';
        else this.toast.error(e?.error?.message || 'Erreur');
      }
    });
  }

  // ÉTAPE 3 : créer nouveau client
  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true;
    this.api.createClient(this.form.value as any).subscribe({
      next: () => {
        this.toast.success('Client créé et ajouté à votre entreprise !');
        this.closeModal(); this.load(); this.loading = false;
      },
      error: (e: any) => { this.toast.error(e?.error?.message || 'Erreur'); this.loading = false; }
    });
  }

  saveEdit(): void {
    if (this.editForm.invalid || !this.editing) { this.editForm.markAllAsTouched(); return; }
    this.loading = true;
    this.api.updateClient(this.editing.id, this.editForm.value as any).subscribe({
      next: () => { this.toast.success('Client modifié !'); this.closeModal(); this.load(); this.loading = false; },
      error: (e: any) => { this.toast.error(e?.error?.message || 'Erreur'); this.loading = false; }
    });
  }

  // ── Dissocier ─────────────────────────────────────────────────────────
  dissocierClient(c: ClientResponse): void {
    const entrepriseId = this.auth.getEntrepriseId();
    if (!entrepriseId) { this.toast.error('Entreprise introuvable'); return; }
    this._showDissocierConfirm(c, entrepriseId);
  }

  private _showDissocierConfirm(c: ClientResponse, entrepriseId: number): void {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const overlay = this.renderer.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.6)',
      zIndex: '99999', display: 'flex', alignItems: 'center',
      justifyContent: 'center', backdropFilter: 'blur(4px)'
    });
    const box = this.renderer.createElement('div');
    const bg    = isDark ? '#16161f' : '#ffffff';
    const text  = isDark ? '#f2f2f8' : '#0f0f1a';
    const muted = isDark ? '#a2a2b8' : '#7070a0';
    Object.assign(box.style, {
      background: bg, border: `1px solid rgba(245,158,11,.3)`,
      borderRadius: '20px', padding: '32px 28px', textAlign: 'center',
      maxWidth: '400px', width: '90%',
      boxShadow: isDark ? '0 24px 64px rgba(0,0,0,0.6)' : '0 16px 48px rgba(0,0,0,0.15)',
      fontFamily: 'Plus Jakarta Sans, sans-serif'
    });
    const close = () => this.renderer.removeChild(document.body, overlay);
    box.innerHTML = `
      <div style="width:52px;height:52px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.3);
           border-radius:14px;display:flex;align-items:center;justify-content:center;
           font-size:1.2rem;margin:0 auto 16px;color:#f59e0b">
        <i class="fas fa-unlink"></i>
      </div>
      <div style="font-size:1rem;font-weight:700;color:${text};margin-bottom:8px">Retirer ce client ?</div>
      <div style="font-size:.82rem;color:${muted};margin-bottom:14px">
        <strong style="color:${text}">${c.nom} ${c.prenom}</strong> sera dissocié de votre entreprise.
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;text-align:left">
        <div style="display:flex;align-items:center;gap:10px;background:rgba(239,68,68,.08);
             border:1px solid rgba(239,68,68,.2);border-radius:10px;padding:10px 14px;font-size:.8rem;color:#f87171">
          <i class="fas fa-calendar-alt" style="flex-shrink:0"></i>
          Ses réservations et entrées en file actives seront annulées.
        </div>
      </div>
      <div style="display:flex;gap:8px;justify-content:center">
        <button id="dis-cancel" style="background:${isDark ? 'rgba(255,255,255,.06)' : '#f4f4f8'};
          color:${muted};border:1px solid ${isDark ? 'rgba(255,255,255,.12)' : '#e2e2f0'};
          padding:9px 20px;border-radius:8px;font-size:.82rem;font-weight:600;cursor:pointer">Annuler</button>
        <button id="dis-ok" style="background:#f59e0b;color:#fff;border:none;
          padding:9px 22px;border-radius:8px;font-size:.82rem;font-weight:700;cursor:pointer">
          <i class="fas fa-unlink" style="margin-right:5px"></i>Retirer
        </button>
      </div>`;
    this.renderer.appendChild(overlay, box);
    this.renderer.appendChild(document.body, overlay);
    box.querySelector('#dis-cancel')!.addEventListener('click', close);
    box.querySelector('#dis-ok')!.addEventListener('click', () => {
      close();
      this.api.dissocierClientDeEntreprise(c.id, entrepriseId).subscribe({
        next: () => { this.toast.success(`${c.nom} ${c.prenom} retiré de votre entreprise`); this.load(); if (this.selectedClient?.id === c.id) this.closeDetail(); },
        error: (e: any) => this.toast.error(e?.error?.message || 'Erreur')
      });
    });
    overlay.addEventListener('click', (e: Event) => { if (e.target === overlay) close(); });
  }

  // ── Supprimer ─────────────────────────────────────────────────────────
  supprimer(c: ClientResponse): void {
    forkJoin({ reservations: this.api.getReservations(), fileAttente: this.api.getFileAttente() }).subscribe({
      next: ({ reservations, fileAttente }) => {
        const resLiees  = reservations.filter(r => r.clientId === c.id);
        const fileLiees = fileAttente.filter(f => f.clientId === c.id);
        const hasLinks  = (c.entreprises && c.entreprises.length > 0) || resLiees.length > 0 || fileLiees.length > 0;
        if (hasLinks) this._openLinkedDialog(c, resLiees, fileLiees);
        else          this._showDeleteConfirm(c);
      },
      error: () => this._showDeleteConfirm(c)
    });
  }

  private _showDeleteConfirm(c: ClientResponse): void {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const overlay = this.renderer.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.6)',
      zIndex: '99999', display: 'flex', alignItems: 'center',
      justifyContent: 'center', backdropFilter: 'blur(4px)'
    });
    const box = this.renderer.createElement('div');
    const bg    = isDark ? '#16161f' : '#ffffff';
    const text  = isDark ? '#f2f2f8' : '#0f0f1a';
    const muted = isDark ? '#a2a2b8' : '#7070a0';
    Object.assign(box.style, {
      background: bg, border: `1px solid rgba(239,68,68,.25)`,
      borderRadius: '20px', padding: '32px 28px', textAlign: 'center',
      maxWidth: '380px', width: '90%',
      boxShadow: isDark ? '0 24px 64px rgba(0,0,0,0.6)' : '0 16px 48px rgba(0,0,0,0.15)',
      fontFamily: 'Plus Jakarta Sans, sans-serif'
    });
    const close = () => this.renderer.removeChild(document.body, overlay);
    box.innerHTML = `
      <div style="width:52px;height:52px;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);
           border-radius:14px;display:flex;align-items:center;justify-content:center;
           font-size:1.3rem;margin:0 auto 16px;color:#ef4444">
        <i class="fas fa-trash-alt"></i>
      </div>
      <div style="font-size:1rem;font-weight:700;color:${text};margin-bottom:8px">Supprimer ce client ?</div>
      <div style="font-size:.82rem;color:${muted};margin-bottom:8px">
        <strong style="color:${text}">${c.nom} ${c.prenom}</strong>
      </div>
      <div style="font-size:.75rem;color:#ef4444;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);
           border-radius:8px;padding:8px 12px;margin-bottom:22px">
        <i class="fas fa-exclamation-triangle" style="margin-right:5px"></i> Cette action est irréversible.
      </div>
      <div style="display:flex;gap:8px;justify-content:center">
        <button id="del-cancel" style="background:${isDark ? 'rgba(255,255,255,.06)' : '#f4f4f8'};
          color:${muted};border:1px solid ${isDark ? 'rgba(255,255,255,.12)' : '#e2e2f0'};
          padding:9px 20px;border-radius:8px;font-size:.82rem;font-weight:600;cursor:pointer">Annuler</button>
        <button id="del-ok" style="background:#ef4444;color:#fff;border:none;
          padding:9px 22px;border-radius:8px;font-size:.82rem;font-weight:700;cursor:pointer">
          <i class="fas fa-trash-alt" style="margin-right:5px"></i>Supprimer
        </button>
      </div>`;
    this.renderer.appendChild(overlay, box);
    this.renderer.appendChild(document.body, overlay);
    box.querySelector('#del-cancel')!.addEventListener('click', close);
    box.querySelector('#del-ok')!.addEventListener('click', () => {
      close();
      this.api.supprimerClient(c.id).subscribe({
        next: () => { this.toast.success('Client supprimé.'); this.load(); if (this.selectedClient?.id === c.id) this.closeDetail(); },
        error: () => this.toast.error('Erreur lors de la suppression')
      });
    });
    overlay.addEventListener('click', (ev: Event) => { if (ev.target === overlay) close(); });
  }

  private _openLinkedDialog(c: ClientResponse, reservations: ReservationResponse[], fileAttente: FileAttenteResponse[]): void {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const overlay = this.renderer.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.6)',
      zIndex: '99999', display: 'flex', alignItems: 'center',
      justifyContent: 'center', backdropFilter: 'blur(4px)'
    });
    const box = this.renderer.createElement('div');
    const bg    = isDark ? '#16161f' : '#ffffff';
    const text  = isDark ? '#f2f2f8' : '#0f0f1a';
    const muted = isDark ? '#a2a2b8' : '#7070a0';
    const sub   = isDark ? '#78788c' : '#9090b0';
    const hintBg     = isDark ? 'rgba(255,255,255,.04)' : '#f4f4f8';
    const hintBorder = isDark ? 'rgba(255,255,255,.08)' : '#e2e2f0';
    Object.assign(box.style, {
      background: bg, border: `1px solid ${isDark ? 'rgba(255,255,255,.1)' : '#e2e2f0'}`,
      borderRadius: '20px', padding: '28px 24px', textAlign: 'center',
      maxWidth: '440px', width: '92%',
      boxShadow: isDark ? '0 24px 64px rgba(0,0,0,0.6)' : '0 16px 48px rgba(0,0,0,0.15)',
      fontFamily: 'Plus Jakarta Sans, sans-serif'
    });
    const close = () => this.renderer.removeChild(document.body, overlay);
    const items: string[] = [];
    if (c.entreprises && c.entreprises.length > 0) {
      const noms = c.entreprises.map(e => e.nom).join(', ');
      items.push(`<div style="display:flex;align-items:center;gap:12px;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);border-radius:12px;padding:12px 14px;text-align:left">
        <div style="width:34px;height:34px;background:rgba(34,197,94,.12);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#22c55e;font-size:.9rem"><i class="fas fa-building"></i></div>
        <div><div style="color:#22c55e;font-weight:700;font-size:.82rem;margin-bottom:2px">${c.entreprises.length} entreprise${c.entreprises.length>1?'s':''} associée${c.entreprises.length>1?'s':''}</div>
        <div style="color:${muted};font-size:.74rem">${noms}</div></div></div>`);
    }
    if (reservations.length > 0) {
      const nbActives   = reservations.filter(r => ['EN_ATTENTE','CONFIRMEE','EN_COURS'].includes(r.statut)).length;
      const nbTerminees = reservations.filter(r => r.statut === 'TERMINEE').length;
      const nbAnnulees  = reservations.filter(r => r.statut === 'ANNULEE').length;
      const details = [
        nbActives   > 0 ? `<span style="color:#f59e0b">${nbActives} active${nbActives>1?'s':''}</span>` : '',
        nbTerminees > 0 ? `<span style="color:${sub}">${nbTerminees} terminée${nbTerminees>1?'s':''}</span>` : '',
        nbAnnulees  > 0 ? `<span style="color:#f87171">${nbAnnulees} annulée${nbAnnulees>1?'s':''}</span>` : ''
      ].filter(Boolean).join(' · ');
      items.push(`<div style="display:flex;align-items:center;gap:12px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.18);border-radius:12px;padding:12px 14px;text-align:left">
        <div style="width:34px;height:34px;background:rgba(239,68,68,.1);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#ef4444;font-size:.9rem"><i class="fas fa-calendar-alt"></i></div>
        <div><div style="color:#ef4444;font-weight:700;font-size:.82rem;margin-bottom:2px">${reservations.length} réservation${reservations.length>1?'s':''}</div>
        <div style="font-size:.74rem">${details}</div></div></div>`);
    }
    if (fileAttente.length > 0) {
      const nbEnCours  = fileAttente.filter(f => ['EN_ATTENTE','APPELE','EN_COURS'].includes(String(f.statut))).length;
      const nbTermines = fileAttente.filter(f => String(f.statut) === 'TERMINE').length;
      const details = [
        nbEnCours  > 0 ? `<span style="color:#f59e0b">${nbEnCours} en cours</span>` : '',
        nbTermines > 0 ? `<span style="color:${sub}">${nbTermines} terminée${nbTermines>1?'s':''}</span>` : ''
      ].filter(Boolean).join(' · ');
      items.push(`<div style="display:flex;align-items:center;gap:12px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.18);border-radius:12px;padding:12px 14px;text-align:left">
        <div style="width:34px;height:34px;background:rgba(245,158,11,.1);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#f59e0b;font-size:.9rem"><i class="fas fa-list-ol"></i></div>
        <div><div style="color:#f59e0b;font-weight:700;font-size:.82rem;margin-bottom:2px">${fileAttente.length} entrée${fileAttente.length>1?'s':''} en file d'attente</div>
        <div style="font-size:.74rem">${details}</div></div></div>`);
    }
    box.innerHTML = `
      <div style="width:48px;height:48px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.3);
           border-radius:14px;display:flex;align-items:center;justify-content:center;
           font-size:1.2rem;margin:0 auto 14px;color:#f59e0b"><i class="fas fa-exclamation-triangle"></i></div>
      <div style="font-size:.98rem;font-weight:700;color:${text};margin-bottom:6px">Suppression impossible</div>
      <div style="font-size:.8rem;color:${muted};margin-bottom:16px;line-height:1.5">
        <strong style="color:${text}">${c.nom} ${c.prenom}</strong> est encore lié aux éléments suivants :</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;text-align:left">${items.join('')}</div>
      <div style="font-size:.74rem;color:${sub};background:${hintBg};border-radius:10px;padding:10px 12px;
           border:1px solid ${hintBorder};margin-bottom:18px;text-align:left;line-height:1.6">
        <i class="fas fa-lightbulb" style="color:#6366f1;margin-right:5px"></i>
        Retirez d'abord ce client de votre entreprise, ou dissociez ses réservations.
      </div>
      <button id="linked-ok" style="background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;
        padding:10px 0;border-radius:10px;font-size:.85rem;font-weight:700;cursor:pointer;
        width:100%;box-shadow:0 2px 8px rgba(99,102,241,.35)">
        <i class="fas fa-check" style="margin-right:6px"></i>Compris
      </button>`;
    this.renderer.appendChild(overlay, box);
    this.renderer.appendChild(document.body, overlay);
    box.querySelector('#linked-ok')!.addEventListener('click', close);
    overlay.addEventListener('click', (ev: Event) => { if (ev.target === overlay) close(); });
  }

  desarchiver(c: ClientResponse): void {
    this.api.desarchiverClient(c.id).subscribe({
      next: () => { this.toast.success('Désarchivé'); this.load(); },
      error: () => this.toast.error('Erreur')
    });
  }
}