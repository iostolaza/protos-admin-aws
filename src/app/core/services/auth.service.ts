/*
Description: 
Central service for advanced authentication, including role/group checks using AWS Amplify v6.
Complements existing auth guards by providing group-based RBAC and custom claims.
Developer: Francisco Ostolaza  
Date Created: September 27, 2025  
References: 
- Amplify Auth v6: https://docs.amplify.aws/gen2/build-a-backend/auth/accessing-credentials/
- Cognito Groups in ID Token: https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-with-identity-providers.html
*/

import { Injectable } from '@angular/core';
import { fetchAuthSession } from 'aws-amplify/auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  async getUserGroups(): Promise<string[]> {
    try {
      const session = await fetchAuthSession({ forceRefresh: true });
      return session.tokens?.idToken?.payload['cognito:groups'] as string[] || [];
    } catch {
      return [];
    }
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

  async isAdmin(): Promise<boolean> {
    const groups = await this.getUserGroups();
    return groups.includes('Admin');
  }

  async isManager(): Promise<boolean> {
    const groups = await this.getUserGroups();
    return groups.includes('Manager');
  }

  async isFacilities(): Promise<boolean> {
    const groups = await this.getUserGroups();
    return groups.includes('Facilities');
  }

  async isUser(): Promise<boolean> {
    const groups = await this.getUserGroups();
    return groups.includes('User');
  }

  async canViewTransaction(trans: any): Promise<boolean> {
    if (await this.isAdmin()) return true;
    if (await this.isFacilities()) return false;
    if (await this.isManager()) {
      const buildings = await this.getAssignedBuildings();
      return buildings.includes(trans.building);
    }
    if (await this.isUser()) {
      return trans.accountId === (await this.getUserId());
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
