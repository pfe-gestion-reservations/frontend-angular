import { Component, OnInit, inject, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ReservationResponse } from '../../../core/models/api.models';

@Component({
  selector: 'app-client-reservations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div style="max-width:860px;margin:0 auto;padding-bottom:40px">

  <!-- HEADER -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:28px">
    <div style="display:flex;align-items:center;gap:14px">
      <div style="width:46px;height:46px;border-radius:14px;background:linear-gradient(135deg,#3b82f6,#6366f1);display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.1rem;box-shadow:0 4px 16px rgba(99,102,241,.3)">
        <i class="fas fa-calendar-check"></i>
      </div>
      <div>
        <div style="font-size:1.3rem;font-weight:800;color:#111">Mes Réservations</div>
        <div style="font-size:.8rem;color:#888;margin-top:2px">{{ reservations.length }} réservation(s) au total</div>
      </div>
    </div>
    <button (click)="load()" style="width:38px;height:38px;border-radius:10px;border:1.5px solid #e5e7eb;background:#fff;color:#888;cursor:pointer;display:flex;align-items:center;justify-content:center">
      <i class="fas fa-sync" [class.fa-spin]="loading"></i>
    </button>
  </div>

  <!-- STATS -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px">
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:18px 16px;position:relative;overflow:hidden">
      <div style="font-size:1.8rem;font-weight:800;color:#111;line-height:1">{{ totalActives }}</div>
      <div style="font-size:.72rem;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-top:4px">Actives</div>
      <div style="position:absolute;bottom:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#3b82f6,#6366f1)"></div>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:18px 16px;position:relative;overflow:hidden">
      <div style="font-size:1.8rem;font-weight:800;color:#111;line-height:1">{{ totalTerminees }}</div>
      <div style="font-size:.72rem;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-top:4px">Terminées</div>
      <div style="position:absolute;bottom:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#10b981,#34d399)"></div>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:18px 16px;position:relative;overflow:hidden">
      <div style="font-size:1.8rem;font-weight:800;color:#111;line-height:1">{{ totalAnnulees }}</div>
      <div style="font-size:.72rem;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-top:4px">Annulées</div>
      <div style="position:absolute;bottom:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#ef4444,#f87171)"></div>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:18px 16px;position:relative;overflow:hidden">
      <div style="font-size:1.8rem;font-weight:800;color:#059669;line-height:1">{{ prixTotal | number:'1.0-0' }}<span style="font-size:1rem;font-weight:600;margin-left:2px">DT</span></div>
      <div style="font-size:.72rem;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-top:4px">Total dépensé</div>
      <div style="position:absolute;bottom:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#f59e0b,#fbbf24)"></div>
    </div>
  </div>

  <!-- FILTRES -->
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px">
    <button (click)="filtreStatut='';applyFilter()"
      [style.background]="filtreStatut==='' ? '#3b82f6' : '#fff'"
      [style.color]="filtreStatut==='' ? '#fff' : '#555'"
      [style.borderColor]="filtreStatut==='' ? '#3b82f6' : '#e5e7eb'"
      style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:20px;border:1.5px solid;font-size:.8rem;font-weight:600;cursor:pointer;transition:all .15s">
      Toutes <span style="font-size:.7rem;padding:1px 6px;border-radius:10px;background:rgba(255,255,255,.25)">{{ reservations.length }}</span>
    </button>
    <button *ngFor="let s of STATUTS" (click)="filtreStatut=s;applyFilter()"
      [style.background]="filtreStatut===s ? statutCfg(s).bg : '#fff'"
      [style.color]="filtreStatut===s ? '#fff' : statutCfg(s).color"
      [style.borderColor]="filtreStatut===s ? statutCfg(s).bg : '#e5e7eb'"
      style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:20px;border:1.5px solid;font-size:.8rem;font-weight:600;cursor:pointer;transition:all .15s">
      <i [class]="statutCfg(s).icon" style="font-size:.72rem"></i>
      {{ statutCfg(s).label }}
    </button>
  </div>

  <!-- LOADING -->
  <div *ngIf="loading" style="text-align:center;padding:60px;color:#888">
    <i class="fas fa-spinner fa-spin" style="margin-right:8px"></i> Chargement...
  </div>

  <!-- LISTE -->
  <div *ngIf="!loading" style="display:flex;flex-direction:column;gap:12px">

    <div *ngIf="filtered.length === 0" style="text-align:center;padding:60px;color:#aaa">
      <i class="fas fa-calendar-times" style="font-size:2.5rem;opacity:.2;display:block;margin-bottom:12px"></i>
      <p style="font-size:.9rem">Aucune réservation{{ filtreStatut ? ' dans cette catégorie' : '' }}</p>
    </div>

    <div *ngFor="let r of filtered"
      (click)="selectedDetail=r"
      style="display:flex;background:#fff;border:1.5px solid #e5e7eb;border-radius:16px;overflow:hidden;cursor:pointer;transition:box-shadow .2s,transform .15s"
      onmouseenter="this.style.boxShadow='0 4px 20px rgba(0,0,0,.08)';this.style.transform='translateY(-1px)'"
      onmouseleave="this.style.boxShadow='none';this.style.transform='none'"
      [style.opacity]="r.statut==='ANNULEE'?'0.65':r.statut==='TERMINEE'?'0.85':'1'">

      <!-- Barre colorée gauche -->
      <div style="width:4px;flex-shrink:0" [style.background]="statutCfg(r.statut).gradient"></div>

      <!-- Contenu -->
      <div style="flex:1;padding:16px 18px">

        <!-- Top : service + badge -->
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:38px;height:38px;border-radius:10px;background:rgba(99,102,241,.1);color:#6366f1;display:flex;align-items:center;justify-content:center;font-size:.9rem;flex-shrink:0">
              <i class="fas fa-concierge-bell"></i>
            </div>
            <div>
              <div style="font-weight:700;font-size:.95rem;color:#111">{{ r.serviceNom }}</div>
              <div *ngIf="r.ressourceNom" style="font-size:.75rem;color:#888;margin-top:2px;display:flex;align-items:center;gap:4px">
                <i class="fas fa-layer-group"></i> {{ r.ressourceNom }}
              </div>
            </div>
          </div>
          <span style="display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:20px;font-size:.72rem;font-weight:700;text-transform:uppercase;white-space:nowrap;flex-shrink:0"
            [style.background]="statutCfg(r.statut).bgLight"
            [style.color]="statutCfg(r.statut).color"
            [style.border]="'1px solid ' + statutCfg(r.statut).border">
            <i [class]="statutCfg(r.statut).icon"></i>
            {{ statutCfg(r.statut).label }}
          </span>
        </div>

        <!-- Milieu : infos -->
        <div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:12px">
          <div style="display:flex;align-items:flex-start;gap:8px">
            <i class="fas fa-calendar-alt" style="color:#9ca3af;font-size:.78rem;margin-top:3px"></i>
            <div>
              <div style="font-size:.875rem;font-weight:600;color:#111">{{ r.heureDebut | date:'dd/MM/yyyy' }}</div>
              <div style="font-size:.72rem;color:#888;margin-top:1px">{{ r.heureDebut | date:'HH:mm' }} — {{ r.heureFin | date:'HH:mm' }}</div>
            </div>
          </div>
          <div *ngIf="r.employeNom" style="display:flex;align-items:flex-start;gap:8px">
            <i class="fas fa-user-tie" style="color:#9ca3af;font-size:.78rem;margin-top:3px"></i>
            <div>
              <div style="font-size:.875rem;font-weight:600;color:#111">{{ r.employeNom }}</div>
              <div style="font-size:.72rem;color:#888;margin-top:1px">Intervenant</div>
            </div>
          </div>
          <div style="display:flex;align-items:flex-start;gap:8px">
            <i class="fas fa-receipt" style="color:#9ca3af;font-size:.78rem;margin-top:3px"></i>
            <div>
              <div style="font-size:.95rem;font-weight:700;color:#059669" *ngIf="r.prixTotal != null">{{ r.prixTotal | number:'1.2-2' }} DT</div>
              <div style="font-size:.875rem;font-weight:600;color:#888" *ngIf="r.prixTotal == null">Gratuit</div>
              <div style="font-size:.72rem;color:#888;margin-top:1px">Prix total</div>
            </div>
          </div>
        </div>

        <!-- Notes -->
        <div *ngIf="r.notes" style="font-size:.78rem;color:#666;font-style:italic;background:#f9fafb;border-radius:8px;padding:7px 10px;margin-bottom:10px;display:flex;gap:7px">
          <i class="fas fa-sticky-note" style="color:#d1d5db;font-size:.72rem;margin-top:2px"></i>
          {{ r.notes }}
        </div>

        <!-- Footer : id + bouton annuler -->
        <div style="display:flex;align-items:center;justify-content:space-between" (click)="$event.stopPropagation()">
          <div style="font-size:.72rem;color:#d1d5db;font-weight:600">#{{ r.id }}</div>
          <button *ngIf="canCancel(r)" (click)="annuler(r)"
            style="display:flex;align-items:center;gap:5px;padding:6px 14px;border-radius:8px;border:1.5px solid rgba(239,68,68,.3);background:rgba(239,68,68,.06);color:#dc2626;font-size:.78rem;font-weight:600;cursor:pointer">
            <i class="fas fa-times" style="font-size:.68rem"></i> Annuler
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- MODALE DÉTAIL -->
  <div *ngIf="selectedDetail"
    (click)="selectedDetail=null"
    style="position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center">
    <div (click)="$event.stopPropagation()"
      style="background:#fff;border-radius:20px;overflow:hidden;width:90%;max-width:520px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 32px 80px rgba(0,0,0,.25)">

      <!-- Header modal -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 24px;gap:12px"
        [style.background]="statutCfg(selectedDetail.statut).bgLight"
        [style.borderBottom]="'2px solid ' + statutCfg(selectedDetail.statut).border">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:42px;height:42px;border-radius:12px;background:rgba(99,102,241,.12);color:#6366f1;display:flex;align-items:center;justify-content:center;font-size:.95rem">
            <i class="fas fa-calendar-check"></i>
          </div>
          <div>
            <div style="font-weight:800;font-size:1rem;color:#111">{{ selectedDetail.serviceNom }}</div>
            <div style="font-size:.75rem;color:#888;margin-top:2px">Réservation #{{ selectedDetail.id }}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <span style="display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:20px;font-size:.72rem;font-weight:700;text-transform:uppercase"
            [style.background]="statutCfg(selectedDetail.statut).bgLight"
            [style.color]="statutCfg(selectedDetail.statut).color"
            [style.border]="'1px solid ' + statutCfg(selectedDetail.statut).border">
            <i [class]="statutCfg(selectedDetail.statut).icon"></i>
            {{ statutCfg(selectedDetail.statut).label }}
          </span>
          <button (click)="selectedDetail=null" style="width:32px;height:32px;border-radius:50%;border:1.5px solid #e5e7eb;background:#fff;color:#888;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.8rem">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>

      <!-- Corps modal -->
      <div style="flex:1;overflow-y:auto;padding:0 24px">

        <!-- Créneau -->
        <div style="padding:16px 0;border-bottom:1px solid #f3f4f6">
          <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;margin-bottom:10px;display:flex;align-items:center;gap:6px">
            <i class="fas fa-clock"></i> Créneau
          </div>
          <div style="display:flex;gap:20px;flex-wrap:wrap">
            <div>
              <div style="font-size:.72rem;color:#9ca3af;font-weight:600">Date</div>
              <div style="font-size:.95rem;font-weight:700;color:#111;margin-top:3px">{{ selectedDetail.heureDebut | date:'dd/MM/yyyy' }}</div>
            </div>
            <div>
              <div style="font-size:.72rem;color:#9ca3af;font-weight:600">Horaire</div>
              <div style="font-size:.95rem;font-weight:700;color:#111;margin-top:3px">{{ selectedDetail.heureDebut | date:'HH:mm' }} → {{ selectedDetail.heureFin | date:'HH:mm' }}</div>
            </div>
            <div *ngIf="selectedDetail.nombrePersonnes > 1">
              <div style="font-size:.72rem;color:#9ca3af;font-weight:600">Personnes</div>
              <div style="font-size:.95rem;font-weight:700;color:#111;margin-top:3px">{{ selectedDetail.nombrePersonnes }}</div>
            </div>
          </div>
        </div>

        <!-- Prestation -->
        <div *ngIf="selectedDetail.employeNom || selectedDetail.ressourceNom" style="padding:16px 0;border-bottom:1px solid #f3f4f6">
          <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;margin-bottom:10px;display:flex;align-items:center;gap:6px">
            <i class="fas fa-concierge-bell"></i> Prestation
          </div>
          <div style="display:flex;gap:20px;flex-wrap:wrap">
            <div *ngIf="selectedDetail.employeNom">
              <div style="font-size:.72rem;color:#9ca3af;font-weight:600">Intervenant</div>
              <div style="font-size:.95rem;font-weight:700;color:#111;margin-top:3px">{{ selectedDetail.employeNom }}</div>
            </div>
            <div *ngIf="selectedDetail.ressourceNom">
              <div style="font-size:.72rem;color:#9ca3af;font-weight:600">Ressource</div>
              <div style="font-size:.95rem;font-weight:700;color:#111;margin-top:3px">{{ selectedDetail.ressourceNom }}</div>
            </div>
          </div>
        </div>

        <!-- Prix -->
        <div style="padding:16px 0;border-bottom:1px solid #f3f4f6">
          <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;margin-bottom:10px;display:flex;align-items:center;gap:6px">
            <i class="fas fa-receipt"></i> Facturation
          </div>
          <div style="font-size:1.8rem;font-weight:800;color:#059669">
            {{ selectedDetail.prixTotal != null ? (selectedDetail.prixTotal | number:'1.2-2') + ' DT' : 'Gratuit' }}
          </div>
        </div>

        <!-- Notes -->
        <div *ngIf="selectedDetail.notes" style="padding:16px 0">
          <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;margin-bottom:10px;display:flex;align-items:center;gap:6px">
            <i class="fas fa-sticky-note"></i> Notes
          </div>
          <div style="font-size:.875rem;color:#555;line-height:1.6;font-style:italic;background:#f9fafb;padding:12px 14px;border-radius:10px;border:1px solid #f3f4f6">
            {{ selectedDetail.notes }}
          </div>
        </div>

      </div>

      <!-- Footer modal -->
      <div style="display:flex;justify-content:flex-end;gap:10px;padding:16px 24px;border-top:1px solid #f3f4f6;background:#f9fafb">
        <button (click)="selectedDetail=null" style="padding:9px 20px;border-radius:10px;border:1.5px solid #e5e7eb;background:#fff;color:#555;font-size:.85rem;font-weight:600;cursor:pointer">
          Fermer
        </button>
        <button *ngIf="canCancel(selectedDetail)" (click)="annuler(selectedDetail)"
          style="display:flex;align-items:center;gap:7px;padding:9px 20px;border-radius:10px;border:1.5px solid rgba(239,68,68,.3);background:rgba(239,68,68,.06);color:#dc2626;font-size:.85rem;font-weight:700;cursor:pointer">
          <i class="fas fa-times-circle"></i> Annuler la réservation
        </button>
      </div>
    </div>
  </div>

</div>`,
})
export class ClientReservationsComponent implements OnInit {
  private api      = inject(ApiService);
  private renderer = inject(Renderer2);

  reservations: ReservationResponse[] = [];
  filtered:     ReservationResponse[] = [];
  loading       = false;
  filtreStatut  = '';
  selectedDetail: ReservationResponse | null = null;

  readonly STATUTS = ['EN_ATTENTE','CONFIRMEE','EN_COURS','ANNULEE','TERMINEE'];

  readonly STATUT_MAP: Record<string, any> = {
    EN_ATTENTE: { label:'En attente',  icon:'fas fa-clock',         color:'#d97706', bg:'#f59e0b', bgLight:'#fffbeb', border:'rgba(245,158,11,.3)',  gradient:'linear-gradient(180deg,#f59e0b,#fbbf24)' },
    CONFIRMEE:  { label:'Confirmée',   icon:'fas fa-check-circle',  color:'#2563eb', bg:'#3b82f6', bgLight:'#eff6ff', border:'rgba(59,130,246,.3)',   gradient:'linear-gradient(180deg,#3b82f6,#60a5fa)'  },
    EN_COURS:   { label:'En cours',    icon:'fas fa-play-circle',   color:'#4f46e5', bg:'#6366f1', bgLight:'#eef2ff', border:'rgba(99,102,241,.3)',   gradient:'linear-gradient(180deg,#6366f1,#818cf8)'  },
    ANNULEE:    { label:'Annulée',     icon:'fas fa-times-circle',  color:'#dc2626', bg:'#ef4444', bgLight:'#fef2f2', border:'rgba(239,68,68,.3)',    gradient:'linear-gradient(180deg,#ef4444,#f87171)'  },
    TERMINEE:   { label:'Terminée',    icon:'fas fa-flag-checkered',color:'#059669', bg:'#10b981', bgLight:'#f0fdf4', border:'rgba(16,185,129,.3)',   gradient:'linear-gradient(180deg,#10b981,#34d399)'  },
  };

  statutCfg(s: string) { return this.STATUT_MAP[s] ?? this.STATUT_MAP['EN_ATTENTE']; }

  get totalActives():  number { return this.reservations.filter(r => !['ANNULEE','TERMINEE'].includes(r.statut)).length; }
  get totalTerminees(): number { return this.reservations.filter(r => r.statut === 'TERMINEE').length; }
  get totalAnnulees():  number { return this.reservations.filter(r => r.statut === 'ANNULEE').length; }
  get prixTotal(): number {
    return this.reservations.filter(r => r.statut === 'TERMINEE' && r.prixTotal != null)
      .reduce((s, r) => s + (r.prixTotal ?? 0), 0);
  }
  canCancel(r: ReservationResponse): boolean { return r.statut === 'EN_ATTENTE' || r.statut === 'CONFIRMEE'; }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.api.getReservations().subscribe({
      next: d => {
        this.reservations = d.sort((a, b) => new Date(b.heureDebut).getTime() - new Date(a.heureDebut).getTime());
        this.applyFilter(); this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  applyFilter(): void {
    this.filtered = this.filtreStatut
      ? this.reservations.filter(r => r.statut === this.filtreStatut)
      : this.reservations;
  }

  annuler(r: ReservationResponse): void {
    const overlay = this.renderer.createElement('div');
    this.renderer.setStyle(overlay, 'position', 'fixed'); this.renderer.setStyle(overlay, 'inset', '0');
    this.renderer.setStyle(overlay, 'background', 'rgba(0,0,0,.7)'); this.renderer.setStyle(overlay, 'z-index', '99999');
    this.renderer.setStyle(overlay, 'display', 'flex'); this.renderer.setStyle(overlay, 'align-items', 'center'); this.renderer.setStyle(overlay, 'justify-content', 'center');
    const box = this.renderer.createElement('div');
    this.renderer.setStyle(box, 'background', '#fff'); this.renderer.setStyle(box, 'border-radius', '20px');
    this.renderer.setStyle(box, 'padding', '36px 32px'); this.renderer.setStyle(box, 'text-align', 'center');
    this.renderer.setStyle(box, 'max-width', '400px'); this.renderer.setStyle(box, 'width', '92%');
    this.renderer.setStyle(box, 'box-shadow', '0 32px 80px rgba(0,0,0,.25)');
    const close = () => this.renderer.removeChild(document.body, overlay);
    const date = new Date(r.heureDebut).toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long'});
    const heure = new Date(r.heureDebut).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
    box.innerHTML = `
      <div style="width:60px;height:60px;background:#fff3cd;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:1.6rem">⚠️</div>
      <div style="font-size:1.1rem;font-weight:800;color:#111;margin-bottom:8px">Annuler cette réservation ?</div>
      <div style="font-size:.9rem;color:#333;margin-bottom:6px;font-weight:600">${r.serviceNom}</div>
      <div style="font-size:.82rem;color:#888;margin-bottom:28px">${date} à ${heure}</div>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:10px 14px;font-size:.8rem;color:#dc2626;margin-bottom:24px">
        ⚠️ Cette action est irréversible.
      </div>
      <div style="display:flex;gap:12px;justify-content:center">
        <button id="c-cancel" style="padding:10px 24px;border-radius:10px;border:1.5px solid #e5e7eb;background:#f9fafb;color:#555;font-size:.875rem;font-weight:600;cursor:pointer">Retour</button>
        <button id="c-ok" style="padding:10px 24px;border-radius:10px;border:none;background:#ef4444;color:#fff;font-size:.875rem;font-weight:700;cursor:pointer">Confirmer</button>
      </div>`;
    this.renderer.appendChild(overlay, box); this.renderer.appendChild(document.body, overlay);
    box.querySelector('#c-cancel')!.addEventListener('click', close);
    box.querySelector('#c-ok')!.addEventListener('click', () => {
      close();
      this.api.annulerReservationClient(r.id).subscribe({
        next: updated => {
          const idx = this.reservations.findIndex(x => x.id === r.id);
          if (idx !== -1) this.reservations[idx] = updated;
          if (this.selectedDetail?.id === r.id) this.selectedDetail = updated;
          this.applyFilter();
        },
        error: (e: any) => this._showError(e?.error?.message || 'Impossible d\'annuler cette réservation.')
      });
    });
    overlay.addEventListener('click', (e: Event) => { if (e.target === overlay) close(); });
  }

  private _showError(msg: string): void {
    const overlay = this.renderer.createElement('div');
    this.renderer.setStyle(overlay, 'position', 'fixed'); this.renderer.setStyle(overlay, 'inset', '0');
    this.renderer.setStyle(overlay, 'background', 'rgba(0,0,0,.7)'); this.renderer.setStyle(overlay, 'z-index', '99999');
    this.renderer.setStyle(overlay, 'display', 'flex'); this.renderer.setStyle(overlay, 'align-items', 'center'); this.renderer.setStyle(overlay, 'justify-content', 'center');
    const box = this.renderer.createElement('div');
    this.renderer.setStyle(box, 'background', '#fff'); this.renderer.setStyle(box, 'border-radius', '20px');
    this.renderer.setStyle(box, 'padding', '32px 28px'); this.renderer.setStyle(box, 'text-align', 'center');
    this.renderer.setStyle(box, 'max-width', '360px'); this.renderer.setStyle(box, 'width', '92%');
    this.renderer.setStyle(box, 'box-shadow', '0 24px 64px rgba(0,0,0,.2)');
    const close = () => this.renderer.removeChild(document.body, overlay);
    box.innerHTML = `
      <div style="font-size:2rem;margin-bottom:12px">❌</div>
      <div style="font-size:1rem;font-weight:700;color:#111;margin-bottom:10px">Erreur</div>
      <div style="font-size:.875rem;color:#666;margin-bottom:22px">${msg}</div>
      <button id="e-ok" style="padding:10px 32px;border-radius:10px;border:none;background:#111;color:#fff;font-size:.875rem;font-weight:700;cursor:pointer">OK</button>`;
    this.renderer.appendChild(overlay, box); this.renderer.appendChild(document.body, overlay);
    box.querySelector('#e-ok')!.addEventListener('click', close);
    overlay.addEventListener('click', (e: Event) => { if (e.target === overlay) close(); });
  }
}