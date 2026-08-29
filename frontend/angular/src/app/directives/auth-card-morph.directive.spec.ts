import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { Subject } from 'rxjs';

import { AuthCardMorphDirective } from './auth-card-morph.directive';

@Component({
  imports: [AuthCardMorphDirective],
  template: `<section class="auth-card">card</section>`,
})
class HostComponent {}

describe('AuthCardMorphDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  const events = new Subject<NavigationStart | NavigationEnd>();

  const card = () =>
    fixture.nativeElement.querySelector('.auth-card') as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: Router, useValue: { events } }],
    });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('keeps the morph while navigating between the auth pages', () => {
    events.next(new NavigationStart(1, '/register'));

    expect(card().style.viewTransitionName).toBe('');
  });

  it('drops the morph when navigation leaves the auth pages', () => {
    events.next(new NavigationStart(1, '/home'));

    expect(card().style.viewTransitionName).toBe('none');
  });

  it('ignores navigation events other than the start of one', () => {
    events.next(new NavigationEnd(1, '/home', '/home'));

    expect(card().style.viewTransitionName).toBe('');
  });

  it('stops reacting once the host is gone', () => {
    fixture.destroy();

    expect(() => events.next(new NavigationStart(2, '/home'))).not.toThrow();
  });
});
