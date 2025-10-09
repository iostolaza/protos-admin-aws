// src/app/core/services/user.service.ts

import { Injectable, signal } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import { uploadData, getUrl } from 'aws-amplify/storage';
import type { Schema } from '../../../../amplify/data/resource';
import { fetchAuthSession, getCurrentUser } from 'aws-amplify/auth'; 
import { Observable, Subject, from } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Hub } from 'aws-amplify/utils'; 

type Models = Schema;
type UserType = Models['User']['type'];
type PaymentMethodType = Models['PaymentMethod']['type'];

export type UserProfile = UserType & { profileImageUrl?: string };

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private client = generateClient<Schema>();
  public user = signal<UserProfile | null>(null); // Make public
  public allUsers = signal<UserType[]>([]); // Cached all users
  private destroy$ = new Subject<void>();

  constructor() {
    this.setupAuthListener();
  }

  private setupAuthListener() {
    Hub.listen('auth', ({ payload }) => {
      switch (payload.event) {
        case 'signedIn':
        case 'tokenRefresh':
          console.log('Auth event:', payload.event);
          this.loadCurrentUser();
          break;
        case 'signedOut':
          this.user.set(null);
          this.allUsers.set([]); // Clear cache on sign out
          break;
      }
    });

    // Initial check
    (async () => {
      try {
        await fetchAuthSession(); // Await to ensure session
        await this.loadCurrentUser();
      } catch {
        console.log('No initial user');
      }
    })();
  }

  async load() {
    await this.loadCurrentUser();
  }

  private async loadCurrentUser() {
    try {
      const { userId, signInDetails } = await getCurrentUser();
      const email = signInDetails?.loginId;

      const { data: userData, errors } = await this.client.models.User.get({ cognitoId: userId });
      if (errors) throw new Error(errors.map((e: any) => e.message).join(', '));

      let user = userData;

      if (!user && email) {
        const { data: users } = await this.client.models.User.listUserByEmail({ email }); // Fixed: singular model name
        user = users[0];
      }

      if (!user && email) {
        const now = new Date().toISOString();
        const { errors } = await this.client.models.User.create({
          cognitoId: userId,
          email,
          createdAt: now,
          updatedAt: now,
        });
        if (errors) throw new Error(errors.map(e => e.message).join(', '));
       
        const { data: newUser } = await this.client.models.User.get({ cognitoId: userId });
        user = newUser;
      }

      if (!user) return;

      const profileImageUrl = await this.getProfileImageUrlFromKey(user.profileImageKey);
      this.user.set({ ...user, profileImageUrl });

      this.client.models.User.observeQuery({ filter: { cognitoId: { eq: userId } } })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: async ({ items }) => {
            if (items[0]) await this.updateProfileFromItem(items[0]);
          },
          error: (err) => console.error('ObserveQuery error:', err),
        });
    } catch (error) {
      console.error('Load user error:', error);
    }
  }

  private async getProfileImageUrlFromKey(key: string | null | undefined): Promise<string | undefined> {
    if (!key) return undefined;
    const { url } = await getUrl({ path: key, options: { expiresIn: 3600 } });
    return url.toString();
  }

  private async updateProfileFromItem(item: UserType) {
    let profileImageUrl = this.user()?.profileImageUrl;
    const currentKey = this.user()?.profileImageKey;
    if (item.profileImageKey !== currentKey) {
      profileImageUrl = await this.getProfileImageUrlFromKey(item.profileImageKey);
    }
    const updatedUser: UserProfile = { ...item, profileImageUrl };
    this.user.set(updatedUser);
  }

  async save(updated: Partial<UserProfile>) {
    const validUpdated: Partial<UserType> = Object.fromEntries(
      Object.entries(updated).filter(([key]) => 
        key !== 'cognitoId' && key !== 'createdAt' && key !== 'updatedAt' && key !== 'profileImageUrl'
      )
    );
    await this.updateUser(validUpdated);
  }

  async getAllUsers(nextToken: string | null = null): Promise<UserType[]> {  
    if (this.allUsers().length > 0) {
      console.log('Returning cached all users');
      return this.allUsers();
    }
    try {
      const accumulated: UserType[] = [];
      let token = nextToken;
      do {
        const { data, nextToken: newToken, errors } = await this.client.models.User.list({ nextToken: token ?? undefined });
        if (errors) throw new Error(errors.map(e => e.message).join(', '));
        accumulated.push(...data);
        token = newToken ?? null;
      } while (token);
      this.allUsers.set(accumulated); // Cache the result
      return accumulated;
    } catch (error) {
      console.error('Get all users error:', error);
      return [];
    }
  }

  async updateUser(updatedData: Partial<UserType>) {
    const currentUser = this.user();
    if (!currentUser?.cognitoId) return;

    const { data: updated, errors } = await this.client.models.User.update({
      cognitoId: currentUser.cognitoId,
      ...updatedData,
      updatedAt: new Date().toISOString(),
    });
    if (errors) throw new Error(errors.map((e: any) => e.message).join(', '));
    if (!updated) throw new Error('Updated user is null');
    await this.updateProfileFromItem(updated);
    // Invalidate cache if needed (e.g., if user details change affects list)
    this.allUsers.set([]);
  }

  async uploadProfileImage(file: File): Promise<string> {
    try {
      const { userId } = await getCurrentUser();
      const result = await uploadData({
        path: ({ identityId }) => `protected/${identityId}/profile-pictures/${userId}/${file.name}`,
        data: file
      }).result;
      const key = result.path;
      await this.updateUser({ profileImageKey: key });
      return key;
    } catch (error: unknown) {
      console.error('Upload image error:', error);
      throw error;
    }
  }

  getProfileImageUrl(key: string): Observable<string> {
    return from(this.getProfileImageUrlFromKey(key).then(u => u ?? ''));
  }

  async getPaymentMethods(): Promise<PaymentMethodType[]> {
    try {
      const { userId } = await getCurrentUser();
      const { data, errors } = await this.client.models.PaymentMethod.listPaymentMethodByUserCognitoId({ userCognitoId: userId });
      if (errors) throw new Error(errors.map((e: any) => e.message).join(', '));
      return data;
    } catch (error: unknown) {
      console.error('Get payments error:', error);
      return [];
    }
  }

  async addPaymentMethod(type: string, name: string) {
    try {
      const { userId } = await getCurrentUser();
      const now = new Date().toISOString();
      const { errors } = await this.client.models.PaymentMethod.create({ userCognitoId: userId, type, name, createdAt: now, updatedAt: now });
      if (errors) throw new Error(errors.map((e: any) => e.message).join(', '));
    } catch (error: unknown) {
      console.error('Add payment error:', error);
    }
  }

  async updatePaymentMethod(id: string, type: string, name: string) {
    try {
      const { errors } = await this.client.models.PaymentMethod.update({ id, type, name, updatedAt: new Date().toISOString() });
      if (errors) throw new Error(errors.map((e: any) => e.message).join(', '));
    } catch (error: unknown) {
      console.error('Update payment error:', error);
    }
  }

  async deletePaymentMethod(id: string) {
    try {
      const { errors } = await this.client.models.PaymentMethod.delete({ id });
      if (errors) throw new Error(errors.map((e: any) => e.message).join(', '));
    } catch (error: unknown) {
      console.error('Delete payment error:', error);
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}