import { Component, OnInit, inject, HostListener, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { ClientResponse, EntrepriseResponse, ReservationResponse, FileAttenteResponse } from '../../../core/models/api.models';
import { forkJoin } from 'rxjs';

type ClientStep = 'tel-check' | 'tel-taken' | 'tel-archived'
                | 'email-check' | 'email-client' | 'email-archived' | 'email-other-role'
                | 'new-form';

const AV_COLORS = [
  '#2563eb','#16a34a','#d97706','#dc2626','#7c3aed',
  '#0284c7','#059669','#ea580c','#9333ea','#0891b2'
];

@Component({
  selector: 'app-sa-clients',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './sa-clients.component.html',
  styleUrls: ['./sa-clients.component.css']
})
export class SaClientsComponent implements OnInit {
  private api      = inject(ApiService);
  private toast    = inject(ToastService);
  private fb       = inject(FormBuilder);
  private renderer = inject(Renderer2);

  clients:     ClientResponse[]     = [];
  filtered:    ClientResponse[]     = [];
  entreprises: EntrepriseResponse[] = [];

  showModal    = false;     
  editing: ClientResponse | null = null;
  loading      = false;
  showArchived = false;
  searchQuery  = '';
  selectedClient: ClientResponse | null = null;
  emailError = '';
  telError = '';

  // Association depuis la modale détail
  assocDropOpen      = false; //liste deroulante initialement fermé
  assocSearch        = '';    
  assocSelectedEnt:  EntrepriseResponse | null = null;
  filteredAssocEnts: EntrepriseResponse[] = [];
  assocLoading       = false;

  //flux du création
  step: ClientStep = 'tel-check';
  telToCheck       = '';
  emailToCheck     = '';
  checking         = false;

  // Client archivé trouvé (pour désarchivage)
  archivedClientId: number | null = null;
  archivedClientNom    = '';
  archivedClientPrenom = '';
  archivedClientEmail  = '';
  desarchiverLoading   = false;

  get totalActifs()   { return this.clients.filter(c => !c.archived).length; }
  get totalArchives() { return this.clients.filter(c =>  c.archived).length; }

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
  onDocumentClick() { this.assocDropOpen = false; }

  ngOnInit(): void {
    this.api.getEntreprises().subscribe(e => {
      this.entreprises = e;
      this.filteredAssocEnts = [...e];
    });
    this.load();
  }

  load(): void {
    this.api.getClients().subscribe(d => { this.clients = d; this.applyFilter(); });
  }

  applyFilter(): void {
    const q = this.searchQuery.toLowerCase();
    this.filtered = this.clients.filter(c => {
      const matchArchive = this.showArchived ? true : !c.archived;
      const matchSearch  = !q || `${c.nom} ${c.prenom} ${c.email} ${c.numtel}`.toLowerCase().includes(q);
      return matchArchive && matchSearch;
    });
  }

  initials(c: any): string { return `${c?.nom?.charAt(0) ?? ''}${c?.prenom?.charAt(0) ?? ''}`.toUpperCase(); }
  avColor(c: any): string  { return AV_COLORS[(c?.id || 0) % AV_COLORS.length]; }

  // ── Modale détail ────────────────────────────────────────────────────
  openDetail(c: ClientResponse): void {
    this.selectedClient    = c;
    this.assocDropOpen     = false;
    this.assocSearch       = '';
    this.assocSelectedEnt  = null;
    this.filteredAssocEnts = [...this.entreprises];
  }

  closeDetail(): void {
    this.selectedClient   = null;
    this.assocDropOpen    = false;
    this.assocSearch      = '';
    this.assocSelectedEnt = null;
  }

  // ── Dropdown association ─────────────────────────────────────────────
  toggleAssocDrop(event: Event): void {
    event.stopPropagation();
    this.assocDropOpen = !this.assocDropOpen;
    if (this.assocDropOpen) { this.assocSearch = ''; this.filteredAssocEnts = [...this.entreprises]; }
  }

  filterAssocEnts(): void {
    const q = this.assocSearch.toLowerCase();
    this.filteredAssocEnts = this.entreprises.filter(e =>
      e.nom.toLowerCase().includes(q) || (e.secteurNom ?? '').toLowerCase().includes(q)
    );
  }

  selectAssocEnt(e: EntrepriseResponse, event: Event): void {
    event.stopPropagation();
    if (this.isAlreadyAssociated(e.id)) return;
    this.assocSelectedEnt = e;
    this.assocDropOpen    = false;
  }

  clearAssocEnt(event: Event): void {
    event.stopPropagation();
    this.assocSelectedEnt = null;
  }

  isAlreadyAssociated(entrepriseId: number): boolean {
    return !!this.selectedClient?.entreprises?.some(e => e.id === entrepriseId);
  }

  associerDepuisDetail(): void {
    if (!this.selectedClient || !this.assocSelectedEnt) return;
    const ent = this.assocSelectedEnt;
    this.assocLoading = true;
    this.api.associerClientAEntreprise(this.selectedClient.id, ent.id).subscribe({
      next: () => {
        this.toast.success(`Client associé à ${ent.nom} !`);
        this.assocSelectedEnt = null;
        this.assocLoading = false;
        this.api.getClients().subscribe(d => {
          this.clients = d; this.applyFilter();
          this.selectedClient = this.clients.find(c => c.id === this.selectedClient?.id) ?? null;
        });
      },
      error: (err: any) => { this.toast.error(err?.error?.message || 'Erreur'); this.assocLoading = false; }
    });
  }

  dissocierDeEntreprise(clientId: number, entreprise: { id: number; nom: string }): void {
    if (!confirm(`Retirer ce client de "${entreprise.nom}" ?`)) return;
    this.api.dissocierClientDeEntreprise(clientId, entreprise.id).subscribe({
      next: () => {
        this.toast.success(`Client retiré de ${entreprise.nom}`);
        this.api.getClients().subscribe(d => {
          this.clients = d; this.applyFilter();
          this.selectedClient = this.clients.find(c => c.id === this.selectedClient?.id) ?? null;
        });
      },
      error: (e: any) => this.toast.error(e?.error?.message || 'Erreur')
    });
  }

  // ── Création ─────────────────────────────────────────────────────────
  openCreate(): void {
    this.editing              = null;
    this.step                 = 'tel-check';
    this.telToCheck           = '';
    this.emailToCheck         = '';
    this.archivedClientId     = null;
    this.archivedClientNom    = '';
    this.archivedClientPrenom = '';
    this.archivedClientEmail  = '';
    this.form.reset();
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal            = false;
    this.editing              = null;
    this.telToCheck           = '';
    this.emailToCheck         = '';
    this.archivedClientId     = null;
    this.archivedClientNom    = '';
    this.archivedClientPrenom = '';
    this.archivedClientEmail  = '';
    this.form.reset();
    this.editForm.reset();
  }

  // ÉTAPE 1 : vérifier le numéro de téléphone
  checkTelephone(): void {
  this.telError = '';

  const tel = this.telToCheck.trim();
  if (!tel) return;

  const telRegex = /^[0-9]{8,}$/;

  if (!telRegex.test(tel)) {
    this.telError = 'Numéro invalide';
    return;
  }

  this.checking = true;

  this.api.getClientByTelephone(tel).subscribe({
    next: (res: any) => {
      this.checking = false;

      if (res.status === 'ARCHIVED') {
        this.archivedClientId     = res.clientId;
        this.archivedClientNom    = res.nom;
        this.archivedClientPrenom = res.prenom;
        this.archivedClientEmail  = res.email;
        this.step = 'tel-archived';

      } else if (res.status === 'ALREADY_TAKEN') {
        this.step = 'tel-taken';

      } else {
        this.step = 'email-check';
      }
    },
    error: () => {
      this.checking = false;
      this.toast.error('Erreur lors de la vérification');
    }
  });
}

  // ÉTAPE 2 : vérifier l'email
  checkEmail(): void {
  this.emailError = '';

  const email = this.emailToCheck.trim();
  if (!email) return;

  // Regex (comme ton exemple)
  const emailRegex = /^[a-zA-Z0-9._%+\-]{4,}@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

  if (!emailRegex.test(email)) {
    this.emailError = 'Email invalide — au moins 4 caractères avant le @ (ex: prenom.nom@gmail.com)';
    return;
  }

  this.checking = true;

  this.api.checkClientEmail(email).subscribe({
    next: (res: any) => {
      this.checking = false;

      if (res.status === 'NOT_FOUND') {
        this.form.patchValue({
          email: email,
          numtel: this.telToCheck.trim()
        });
        this.step = 'new-form';

      } else if (res.status === 'ROLE_CLIENT_ARCHIVED') {
        this.archivedClientId     = res.clientId;
        this.archivedClientNom    = res.nom;
        this.archivedClientPrenom = res.prenom;
        this.archivedClientEmail  = res.email;
        this.step = 'email-archived';

      } else if (res.status === 'ROLE_CLIENT') {
        this.step = 'email-client';

      } else {
        this.step = 'email-other-role';
      }
    },
    error: () => {
      this.checking = false;
      this.toast.error('Erreur lors de la vérification');
    }
  });
}
  

  // Désarchiver le client trouvé (depuis tel-archived ou email-archived)
  desarchiverClientArchive(): void {
    if (!this.archivedClientId) return;
    this.desarchiverLoading = true;
    this.api.desarchiverClient(this.archivedClientId).subscribe({
      next: () => {
        this.toast.success(`${this.archivedClientNom} ${this.archivedClientPrenom} désarchivé avec succès !`);
        this.desarchiverLoading = false;
        this.load();
        this.closeModal();
      },
      error: () => { this.toast.error('Erreur lors du désarchivage'); this.desarchiverLoading = false; }
    });
  }

  // ÉTAPE 3 : créer le client
  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true;
    const v = this.form.value;
    this.api.createClient({
      nom: v.nom!, prenom: v.prenom!, email: v.email!,
      password: v.password!, numtel: v.numtel || ''
    } as any).subscribe({
      next: () => { this.toast.success('Client créé !'); this.load(); this.closeModal(); this.loading = false; },
      error: (e: any) => { this.toast.error(e?.error?.message || 'Erreur'); this.loading = false; }
    });
  }

  // ── Édition ───────────────────────────────────────────────────────────
  openEdit(c: ClientResponse): void {
    this.editing = c;
    this.editForm.patchValue({ nom: c.nom, prenom: c.prenom, email: c.email, password: '', numtel: c.numtel });
    this.showModal = true;
  }

  saveEdit(): void {
    if (this.editForm.invalid || !this.editing) { this.editForm.markAllAsTouched(); return; }
    this.loading = true;
    const v = this.editForm.value;
    this.api.updateClient(this.editing.id, {
      nom: v.nom!, prenom: v.prenom!, email: v.email!, password: v.password || '', numtel: v.numtel!
    }).subscribe({
      next: () => { this.toast.success('Client modifié !'); this.load(); this.closeModal(); this.loading = false; },
      error: () => { this.toast.error('Erreur'); this.loading = false; }
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

        if (hasLinks) {
          this._openLinkedDialog(c, resLiees, fileLiees);
        } else {
          this._showDeleteConfirm(c);
        }
      },
      error: () => this._showDeleteConfirm(c)
    });
  }

  private _showDeleteConfirm(c: ClientResponse): void {
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
    const btnCancelBg = isDark ? 'rgba(255,255,255,.06)' : '#f4f4f8';
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
    this.renderer.setStyle(box, 'animation', 'slideUp .2s cubic-bezier(.34,1.56,.64,1)');

    const close = () => this.renderer.removeChild(document.body, overlay);

    box.innerHTML = `
      <div style="width:52px;height:52px;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);
           border-radius:14px;display:flex;align-items:center;justify-content:center;
           font-size:1.3rem;margin:0 auto 16px;color:#ef4444">
        <i class="fas fa-trash-alt"></i>
      </div>
      <div style="font-size:1rem;font-weight:700;color:${text};margin-bottom:8px;letter-spacing:-0.01em">
        Supprimer ce client ?
      </div>
      <div style="font-size:.82rem;color:${muted};margin-bottom:8px;line-height:1.5">
        <strong style="color:${text}">${c.nom} ${c.prenom}</strong>
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
      this.api.supprimerClient(c.id).subscribe({
        next: () => { this.toast.success('Client supprimé définitivement.'); this.load(); },
        error: () => this.toast.error('Erreur lors de la suppression')
      });
    });
    overlay.addEventListener('click', (ev: Event) => { if (ev.target === overlay) close(); });
  }

  private _openLinkedDialog(c: ClientResponse, reservations: ReservationResponse[], fileAttente: FileAttenteResponse[]): void {
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
    const btnBg = 'linear-gradient(135deg,#6366f1,#4f46e5)';

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

    // ── Entreprises ────────────────────────────────────────────────────
    if (c.entreprises && c.entreprises.length > 0) {
      const noms = c.entreprises.map(e => e.nom).join(', ');
      items.push(`
        <div style="display:flex;align-items:center;gap:12px;
          background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);
          border-radius:12px;padding:12px 14px;text-align:left">
          <div style="width:34px;height:34px;background:rgba(34,197,94,.12);border-radius:10px;
            display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#22c55e;font-size:.9rem">
            <i class="fas fa-building"></i>
          </div>
          <div>
            <div style="color:#22c55e;font-weight:700;font-size:.82rem;margin-bottom:2px">
              ${c.entreprises.length} entreprise${c.entreprises.length > 1 ? 's' : ''} associée${c.entreprises.length > 1 ? 's' : ''}
            </div>
            <div style="color:${muted};font-size:.74rem">${noms}</div>
          </div>
        </div>`);
    }

    // ── Réservations ───────────────────────────────────────────────────
    if (reservations.length > 0) {
      const nbActives   = reservations.filter(r => ['EN_ATTENTE','CONFIRMEE','EN_COURS'].includes(r.statut)).length;
      const nbTerminees = reservations.filter(r => r.statut === 'TERMINEE').length;
      const nbAnnulees  = reservations.filter(r => r.statut === 'ANNULEE').length;
      const details = [
        nbActives   > 0 ? `<span style="color:#f59e0b">${nbActives} active${nbActives > 1 ? 's' : ''}</span>` : '',
        nbTerminees > 0 ? `<span style="color:${sub}">${nbTerminees} terminée${nbTerminees > 1 ? 's' : ''}</span>` : '',
        nbAnnulees  > 0 ? `<span style="color:#ef4444">${nbAnnulees} annulée${nbAnnulees > 1 ? 's' : ''}</span>` : ''
      ].filter(Boolean).join(' · ');
      items.push(`
        <div style="display:flex;align-items:center;gap:12px;
          background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.18);
          border-radius:12px;padding:12px 14px;text-align:left">
          <div style="width:34px;height:34px;background:rgba(239,68,68,.1);border-radius:10px;
            display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#ef4444;font-size:.9rem">
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

    // ── File d'attente ─────────────────────────────────────────────────
    if (fileAttente.length > 0) {
      const nbEnCours  = fileAttente.filter(f => ['EN_ATTENTE','APPELE','EN_COURS'].includes(String(f.statut))).length;
      const nbTermines = fileAttente.filter(f => String(f.statut) === 'TERMINE').length;
      const details = [
        nbEnCours  > 0 ? `<span style="color:#f59e0b">${nbEnCours} en cours</span>` : '',
        nbTermines > 0 ? `<span style="color:${sub}">${nbTermines} terminée${nbTermines > 1 ? 's' : ''}</span>` : ''
      ].filter(Boolean).join(' · ');
      items.push(`
        <div style="display:flex;align-items:center;gap:12px;
          background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.18);
          border-radius:12px;padding:12px 14px;text-align:left">
          <div style="width:34px;height:34px;background:rgba(245,158,11,.1);border-radius:10px;
            display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#f59e0b;font-size:.9rem">
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
        <strong style="color:${text}">${c.nom} ${c.prenom}</strong> est encore lié aux éléments suivants :
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;text-align:left">
        ${items.join('')}
      </div>
      <div style="font-size:.74rem;color:${sub};background:${hintBg};
           border-radius:10px;padding:10px 12px;border:1px solid ${hintBorder};
           margin-bottom:18px;text-align:left;line-height:1.6">
        <i class="fas fa-lightbulb" style="color:#6366f1;margin-right:5px"></i>
        Supprimez ou dissociez ces éléments, puis réessayez.<br>
        <span>Ou <strong style="color:${muted}">archivez</strong> le client pour le désactiver sans perdre les données.</span>
      </div>
      <button id="linked-ok"
        style="background:${btnBg};color:#fff;border:none;
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


  // ── Remplace archiver() par cette version corrigée ──────────────────────
archiver(c: ClientResponse): void {
  forkJoin({
    reservations: this.api.getReservations(),
    fileAttente:  this.api.getFileAttente()
  }).subscribe({
    next: ({ reservations, fileAttente }) => {
      const resActives  = reservations.filter(r =>
        r.clientId === c.id && ['EN_ATTENTE', 'CONFIRMEE', 'EN_COURS'].includes(r.statut)
      );
      const fileActives = fileAttente.filter(f =>
        f.clientId === c.id && ['EN_ATTENTE', 'APPELE', 'EN_COURS'].includes(String(f.statut))
      );

      const hasActive = resActives.length > 0 || fileActives.length > 0;

      let message = `Archiver "${c.nom} ${c.prenom}" ?`;
      if (hasActive) {
        const parts: string[] = [];
        if (resActives.length > 0)
          parts.push(`${resActives.length} réservation(s) active(s)`);
        if (fileActives.length > 0)
          parts.push(`${fileActives.length} entrée(s) en file d'attente`);
        message = `Archiver "${c.nom} ${c.prenom}" ?\n\n⚠️ Attention : ${parts.join(' et ')} seront annulées.`;
      }

      if (!confirm(message)) return;

      this.api.archiverClient(c.id).subscribe({
        next: () => { this.toast.success('Client archivé'); this.load(); },
        error: () => this.toast.error('Erreur lors de l\'archivage')
      });
    },
    error: () => {
      // fallback si l'API échoue : on archive quand même après confirmation simple
      if (!confirm(`Archiver "${c.nom} ${c.prenom}" ?`)) return;
      this.api.archiverClient(c.id).subscribe({
        next: () => { this.toast.success('Client archivé'); this.load(); },
        error: () => this.toast.error('Erreur lors de l\'archivage')
      });
    }
  });
}

// ── SUPPRIME complètement archiverClient() ── (efface ces lignes)

  desarchiver(c: ClientResponse): void {
    this.api.desarchiverClient(c.id).subscribe({
      next: () => { this.toast.success('Client désarchivé'); this.load(); },
      error: () => this.toast.error('Erreur')
    });
  }

  

}