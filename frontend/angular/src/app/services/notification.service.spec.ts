import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';

import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  const open = vi.fn();

  beforeEach(() => {
    open.mockClear();
    TestBed.configureTestingModule({
      providers: [{ provide: MatSnackBar, useValue: { open } }],
    });
    service = TestBed.inject(NotificationService);
  });

  it('shows a plain info toast with the shared placement', () => {
    service.info('Saved');

    expect(open).toHaveBeenCalledWith('Saved', 'OK', {
      duration: 4200,
      horizontalPosition: 'end',
      verticalPosition: 'top',
    });
  });

  it('tags a success toast with its panel class', () => {
    service.success('Created');

    expect(open).toHaveBeenCalledWith(
      'Created',
      'OK',
      expect.objectContaining({ panelClass: ['app-snackbar-success'] }),
    );
  });

  it('gives an error toast a dismiss action and a longer dwell', () => {
    service.error('Boom');

    expect(open).toHaveBeenCalledWith(
      'Boom',
      'Dismiss',
      expect.objectContaining({
        duration: 6500,
        panelClass: ['app-snackbar-error'],
      }),
    );
  });
});
