// src/main.ts (Full Edited Script - Angular v20.1.0 Standalone Bootstrap)

import { enableProdMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config'; // Import full config
import { environment } from './environments/environment.prod'; // Standard import (handles prod via build)

if (environment.production) {
  enableProdMode();
}

// Bootstrap with appConfig (includes all providers, including provideIconPreload() and Amplify init)
bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));