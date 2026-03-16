import { Component, OnInit, inject, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { ClientResponse } from '../../../core/models/api.models';

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