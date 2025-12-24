import { Injectable } from '@angular/core';
import { fetchAuthSession } from 'aws-amplify/auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
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
}
