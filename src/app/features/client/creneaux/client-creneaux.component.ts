import { Component, OnInit, inject, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { ServiceResponse, ConfigServiceResponse, ClientResponse, EntrepriseResponse } from '../../../core/models/api.models';
import { forkJoin } from 'rxjs';

type Step = 'service' | 'creneau' | 'details' | 'confirm';

@Component({
  selector: 'app-client-creneaux',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
<div style="max-width:720px;margin:0 auto;padding-bottom:40px">

  <!-- HEADER -->
  <div style="margin-bottom:28px">
    <div style="display:flex;align-items:center;gap:14px">
      <div style="width:46px;height:46px;border-radius:14px;background:linear-gradient(135deg,#10b981,#3b82f6);display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.1rem;box-shadow:0 4px 16px rgba(16,185,129,.3)">
        <i class="fas fa-calendar-plus"></i>
      </div>
      <div>
        <div style="font-size:1.3rem;font-weight:800;color:#111">Prendre un rendez-vous</div>
        <div style="font-size:.8rem;color:#888;margin-top:2px">Choisissez votre service, le créneau et confirmez</div>
      </div>
    </div>
  </div>

  <!-- STEPPER -->
  <div style="display:flex;align-items:center;margin-bottom:32px">
    <ng-container *ngFor="let s of STEPS; let i = index">
      <div style="display:flex;flex-direction:column;align-items:center;gap:5px">
        <div style="width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.78rem;font-weight:700;transition:all .2s"
          [style.background]="stepIndex > i ? '#10b981' : stepIndex === i ? '#3b82f6' : '#e5e7eb'"
          [style.color]="stepIndex >= i ? '#fff' : '#9ca3af'"
          [style.border]="stepIndex === i ? '2px solid #3b82f6' : 'none'">
          <i class="fas fa-check" *ngIf="stepIndex > i"></i>
          <span *ngIf="stepIndex <= i">{{ i+1 }}</span>
        </div>
        <span style="font-size:.68rem;font-weight:600;white-space:nowrap"
          [style.color]="stepIndex === i ? '#3b82f6' : stepIndex > i ? '#10b981' : '#9ca3af'">
          {{ s }}
        </span>
      </div>
      <div *ngIf="i < STEPS.length-1" style="flex:1;height:2px;margin:0 8px;margin-bottom:18px;transition:background .3s"
        [style.background]="stepIndex > i ? '#10b981' : '#e5e7eb'"></div>
    </ng-container>
  </div>

  <!-- ══ STEP 1 : CHOISIR SERVICE ══ -->
  <div *ngIf="step === 'service'">
    <div style="font-size:.85rem;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.05em;margin-bottom:14px">
      <i class="fas fa-concierge-bell" style="color:#3b82f6;margin-right:6px"></i> Sélectionnez un service
    </div>

    <!-- Filtre entreprise -->
    <div *ngIf="entreprises.length > 1" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
      <button (click)="filtreEntrepriseId=null;filterServices()"
        style="padding:6px 14px;border-radius:20px;border:1.5px solid;font-size:.8rem;font-weight:600;cursor:pointer"
        [style.background]="filtreEntrepriseId===null ? '#3b82f6' : '#fff'"
        [style.color]="filtreEntrepriseId===null ? '#fff' : '#555'"
        [style.borderColor]="filtreEntrepriseId===null ? '#3b82f6' : '#e5e7eb'">
        Toutes
      </button>
      <button *ngFor="let e of entreprises" (click)="filtreEntrepriseId=e.id;filterServices()"
        style="padding:6px 14px;border-radius:20px;border:1.5px solid;font-size:.8rem;font-weight:600;cursor:pointer"
        [style.background]="filtreEntrepriseId===e.id ? '#3b82f6' : '#fff'"
        [style.color]="filtreEntrepriseId===e.id ? '#fff' : '#555'"
        [style.borderColor]="filtreEntrepriseId===e.id ? '#3b82f6' : '#e5e7eb'">
        {{ e.nom }}
      </button>
    </div>

    <div *ngIf="loadingData" style="text-align:center;padding:40px;color:#888">
      <i class="fas fa-spinner fa-spin"></i> Chargement...
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px">
      <div *ngFor="let s of filteredServices"
        (click)="selectService(s)"
        style="background:#fff;border:1.5px solid #e5e7eb;border-radius:14px;padding:16px;cursor:pointer;transition:all .18s"
        onmouseenter="this.style.borderColor='#3b82f6';this.style.boxShadow='0 4px 16px rgba(59,130,246,.1)'"
        onmouseleave="this.style.borderColor='#e5e7eb';this.style.boxShadow='none'">
        <div style="width:40px;height:40px;border-radius:10px;background:rgba(99,102,241,.1);color:#6366f1;display:flex;align-items:center;justify-content:center;font-size:.95rem;margin-bottom:10px">
          <i class="fas fa-concierge-bell"></i>
        </div>
        <div style="font-weight:700;font-size:.9rem;color:#111;margin-bottom:4px">{{ s.nom }}</div>
        <div style="font-size:.75rem;color:#888" *ngIf="s.description">{{ s.description }}</div>
        <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
          <span *ngIf="configMap.get(s.id)?.dureeMinutes" style="font-size:.7rem;background:#f3f4f6;color:#555;padding:2px 8px;border-radius:10px;display:flex;align-items:center;gap:3px">
            <i class="fas fa-clock"></i> {{ configMap.get(s.id)?.dureeMinutes }} min
          </span>
        </div>
      </div>
    </div>

    <div *ngIf="!loadingData && filteredServices.length === 0" style="text-align:center;padding:60px;color:#aaa">
      <i class="fas fa-concierge-bell" style="font-size:2rem;opacity:.2;display:block;margin-bottom:10px"></i>
      <p style="font-size:.9rem">Aucun service disponible</p>
    </div>
  </div>

  <!-- ══ STEP 2 : CHOISIR CRÉNEAU ══ -->
  <div *ngIf="step === 'creneau'">
    <!-- Info service sélectionné -->
    <div style="background:#eff6ff;border:1.5px solid rgba(59,130,246,.2);border-radius:12px;padding:12px 16px;margin-bottom:20px;display:flex;align-items:center;gap:10px">
      <div style="width:36px;height:36px;border-radius:9px;background:#3b82f6;color:#fff;display:flex;align-items:center;justify-content:center;font-size:.85rem;flex-shrink:0">
        <i class="fas fa-concierge-bell"></i>
      </div>
      <div style="flex:1">
        <div style="font-weight:700;font-size:.9rem;color:#1d4ed8">{{ selectedService?.nom }}</div>
        <div style="font-size:.75rem;color:#3b82f6" *ngIf="selectedConfig?.dureeMinutes">
          <i class="fas fa-clock"></i> {{ selectedConfig?.dureeMinutes }} min
        </div>
      </div>
      <button (click)="step='service'" style="font-size:.75rem;color:#3b82f6;background:none;border:none;cursor:pointer">
        <i class="fas fa-pen"></i> Changer
      </button>
    </div>

    <!-- Picker date -->
    <div style="margin-bottom:20px">
      <label style="font-size:.8rem;font-weight:700;color:#555;display:block;margin-bottom:8px">
        <i class="fas fa-calendar" style="color:#3b82f6;margin-right:6px"></i> Choisissez une date
      </label>
      <div style="display:flex;align-items:center;gap:10px">
        <input type="date" [(ngModel)]="selectedDate" [min]="minDate"
          style="flex:1;padding:10px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:.9rem;color:#111;outline:none"
          (change)="loadCreneaux()">
        <button (click)="loadCreneaux()" [disabled]="!selectedDate || loadingCreneaux"
          style="padding:10px 18px;border-radius:10px;border:none;background:#3b82f6;color:#fff;font-size:.85rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px"
          [style.opacity]="!selectedDate ? '0.5' : '1'">
          <i class="fas fa-spinner fa-spin" *ngIf="loadingCreneaux"></i>
          <i class="fas fa-search" *ngIf="!loadingCreneaux"></i>
          Rechercher
        </button>
      </div>
    </div>

    <!-- Créneaux -->
    <div *ngIf="loadingCreneaux" style="text-align:center;padding:40px;color:#888">
      <i class="fas fa-spinner fa-spin"></i> Chargement des créneaux...
    </div>

    <div *ngIf="searched && !loadingCreneaux">
      <div style="font-size:.8rem;font-weight:700;color:#555;margin-bottom:10px">
        {{ creneaux.length > 0 ? creneaux.length + ' créneau(x) disponible(s)' : 'Aucun créneau disponible' }}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px" *ngIf="creneaux.length > 0">
        <button *ngFor="let c of creneaux" (click)="selectCreneau(c)"
          style="padding:12px 8px;border-radius:10px;border:1.5px solid;font-size:.85rem;font-weight:600;cursor:pointer;text-align:center;transition:all .15s"
          [style.background]="selectedCreneau?.heureDebut===c.heureDebut ? '#3b82f6' : '#fff'"
          [style.color]="selectedCreneau?.heureDebut===c.heureDebut ? '#fff' : '#333'"
          [style.borderColor]="selectedCreneau?.heureDebut===c.heureDebut ? '#3b82f6' : '#e5e7eb'">
          <div>{{ c.heureDebut | slice:11:16 }}</div>
          <div style="font-size:.72rem;opacity:.8;margin-top:2px">{{ c.heureFin | slice:11:16 }}</div>
        </button>
      </div>
      <div *ngIf="creneaux.length === 0" style="text-align:center;padding:40px;color:#aaa">
        <i class="fas fa-calendar-times" style="font-size:2rem;opacity:.2;display:block;margin-bottom:10px"></i>
        <p style="font-size:.875rem">Aucun créneau ce jour. Essayez une autre date.</p>
      </div>
    </div>

    <div style="display:flex;justify-content:space-between;margin-top:20px">
      <button (click)="step='service'" style="padding:9px 20px;border-radius:10px;border:1.5px solid #e5e7eb;background:#fff;color:#555;font-size:.85rem;font-weight:600;cursor:pointer">
        <i class="fas fa-arrow-left"></i> Retour
      </button>
      <button (click)="goToDetails()" [disabled]="!selectedCreneau"
        style="padding:9px 20px;border-radius:10px;border:none;background:#3b82f6;color:#fff;font-size:.85rem;font-weight:700;cursor:pointer"
        [style.opacity]="!selectedCreneau ? '0.5' : '1'">
        Suivant <i class="fas fa-arrow-right"></i>
      </button>
    </div>
  </div>

  <!-- ══ STEP 3 : DÉTAILS ══ -->
  <div *ngIf="step === 'details'">
    <div style="background:#fff;border:1.5px solid #e5e7eb;border-radius:14px;padding:16px;margin-bottom:20px">
      <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af;margin-bottom:10px">Récapitulatif</div>
      <div style="display:flex;gap:20px;flex-wrap:wrap">
        <div>
          <div style="font-size:.72rem;color:#9ca3af">Service</div>
          <div style="font-weight:700;color:#111;margin-top:2px">{{ selectedService?.nom }}</div>
        </div>
        <div>
          <div style="font-size:.72rem;color:#9ca3af">Date & heure</div>
          <div style="font-weight:700;color:#111;margin-top:2px">{{ selectedDate | date:'dd/MM/yyyy' }} à {{ selectedCreneau?.heureDebut | slice:11:16 }}</div>
        </div>
      </div>
    </div>

    <!-- Nombre de personnes (si RESSOURCE_PARTAGEE) -->
    <div *ngIf="selectedConfig?.typeService === 'RESSOURCE_PARTAGEE'" style="margin-bottom:16px">
      <label style="font-size:.8rem;font-weight:700;color:#555;display:block;margin-bottom:8px">
        <i class="fas fa-users" style="color:#3b82f6;margin-right:6px"></i>
        Nombre de personnes
        <span *ngIf="selectedConfig?.capaciteMinPersonnes || selectedConfig?.capaciteMaxPersonnes" style="font-weight:400;color:#888">
          ({{ selectedConfig?.capaciteMinPersonnes }}–{{ selectedConfig?.capaciteMaxPersonnes }})
        </span>
      </label>
      <input type="number" [(ngModel)]="nombrePersonnes" [min]="selectedConfig?.capaciteMinPersonnes ?? 1" [max]="selectedConfig?.capaciteMaxPersonnes ?? 99"
        style="width:100%;padding:10px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:.9rem;color:#111;outline:none;box-sizing:border-box">
    </div>

    <!-- Notes -->
    <div style="margin-bottom:16px">
      <label style="font-size:.8rem;font-weight:700;color:#555;display:block;margin-bottom:8px">
        <i class="fas fa-sticky-note" style="color:#3b82f6;margin-right:6px"></i> Notes
        <span style="font-weight:400;color:#888">(optionnel)</span>
      </label>
      <textarea [(ngModel)]="notes" rows="3" placeholder="Précisions, demandes particulières..."
        style="width:100%;padding:10px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:.875rem;color:#111;outline:none;resize:vertical;box-sizing:border-box"></textarea>
    </div>

    <div style="display:flex;justify-content:space-between">
      <button (click)="step='creneau'" style="padding:9px 20px;border-radius:10px;border:1.5px solid #e5e7eb;background:#fff;color:#555;font-size:.85rem;font-weight:600;cursor:pointer">
        <i class="fas fa-arrow-left"></i> Retour
      </button>
      <button (click)="step='confirm'"
        style="padding:9px 20px;border-radius:10px;border:none;background:#3b82f6;color:#fff;font-size:.85rem;font-weight:700;cursor:pointer">
        Confirmer <i class="fas fa-arrow-right"></i>
      </button>
    </div>
  </div>

  <!-- ══ STEP 4 : CONFIRMATION ══ -->
  <div *ngIf="step === 'confirm'">
    <div style="background:#fff;border:2px solid #3b82f6;border-radius:16px;padding:24px;margin-bottom:24px">
      <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#3b82f6;margin-bottom:16px;display:flex;align-items:center;gap:6px">
        <i class="fas fa-check-circle"></i> Récapitulatif de votre réservation
      </div>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;justify-content:space-between;padding-bottom:10px;border-bottom:1px solid #f3f4f6">
          <span style="font-size:.82rem;color:#888">Service</span>
          <span style="font-size:.9rem;font-weight:700;color:#111">{{ selectedService?.nom }}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding-bottom:10px;border-bottom:1px solid #f3f4f6">
          <span style="font-size:.82rem;color:#888">Date</span>
          <span style="font-size:.9rem;font-weight:700;color:#111">{{ selectedDate | date:'EEEE d MMMM yyyy':'':'fr' }}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding-bottom:10px;border-bottom:1px solid #f3f4f6">
          <span style="font-size:.82rem;color:#888">Heure</span>
          <span style="font-size:.9rem;font-weight:700;color:#111">{{ selectedCreneau?.heureDebut | slice:11:16 }} → {{ selectedCreneau?.heureFin | slice:11:16 }}</span>
        </div>
        <div *ngIf="selectedConfig?.typeService === 'RESSOURCE_PARTAGEE'" style="display:flex;justify-content:space-between;padding-bottom:10px;border-bottom:1px solid #f3f4f6">
          <span style="font-size:.82rem;color:#888">Personnes</span>
          <span style="font-size:.9rem;font-weight:700;color:#111">{{ nombrePersonnes }}</span>
        </div>
        <div *ngIf="notes" style="display:flex;justify-content:space-between">
          <span style="font-size:.82rem;color:#888">Notes</span>
          <span style="font-size:.85rem;color:#555;font-style:italic;max-width:60%;text-align:right">{{ notes }}</span>
        </div>
      </div>
    </div>

    <div style="display:flex;justify-content:space-between">
      <button (click)="step='details'" style="padding:9px 20px;border-radius:10px;border:1.5px solid #e5e7eb;background:#fff;color:#555;font-size:.85rem;font-weight:600;cursor:pointer">
        <i class="fas fa-arrow-left"></i> Retour
      </button>
      <button (click)="confirmerReservation()" [disabled]="saving"
        style="display:flex;align-items:center;gap:8px;padding:11px 28px;border-radius:10px;border:none;background:linear-gradient(135deg,#10b981,#3b82f6);color:#fff;font-size:.9rem;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(16,185,129,.3)">
        <i class="fas fa-spinner fa-spin" *ngIf="saving"></i>
        <i class="fas fa-calendar-check" *ngIf="!saving"></i>
        {{ saving ? 'Réservation en cours...' : 'Confirmer la réservation' }}
      </button>
    </div>
  </div>

</div>`
})
export class ClientCreneauxComponent implements OnInit {
  private api      = inject(ApiService);
  private auth     = inject(AuthService);
  private toast    = inject(ToastService);
  private renderer = inject(Renderer2);

  readonly STEPS = ['Service', 'Créneau', 'Détails', 'Confirmation'];

  step: Step = 'service';
  get stepIndex(): number { return ['service','creneau','details','confirm'].indexOf(this.step); }

  services:         ServiceResponse[]    = [];
  filteredServices: ServiceResponse[]    = [];
  entreprises:      EntrepriseResponse[] = [];
  configMap = new Map<number, ConfigServiceResponse>();

  filtreEntrepriseId: number | null = null;
  loadingData   = false;
  loadingCreneaux = false;
  saving        = false;
  searched      = false;

  selectedService: ServiceResponse | null       = null;
  selectedConfig:  ConfigServiceResponse | null  = null;
  selectedDate     = '';
  selectedCreneau: { heureDebut: string; heureFin: string } | null = null;
  creneaux: { heureDebut: string; heureFin: string }[] = [];

  nombrePersonnes = 1;
  notes           = '';
  myClientId: number | null = null;

  get minDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  ngOnInit(): void { this.loadData(); }

  loadData(): void {
    this.loadingData = true;
    forkJoin({
      services:    this.api.getServices(),
      entreprises: this.api.getEntreprises(),
      me:          this.api.getClientMe()
    }).subscribe({
      next: d => {
        this.services    = d.services;
        this.entreprises = d.entreprises;
        this.myClientId  = d.me.id;
        this.filteredServices = d.services;
        // Load configs
        d.services.forEach(s =>
          this.api.getConfigService(s.id).subscribe({ next: c => this.configMap.set(s.id, c), error: () => {} })
        );
        this.loadingData = false;
      },
      error: () => { this.toast.error('Erreur chargement'); this.loadingData = false; }
    });
  }

  filterServices(): void {
    this.filteredServices = this.filtreEntrepriseId
      ? this.services.filter(s => s.entrepriseId === this.filtreEntrepriseId)
      : this.services;
  }

  selectService(s: ServiceResponse): void {
    this.selectedService  = s;
    this.selectedConfig   = this.configMap.get(s.id) ?? null;
    this.selectedCreneau  = null;
    this.selectedDate     = '';
    this.creneaux         = [];
    this.searched         = false;
    this.step = 'creneau';
  }

  loadCreneaux(): void {
    if (!this.selectedDate || !this.selectedService) return;
    this.loadingCreneaux = true;
    this.searched = false;
    this.selectedCreneau = null;
    this.api.getCreneaux(this.selectedService.id, this.selectedDate).subscribe({
      next: d => { this.creneaux = d; this.searched = true; this.loadingCreneaux = false; },
      error: () => { this.toast.error('Erreur'); this.loadingCreneaux = false; }
    });
  }

  selectCreneau(c: { heureDebut: string; heureFin: string }): void {
    this.selectedCreneau = this.selectedCreneau?.heureDebut === c.heureDebut ? null : c;
  }

  goToDetails(): void {
    if (!this.selectedCreneau) return;
    this.nombrePersonnes = this.selectedConfig?.capaciteMinPersonnes ?? 1;
    this.notes = '';
    this.step = 'details';
  }

  confirmerReservation(): void {
    if (!this.myClientId || !this.selectedService || !this.selectedCreneau) return;
    this.saving = true;
    const body: any = {
      clientId:        this.myClientId,
      serviceId:       this.selectedService.id,
      heureDebut:      this.selectedCreneau.heureDebut,
      nombrePersonnes: this.nombrePersonnes,
      notes:           this.notes || null
    };
    this.api.createReservation(body).subscribe({
      next: () => {
        this.saving = false;
        this._showSuccess();
      },
      error: (e: any) => {
        this.saving = false;
        const msg = e?.error?.message || e?.error || 'Erreur lors de la réservation';
        this._showError(msg);
      }
    });
  }

  private _showSuccess(): void {
    const overlay = this.renderer.createElement('div');
    this.renderer.setStyle(overlay, 'position', 'fixed'); this.renderer.setStyle(overlay, 'inset', '0');
    this.renderer.setStyle(overlay, 'background', 'rgba(0,0,0,.65)'); this.renderer.setStyle(overlay, 'z-index', '99999');
    this.renderer.setStyle(overlay, 'display', 'flex'); this.renderer.setStyle(overlay, 'align-items', 'center'); this.renderer.setStyle(overlay, 'justify-content', 'center');
    const box = this.renderer.createElement('div');
    this.renderer.setStyle(box, 'background', '#fff'); this.renderer.setStyle(box, 'border-radius', '20px');
    this.renderer.setStyle(box, 'padding', '40px 32px'); this.renderer.setStyle(box, 'text-align', 'center');
    this.renderer.setStyle(box, 'max-width', '380px'); this.renderer.setStyle(box, 'width', '92%');
    this.renderer.setStyle(box, 'box-shadow', '0 32px 80px rgba(0,0,0,.25)');
    const svc = this.selectedService?.nom ?? '';
    const date = new Date(this.selectedCreneau?.heureDebut ?? '').toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long'});
    const heure = this.selectedCreneau?.heureDebut?.slice(11, 16) ?? '';
    box.innerHTML = `
      <div style="width:64px;height:64px;background:linear-gradient(135deg,#10b981,#3b82f6);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:1.6rem">✅</div>
      <div style="font-size:1.2rem;font-weight:800;color:#111;margin-bottom:8px">Réservation confirmée !</div>
      <div style="font-size:.9rem;font-weight:600;color:#333;margin-bottom:4px">${svc}</div>
      <div style="font-size:.82rem;color:#888;margin-bottom:28px">${date} à ${heure}</div>
      <button id="ok-btn" style="width:100%;padding:12px;border-radius:10px;border:none;background:linear-gradient(135deg,#10b981,#3b82f6);color:#fff;font-size:.9rem;font-weight:700;cursor:pointer">
        Voir mes réservations
      </button>`;
    this.renderer.appendChild(overlay, box); this.renderer.appendChild(document.body, overlay);
    box.querySelector('#ok-btn')!.addEventListener('click', () => {
      this.renderer.removeChild(document.body, overlay);
      // Reset form
      this.step = 'service';
      this.selectedService = null; this.selectedCreneau = null; this.selectedDate = '';
    });
  }

  private _showError(msg: string): void {
    const overlay = this.renderer.createElement('div');
    this.renderer.setStyle(overlay, 'position', 'fixed'); this.renderer.setStyle(overlay, 'inset', '0');
    this.renderer.setStyle(overlay, 'background', 'rgba(0,0,0,.65)'); this.renderer.setStyle(overlay, 'z-index', '99999');
    this.renderer.setStyle(overlay, 'display', 'flex'); this.renderer.setStyle(overlay, 'align-items', 'center'); this.renderer.setStyle(overlay, 'justify-content', 'center');
    const box = this.renderer.createElement('div');
    this.renderer.setStyle(box, 'background', '#fff'); this.renderer.setStyle(box, 'border-radius', '20px');
    this.renderer.setStyle(box, 'padding', '32px 28px'); this.renderer.setStyle(box, 'text-align', 'center');
    this.renderer.setStyle(box, 'max-width', '360px'); this.renderer.setStyle(box, 'width', '92%');
    this.renderer.setStyle(box, 'box-shadow', '0 24px 64px rgba(0,0,0,.2)');
    const close = () => this.renderer.removeChild(document.body, overlay);
    box.innerHTML = `
      <div style="font-size:2rem;margin-bottom:12px">❌</div>
      <div style="font-size:1rem;font-weight:700;color:#111;margin-bottom:10px">Réservation impossible</div>
      <div style="font-size:.875rem;color:#666;margin-bottom:24px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px">${msg}</div>
      <button id="e-ok" style="padding:10px 32px;border-radius:10px;border:none;background:#111;color:#fff;font-size:.875rem;font-weight:700;cursor:pointer">OK</button>`;
    this.renderer.appendChild(overlay, box); this.renderer.appendChild(document.body, overlay);
    box.querySelector('#e-ok')!.addEventListener('click', close);
    overlay.addEventListener('click', (e: Event) => { if (e.target === overlay) close(); });
  }
}