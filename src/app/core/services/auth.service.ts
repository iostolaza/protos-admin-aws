/*
Description: 
Central service for advanced authentication, including role/group checks using AWS Amplify v6.
Complements existing auth guards by providing group-based RBAC and custom claims.
Developer: Francisco Ostolaza  
Date Created: September 27, 2025  
*/

import { Injectable, inject, signal, computed } from '@angular/core';
import { fetchAuthSession } from 'aws-amplify/auth';
import { ContactService } from './contact.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private contactService = inject(ContactService);

  // Reactive signal for groups
  private groups = signal<string[]>([]);

  // Computed observable-like signal for isAdmin
  public isAdmin$ = computed(() => this.groups().includes('user_Admin'));

  // Refresh groups (call on sign-in, token refresh, or manually)
  async refreshGroups(): Promise<void> {
    try {
      const session = await fetchAuthSession({ forceRefresh: true });
      const groups = (session.tokens?.idToken?.payload['cognito:groups'] as string[]) || [];
      this.groups.set(groups);
    } catch (err) {
      console.error('Failed to refresh groups', err);
      this.groups.set([]);
    }
  }

  async getUserGroups(): Promise<string[]> {
    if (this.groups().length === 0) {
      await this.refreshGroups();
    }
    return this.groups();
  }

  async getCustomClaims(): Promise<Record<string, any>> {
    try {
      const session = await fetchAuthSession({ forceRefresh: true });
      return session.tokens?.idToken?.payload as Record<string, any> || {};
    } catch {
      return {};
    }
  }

  async getAssignedBuildings(): Promise<string[]> {
    const claims = await this.getCustomClaims();
    return claims['custom:assigned_buildings'] ? JSON.parse(claims['custom:assigned_buildings']) : [];
  }

  async getUserId(): Promise<string | null> {
    const claims = await this.getCustomClaims();
    return claims['sub'] || null;
  }

  private async hasRole(suffix: string): Promise<boolean> {
    const groups = await this.getUserGroups();
    return groups.includes('cognitoAdmin') || groups.some(g => g.endsWith(suffix));
  }

  async isAdmin(): Promise<boolean> {
    return this.hasRole('_Admin');
  }

  async isManager(): Promise<boolean> {
    return this.hasRole('_Manager');
  }

  async isFacilities(): Promise<boolean> {
    return this.hasRole('_Facilities');
  }

  async isUser(): Promise<boolean> {
    return this.hasRole('_User');
  }

  async canViewTransaction(trans: any): Promise<boolean> {
    if (await this.isAdmin()) return true;
    if (await this.isFacilities()) return false;

    if (await this.isManager()) {
      const buildings = await this.getAssignedBuildings();
      return buildings.includes(trans.building);
    }

    if (await this.isUser()) {
      const userId = await this.getUserId();
      if (trans.accountId === userId) return true;

      const contacts = await this.contactService.getContacts();
      return contacts.some(contact => contact.cognitoId === trans.accountId);
    }

    return false;
  }

  async canCreateTransaction(): Promise<boolean> {
    return (await this.isAdmin()) || (await this.isManager());
  }

  async canEditTransaction(trans: any): Promise<boolean> {
    if (await this.isAdmin()) return true;
    if (await this.isManager()) {
      const buildings = await this.getAssignedBuildings();
      return buildings.includes(trans.building);
    }
    return false;
  }

  async canDeleteTransaction(): Promise<boolean> {
    return await this.isAdmin();
  }
}
