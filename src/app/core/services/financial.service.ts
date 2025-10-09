
// src/app/core/services/financial.service.ts

import { Injectable } from '@angular/core';
import { UserService } from './user.service';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../amplify/data/resource';
import { from, Observable, throwError, of, forkJoin } from 'rxjs';
import { catchError, map, switchMap, tap} from 'rxjs/operators';
import { AuthService } from './auth.service';
import { Transaction, Invoice, InvoiceItem } from '../models/financial.model';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

@Injectable({ providedIn: 'root' })
export class FinancialService {
  private client = generateClient<Schema>();
  
  private taxRate = 0.0825;
  constructor(private auth: AuthService, private userService: UserService) {}

  createTransaction(transData: Partial<Transaction> & { accountId: string }): Observable<Transaction | null> {
    console.log('createTransaction called with:', transData);
    return from(this.getLastBalance(transData.accountId)).pipe(
      switchMap(lastBalance => {
        console.log('Last balance:', lastBalance);
        return from(this.auth.canCreateTransaction()).pipe(
          switchMap(can => {
            if (!can) throw new Error('Unauthorized');
            const computed: Partial<Transaction> & { accountId: string } = {
              ...transData,
              transactionId: crypto.randomUUID(),
              balance: (lastBalance || 0) + (transData.chargeAmount || 0) - (transData.paymentAmount || 0),
              date: transData.date || new Date().toISOString().split('T')[0],
            };
            console.log('Creating transaction:', computed);
            return from(this.client.models.Transaction.create(computed as any)).pipe(
              map(res => {
                console.log('Create response:', res);
                return res.data as Transaction;
              })
            );
          })
        );
      }),
      catchError(err => {
        console.error('Create error:', err);
        return throwError(() => new Error(`Create failed: ${err.message}`));
      })
    );
  }

  private getLastBalance(accountId: string): Observable<number> {
    console.log('getLastBalance for accountId:', accountId);
    return from(this.client.models.Transaction.list({
      filter: { accountId: { eq: accountId } },
    })).pipe(
      map(res => {
        console.log('getLastBalance list response:', res.data);
        if (res.data.length === 0) return 0;
        const filtered = res.data.filter(t => t.createdAt != null);
        if (filtered.length === 0) return 0;
        const sorted = filtered.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
        return sorted[0]?.balance || 0;
      })
    );
  }

listTransactions(filter: { accountId?: string; startDate?: string; endDate?: string; limit?: number } = {}): Observable<Transaction[]> {  // CHANGED: accountId optional
  console.log('listTransactions called with filter:', filter);
  return from(this.auth.isManager()).pipe(  // ADDED: Check isManager
    switchMap(isManager => {
      const baseFilter = isManager ? {} : (filter.accountId ? { accountId: { eq: filter.accountId } } : {});  // ADDED: No filter if manager
      const additionalConditions: any[] = [];
      if (filter.startDate) additionalConditions.push({ date: { ge: filter.startDate } });
      if (filter.endDate) additionalConditions.push({ date: { le: filter.endDate } });
      const fullFilter = additionalConditions.length > 0 
        ? { and: [baseFilter, ...additionalConditions] }
        : baseFilter;
      return from(this.client.models.Transaction.list({
        filter: fullFilter,
        limit: filter.limit || 100
      })).pipe(
        switchMap(res => {
          console.log('listTransactions response:', res.data);
          return from(Promise.all(res.data.map(async trans => {
            const canView = await this.auth.canViewTransaction(trans);
            console.log('canViewTransaction for', trans.transactionId, ':', canView);
            return canView ? trans as Transaction : null;
          })));
        }),
        map(filtered => {
          const result = filtered.filter(t => t !== null) as Transaction[];
          console.log('Filtered transactions:', result);
          return result;
        })
      );
    })
  );
}

  getTransaction(transactionId: string): Observable<Transaction | null> {
    console.log('getTransaction called for:', transactionId);
    return from(this.client.models.Transaction.get({ transactionId })).pipe(
      switchMap(res => from(this.auth.canViewTransaction(res.data)).pipe(
        map(can => can ? res.data as Transaction : null)
      ))
    );
  }

  updateTransaction(transactionId: string, updates: Partial<Transaction>): Observable<Transaction | null> {
    console.log('updateTransaction called for:', transactionId, 'with updates:', updates);
    return from(this.getTransaction(transactionId)).pipe(
      switchMap(existing => {
        if (!existing) throw new Error('Transaction not found');
        return from(this.auth.canEditTransaction(existing)).pipe(
          switchMap(can => {
            if (!can) throw new Error('Unauthorized');
            return from(this.client.models.Transaction.update({ transactionId, ...updates } as any)).pipe(
              map(res => res.data as Transaction)
            );
          })
        );
      })
    );
  }

  deleteTransaction(transactionId: string): Observable<void> {  // UPDATED: delete to deleteTransaction
    console.log('deleteTransaction called for:', transactionId);
    return from(this.auth.canDeleteTransaction()).pipe(
      switchMap(can => {
        if (!can) throw new Error('Unauthorized');
        return from(this.client.models.Transaction.delete({ transactionId })).pipe(
          map(() => undefined)
        );
      })
    );
  }

subscribeNewTransactions(accountId: string): Observable<Transaction[]> {
  console.log('subscribeNewTransactions for accountId:', accountId);
  return from(this.auth.isManager()).pipe(  // ADDED: Check isManager
    switchMap(isManager => {
      const filter = isManager ? {} : { accountId: { eq: accountId } };  // ADDED: No filter if manager
      console.log('Subscription filter:', filter);  // ADDED: Log filter
      return this.client.models.Transaction.observeQuery({ filter }).pipe(
        switchMap(snapshot => {
          console.log('observeQuery snapshot:', snapshot.items);
          return from(Promise.all(snapshot.items.map(async (trans: any) => {
            const canView = await this.auth.canViewTransaction(trans);
            console.log('canViewTransaction for', trans.transactionId, ':', canView);
            return canView ? trans as Transaction : null;
          })));
        }),
        map(filtered => {
          const result = filtered.filter(t => t !== null) as Transaction[];
          console.log('Filtered subscription transactions:', result);
          return result;
        })
      );
    })
  );
}

  forecastBalance(accountId: string): Observable<number> {
    return of(0);  // Placeholder
  }

  getContacts(): Observable<Schema['User']['type'][]> {
    return from(this.auth.getUserId()).pipe(
      switchMap(userId => {
        if (!userId) throw new Error('No current user');
        return from(this.client.models.Friend.list({
          filter: { ownerCognitoId: { eq: userId } },
          selectionSet: ['friend.cognitoId', 'friend.firstName', 'friend.lastName', 'friend.email', 'friend.address.*'],
          limit: 100
        }));
      }),
      map(res => {
        if (res.errors) throw new Error('Query error');
        return res.data.map(f => f.friend as Schema['User']['type']);
      }),
      catchError(err => throwError(() => new Error(`Contacts fetch failed: ${err.message}`)))
    );
  }

createInvoice(invoiceData: Partial<Invoice> & { items: Partial<InvoiceItem>[] }): Observable<Invoice | null> {
    return from(this.auth.getUserId()).pipe(
      switchMap(userId => {
        if (!userId) throw new Error('No current user');
        return from(this.auth.canCreateTransaction()).pipe(
          switchMap(can => {
            if (!can) throw new Error('Unauthorized to create invoice');
            const invoiceId = crypto.randomUUID();
            const invoiceNumber = `INV-${invoiceId.slice(0, 8).toUpperCase()}`;
            const now = new Date().toISOString();
            const computedInvoice: any = {
              invoiceId,
              invoiceNumber,
              billFromId: userId,
              ...invoiceData,
              date: invoiceData.date || new Date().toISOString().split('T')[0],
              createdAt: now,
              updatedAt: now,
            };
            console.log('Creating invoice:', computedInvoice);
            return from(this.client.models.Invoice.create(computedInvoice)).pipe(
              tap(res => console.log('Invoice create response:', res)),
              map(res => {
                if (res.errors) throw new Error(`Invoice creation failed: ${res.errors.map(e => e.message).join(', ')}`);
                return res.data as unknown as Invoice;  // UPDATED: Cast to unknown
              }),
              switchMap(invoice => {
                console.log('Created invoice before items:', invoice);  // ADDED: Log to check invoiceId
                const itemsPromises = invoiceData.items.map((item: Partial<InvoiceItem>) => {
                  const itemId = crypto.randomUUID();
                  const computedItem: any = {
                    invoiceItemId: itemId,
                    invoiceId: invoice.invoiceId,
                    ...item,
                  };
                  console.log('Creating item:', computedItem);
                  return this.client.models.InvoiceItem.create(computedItem).then(res => {
                    console.log('Item create response:', res);  // ADDED
                    if (res.errors) throw new Error(`Item create failed: ${res.errors.map(e => e.message).join(', ')}`);
                    return res;
                  }).catch(err => {
                    console.error('Item create catch:', err);  // ADDED
                    throw err;
                  });
                });
                return from(Promise.all(itemsPromises)).pipe(
                  map(results => {
                    console.log('Items created:', results.length);
                    invoice.items = results.map(r => r.data as InvoiceItem);
                    return invoice;
                  }),
                  catchError(err => {
                    console.error('Items Promise.all error:', err);  // ADDED
                    return throwError(() => err);
                  })
                );
              }),
              switchMap(invoice => {
                const transData: Partial<Transaction> & { accountId: string } = {
                  accountId: invoice.billToId,
                  type: 'charge',
                  date: invoice.date,
                  docNumber: invoice.invoiceNumber,
                  description: `Invoice: ${invoice.description || 'N/A'}`,
                  chargeAmount: invoice.grandTotal,
                  paymentAmount: 0,
                  status: 'pending',
                  tenantId: invoice.billToId,
                  building: invoice.building,
                };
                console.log('Creating linked transaction:', transData);
                return this.createTransaction(transData).pipe(
                  map(transaction => {
                    console.log('Linked transaction created:', transaction);
                    return invoice;
                  })
                );
              })
            );
          })
        );
      }),
      catchError(err => {
        console.error('Invoice creation error:', err);
        return throwError(() => new Error(`Invoice creation failed: ${err.message}`));
      })
    );
  }

  getInvoice(invoiceId: string): Observable<Invoice | null> {
    return from(this.client.models.Invoice.get({ invoiceId })).pipe(
      map(res => res.data as unknown as Invoice),  // UPDATED: Cast
      switchMap(invoice => {
        if (!invoice) return of(null);
        return from(this.client.models.InvoiceItem.list({ filter: { invoiceId: { eq: invoiceId } } })).pipe(
          map(itemsRes => {
            invoice.items = itemsRes.data as InvoiceItem[];
            return invoice;
          })
        );
      })
    );
  }

updateInvoice(invoiceId: string, updates: Partial<Invoice> & { items: Partial<InvoiceItem>[] }): Observable<Invoice | null> {
    return from(this.getInvoice(invoiceId)).pipe(
      switchMap(existing => {
        if (!existing) throw new Error('Invoice not found');
        return from(this.auth.isAdmin()).pipe(
          switchMap(isAdmin => {
            if (!isAdmin) throw new Error('Unauthorized');
            const now = new Date().toISOString();
            const computed: any = {
              ...existing,
              ...updates,
              updatedAt: now,
            };
            return from(this.client.models.Invoice.update(computed)).pipe(
              map(res => res.data as unknown as Invoice),  // UPDATED: Cast
              switchMap(updated => {
                const deletePromises = existing.items?.map(item => this.client.models.InvoiceItem.delete({ invoiceItemId: item.invoiceItemId })) || [];
                return from(Promise.all(deletePromises)).pipe(
                  switchMap(() => {
                    const createPromises = updates.items.map((item: Partial<InvoiceItem>) => {
                      const itemId = crypto.randomUUID();
                      return this.client.models.InvoiceItem.create({ invoiceItemId: itemId, invoiceId, ...item } as any);
                    });
                    return from(Promise.all(createPromises)).pipe(
                      map(results => {
                        updated.items = results.map(r => r.data as InvoiceItem);
                        return updated;
                      })
                    );
                  })
                );
              }),
              switchMap(updated => {
                return this.listTransactions({ accountId: updated.billToId }).pipe(
                  map(trans => trans.find(t => t.docNumber === updated.invoiceNumber)),
                  switchMap(trans => {
                    if (!trans) return of(updated);
                    const amountDiff = updated.grandTotal - (trans.chargeAmount || 0);
                    if (amountDiff === 0) return of(updated);
                    return this.updateTransaction(trans.transactionId, { chargeAmount: updated.grandTotal }).pipe(
                      map(() => updated)
                    );
                  })
                );
              })
            );
          })
        );
      })
    );
  }

  sendInvoice(invoiceId: string): Observable<Invoice | null> {
    return this.getInvoice(invoiceId).pipe(
      switchMap(invoice => {
        if (!invoice) throw new Error('Invoice not found');
        return from(this.auth.isAdmin()).pipe(
          switchMap(isAdmin => {
            if (!isAdmin) throw new Error('Unauthorized');
            return from(this.client.models.Invoice.update({ invoiceId, status: 'open' } as any)).pipe(
              map(res => res.data as unknown as Invoice),  // UPDATED: Cast
              switchMap(updated => {
                const notifyData: any = {
                  userCognitoId: updated.billToId,
                  content: `New invoice ${updated.invoiceNumber} from ${updated.billFromId}`,
                  type: 'invoice',
                  createdAt: new Date().toISOString(),
                  isRead: false,
                };
                return from(this.client.models.Notification.create(notifyData)).pipe(
                  map(() => updated)
                );
              })
            );
          })
        );
      })
    );
  }

listInvoices(filter: { limit?: number; isAdmin?: boolean } = {}): Observable<Invoice[]> {
    return from(this.auth.getUserId()).pipe(
      switchMap(userId => {
        if (!userId) return throwError(() => new Error('No user ID'));
        return from(this.auth.isAdmin()).pipe(
          switchMap(isAdmin => {
            const queryFilter = isAdmin ? {} : { billToId: { eq: userId } };
            return from(this.client.models.Invoice.list({ filter: queryFilter, limit: filter.limit || 100 })).pipe(
              map(res => {
                if (res.errors) throw new Error('Query failed');
                return res.data as unknown as Invoice[];
              }),
              switchMap(invoices => {
                const fetches = invoices.map(inv => 
                  from(this.client.models.InvoiceItem.list({ filter: { invoiceId: { eq: inv.invoiceId } } })).pipe(
                    map(itemsRes => {
                      inv.items = itemsRes.data as InvoiceItem[];  
                      return inv;
                    })
                  )
                );
                return forkJoin(fetches.length ? fetches : [of([])]).pipe( 
                  map(() => invoices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
                );
              })
            );
          })
        );
      }),
      catchError(err => throwError(() => new Error(`List failed: ${err.message}`)))
    );
  }

getCurrentBalance(accountId: string): Observable<number> {
  return from(this.auth.isManager()).pipe(  // ADDED: Check isManager
    switchMap(isManager => {
      if (isManager) {
        // ADDED: Aggregate all balances if manager
        return this.listTransactions({}).pipe(
          map(trans => trans.reduce((sum, t) => sum + t.balance, 0))
        );
      } else {
        return this.getLastBalance(accountId);
      }
    })
  );
}
  payBalance(accountId: string, amount: number): Observable<Transaction | null> {
    return from(this.userService.getPaymentMethods()).pipe(
      switchMap(methods => {
        if (methods.length === 0) throw new Error('No payment method');
        const method = methods[0];
        return this.listTransactions({ accountId, limit: 1000 }).pipe(
          map(trans => trans.filter(t => t.status === 'pending' && t.type === 'charge').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())),
          switchMap(pending => {
            if (pending.length === 0) throw new Error('No pending charges');
            let remaining = amount;
            const updates: Observable<Transaction>[] = [];
            for (const trans of pending) {
              if (remaining <= 0) break;
              const apply = Math.min(remaining, trans.chargeAmount || 0);
              remaining -= apply;
              const newCharge = (trans.chargeAmount || 0) - apply;
              const newStatus = newCharge > 0 ? 'pending' : 'paid';
              updates.push(this.updateTransaction(trans.transactionId, { chargeAmount: newCharge, status: newStatus, balance: trans.balance - apply }) as Observable<Transaction>);
            }
            if (remaining > 0) throw new Error('Payment exceeds pending charges');
            return forkJoin(updates).pipe(
              map(() => null),
              switchMap(() => {
                const payTrans: Partial<Transaction> & { accountId: string } = {
                  accountId,
                  type: 'payment',
                  date: new Date().toISOString().split('T')[0],
                  description: `Partial/Full payment via ${method.type} (${method.name})`,
                  paymentAmount: amount,
                  status: 'paid',
                  method: `${method.type}-${method.name}`,
                  tenantId: accountId,
                };
                return this.createTransaction(payTrans);
              })
            );
          })
        );
      }),
      catchError(err => throwError(() => new Error(`Payment failed: ${err.message}`)))
    );
  }

  getUnpaidBalance(accountId: string): Observable<number> {
    return this.listTransactions({ accountId }).pipe(
      map(trans => trans.filter(t => t.status === 'pending' && t.type === 'charge').reduce((sum, t) => sum + (t.chargeAmount || 0), 0))
    );
  }

  getPaidSummary(accountId: string, period: 'recent' | 'lastYear' = 'recent'): Observable<{ total: number; byCategory?: Record<string, number> }> {
    const startDate = period === 'lastYear' ? new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0] : undefined;
    return this.listTransactions({ accountId, startDate }).pipe(
      map(trans => {
        const payments = trans.filter(t => t.status === 'paid' && t.type === 'payment');
        const total = payments.reduce((sum, t) => sum + (t.paymentAmount || 0), 0);
        const byCategory = payments.reduce((acc, t) => {
          const cat = t.category || 'Uncategorized';
          acc[cat] = (acc[cat] || 0) + (t.paymentAmount || 0);
          return acc;
        }, {} as Record<string, number>);
        return { total, byCategory };
      })
    );
  }

  generatePdf(invoice: Invoice): jsPDF {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`Invoice #${invoice.invoiceNumber}`, 20, 20);
    doc.setFontSize(12);
    doc.text(`Date: ${invoice.date}`, 20, 30);
    doc.text(`From: ${invoice.fromAddress || ''}`, 20, 40);
    doc.text(`To: ${invoice.toAddress || ''}`, 20, 50);
    doc.text(`Description: ${invoice.description || ''}`, 20, 60);

    const tableData = invoice.items?.map(item => [item.name, item.unitPrice, item.units, item.total]) || [];
    (doc as any).autoTable({
      head: [['Name', 'Unit Price', 'Units', 'Total']],
      body: tableData,
      startY: 70,
    });

    doc.text(`Subtotal: $${invoice.subtotal}`, 140, (doc as any).lastAutoTable.finalY + 10);
    doc.text(`Tax: $${invoice.tax}`, 140, (doc as any).lastAutoTable.finalY + 20);
    doc.text(`Grand Total: $${invoice.grandTotal}`, 140, (doc as any).lastAutoTable.finalY + 30);

    return doc;
  }
}