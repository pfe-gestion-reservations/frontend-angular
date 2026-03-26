import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-sa-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: `./sa-dashboard.component.html`,
  styleUrls: [`./sa-dashboard.component.css`]
})
export class SaDashboardComponent implements OnInit {
  private api = inject(ApiService);
  loading = false;

  stats = { secteurs: 0, entreprises: 0, gerants: 0, employes: 0, clients: 0, services: 0 };
  recentEntreprises: any[] = [];

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    forkJoin({
      s: this.api.getSecteurs(),
      e: this.api.getEntreprises(),
      g: this.api.getGerants(),
      emp: this.api.getEmployes(),
      c: this.api.getClients(),
      svc: this.api.getServices()
    }).subscribe({
      next: r => {
        this.stats = {
          secteurs:    r.s.length,
          entreprises: r.e.length,
          gerants:     r.g.length,
          employes:    r.emp.filter((e: any) => !e.archived).length,
          clients:     r.c.filter((c: any) => !c.archived).length,
          services:    r.svc.filter((s: any) => !s.archived).length
        };
        this.recentEntreprises = r.e.slice(-5).reverse();
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }
}