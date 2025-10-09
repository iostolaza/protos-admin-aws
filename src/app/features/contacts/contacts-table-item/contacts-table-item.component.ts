import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { getIconPath } from '../../../core/services/icon-preloader.service';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { InputContact } from '../../../core/models/contact';

@Component({
  selector: '[contacts-table-item]',
  templateUrl: './contacts-table-item.component.html',
  standalone: true,
  imports: [CommonModule, DatePipe, AngularSvgIconModule],
})
export class ContactsTableItemComponent {
  getIconPath = getIconPath;

  @Input() contact!: InputContact;
  @Output() deleted = new EventEmitter<string>();
  @Output() messaged = new EventEmitter<string>(); 

  deleteContact(): void {
    if (confirm('Delete this contact?')) {
      this.deleted.emit(this.contact.cognitoId);
    }
  }

  startMessage(): void { 
    this.messaged.emit(this.contact.cognitoId);
  }
}