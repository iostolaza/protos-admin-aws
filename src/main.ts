// src/main.ts

import { enableProdMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { Amplify } from 'aws-amplify'; // aws-amplify ^6.6.3
import amplify_outputs from '../amplify_outputs.json'; // Generated from 'npx ampx generate outputs'
import { AppComponent } from './app/app.component'; // Adjust if your root component differs
import { routes } from './app/app.routes'; // Your routes file
import { environment } from './environments/environment.prod'; // If using environments

if (environment.production) {
  enableProdMode();
}

// Configure Amplify with generated outputs (must be before bootstrap for Authenticator to work)
Amplify.configure(amplify_outputs);

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    // Add Amplify UI providers if not already in app.config.ts
    // e.g., importProvidersFrom(AmplifyAuthenticatorModule),
  ],
}).catch((err) => console.error(err));