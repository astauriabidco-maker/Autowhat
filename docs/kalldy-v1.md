# Kalldy Connector v1

## Positionnement

`KALLDY_V1` est le contrat d'integration WhatsPoint x Kalldy issu du POC valide. Il s'appuie sur les webhooks sortants WhatsPoint, mais fixe une convention partenaire stable pour l'exploitation.

WhatsPoint reste le canal terrain:

- notification collaborateur;
- collecte d'elements simples;
- validation manager;
- redirection vers la PWA Kalldy pour les donnees sensibles.

Kalldy reste le systeme de paie et l'espace securise pour RIB, NIR, bulletins, pieces d'identite et donnees equivalentes.

## URLs de reference

- API REST v1 sandbox WhatsPoint: `https://api.testbed.whatspoint.com/api/v1`
- OpenAPI sandbox: `https://api.testbed.whatspoint.com/api/docs/public-v1.yaml`
- Console superadmin sandbox: `https://testbed.whatspoint.com/superadmin/integrations`
- Webhook sortant Kalldy sandbox: `https://api.testbed.fr.paie.kalldy.com/api/webhooks/whatspoint`
- Webhook sortant Kalldy production cible: `https://api.fr.paie.kalldy.com/api/webhooks/whatspoint`

Chaque environnement doit avoir ses propres cles API, secrets HMAC, webhooks et journaux.

## Evenements v1

Les evenements obligatoires du connecteur v1 sont:

- `leave.approved`
- `document.received`
- `employee.secure_link.requested`

Le webhook Kalldy doit etre tenant-scope. Chaque evenement peut etre active ou desactive par tenant depuis `/superadmin/integrations`.

Regles d'emission:

- WhatsPoint n'envoie un evenement Kalldy v1 que si le webhook du tenant ecoute explicitement cet evenement.
- Un webhook Kalldy global, sans `tenantId`, est refuse pour les evenements v1.
- Un evenement non active contractuellement ne doit pas sortir, meme si le webhook existe techniquement.
- Le passage sandbox -> production doit conserver des webhooks, secrets et activations separes.

## Payloads v1

### `leave.approved`

```json
{
  "eventId": "wp_evt_123",
  "event": "leave.approved",
  "timestamp": "2026-06-01T10:00:00.000Z",
  "tenantId": "699e8c48-4632-425f-a248-6c8aedbebc15",
  "data": {
    "leaveRequestId": "leave_123",
    "employeeId": "emp_123",
    "employeeName": "Camille Martin",
    "employeePhoneNumber": "+33612345678",
    "startDate": "2026-06-10",
    "endDate": "2026-06-17",
    "businessDays": 6,
    "status": "APPROVED",
    "isHalfDayStart": false,
    "isHalfDayEnd": false,
    "managerComment": "Validation POC"
  }
}
```

### `document.received`

```json
{
  "eventId": "wp_evt_456",
  "event": "document.received",
  "timestamp": "2026-06-01T10:05:00.000Z",
  "tenantId": "699e8c48-4632-425f-a248-6c8aedbebc15",
  "data": {
    "documentId": "doc_123",
    "employeeId": "emp_123",
    "employeeName": "Camille Martin",
    "employeePhoneNumber": "+33612345678",
    "documentType": "absence_justification",
    "fileName": "justificatif-absence-poc.pdf",
    "mimeType": "application/pdf",
    "fileSizeBytes": 245760,
    "mediaId": "doc_123",
    "mediaUrl": "https://api.testbed.whatspoint.com/api/files/signed/poc-document-token",
    "mediaUrlExpiresAt": "2026-06-01T10:20:00.000Z"
  }
}
```

Le fichier n'est pas transmis en base64. `mediaId` est la reference durable cote WhatsPoint; `mediaUrl` est une URL temporaire signee a telecharger rapidement.

### `employee.secure_link.requested`

```json
{
  "eventId": "wp_evt_789",
  "event": "employee.secure_link.requested",
  "timestamp": "2026-06-01T10:10:00.000Z",
  "tenantId": "699e8c48-4632-425f-a248-6c8aedbebc15",
  "data": {
    "employeeRef": "emp_poc_001",
    "employeePhoneNumber": "+33612345678",
    "purpose": "PROFILE_UPDATE",
    "deliveryChannel": "whatsapp",
    "secureLink": "https://testbed.fr.paie.kalldy.com/pwa/secure-intake/poc-token",
    "secureLinkExpiresAt": "2026-06-01T10:40:00.000Z",
    "sensitiveDataInWhatsApp": false,
    "messageTemplate": {
      "name": "kalldy_secure_pwa_relaunch_fr",
      "language": "fr",
      "variables": {
        "firstName": "Camille",
        "expiresInMinutes": 30
      }
    }
  }
}
```

Ce flux sert uniquement a notifier le salarie et a l'orienter vers la PWA Kalldy. Les donnees sensibles sont collectees exclusivement cote Kalldy.

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

La chaine signee est le corps JSON exact de la requete HTTP. Kalldy doit verifier:

- le prefixe `sha256=`;
- le HMAC SHA-256 avec comparaison en temps constant;
- le timestamp anti-rejeu;
- l'unicite de `X-WhatsPoint-Event-Id`;
- la coherence entre `X-WhatsPoint-Event` et le champ JSON `event`.

Les anciens headers `X-Webhook-Event`, `X-Webhook-Event-Id`, `X-Webhook-Timestamp` et `X-Webhook-Signature` peuvent rester envoyes pour compatibilite, mais la convention Kalldy v1 doit utiliser les headers `X-WhatsPoint-*`.

Le secret HMAC est affiche une seule fois lors de la creation ou regeneration du webhook. Les listings, details et logs ne doivent jamais exposer le secret.

## Retry, idempotence et dead-letter

- `eventId` est stable pour un meme evenement metier et sert de cle d'idempotence principale.
- En cas d'echec HTTP ou reseau, WhatsPoint planifie un retry.
- Premiere nouvelle tentative: environ 5 minutes.
- Backoff exponentiel ensuite.
- Echec permanent apres 3 tentatives.
- Les tentatives en attente conservent le payload exact pour permettre le retry.
- Les logs finaux `SUCCESS` ou `FAILED` sont rediges pour eviter l'archivage durable de PII.

## Medias et fichiers

- Taille maximale document: 10 MB.
- Extensions acceptees: `.pdf`, `.doc`, `.docx`, `.png`, `.jpg`, `.jpeg`.
- MIME types POC: `application/pdf`, `image/png`, `image/jpeg`.
- URL media webhook: signee et temporaire.
- Expiration URL media webhook: 15 minutes.
- Aucun transfert base64 dans le webhook.

Kalldy doit privilegier `mediaId` comme reference durable et telecharger le media des reception quand `mediaUrl` est present.

## API REST et MCP

La cle API sandbox est tenant-scope et transmise en Bearer token:

```text
Authorization: Bearer <sandbox_api_key>
```

Scopes utiles pour l'integration Kalldy:

- `tenant:read`
- `employees:read`
- `attendance:read`
- `messages:send`

Le serveur MCP WhatsPoint doit consommer les memes routes `/api/v1` et respecter les memes scopes. Les premiers tools read-only recommandes sont `getTenantInfo`, `listEmployees` et `listAttendanceSummary`.

## Observabilite

Le statut superadmin du connecteur Kalldy v1 expose:

- version du contrat;
- evenements requis;
- evenements actives par webhook tenant;
- endpoint sandbox/production detecte;
- webhooks actifs;
- compteur succes/echec;
- derniere livraison;
- statut HTTP;
- latence;
- evenements manquants.
- historique recent des livraisons avec `eventId`, statut, HTTP, latence, retries et prochaine tentative.

Le panneau `/superadmin/integrations` permet aussi d'envoyer un test controle par evenement actif. Chaque test demande une confirmation navigateur avant emission vers Kalldy.

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

## Retention et RGPD

Principes v1:

- minimisation stricte des donnees envoyees;
- environnement sandbox separe de la production;
- secrets, tokens et URLs signees non affiches dans les listings;
- purge de fin de POC a cadrer avant bascule production;
- DPA a finaliser avant production;
- Kalldy devient responsable de sa copie apres telechargement du media.

## Reference POC

La validation du POC et les payloads finaux sont conserves dans `docs/kalldy-poc.md`.
