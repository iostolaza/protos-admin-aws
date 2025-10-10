
// src/app/app.ts

import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { IconPreloaderService } from './core/services/icon-preloader.service';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  private iconPreloader = inject(IconPreloaderService);
  private themeService = inject(ThemeService); 

  constructor() {
    this.iconPreloader.preloadIcons().subscribe();
  }
}