'use strict';
/* Bibliothèque commune des micro-tests du banc d'essai (docs/ref/banc.md). Un micro-test = un fichier <nom>.test.js :
     require('./lib.js').essai('nom', async ({ ouvrir, ok }) => { const page = await ouvrir({ inverse: true }); ok('ce qui est vérifié', condition, info); });
   Sortie : une ligne `ok` ou `FAIL` par assertion, puis `PASS` ou `FAIL (n)` ; code de sortie 0 si tout passe (aucune erreur de page non plus).
   Playwright : trouvé seul (dossier global de npm), sans NODE_PATH. Moteur essayé : variable MOTEUR (dossier engine/, chemin absolu ou relatif à banc.html), défaut le moteur de ce dépôt. */
const fs = require('fs'), os = require('os'), path = require('path'), { execSync } = require('child_process');
let pw; try { pw = require('playwright'); } catch (e) { pw = require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); }
const { construire, ecrire } = require('./constructeur.js');
const PAGE = path.join(__dirname, 'banc.html');
const MOTEUR = process.env.MOTEUR ? '&moteur=' + encodeURIComponent(process.env.MOTEUR) : '';

async function essai(nom, corps) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'banc-')), errors = [], out = []; let fails = 0, browser;
  const ok = (name, c, info) => { if (!c) fails++; out.push((c ? 'ok   ' : 'FAIL ') + name + (!c && info !== undefined ? ' ' + JSON.stringify(info) : '')); };
  const ouvrir = async (opt, ex) => { // nouvelle page sur un mini-site fabriqué ; ex facultatif : { width, height, mode: 'sandbox' (défaut) | 'career' }
    const f = ecrire(fs.mkdtempSync(path.join(tmp, 's')), opt);
    const page = await browser.newPage({ viewport: { width: (ex && ex.width) || 800, height: (ex && ex.height) || 600 } });
    page.on('pageerror', e => errors.push(String(e.message || e).slice(0, 200)));
    await page.addInitScript(() => { try { for (const k of Object.keys(localStorage)) if (k.startsWith('t2z.save.')) localStorage.removeItem(k); } catch (e) {} });
    await page.goto('file://' + PAGE + '?site=' + encodeURIComponent(f) + MOTEUR + '&mode=' + ((ex && ex.mode) || 'sandbox'));
    await page.waitForFunction(() => window.G && typeof act === 'function', null, { timeout: 15000 });
    await page.evaluate(() => { try { act('closeHelp'); } catch (e) {} act('speed', 0); G.wx.next = 1e6; });
    return page;
  };
  try { browser = await pw.chromium.launch(); await corps({ ouvrir, ok, construire }); }
  catch (e) { fails++; out.push('FAIL exception ' + String(e && e.message || e).split('\n')[0]); }
  if (browser) await browser.close();
  if (errors.length) { fails++; out.push('FAIL pageerror ' + errors.slice(0, 2).join(' | ')); }
  console.log(out.join('\n')); console.log(fails ? 'FAIL (' + fails + ')' : 'PASS');
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(fails ? 1 : 0);
}
module.exports = { essai, pw };
