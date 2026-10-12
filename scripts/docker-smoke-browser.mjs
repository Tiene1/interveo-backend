// Parcours d'un visiteur dans un vrai navigateur (Chrome), appele par
// scripts/docker-smoke.sh une fois la pile demarree : connexion au back-office,
// liste des interventions, ouverture de celle creee par le test, affichage de
// sa photo. Verifie ce que curl ne voit pas : le site construit, son adresse
// d'API integree, le CORS avec l'en-tete Authorization et le chargement des
// photos par blob.
//
// Variables : WEB_URL, INTERVENTION_ID, NOM_CLIENT, CAPTURES (dossier des
// captures d'ecran en cas d'echec). Necessite `playwright-core` et Chrome.
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const { WEB_URL, INTERVENTION_ID, NOM_CLIENT, CAPTURES } = process.env;
for (const [nom, valeur] of Object.entries({ WEB_URL, INTERVENTION_ID, NOM_CLIENT })) {
  if (!valeur) throw new Error(`variable ${nom} manquante`);
}

const problemes = [];
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
page.on('pageerror', (e) => problemes.push(`erreur de page : ${e.message}`));
page.on('requestfailed', (r) =>
  problemes.push(`requete echouee : ${r.method()} ${r.url()} (${r.failure()?.errorText})`),
);
page.on('response', (r) => {
  if (r.status() >= 400) problemes.push(`HTTP ${r.status()} : ${r.request().method()} ${r.url()}`);
});

const delai = { timeout: 30_000 };
const etape = (texte) => console.log(`  OK  navigateur : ${texte}`);

try {
  await page.goto(`${WEB_URL}/connexion`, delai);
  await page.fill('#identifiant', 'kouassi');
  await page.fill('#mot-de-passe', 'directeur123');
  await page.click('button[type=submit]');
  await page.waitForURL('**/interventions', delai);
  etape('connexion du directeur depuis la page /connexion, redirection vers /interventions');

  await page.getByText(NOM_CLIENT).first().waitFor(delai);
  etape(`la liste affiche l'intervention creee par le test (${NOM_CLIENT})`);

  await page.getByText(NOM_CLIENT).first().click();
  await page.waitForURL(`**/interventions/detail?id=${INTERVENTION_ID}*`, delai);
  etape('ouverture du detail de l\'intervention');

  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('img')].some(
        (img) => img.src.startsWith('blob:') && img.naturalWidth > 0,
      ),
    null,
    delai,
  );
  etape('la photo envoyee par le technicien s\'affiche (chargee par l\'API avec le jeton)');
} catch (erreur) {
  console.error(`ECHEC du parcours navigateur : ${erreur.message}`);
  console.error(`URL courante : ${page.url()}`);
  console.error(`Texte de la page :\n${(await page.innerText('body').catch(() => '')).slice(0, 1500)}`);
  if (CAPTURES) {
    mkdirSync(CAPTURES, { recursive: true });
    await page.screenshot({ path: `${CAPTURES}/echec-navigateur.png`, fullPage: true }).catch(() => {});
  }
  if (problemes.length) console.error(`Problemes reseau/console :\n- ${problemes.join('\n- ')}`);
  await browser.close();
  process.exit(1);
}

await browser.close();
if (problemes.length) {
  console.error(`Problemes reseau/console pendant le parcours :\n- ${problemes.join('\n- ')}`);
  process.exit(1);
}
etape('aucune erreur reseau ni de page pendant tout le parcours');
