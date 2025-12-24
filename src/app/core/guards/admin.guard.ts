import { CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

export const adminGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.refreshGroups(); // Ensure groups are loaded
  const isAdmin = authService.isAdmin$();

  if (!isAdmin) {
    return router.createUrlTree(['/main-layout/home']);
  }
  return true;
};
