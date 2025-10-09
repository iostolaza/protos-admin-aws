/* Menu service, unchanged. */

import { Injectable, OnDestroy, signal, computed } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, from } from 'rxjs';
import { Menu } from '../constants/menu';
import { MenuItem, SubMenuItem } from '../models/menu.model';
import { signOut } from 'aws-amplify/auth';

@Injectable({
  providedIn: 'root',
})
export class MenuService implements OnDestroy {
  private _showSidebar = signal(true);
  private _showMobileMenu = signal(false);
  private _pagesMenu = signal<MenuItem[]>([]);
  private _subscription = new Subscription();

  constructor(private router: Router) {
    this._pagesMenu.set(Menu.pages);
    const sub = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this._pagesMenu().forEach((menu) => {
          let activeGroup = false;
          menu.items.forEach((subMenu) => {
            const active = this.isActive(subMenu.route);
            subMenu.active = active;
            subMenu.expanded = active;
            if (active) activeGroup = true;
            if (subMenu.children) {
              this.expand(subMenu.children);
            }
          });
          menu.active = activeGroup;
        });
      }
    });
    this._subscription.add(sub);
  }

  get showSideBar() { return this._showSidebar(); }
  get showMobileMenu() { return this._showMobileMenu(); }
  get pagesMenu() { return computed(() => this._pagesMenu()); }

  set showSideBar(value: boolean) {
    this._showSidebar.set(value);
    if (!value) this.collapseAll();
  }
  set showMobileMenu(value: boolean) { this._showMobileMenu.set(value); }

  public toggleSidebar() {
    this._showSidebar.set(!this._showSidebar());
  }

  public toggleMenu(menu: SubMenuItem) {
    this.showSideBar = true;
    const updatedMenu = this._pagesMenu().map((menuGroup) => ({
      ...menuGroup,
      items: menuGroup.items.map((item) => ({
        ...item,
        expanded: item === menu ? !item.expanded : false,
      })),
    }));
    this._pagesMenu.set(updatedMenu);
  }

  public toggleSubMenu(submenu: SubMenuItem) {
    submenu.expanded = !submenu.expanded;
  }

  private expand(items: Array<SubMenuItem>) {
    items.forEach((item) => {
      item.expanded = this.isActive(item.route);
      if (item.children) this.expand(item.children);
    });
  }

  private collapseAll() {
    this._pagesMenu.update((menus) => menus.map((group) => ({
      ...group,
      items: group.items.map((item) => this._collapseRecursive(item))
    })));
  }

  private _collapseRecursive(item: SubMenuItem): SubMenuItem {
    return {
      ...item,
      expanded: false,
      children: item.children?.map((child) => this._collapseRecursive(child))
    };
  }

  public isActive(instruction: string | null | undefined): boolean {
    if (!instruction) return false;
    return this.router.isActive(this.router.createUrlTree([instruction]), {
      paths: 'subset',
      queryParams: 'subset',
      fragment: 'ignored',
      matrixParams: 'ignored',
    });
  }

  public logout() {
    from(signOut({ global: true })).subscribe({
      next: () => this.router.navigate(['/sign-in']),
      error: (err) => console.error('Logout error', err)
    });
  }

  ngOnDestroy(): void {
    this._subscription.unsubscribe();
  }
}
