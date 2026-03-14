import { Component, OnInit, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { ClientResponse, EntrepriseResponse } from '../../../core/models/api.models';

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
  private api   = inject(ApiService);
  private toast = inject(ToastService);
  private fb    = inject(FormBuilder);

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
  }
}