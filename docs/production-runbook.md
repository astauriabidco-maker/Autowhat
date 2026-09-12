# Production Runbook

Runbook court pour preparer une beta/production Autowhat. Il ne remplace pas les tests P0, mais donne la checklist operationnelle minimale.

## Checklist Env Production

### Preproduction Coolify

Le serveur Coolify actuellement vise la preproduction, pas la production client finale.

Domaines preproduction:

- Frontend: `https://testbed.whatspoint.com`
- Backend/API: `https://api.testbed.whatspoint.com`

Configuration a poser dans Coolify:

- utiliser `.env.preproduction.example` comme template de variables;
- garder `NODE_ENV=production`, car l'image doit tourner avec les garde-fous production;
- ajouter `APP_ENV=preproduction` pour distinguer les logs, prefixes Redis et procedures;
- definir `FRONTEND_URL=https://testbed.whatspoint.com`;
- definir `BACKEND_URL=https://api.testbed.whatspoint.com`;
- definir `BASE_URL=https://api.testbed.whatspoint.com`;
- definir `APP_URL=https://testbed.whatspoint.com`;
- definir `CORS_ORIGINS=https://testbed.whatspoint.com`;
- generer des secrets preprod distincts de production pour `JWT_SECRET`, `ENCRYPTION_KEY`, `FILE_URL_SECRET`, `LOG_HASH_SECRET`, `WEBHOOK_VERIFY_TOKEN` et `WHATSAPP_APP_SECRET`;
- verifier que `ENCRYPTION_KEY` fait exactement 32 caracteres;
- verifier que `AUTH_COOKIE_SECURE=true`.

Avant de redeployer sur Coolify, lancer `npm run env:check` avec les variables Coolify preprod. L'erreur vue au deploy du 12 septembre 2026 venait de variables preprod absentes, pas d'un bug applicatif.

### Production client

Variables obligatoires:

- `NODE_ENV=production`
- `DEMO_MODE=false` sauf environnement de demonstration explicitement annonce
- `SERVE_FRONTEND=true` si le backend sert le build Vite
- `DATABASE_URL` vers la base Postgres production
- `JWT_SECRET` long, aleatoire, different de dev
- `ENCRYPTION_KEY` aleatoire, exactement 32 caracteres, conserve hors Git
- `FILE_URL_SECRET` long, aleatoire, different de `JWT_SECRET`
- `LOG_HASH_SECRET` long, aleatoire, different de `JWT_SECRET`, utilise pour correler les logs sans exposer de PII
- `FRONTEND_URL`, `BACKEND_URL`, `BASE_URL`, `APP_URL` avec URLs HTTPS publiques
- `CORS_ORIGINS` strictement limite aux domaines de production
- `AUTH_COOKIE_SECURE=true`
- `AUTH_COOKIE_CROSS_SITE=true` seulement si frontend et backend sont sur des domaines differents
- `AUTH_COOKIE_SAME_SITE=lax` pour meme site, `none` seulement avec cookies cross-site securises

Variables selon modules actifs:

- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_ENTERPRISE`
- WhatsApp/Meta: `WHATSAPP_TOKEN`, `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_VERIFY_TOKEN`
- Email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` ou `SENDGRID_API_KEY`
- Redis/queues/rate limits: `USE_REDIS=true`, `REDIS_URL`, `QUEUE_RATE_LIMIT`, `RATE_LIMIT_STORE=redis`, `RATE_LIMIT_REDIS_PREFIX`
- IA/SMS: `OPENAI_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`

Avant deploy:

- Ne jamais reutiliser les secrets de `.env.example`.
- Utiliser `.env.production.example` comme checklist de variables, mais stocker les valeurs reelles dans le secret manager de l'hebergeur.
- Lancer `npm run env:check` avec les variables de l'environnement de production; la commande doit passer avant migration/start. Le script `scripts/start-prod.sh` relance aussi ce controle avec le code compile avant `prisma migrate deploy`.
- Verifier que `.env` n'est pas suivi par Git.
- Verifier que les logs applicatifs ne contiennent pas tokens, secrets, payloads WhatsApp complets ou donnees RH inutiles.
- Definir une procedure de rotation pour `JWT_SECRET`, `ENCRYPTION_KEY`, tokens WhatsApp, Stripe et SMTP.

## Flags A Prevoir

Ajouter ou utiliser des flags explicites pour separer production reelle, beta et demo:

- `ENABLE_JOBS`: demarrer crons/workers seulement sur l'instance designee.
- `DEMO_MODE`: autoriser les donnees et reponses simulees uniquement en demo declaree. Valeur production client: `false`.
- `ENABLE_AI_AGENTS`: activer les fonctions IA. En production, les fallbacks OCR/NLP/RAG simules sont refuses sauf `DEMO_MODE=true`.
- `ENABLE_KPAIE`: activer l'integration paie. En production sans config tenant KPaie, aucun solde simule n'est renvoye sauf `DEMO_MODE=true`.
- `ENABLE_DYNAMIC_NUMBER_PROVISIONING`: reserver au futur provisioning reel Twilio/Meta. Le code actuel de provisioning dedie reste une simulation et exige `DEMO_MODE=true` en production.
- `ENABLE_META_EMBEDDED_SIGNUP`: reserver au futur OAuth/Embedded Signup Meta reel. Le callback actuel simule l'echange token et exige `DEMO_MODE=true` en production.
- `ENABLE_LEGACY_OPERATIONS`: reactiver temporairement l'ancien perimetre CRM/FSM si besoin de support ou migration. Valeur production client: `false`.
- `ENABLE_FRONTEND_DIAGNOSTICS`: exposer `/api/frontend-diagnostics` uniquement si necessaire.

Regle: un comportement mocke ne doit pas etre actif en production client sans flag explicite et communication produit claire.

## Comportement Des Mocks

En developpement (`NODE_ENV!=production`), les helpers de demo restent actifs par defaut pour garder les parcours locaux utilisables.

En production client:

- `DEMO_MODE=false`
- `ENABLE_AI_AGENTS=true` uniquement si `OPENAI_API_KEY` est configuree et que les usages IA sont assumes produit.
- `ENABLE_KPAIE=true` uniquement si chaque tenant concerne a une configuration KPaie valide.
- `ENABLE_DYNAMIC_NUMBER_PROVISIONING=false` tant que l'achat Twilio et l'enregistrement Meta ne sont pas vraiment implementes.
- `ENABLE_META_EMBEDDED_SIGNUP=false` tant que l'echange OAuth Meta reel n'est pas implemente.
- `ENABLE_LEGACY_OPERATIONS=false` pour garder WhatsPoint centre sur pointage, presence, GPS, planning simple, justificatifs et exports RH/paie. Ce flag bloque les routes clients, interventions, dispatch, demandes client WhatsApp, devis, pieces/stock, rapports d'intervention et recurrents, ainsi que le cron de generation d'interventions recurrentes.

En production demo/sales, `DEMO_MODE=true` peut etre utilise, mais l'environnement doit etre separe d'une production client et les reponses simulees doivent etre annoncees.

## Migration

Procedure standard:

1. Sauvegarder la base avant migration.
2. Deployer l'image applicative construite depuis le commit valide.
3. Laisser le script de demarrage executer `npx prisma migrate deploy`.
4. Verifier les logs de migration.
5. Lancer un smoke test manuel:
   - `/api/health`
   - login superadmin
   - login manager
   - lecture dashboard
   - upload document
   - URL fichier signee
   - webhook Stripe en mode test
   - verification webhook Meta

Interdits:

- Ne jamais utiliser `npm run db:push` ou `prisma db push` en production.
- Ne jamais modifier la base production a la main sans ticket incident ou procedure ecrite.

## PRISMA_RESOLVE_APPLIED_MIGRATION

`PRISMA_RESOLVE_APPLIED_MIGRATION` est reserve aux incidents de migration Prisma.

Utilisation autorisee seulement si:

- la migration a deja ete appliquee manuellement ou par un deploy precedent,
- Prisma refuse de la considerer comme appliquee,
- un snapshot/backup vient d'etre realise,
- le nom exact de migration a ete verifie,
- l'action est documentee dans le journal d'incident.

Apres resolution:

1. Retirer immediatement `PRISMA_RESOLVE_APPLIED_MIGRATION` de l'environnement.
2. Redeployer ou redemarrer sans cette variable.
3. Verifier que `npx prisma migrate deploy` passe sans resolution forcee.

Cette variable ne doit jamais rester configuree en permanence dans Coolify ou tout autre hebergeur.

## Rollback

Rollback applicatif:

1. Identifier le dernier commit/image stable.
2. Verifier si le deploy courant a applique une migration.
3. Si aucune migration incompatible n'a ete appliquee, redeployer l'image stable.
4. Lancer les smoke tests.

Rollback avec migration:

- Prisma ne gere pas automatiquement les down migrations.
- Preferer un correctif forward si les donnees sont intactes.
- Restaurer la base seulement si la migration a corrompu ou bloque les donnees.
- Toujours sauvegarder l'etat casse avant restauration pour analyse.

Decision rapide:

- Bug UI/API sans schema DB: rollback image.
- Bug schema compatible: correctif forward.
- Corruption donnees ou migration bloquante: incident, freeze deploy, restore ou correction manuelle controlee.

## Backup Postgres

Minimum beta:

- backup quotidien `pg_dump` ou snapshot hebergeur,
- retention 7 jours minimum,
- chiffrement au repos,
- stockage hors machine applicative,
- alerte en cas d'echec,
- test de restauration au moins avant ouverture beta puis mensuel.

Script projet:

```sh
npm run db:backup -- --help
```

Variables:

- `DATABASE_URL`: base source par defaut.
- `BACKUP_DATABASE_URL`: optionnel, surcharge la base source.
- `BACKUP_DIR`: optionnel, dossier de sortie. Defaut: `./backups`.

Dry-run sans creation de fichier:

```sh
npm run db:backup -- --dry-run
```

Backup reel avec nom automatique:

```sh
BACKUP_DIR=/secure/backups npm run db:backup
```

Backup reel avec chemin explicite:

```sh
npm run db:backup -- --file /secure/backups/autowhat-20260911.dump
```

Le script utilise `pg_dump --format=custom --no-owner --no-privileges`, adapte aux restaurations avec `pg_restore`.

Ne pas stocker durablement les dumps dans le conteneur applicatif. Copier les sauvegardes vers un stockage hors machine applicative, idealement chiffre et surveille.

## Validation Redis Rate Limit

Les tests automatises valident le store Redis avec un faux client Redis deterministe:

```sh
npm run test -- tests/services/redisRateLimitStore.test.ts
```

Ils couvrent:

- increment des compteurs,
- TTL par fenetre,
- expiration,
- `resetKey`,
- `resetAll` par scope,
- comportement `passOnStoreError=true/false`.

Validation quasi reelle avec Redis local:

1. Demarrer Redis localement ou via Docker:

```sh
docker run --rm -p 6379:6379 redis:7-alpine
```

2. Configurer l'application:

```sh
export NODE_ENV=production
export USE_REDIS=true
export REDIS_URL=redis://localhost:6379
export RATE_LIMIT_STORE=redis
export RATE_LIMIT_REDIS_PREFIX=whatspoint:rate-limit
export RATE_LIMIT_REDIS_PASS_ON_ERROR=false
```

3. Lancer le backend puis appeler plusieurs fois une route limitee, par exemple un endpoint auth ou webhook, jusqu'au `429`.

4. Verifier les cles Redis:

```sh
redis-cli keys 'whatspoint:rate-limit:*'
redis-cli pttl 'whatspoint:rate-limit:auth:<client-key>'
```

5. En multi-instance, garder `RATE_LIMIT_STORE=redis`; le store memoire n'est acceptable que pour dev, test ou instance unique.

Politique d'incident:

- `RATE_LIMIT_REDIS_PASS_ON_ERROR=false` est le defaut recommande en production: si Redis tombe, les endpoints critiques restent proteges par refus.
- `RATE_LIMIT_REDIS_PASS_ON_ERROR=true` ne doit etre utilise que temporairement si la disponibilite prime sur la protection anti-abus, avec surveillance renforcee.

## Restore Postgres

Procedure type:

1. Declarer l'incident et bloquer les ecritures si possible.
2. Sauvegarder l'etat courant, meme casse.
3. Creer une base de restauration separee.
4. Definir `RESTORE_DATABASE_URL` vers cette base separee.
5. Simuler la restauration:

```sh
npm run db:restore -- --file /secure/backups/autowhat-20260911.dump
```

6. Executer la restauration seulement apres verification de la commande:

```sh
RESTORE_DATABASE_URL="postgres://..." npm run db:restore -- --file /secure/backups/autowhat-20260911.dump --apply
```

7. Ajouter `--clean` seulement si la base cible peut etre nettoyee:

```sh
RESTORE_DATABASE_URL="postgres://..." npm run db:restore -- --file /secure/backups/autowhat-20260911.dump --apply --clean
```

8. Verifier les donnees critiques: tenants, users, employees, attendance, documents, billing.
9. Basculer `DATABASE_URL` seulement apres validation.
10. Lancer smoke tests.

Le restore est volontairement en dry-run par defaut. Le script refuse d'utiliser `DATABASE_URL` comme cible et exige `RESTORE_DATABASE_URL` pour reduire le risque de restauration accidentelle sur la production.

## Uploads Et Fichiers

Etat actuel attendu:

- les uploads peuvent etre montes en volume Docker sous `/app/uploads`,
- l'acces direct aux uploads doit rester bloque,
- les fichiers sensibles doivent passer par des URLs signees.

Pour production durable:

- preferer S3/MinIO ou stockage objet equivalent,
- sauvegarder les fichiers avec la meme strategie que la base,
- verifier la restauration base + fichiers ensemble,
- ne jamais exposer `/uploads` publiquement,
- purger recursivement les sous-dossiers (`documents`, `signatures`, medias).

Point de vigilance: une restauration DB sans les fichiers correspondants casse documents, signatures et pieces jointes.

## Secrets

Regles:

- Secrets longs, aleatoires, uniques par environnement.
- Aucun secret dans Git, tickets, captures d'ecran ou logs.
- Rotation documentee pour chaque fournisseur.
- Acces limite aux personnes qui deployent.
- Tokens WhatsApp BYON et credentials integration a chiffrer au repos.

Avant beta client:

- remplacer tout bypass OTP de dev,
- remplacer tout token test,
- verifier Stripe en mode live seulement quand les webhooks live sont valides,
- verifier que les queues Redis ne stockent pas de credentials complets plus longtemps que necessaire.

## Checklist Pre-Beta

- Build backend et frontend valides.
- `prisma migrate deploy` valide sur base fraiche.
- `prisma migrate deploy` valide sur copie d'une base existante.
- Superadmin cree avec mot de passe fort puis secret retire de l'env si possible.
- Rate limiting active sur auth, OTP, reset password et webhooks publics.
- Rate limiting branche sur Redis en multi-instance (`USE_REDIS=true`, `RATE_LIMIT_STORE=redis`), avec `RATE_LIMIT_REDIS_PASS_ON_ERROR=false` sauf choix incident explicite.
- Webhook WhatsApp signe et logs PII reduits.
- Webhook Stripe signe et teste.
- Backup Postgres configure et restaure au moins une fois.
- Strategie uploads validee.
- Flags demo/mock desactives ou clairement declares.
- Runbook incident accessible a l'equipe.
