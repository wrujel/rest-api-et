import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { ApiTestDialogComponent } from './api-test-dialog.component';
import { PRODUCT_ENDPOINTS } from '../../models/api-docs';

describe('ApiTestDialogComponent', () => {
  let component: ApiTestDialogComponent;
  let fixture: ComponentFixture<ApiTestDialogComponent>;

  beforeEach(async () => {
    localStorage.removeItem('accessToken');
    await TestBed.configureTestingModule({
      imports: [ApiTestDialogComponent],
      providers: [
        provideHttpClient(),
        provideNoopAnimations(),
        { provide: MAT_DIALOG_DATA, useValue: PRODUCT_ENDPOINTS[1] },
        { provide: MatDialogRef, useValue: { close: () => undefined } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ApiTestDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('refuses to send without a token when the endpoint requires auth', async () => {
    await component.send();
    expect(component['sendError']()).toContain('Bearer token');
    expect(component['result']()).toBeNull();
  });

  it('refuses to send an invalid JSON body', async () => {
    component['tokenControl'].setValue('fake-token');
    component['bodyControl'].setValue('{ not json');
    await component.send();
    expect(component['sendError']()).toContain('not valid JSON');
  });
});
