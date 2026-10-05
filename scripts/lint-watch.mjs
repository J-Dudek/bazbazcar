#!/usr/bin/env node
// Relance `npm run lint` à chaque modification d'un .ts ou .html de src/.
// Remplace chokidar-cli (non maintenu, dépendance `braces` vulnérable sans
// correctif) : fs.watch récursif est natif depuis Node 20 sur Linux/macOS/Windows.
//
// Usage : npm run lint:watch   (lancé aussi par `npm run dev`)
import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../src', import.meta.url));
const root = fileURLToPath(new URL('..', import.meta.url));

let lint = null;
let relancer = false;
let minuteur = null;

function lancer() {
  // Un lint déjà en cours : on le laisse finir, puis on relance une seule fois.
  if (lint) {
    relancer = true;
    return;
  }
  lint = spawn('npm', ['run', 'lint'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  lint.on('exit', () => {
    lint = null;
    if (relancer) {
      relancer = false;
      lancer();
    }
  });
}

watch(src, { recursive: true }, (_evenement, fichier) => {
  if (!fichier || !/\.(ts|html)$/.test(fichier)) return;
  clearTimeout(minuteur);
  minuteur = setTimeout(lancer, 300);
});

lancer();
