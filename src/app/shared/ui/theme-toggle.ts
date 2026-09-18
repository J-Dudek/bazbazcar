import { Component, inject } from '@angular/core';
import { Theme, ThemePreference } from '../../core/theme/theme';

@Component({
  selector: 'app-theme-toggle',
  templateUrl: './theme-toggle.html',
})
export class ThemeToggle {
  protected readonly theme = inject(Theme);

  definir(preference: ThemePreference): void {
    this.theme.definir(preference);
  }
}
