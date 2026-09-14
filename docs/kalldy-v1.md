# Kalldy Connector v1

## Positionnement

`KALLDY_V1` est le contrat d'integration WhatsPoint x Kalldy issu du POC valide. Il s'appuie sur les webhooks sortants WhatsPoint, mais fixe une convention partenaire stable pour l'exploitation.

WhatsPoint reste le canal terrain:

- notification collaborateur;
- collecte d'elements simples;
- validation manager;
- redirection vers la PWA Kalldy pour les donnees sensibles.

Kalldy reste le systeme de paie et l'espace securise pour RIB, NIR, bulletins, pieces d'identite et donnees equivalentes.

## Evenements v1

Les evenements obligatoires du connecteur v1 sont:

- `leave.approved`
- `document.received`
- `employee.secure_link.requested`

Le webhook Kalldy doit etre tenant-scope et actif sur ces trois evenements.

## Environnements

Sandbox:

```text
https://api.testbed.fr.paie.kalldy.com/api/webhooks/whatspoint
```

Production:

```text
https://api.fr.paie.kalldy.com/api/webhooks/whatspoint
```

Chaque environnement doit avoir ses propres cles API, secrets HMAC, webhooks et journaux.

## Securite

WhatsPoint signe chaque webhook avec:

- `X-WhatsPoint-Event`
- `X-WhatsPoint-Event-Id`
- `X-WhatsPoint-Timestamp`
- `X-WhatsPoint-Signature`

La signature est:

```text
sha256=<hmac_sha256(raw_json_body, webhook_secret)>
```

Le secret HMAC est affiche une seule fois lors de la creation ou regeneration du webhook. Les listings, details et logs ne doivent jamais exposer le secret.

## Observabilite

Le statut superadmin du connecteur Kalldy v1 expose:

- version du contrat;
- evenements requis;
- endpoint sandbox/production detecte;
- webhooks actifs;
- compteur succes/echec;
- derniere livraison;
- statut HTTP;
- latence;
- evenements manquants.

Etats possibles:

- `healthy`: dernier webhook reussi et contrat complet;
- `configured`: contrat complet, pas encore de livraison observee;
- `partial`: webhook actif mais evenement requis manquant;
- `degraded`: derniere livraison en echec;
- `disabled`: webhook Kalldy present mais inactif;
- `not_configured`: aucun webhook Kalldy detecte.

## Regles PII

Le connecteur v1 interdit le transit WhatsApp des donnees suivantes:

- RIB;
- NIR;
- bulletin;
- piece d'identite;
- donnees medicales detaillees;
- libelle document revelateur;
- reference sensible de paie.

Les medias simples doivent transiter par `mediaId` et URL temporaire signee, sans base64.

## Reference POC

La validation du POC et les payloads finaux sont conserves dans `docs/kalldy-poc.md`.
