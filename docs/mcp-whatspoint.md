# WhatsPoint MCP Server

Ce serveur MCP minimal expose WhatsPoint aux agents IA via l'API publique v1. Les premiers tools sont read-only; les actions d'écriture restent explicites, scopées et idempotentes.

## Tools disponibles

- `getTenantInfo`: lit `/api/v1/me`.
- `listEmployees`: lit `/api/v1/employees` sans numéro complet.
- `listAttendanceSummary`: lit `/api/v1/attendance/summary` sans coordonnées GPS brutes.
- `sendEmployeeMessage`: envoie un message WhatsApp à un collaborateur via `/api/v1/messages`.

## Scopes requis

Créer une clé API tenant avec les scopes suivants:

- `tenant:read`
- `employees:read`
- `attendance:read`

Ajouter seulement si l'agent doit envoyer des messages:

- `messages:send`

## Configuration client MCP

```json
{
  "mcpServers": {
    "whatspoint": {
      "command": "node",
      "args": ["/chemin/absolu/vers/mcp/whatspoint-mcp-server.mjs"],
      "env": {
        "WHATSPOINT_API_BASE_URL": "https://api.testbed.whatspoint.com",
        "WHATSPOINT_API_KEY": "wp_test_xxx"
      }
    }
  }
}
```

En production, utiliser `https://api.whatspoint.com` et une clé `wp_live_...`.

## Actions protégées

`sendEmployeeMessage` exige:

- un `employeeId`, pas un numéro libre;
- un `message`;
- une `idempotencyKey` stable côté agent ou intégrateur.

La route API sous-jacente refuse l'action sans scope `messages:send`. Une même clé d'idempotence rejoue la première réponse si le payload est identique, et refuse un payload différent.

## Garantie de sécurité

Le serveur MCP ne connaît que la clé API fournie par l'environnement. Il ne journalise pas cette clé, ne reçoit pas les secrets Meta/Stripe, et délègue les droits à l'API v1 via les scopes.

Les données exposées sont limitées:

- collaborateurs: pas de téléphone complet, seulement les quatre derniers chiffres;
- pointages: pas de latitude, longitude, URL de photo ou justificatif;
- tenant: identité et plan uniquement.
