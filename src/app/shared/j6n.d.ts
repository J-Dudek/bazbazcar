/**
 * `design-j6n`/theme.js est chargé comme script global (pas un module ES) —
 * voir angular.json `architect.build.options.scripts`.
 */
declare const j6n: {
  init(root?: Document | Element): void;
  toast(
    message: string,
    options?: { tone?: 'success' | 'danger' | 'warning'; duration?: number },
  ): void;
  openModal(id: string): void;
  closeModal(id: string): void;
};
