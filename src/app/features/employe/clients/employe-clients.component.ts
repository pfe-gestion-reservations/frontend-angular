import { Component, OnInit, inject, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { ClientResponse, ReservationResponse, FileAttenteResponse } from '../../../core/models/api.models';
import { forkJoin } from 'rxjs';

// Flux :
// tel-check → tel-found (actif, proposer association) | tel-archived (informer) | email-check (non trouvé)
// email-check → email-client-actif (associer) | email-archived (informer) | email-other-role (bloquer) | new-form (créer)
type ModalStep =
  | 'tel-check' | 'tel-found' | 'tel-archived'
  | 'email-check' | 'email-client-actif' | 'email-archived' | 'email-other-role'
  | 'already-associated' | 'new-form';

const AV_COLORS = [
  '#2563eb','#16a34a','#d97706','#dc2626','#7c3aed',
  '#0284c7','#059669','#ea580c','#9333ea','#0891b2'
];

@Component({
  selector: 'app-employe-clients',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: `./employe-clients.component.html`,
  styleUrls: [`./employe-clients.component.css`]
})
export class EmployeClientsComponent implements OnInit {
  private api      = inject(ApiService);
  private toast    = inject(ToastService);
  private fb       = inject(FormBuilder);
  private renderer = inject(Renderer2);
  private auth     = inject(AuthService);

  clients:  ClientResponse[] = [];
  filtered: ClientResponse[] = [];
  showModal    = false;
  editing: ClientResponse | null = null;
  loading      = false;
  searchQuery  = '';

  step: ModalStep  = 'tel-check';
  telToCheck       = '';
  emailToCheck     = '';
  checking         = false;
  checkResult: any = null;

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

  get totalActifs()   { return this.clients.filter(c => !c.archived).length; }
  get totalArchives() { return this.clients.filter(c =>  c.archived).length; }
  get avecTel()       { return this.clients.filter(c => !!c.numtel).length; }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.api.getClients().subscribe(d => { this.clients = d; this.applyFilter(); });
  }

  applyFilter(): void {
    const q = this.searchQuery.toLowerCase();
    this.filtered = this.clients.filter(c => {
      return !q || `${c.nom} ${c.prenom} ${c.email} ${c.numtel ?? ''}`.toLowerCase().includes(q);
    });
  }

  initials(c: ClientResponse) { return `${c.nom?.charAt(0)??''}${c.prenom?.charAt(0)??''}`.toUpperCase(); }
  avColor(c: ClientResponse)  { return AV_COLORS[(c.id || 0) % AV_COLORS.length]; }

  openCreate(): void {
    this.editing = null;
    this.step = 'tel-check';
    this.telToCheck = ''; this.emailToCheck = ''; this.checkResult = null;
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
    this.telToCheck = ''; this.emailToCheck = ''; this.checkResult = null;
  }

  // ÉTAPE 1 : vérifier le numéro
  checkTelephone(): void {
    if (!this.telToCheck.trim()) return;
    this.checking = true;
    this.api.getClientByTelephone(this.telToCheck.trim()).subscribe({
      next: (res: any) => {
        this.checking = false;
        this.checkResult = res;
        if      (res.status === 'ARCHIVED')      this.step = 'tel-archived';
        else if (res.status === 'ALREADY_TAKEN') this.step = 'tel-found';
        else                                     this.step = 'email-check'; // NOT_FOUND → continuer
      },
      error: () => { this.checking = false; this.toast.error('Erreur lors de la vérification'); }
    });
  }

  // ÉTAPE 2 : vérifier l'email
  checkEmail(): void {
    if (!this.emailToCheck.trim()) return;
    this.checking = true;
    this.api.checkClientEmail(this.emailToCheck.trim()).subscribe({
      next: (res: any) => {
        this.checking = false;
        this.checkResult = res;
        if      (res.status === 'NOT_FOUND')          { this.form.patchValue({ email: this.emailToCheck.trim(), numtel: this.telToCheck.trim() }); this.step = 'new-form'; }
        else if (res.status === 'ROLE_CLIENT')        this.step = 'email-client-actif';
        else if (res.status === 'ROLE_CLIENT_ARCHIVED') this.step = 'email-archived';
        else                                          this.step = 'email-other-role'; // EMAIL_OTHER_ROLE
      },
      error: () => { this.checking = false; this.toast.error('Erreur lors de la vérification'); }
    });
  }

  // Email d'un client actif → associer directement à mon entreprise
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
        const errCode = e?.error?.error;
        if (errCode === 'ALREADY_ASSOCIATED') {
          this.step = 'already-associated';
        } else {
          this.toast.error(e?.error?.message || 'Erreur');
        }
      }
    });
  }

  // Nouveau compte → créer et associer automatiquement
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

  supprimer(c: ClientResponse): void {
    forkJoin({
      reservations: this.api.getReservations(),
      fileAttente:  this.api.getFileAttente()
    }).subscribe({
      next: ({ reservations, fileAttente }) => {
        const resLiees  = reservations.filter(r => r.clientId === c.id);
        const fileLiees = fileAttente.filter(f => f.clientId === c.id);
        const hasEntreprises = c.entreprises && c.entreprises.length > 0;
        const hasLinks = hasEntreprises || resLiees.length > 0 || fileLiees.length > 0;
        if (hasLinks) this._openLinkedDialog(c, resLiees, fileLiees);
        else          this._showDeleteConfirm(c);
      },
      error: () => this._showDeleteConfirm(c)
    });
  }

  private _showDeleteConfirm(c: ClientResponse): void {
    const overlay = this.renderer.createElement('div');
    this.renderer.setStyle(overlay, 'position', 'fixed'); this.renderer.setStyle(overlay, 'inset', '0');
    this.renderer.setStyle(overlay, 'background', 'rgba(0,0,0,0.65)'); this.renderer.setStyle(overlay, 'z-index', '99999');
    this.renderer.setStyle(overlay, 'display', 'flex'); this.renderer.setStyle(overlay, 'align-items', 'center'); this.renderer.setStyle(overlay, 'justify-content', 'center');
    const box = this.renderer.createElement('div');
    this.renderer.setStyle(box, 'background', '#1e1e2e'); this.renderer.setStyle(box, 'border', '1px solid rgba(239,68,68,.3)');
    this.renderer.setStyle(box, 'border-radius', '16px'); this.renderer.setStyle(box, 'padding', '32px 28px');
    this.renderer.setStyle(box, 'text-align', 'center'); this.renderer.setStyle(box, 'max-width', '380px'); this.renderer.setStyle(box, 'width', '90%');
    this.renderer.setStyle(box, 'box-shadow', '0 24px 64px rgba(0,0,0,0.6)'); this.renderer.setStyle(box, 'font-family', 'inherit');
    const close = () => this.renderer.removeChild(document.body, overlay);
    box.innerHTML = `
      <div style="font-size:2.2rem;margin-bottom:12px">🗑️</div>
      <div style="font-size:1.05rem;font-weight:700;color:#fff;margin-bottom:8px">Supprimer ce client ?</div>
      <div style="font-size:.875rem;color:#94a3b8;margin-bottom:14px"><strong style="color:#fff">${c.nom} ${c.prenom}</strong></div>
      <div style="font-size:.78rem;color:#f87171;margin-bottom:22px">⚠️ Cette action est irréversible.</div>
      <div style="display:flex;gap:10px;justify-content:center">
        <button id="del-cancel" style="background:transparent;color:#aaa;border:1px solid rgba(255,255,255,0.15);padding:9px 20px;border-radius:8px;font-size:.875rem;cursor:pointer">Annuler</button>
        <button id="del-ok" style="background:#ef4444;color:#fff;border:none;padding:9px 22px;border-radius:8px;font-size:.875rem;font-weight:700;cursor:pointer">Supprimer</button>
      </div>`;
    this.renderer.appendChild(overlay, box); this.renderer.appendChild(document.body, overlay);
    box.querySelector('#del-cancel')!.addEventListener('click', close);
    box.querySelector('#del-ok')!.addEventListener('click', () => {
      close();
      this.api.supprimerClient(c.id).subscribe({
        next: () => { this.toast.success('Client supprimé définitivement.'); this.load(); },
        error: () => this.toast.error('Erreur lors de la suppression')
      });
    });
    overlay.addEventListener('click', (ev: Event) => { if (ev.target === overlay) close(); });
  }

  private _openLinkedDialog(c: ClientResponse, reservations: ReservationResponse[], fileAttente: FileAttenteResponse[]): void {
    const overlay = this.renderer.createElement('div');
    this.renderer.setStyle(overlay, 'position', 'fixed'); this.renderer.setStyle(overlay, 'inset', '0');
    this.renderer.setStyle(overlay, 'background', 'rgba(0,0,0,0.7)'); this.renderer.setStyle(overlay, 'z-index', '99999');
    this.renderer.setStyle(overlay, 'display', 'flex'); this.renderer.setStyle(overlay, 'align-items', 'center'); this.renderer.setStyle(overlay, 'justify-content', 'center');
    const box = this.renderer.createElement('div');
    this.renderer.setStyle(box, 'background', '#1e1e2e'); this.renderer.setStyle(box, 'border', '1px solid rgba(245,158,11,.4)');
    this.renderer.setStyle(box, 'border-radius', '18px'); this.renderer.setStyle(box, 'padding', '32px 28px 28px');
    this.renderer.setStyle(box, 'text-align', 'center'); this.renderer.setStyle(box, 'max-width', '440px'); this.renderer.setStyle(box, 'width', '92%');
    this.renderer.setStyle(box, 'box-shadow', '0 24px 64px rgba(0,0,0,0.7)'); this.renderer.setStyle(box, 'font-family', 'inherit');
    const close = () => this.renderer.removeChild(document.body, overlay);
    const items: string[] = [];
    if (c.entreprises && c.entreprises.length > 0) {
      const noms = c.entreprises.map(e => e.nom).join(', ');
      items.push(`<div style="display:flex;align-items:center;gap:12px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.25);border-radius:10px;padding:12px 16px;text-align:left">
        <span style="font-size:1.5rem;flex-shrink:0">🏢</span>
        <div><div style="color:#6ee7b7;font-weight:700;font-size:.88rem;margin-bottom:3px">${c.entreprises.length} entreprise${c.entreprises.length>1?'s':''} associée${c.entreprises.length>1?'s':''}</div>
        <div style="color:#94a3b8;font-size:.78rem">${noms}</div></div></div>`);
    }
    if (reservations.length > 0) {
      const nbActives   = reservations.filter(r => r.statut === 'EN_ATTENTE' || r.statut === 'CONFIRMEE' || r.statut === 'EN_COURS').length;
      const nbTerminees = reservations.filter(r => r.statut === 'TERMINEE').length;
      const nbAnnulees  = reservations.filter(r => r.statut === 'ANNULEE').length;
      const details = [
        nbActives   > 0 ? `<span style="color:#fbbf24">${nbActives} active${nbActives>1?'s':''}</span>` : '',
        nbTerminees > 0 ? `<span style="color:#94a3b8">${nbTerminees} terminée${nbTerminees>1?'s':''}</span>` : '',
        nbAnnulees  > 0 ? `<span style="color:#f87171">${nbAnnulees} annulée${nbAnnulees>1?'s':''}</span>` : ''
      ].filter(Boolean).join(' · ');
      items.push(`<div style="display:flex;align-items:center;gap:12px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:10px;padding:12px 16px;text-align:left">
        <span style="font-size:1.5rem;flex-shrink:0">📅</span>
        <div><div style="color:#f87171;font-weight:700;font-size:.88rem;margin-bottom:3px">${reservations.length} réservation${reservations.length>1?'s':''}</div>
        <div style="font-size:.78rem">${details}</div></div></div>`);
    }
    if (fileAttente.length > 0) {
      const nbEnCours  = fileAttente.filter(f => String(f.statut) === 'EN_ATTENTE' || String(f.statut) === 'APPELE' || String(f.statut) === 'EN_COURS').length;
      const nbTermines = fileAttente.filter(f => String(f.statut) === 'TERMINE').length;
      const details = [
        nbEnCours  > 0 ? `<span style="color:#fbbf24">${nbEnCours} en cours</span>` : '',
        nbTermines > 0 ? `<span style="color:#94a3b8">${nbTermines} terminée${nbTermines>1?'s':''}</span>` : ''
      ].filter(Boolean).join(' · ');
      items.push(`<div style="display:flex;align-items:center;gap:12px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:10px;padding:12px 16px;text-align:left">
        <span style="font-size:1.5rem;flex-shrink:0">🕐</span>
        <div><div style="color:#fbbf24;font-weight:700;font-size:.88rem;margin-bottom:3px">${fileAttente.length} entrée${fileAttente.length>1?'s':''} en file d'attente</div>
        <div style="font-size:.78rem">${details}</div></div></div>`);
    }
    box.innerHTML = `
      <div style="width:52px;height:52px;background:rgba(245,158,11,.12);border:2px solid rgba(245,158,11,.35);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.6rem;margin:0 auto 16px">⚠️</div>
      <div style="font-size:1.1rem;font-weight:700;color:#fff;margin-bottom:6px">Suppression impossible</div>
      <div style="font-size:.82rem;color:#94a3b8;margin-bottom:18px;line-height:1.5"><strong style="color:#f1f5f9">${c.nom} ${c.prenom}</strong> est encore lié aux éléments suivants :</div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:18px">${items.join('')}</div>
      <div style="font-size:.76rem;color:#64748b;margin-bottom:20px;background:rgba(255,255,255,.03);border-radius:8px;padding:10px;border:1px solid rgba(255,255,255,.06)">
        💡 Supprimez ou dissociez ces éléments, puis réessayez.<br>
        <span style="color:#475569">Ou <strong style="color:#94a3b8">archivez</strong> le client pour le désactiver sans perdre les données.</span>
      </div>
      <button id="linked-ok" style="background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;padding:11px 36px;border-radius:10px;font-size:.9rem;font-weight:600;cursor:pointer;width:100%"
        onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">Compris</button>`;
    this.renderer.appendChild(overlay, box); this.renderer.appendChild(document.body, overlay);
    box.querySelector('#linked-ok')!.addEventListener('click', close);
    overlay.addEventListener('click', (ev: Event) => { if (ev.target === overlay) close(); });
  }

  dissocierClient(c: ClientResponse): void {
    const entrepriseId = this.auth.getEntrepriseId();
    if (!entrepriseId) { this.toast.error('Entreprise introuvable'); return; }

    const overlay = this.renderer.createElement('div');
    this.renderer.setStyle(overlay, 'position', 'fixed'); this.renderer.setStyle(overlay, 'inset', '0');
    this.renderer.setStyle(overlay, 'background', 'rgba(0,0,0,0.65)'); this.renderer.setStyle(overlay, 'z-index', '99999');
    this.renderer.setStyle(overlay, 'display', 'flex'); this.renderer.setStyle(overlay, 'align-items', 'center'); this.renderer.setStyle(overlay, 'justify-content', 'center');
    const box = this.renderer.createElement('div');
    this.renderer.setStyle(box, 'background', '#1e1e2e'); this.renderer.setStyle(box, 'border', '1px solid rgba(245,158,11,.3)');
    this.renderer.setStyle(box, 'border-radius', '18px'); this.renderer.setStyle(box, 'padding', '32px 28px');
    this.renderer.setStyle(box, 'text-align', 'center'); this.renderer.setStyle(box, 'max-width', '380px'); this.renderer.setStyle(box, 'width', '92%');
    this.renderer.setStyle(box, 'box-shadow', '0 24px 64px rgba(0,0,0,0.6)'); this.renderer.setStyle(box, 'font-family', 'inherit');
    const close = () => this.renderer.removeChild(document.body, overlay);
    box.innerHTML = `
      <div style="font-size:2rem;margin-bottom:12px">🏢</div>
      <div style="font-size:1.05rem;font-weight:700;color:#fff;margin-bottom:6px">Retirer ce client ?</div>
      <div style="font-size:.85rem;color:#aaa;margin-bottom:16px"><strong style="color:#f1f5f9">${c.nom} ${c.prenom}</strong></div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:22px;text-align:left">
        <div style="display:flex;align-items:center;gap:10px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:10px;padding:10px 14px">
          <span style="font-size:1.1rem">🔗</span>
          <div style="font-size:.82rem;color:#fbbf24">Il sera <strong>dissocié de votre entreprise</strong> uniquement</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:10px;padding:10px 14px">
          <span style="font-size:1.1rem">📅</span>
          <div style="font-size:.82rem;color:#f87171">Ses <strong>réservations et file d'attente actives</strong> seront annulées</div>
        </div>
      </div>
      <div style="display:flex;gap:10px;justify-content:center">
        <button id="dis-cancel" style="background:transparent;color:#aaa;border:1px solid rgba(255,255,255,0.15);padding:9px 20px;border-radius:8px;font-size:.875rem;cursor:pointer">Annuler</button>
        <button id="dis-ok" style="background:#f59e0b;color:#fff;border:none;padding:9px 22px;border-radius:8px;font-size:.875rem;font-weight:700;cursor:pointer">Retirer</button>
      </div>`;
    this.renderer.appendChild(overlay, box); this.renderer.appendChild(document.body, overlay);
    box.querySelector('#dis-cancel')!.addEventListener('click', close);
    box.querySelector('#dis-ok')!.addEventListener('click', () => {
      close();
      this.api.dissocierClientDeEntreprise(c.id, entrepriseId).subscribe({
        next: () => { this.toast.success(`${c.nom} ${c.prenom} retiré de votre entreprise`); this.load(); },
        error: (e: any) => this.toast.error(e?.error?.message || 'Erreur')
      });
    });
    overlay.addEventListener('click', (e: Event) => { if (e.target === overlay) close(); });
  }

  desarchiver(c: ClientResponse): void {
    this.api.desarchiverClient(c.id).subscribe({
      next: () => { this.toast.success('Désarchivé'); this.load(); },
      error: () => this.toast.error('Erreur')
    });
  }
}