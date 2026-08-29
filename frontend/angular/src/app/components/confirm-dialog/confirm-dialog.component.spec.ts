import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from './confirm-dialog.component';
import { query, queryAll, text } from '../../../testing/dom';

describe('ConfirmDialogComponent', () => {
  let fixture: ComponentFixture<ConfirmDialogComponent>;
  const close = vi.fn();

  const render = (data: ConfirmDialogData) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ConfirmDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.detectChanges();
    return fixture;
  };

  const buttons = () => queryAll<HTMLButtonElement>(fixture, 'button');

  beforeEach(() => close.mockClear());

  it('renders the title and message it was handed', () => {
    render({ title: 'Delete this?', message: 'It cannot be undone.' });

    expect(text(fixture)).toContain('Delete this?');
    expect(text(fixture)).toContain('It cannot be undone.');
  });

  it('falls back to neutral labels and the help icon', () => {
    render({ title: 'T', message: 'M' });

    expect(buttons().map((b) => b.textContent?.trim())).toEqual([
      'Cancel',
      'Confirm',
    ]);
    expect(query(fixture, 'mat-icon')?.textContent).toBe('help');
    expect(
      query(fixture, '.confirm-dialog')?.classList.contains('is-danger'),
    ).toBe(false);
  });

  it('uses the warning icon and danger styling for a destructive prompt', () => {
    render({ title: 'T', message: 'M', danger: true });

    expect(query(fixture, 'mat-icon')?.textContent).toBe('warning');
    expect(
      query(fixture, '.confirm-dialog')?.classList.contains('is-danger'),
    ).toBe(true);
  });

  it('prefers an explicit icon and explicit labels', () => {
    render({
      title: 'T',
      message: 'M',
      danger: true,
      icon: 'delete',
      confirmLabel: 'Delete it',
      cancelLabel: 'Keep it',
    });

    expect(query(fixture, 'mat-icon')?.textContent).toBe('delete');
    expect(buttons().map((b) => b.textContent?.trim())).toEqual([
      'Keep it',
      'Delete it',
    ]);
  });

  it('closes with false when cancelled', () => {
    render({ title: 'T', message: 'M' });

    buttons()[0].click();

    expect(close).toHaveBeenCalledWith(false);
  });

  it('closes with true when confirmed', () => {
    render({ title: 'T', message: 'M' });

    buttons()[1].click();

    expect(close).toHaveBeenCalledWith(true);
  });
});
