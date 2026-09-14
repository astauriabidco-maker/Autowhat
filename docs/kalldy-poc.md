# Kalldy POC

## Objectif

Le POC Kalldy valide WhatsPoint comme couche conversationnelle WhatsApp pour:

- demander et valider une absence;
- collecter un justificatif simple, image ou PDF;
- relancer un salarie avec un lien securise vers la PWA Kalldy pour les donnees sensibles.

WhatsPoint ne doit pas faire transiter de donnees sensibles de paie dans WhatsApp: RIB, NIR, bulletin, piece d'identite ou donnees equivalentes. Ces donnees doivent etre collectees dans l'espace securise Kalldy.

## Environnement

- Frontend preproduction: `https://testbed.whatspoint.com`
- API preproduction: `https://api.testbed.whatspoint.com`
- OpenAPI publique: `https://api.testbed.whatspoint.com/api/docs/public-v1.yaml`
- Endpoint webhook Kalldy POC: `https://api.testbed.fr.paie.kalldy.com/api/webhooks/whatspoint`

## Evenements POC

Les evenements configurables cote webhooks sortants sont:

- `leave.requested`
- `leave.approved`
- `leave.rejected`
- `document.received`
- `message.status.updated`

## Payload absence validee

```json
{
  "eventId": "wp_evt_123",
  "event": "leave.approved",
  "timestamp": "2026-06-01T10:00:00.000Z",
  "tenantId": "00000000-0000-0000-0000-000000000000",
  "data": {
    "leaveRequestId": "leave_123",
    "employeeId": "emp_123",
    "employeePhoneNumber": "+33612345678",
    "startDate": "2026-06-10",
    "endDate": "2026-06-17",
    "businessDays": 6,
    "status": "APPROVED"
  }
}
```

`eventId` est stable pour un meme evenement metier et permet l'idempotence cote Kalldy.

## Payload justificatif simple

```json
{
  "eventId": "wp_evt_456",
  "event": "document.received",
  "timestamp": "2026-06-01T10:05:00.000Z",
  "tenantId": "00000000-0000-0000-0000-000000000000",
  "data": {
    "documentId": "doc_123",
    "employeeId": "emp_123",
    "leaveRequestId": "leave_123",
    "file": {
      "fileId": "file_123",
      "mimeType": "application/pdf",
      "downloadUrl": "https://api.testbed.whatspoint.com/api/files/documents/file.pdf?expires=...",
      "expiresAt": "2026-06-01T11:05:00.000Z"
    }
  }
}
```

Le fichier n'est pas envoye en base64 dans le webhook. Le payload doit contenir une reference fichier ou une URL temporaire signee avec expiration.

## Headers webhook

WhatsPoint envoie les headers suivants:

- `X-WhatsPoint-Event`
- `X-WhatsPoint-Event-Id`
- `X-WhatsPoint-Timestamp`
- `X-WhatsPoint-Signature`

Les anciens headers `X-Webhook-*` restent envoyes pour compatibilite.

La signature est calculee en HMAC-SHA256 sur le corps JSON exact:

```text
X-WhatsPoint-Signature: sha256=<hmac_sha256(payload, secret)>
```

## Retry

En cas d'echec HTTP ou reseau, WhatsPoint journalise la tentative et planifie un retry. Le comportement actuel est:

- premier retry apres 5 minutes;
- retries suivants avec backoff;
- passage en echec permanent apres 3 tentatives.

## API publique

La cle API est propre a un tenant et doit etre transmise en Bearer token.

Scopes utiles pour le POC:

- `tenant:read`
- `employees:read`
- `attendance:read`
- `messages:send`

Les appels d'ecriture sensibles doivent fournir un header `Idempotency-Key`.

## Execution controlee

Avant execution en preproduction, il faut:

1. utiliser l'URL de reception webhook Kalldy: `https://api.testbed.fr.paie.kalldy.com/api/webhooks/whatspoint`;
2. creer/activer une configuration webhook `Kalldy POC` limitee au tenant de test;
3. declencher une demande d'absence fictive;
4. valider/refuser la demande depuis l'Inbox;
5. verifier la livraison webhook, la signature et les logs;
6. supprimer ou desactiver la configuration POC si elle n'est plus necessaire.
