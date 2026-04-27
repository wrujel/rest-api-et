import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-auth-hero',
  templateUrl: './auth-hero.component.html',
  styleUrl: './auth-hero.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthHeroComponent {}
