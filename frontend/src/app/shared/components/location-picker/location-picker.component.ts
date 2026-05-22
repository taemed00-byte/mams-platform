import { Component, Output, EventEmitter, AfterViewInit, OnDestroy, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';

declare const L: any;

@Component({
  selector: 'app-location-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatInputModule],
  template: `
    <div class="location-picker">
      <div class="search-bar">
        <input class="loc-search" [(ngModel)]="searchText" (keydown.enter)="searchLocation()"
               placeholder="Search for a location…">
        <button class="loc-search-btn" (click)="searchLocation()">
          <mat-icon>search</mat-icon>
        </button>
      </div>
      <div id="mams-map-{{mapId}}" class="map-container"></div>
      <div *ngIf="selected()" class="selected-info">
        <mat-icon>location_on</mat-icon>
        <div>
          <div class="loc-address">{{selected()!.address}}</div>
          <div class="loc-coords">{{selected()!.lat | number:'1.5-5'}}, {{selected()!.lng | number:'1.5-5'}}</div>
        </div>
        <button mat-icon-button color="warn" (click)="clearSelection()"><mat-icon>close</mat-icon></button>
      </div>
    </div>
  `,
  styles: [`
    .location-picker { display: flex; flex-direction: column; gap: 10px; }
    .search-bar { display: flex; gap: 8px; }
    .loc-search { flex: 1; border: 1.5px solid #d0d7e6; border-radius: 8px; padding: 8px 12px; font-size: 14px; outline: none; font-family: inherit; }
    .loc-search:focus { border-color: #1e3870; }
    .loc-search-btn { background: #1e3870; color: white; border: none; border-radius: 8px; width: 40px; height: 40px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .map-container { width: 100%; height: 280px; border-radius: 10px; border: 1.5px solid #d0d7e6; overflow: hidden; }
    .selected-info { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #f0f4ff; border-radius: 8px; border: 1px solid #c5cade; }
    .selected-info mat-icon { color: #1e3870; }
    .loc-address { font-size: 13px; font-weight: 600; color: #222; }
    .loc-coords { font-size: 11px; color: #888; }
  `]
})
export class LocationPickerComponent implements AfterViewInit, OnDestroy {
  @Input() initialLat = 30.0444;
  @Input() initialLng = 31.2357;
  @Output() locationSelected = new EventEmitter<{lat: number, lng: number, address: string, city: string}>();

  mapId = Math.random().toString(36).slice(2, 8);
  searchText = '';
  selected = signal<{lat: number, lng: number, address: string} | null>(null);
  private map: any;
  private marker: any;

  ngAfterViewInit() {
    setTimeout(() => this.initMap(), 100);
  }

  private initMap() {
    if (typeof L === 'undefined') {
      // Load Leaflet dynamically if not already loaded
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => this.setupMap();
      document.head.appendChild(script);
    } else {
      this.setupMap();
    }
  }

  private setupMap() {
    const el = document.getElementById(`mams-map-${this.mapId}`);
    if (!el) return;
    this.map = L.map(el).setView([this.initialLat, this.initialLng], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(this.map);

    const icon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41], iconAnchor: [12, 41]
    });

    this.map.on('click', (e: any) => {
      const { lat, lng } = e.latlng;
      this.placeMarker(lat, lng, icon);
      this.reverseGeocode(lat, lng);
    });
  }

  searchLocation() {
    if (!this.searchText.trim()) return;
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(this.searchText)}&limit=1`)
      .then(r => r.json()).then((results: any[]) => {
        if (results.length) {
          const { lat, lon, display_name } = results[0];
          const icon = L.icon({
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            iconSize: [25, 41], iconAnchor: [12, 41]
          });
          this.map.setView([+lat, +lon], 14);
          this.placeMarker(+lat, +lon, icon);
          this.setSelected(+lat, +lon, display_name);
        }
      });
  }

  private reverseGeocode(lat: number, lng: number) {
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
      .then(r => r.json()).then((data: any) => {
        const address = data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        const city = data.address?.city || data.address?.town || data.address?.village || data.address?.county || '';
        this.setSelected(lat, lng, address, city);
      });
  }

  private placeMarker(lat: number, lng: number, icon: any) {
    if (this.marker) this.map.removeLayer(this.marker);
    this.marker = L.marker([lat, lng], { icon }).addTo(this.map);
  }

  private setSelected(lat: number, lng: number, address: string, city = '') {
    this.selected.set({ lat, lng, address });
    this.locationSelected.emit({ lat, lng, address, city });
  }

  clearSelection() {
    if (this.marker) this.map.removeLayer(this.marker);
    this.marker = null;
    this.selected.set(null);
    this.locationSelected.emit({ lat: 0, lng: 0, address: '', city: '' });
  }

  ngOnDestroy() { if (this.map) this.map.remove(); }
}
