import { Component, OnInit, inject, HostListener, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { ClientResponse, EntrepriseResponse, ReservationResponse, FileAttenteResponse } from '../../../core/models/api.models';
import { forkJoin } from 'rxjs';

// Flux création : tel → email → new-form
// tel-taken        : numéro actif d'un autre client
// tel-archived     : numéro appartient à un client archivé → proposer désarchivage
// email-client     : email déjà pris par un client actif
// email-archived   : email appartient à un client archivé → proposer désarchivage
// email-other-role : email déjà pris par un autre rôle
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

  // Modale détail client
  selectedClient: ClientResponse | null = null;

  // Association depuis la modale détail
  assocDropOpen      = false;
  assocSearch        = '';
  assocSelectedEnt:  EntrepriseResponse | null = null;
  filteredAssocEnts: EntrepriseResponse[] = [];
  assocLoading       = false;

  // Flux création
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
    if (!this.telToCheck.trim()) return;
    this.checking = true;
    this.api.getClientByTelephone(this.telToCheck.trim()).subscribe({
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
        if (res.status === 'NOT_FOUND') {
          this.form.patchValue({ email: this.emailToCheck.trim(), numtel: this.telToCheck.trim() });
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
      error: () => { this.checking = false; this.toast.error('Erreur lors de la vérification'); }
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
      <div style="font-size:1.05rem;font-weight:700;color:#fff;margin-bottom:8px">Supprimer ce client ?</div>
      <div style="font-size:.875rem;color:#94a3b8;margin-bottom:14px;line-height:1.5">
        <strong style="color:#fff">${c.nom} ${c.prenom}</strong>
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
      this.api.supprimerClient(c.id).subscribe({
        next: () => { this.toast.success('Client supprimé définitivement.'); this.load(); },
        error: () => this.toast.error('Erreur lors de la suppression')
      });
    });
    overlay.addEventListener('click', (ev: Event) => { if (ev.target === overlay) close(); });
  }

  private _openLinkedDialog(c: ClientResponse, reservations: ReservationResponse[], fileAttente: FileAttenteResponse[]): void {
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

    // ── Entreprises ───────────────────────────────────────────────────
    if (c.entreprises && c.entreprises.length > 0) {
      const noms = c.entreprises.map(e => e.nom).join(', ');
      items.push(`
        <div style="display:flex;align-items:center;gap:12px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.25);border-radius:10px;padding:12px 16px;text-align:left">
          <span style="font-size:1.5rem;flex-shrink:0">🏢</span>
          <div>
            <div style="color:#6ee7b7;font-weight:700;font-size:.88rem;margin-bottom:3px">
              ${c.entreprises.length} entreprise${c.entreprises.length > 1 ? 's' : ''} associée${c.entreprises.length > 1 ? 's' : ''}
            </div>
            <div style="color:#94a3b8;font-size:.78rem">${noms}</div>
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
        <strong style="color:#f1f5f9">${c.nom} ${c.prenom}</strong> est encore lié aux éléments suivants :
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:18px">${items.join('')}</div>
      <div style="font-size:.76rem;color:#64748b;margin-bottom:20px;line-height:1.5;background:rgba(255,255,255,.03);
           border-radius:8px;padding:10px;border:1px solid rgba(255,255,255,.06)">
        💡 Supprimez ou dissociez ces éléments, puis réessayez.<br>
        <span style="color:#475569">Ou <strong style="color:#94a3b8">archivez</strong> le client pour le désactiver sans perdre les données.</span>
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

  archiver(c: ClientResponse): void {
    if (!confirm(`Archiver "${c.nom} ${c.prenom}" ?`)) return;
    this.api.archiverClient(c.id).subscribe({
      next: () => { this.toast.success('Client archivé'); this.load(); },
      error: () => this.toast.error('Erreur')
    });
  }

  desarchiver(c: ClientResponse): void {
    this.api.desarchiverClient(c.id).subscribe({
      next: () => { this.toast.success('Client désarchivé'); this.load(); },
      error: () => this.toast.error('Erreur')
    });
  }}