
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule, NgClass, NgTemplateOutlet } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { SubMenuItem } from '../../../core/models/menu.model';
import { MenuService } from '../../../core/services/menu.service';
import { SidebarSubmenuComponent } from '../sidebar-submenu/sidebar-submenu.component';
import { getIconPath } from '../../../core/services/icon-preloader.service';

@Component({
  selector: 'app-sidebar-menu',
  standalone: true,
  imports: [
    CommonModule, NgClass, NgTemplateOutlet,
    RouterLink, RouterLinkActive, AngularSvgIconModule,
    SidebarSubmenuComponent
  ],
  templateUrl: './sidebar-menu.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarMenuComponent {
  getIconPath = getIconPath;

  constructor(public menuService: MenuService) {}

  trackByLabel(index: number, item: { label: string }) { return item.label; }

  public toggleMenu(subMenu: SubMenuItem) {
    this.menuService.toggleMenu(subMenu);
  }
}