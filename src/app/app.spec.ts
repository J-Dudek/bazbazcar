import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    // jsdom n'implémente pas matchMedia, que PwaInstall (popin d'installation) appelle.
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query }));
    await TestBed.configureTestingModule({
      imports: [App],
      // `enabled: false` : SwUpdate (PwaUpdate) a besoin du provider pour
      // s'injecter, mais on ne veut pas d'un vrai service worker dans les tests.
      providers: [provideRouter([]), provideServiceWorker('ngsw-worker.js', { enabled: false })],
    }).compileComponents();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the router outlet', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('should render a single header, outside the routed pages', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('app-header').length).toBe(1);
  });
});
