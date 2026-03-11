import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { ServiceResponse } from '../../../core/models/api.models';

@Component({
  selector: 'app-client-services',
  standalone: true,
  imports: [CommonModule],
  template: `
  <div>
    <h2>Services disponibles</h2>

    <div *ngFor="let s of services">
      <strong>{{ s.nom }}</strong>
      — {{ s.dureeMinutes }} min
      — {{ s.tarif | number:'1.2-2' }} DT
      <p>{{ s.description }}</p>
      <hr>
    </div>

    <p *ngIf="services.length === 0">Aucun service disponible</p>
  </div>
  `,
  styles: [`
    h2 { margin-bottom: 16px; }
  `]
})
export class ClientServicesComponent implements OnInit {

  private api = inject(ApiService);
  services: ServiceResponse[] = [];

  ngOnInit() {
    this.api.getServices().subscribe(d => this.services = d);
  }
}