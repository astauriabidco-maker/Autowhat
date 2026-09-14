# Kalldy POC

## Objectif

Le POC Kalldy valide WhatsPoint comme couche conversationnelle WhatsApp pour:

- demander et valider une absence;
- collecter un justificatif simple, image ou PDF;
- relancer un salarie avec un lien securise vers la PWA Kalldy pour les donnees sensibles.

WhatsPoint ne doit pas faire transiter de donnees sensibles de paie dans WhatsApp: RIB, NIR, bulletin, piece d'identite ou donnees equivalentes. Ces donnees doivent etre collectees dans l'espace securise Kalldy. WhatsPoint sert ici a notifier, collecter des elements simples et rediriger vers Kalldy.

## Environnement sandbox

- Frontend preproduction: `https://testbed.whatspoint.com`
- API preproduction: `https://api.testbed.whatspoint.com`
- OpenAPI publique: `https://api.testbed.whatspoint.com/api/docs/public-v1.yaml`
- Endpoint webhook Kalldy POC: `https://api.testbed.fr.paie.kalldy.com/api/webhooks/whatspoint`
- Tenant pilote WhatsPoint/Kalldy: `699e8c48-4632-425f-a248-6c8aedbebc15`

La configuration webhook Kalldy POC est geree dans l'espace superadmin WhatsPoint: `/superadmin/webhooks`.

## Statut POC

| Flux | Evenement | Statut | Validation |
| --- | --- | --- | --- |
| Absence validee | `leave.approved` | Valide | Inbox manager WhatsPoint -> webhook HMAC -> tenant/collaborateur Kalldy -> EVP cree |
| Justificatif simple | `document.received` | Valide | Webhook HMAC -> tenant/collaborateur Kalldy -> document cree en `PENDING_REVIEW` |
| Relance PWA securisee | `employee.secure_link.requested` | Smoke WhatsPoint reussi | Endpoint Kalldy a retourne un succes au test reel; attente confirmation cockpit Kalldy pour validation fonctionnelle finale |

## Evenements POC

Les evenements configurables cote webhooks sortants sont:

- `leave.requested`
- `leave.approved`
- `leave.rejected`
- `document.received`
- `employee.secure_link.requested`
- `message.status.updated`

## Payload `leave.approved`

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

`employeeId`, `employeeName`, `isHalfDayStart`, `isHalfDayEnd` et `managerComment` peuvent etre presents selon le flux metier. `eventId` est stable pour un meme evenement metier et permet l'idempotence cote Kalldy.

## Payload `document.received`

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

Le fichier n'est pas envoye en base64 dans le webhook. Le payload contient une reference fichier (`mediaId`) et, quand disponible, une URL temporaire signee (`mediaUrl`) avec expiration.

## Payload `employee.secure_link.requested`

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

Ce flux sert uniquement a notifier le salarie et a le rediriger vers l'espace securise Kalldy. WhatsPoint ne collecte ni ne transmet dans WhatsApp les donnees sensibles telles que RIB, NIR, bulletin ou piece d'identite.

## Headers webhook

WhatsPoint envoie les headers suivants:

- `X-WhatsPoint-Event`
- `X-WhatsPoint-Event-Id`
- `X-WhatsPoint-Timestamp`
- `X-WhatsPoint-Signature`

Les anciens headers suivants restent envoyes pour compatibilite:

- `X-Webhook-Event`
- `X-Webhook-Event-Id`
- `X-Webhook-Timestamp`
- `X-Webhook-Signature`

## Signature HMAC

La signature est calculee en HMAC-SHA256 sur le corps JSON exact envoye dans la requete HTTP, apres application eventuelle du mapping de payload configure sur le webhook.

```text
signedPayload = raw JSON request body
signature = hmac_sha256(signedPayload, webhookSecret)
X-WhatsPoint-Signature = sha256=<signature>
```

Kalldy doit verifier:

- la signature HMAC;
- le timestamp anti-rejeu;
- l'unicite de `eventId`;
- la correspondance entre le header `X-WhatsPoint-Event` et le champ JSON `event`.

Le secret HMAC est configure cote webhook. Il est affiche une seule fois a la creation ou lors d'une regeneration volontaire, puis n'est jamais renvoye par l'API de listing/detail ni affiche dans les logs.

## Idempotence

`eventId` est l'identifiant stable de l'evenement. Kalldy doit l'utiliser comme cle d'idempotence principale.

Pour les appels entrants de l'API publique WhatsPoint qui modifient de l'etat, les integrateurs doivent fournir un header `Idempotency-Key`.

## Retry et dead-letter

En cas d'echec HTTP ou reseau, WhatsPoint journalise la tentative et planifie un retry:

- premiere nouvelle tentative apres 5 minutes;
- backoff exponentiel ensuite;
- echec permanent apres 3 tentatives;
- les tentatives en attente conservent le payload exact pour permettre le retry;
- les logs finaux `SUCCESS` ou `FAILED` sont rediges pour eviter l'archivage durable de PII.

## Medias et fichiers

Limites actuelles cote upload document WhatsPoint:

- taille maximale: 10 MB;
- extensions acceptees: `.pdf`, `.doc`, `.docx`, `.png`, `.jpg`, `.jpeg`;
- URL media webhook: signee et temporaire;
- expiration URL media webhook: 15 minutes;
- pas de transfert base64 dans le webhook.

Le POC Kalldy doit privilegier `mediaId` comme reference durable et `mediaUrl` comme acces temporaire de recuperation. Kalldy doit telecharger le media des reception, car une tentative de retry tardive peut conserver un payload exact mais pointer vers une URL media deja expiree.

## API publique

La cle API est propre a un tenant et doit etre transmise en Bearer token.

Scopes utiles pour le POC:

- `tenant:read`
- `employees:read`
- `attendance:read`
- `messages:send`

Documentation OpenAPI:

- `https://api.testbed.whatspoint.com/api/docs/public-v1.yaml`

## Monitoring et logs

L'ecran superadmin `/superadmin/webhooks` affiche:

- les webhooks configures;
- les evenements actifs;
- les compteurs succes/echec;
- les dernieres executions.

Les secrets HMAC et headers sensibles ne doivent pas etre visibles dans l'interface. Les payloads de logs exposes par l'API sont rediges pour masquer les champs sensibles.

## RGPD et retention

Principes POC:

- minimisation: seules les donnees necessaires au flux sont envoyees;
- pas de RIB, NIR, bulletin ou piece d'identite dans WhatsApp;
- pas de libelle sensible dans les messages WhatsApp, y compris nom de document, type medical/identite, date sensible ou reference de paie;
- URLs medias temporaires;
- suppression/retention a cadrer contractuellement dans le DPA: fichiers uploades, documents DB, logs webhook, payloads de retry et preuves d'evenement;
- procedure de purge de fin de POC a definir avant passage production;
- Kalldy devient responsable de sa copie apres telechargement du media;
- environnement sandbox separe de la production.

## Contraintes de configuration POC

Pour le POC, le webhook doit rester limite a:

- URL HTTPS Kalldy preproduction;
- tenant pilote `699e8c48-4632-425f-a248-6c8aedbebc15`;
- mapping valide par WhatsPoint et Kalldy;
- aucun champ RIB, NIR, bulletin, piece d'identite ou donnees sensibles equivalentes dans le payload webhook ou le message WhatsApp.

## Prochaine confirmation Kalldy

Le smoke reel WhatsPoint du troisieme flux a retourne un succes cote interface superadmin. Kalldy doit confirmer cote cockpit:

- reception de `employee.secure_link.requested`;
- validation HMAC;
- resolution tenant;
- resolution collaborateur par telephone;
- creation du lien PWA securise temporaire;
- idempotence via `eventId`;
- absence de donnee sensible transmise dans WhatsApp.
