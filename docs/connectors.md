# Registre Multi-Connecteurs

Le panneau superadmin `/superadmin/integrations` s'appuie sur un registre de connecteurs versionnes. Kalldy est aujourd'hui la premiere definition active. `SANDBOX_PARTNER` sert de connecteur modele factice pour verifier que le panneau et les routes restent generiques quand un deuxieme partenaire existe.

## Principe

Chaque connecteur declare:

- un `provider` stable, par exemple `KALLDY`;
- un nom affichable;
- une version de contrat, par exemple `KALLDY_V1`;
- les endpoints sandbox et production;
- les evenements requis;
- les termes de recherche permettant de rattacher les webhooks existants;
- la regle permettant d'identifier les webhooks du partenaire;
- si les evenements doivent obligatoirement etre rattaches a un tenant.

Le registre vit dans `src/services/connectorRegistry.ts`.

Les connecteurs systeme restent codes dans le registre. Les connecteurs partenaires crees depuis le superadmin sont stockes dans la table `PartnerConnector` et fusionnes au runtime avec les connecteurs systeme.

## Connecteurs enregistres

- `KALLDY`: connecteur paie issu du POC Kalldy.
- `SANDBOX_PARTNER`: connecteur modele non productif, endpoint `.invalid`, utilise pour tester l'architecture multi-connecteurs sans partenaire reel.

## Endpoints superadmin

- `GET /admin/connectors`: liste les connecteurs connus, leur sante, leurs webhooks, les derniers envois et les evenements manquants.
- `POST /admin/connectors`: cree un connecteur partenaire custom et le webhook tenant-scope associe.
- `GET /admin/connectors/:provider/status`: lit un connecteur precis.
- `PUT /admin/connectors/:provider/webhooks/:id/events`: active/desactive les evenements d'un webhook partenaire.
- `POST /admin/connectors/:provider/webhooks/:id/test`: envoie un smoke test controle pour un evenement du connecteur.

Les anciennes routes Kalldy restent disponibles en compatibilite:

- `GET /admin/integrations/kalldy/status`
- `PUT /admin/integrations/kalldy/webhooks/:id/events`

## Verrou tenant

Pour les connecteurs marques `requiresTenantScopedEvents`, WhatsPoint bloque l'envoi d'un evenement metier tenant-scoped vers un webhook global. Cela evite qu'un flux paie ou RH parte au mauvais partenaire ou au mauvais tenant.

Le verrou est applique dans le dispatch sortant via `getConnectorDispatchGuard(...)`.

## Creation superadmin

Le panneau `/superadmin/integrations` permet de creer un connecteur partenaire sans repasser par le code:

- provider technique, normalise en majuscules avec underscores;
- nom affichable;
- endpoint sandbox;
- endpoint production optionnel;
- tenant pilote;
- evenements supportes;
- secret HMAC genere a la demande.

La creation ajoute:

- une definition `PartnerConnector`;
- un `WebhookConfig` actif, tenant-scope, signe HMAC.

Le secret HMAC est visible uniquement dans la reponse de creation. Ensuite, les ecrans continuent a masquer les secrets.

## Ajouter un partenaire

1. Ajouter une entree dans `CONNECTOR_DEFINITIONS`.
2. Declarer les evenements requis et les endpoints sandbox/production.
3. Definir `matchWebhook` pour reconnaitre les webhooks du partenaire.
4. Choisir `requiresTenantScopedEvents`.
5. Ajouter les payloads de test si le partenaire a besoin d'evenements specifiques.
6. Completer la documentation partenaire et les tests de service.

Le frontend n'a pas besoin d'un panneau dedie tant que le connecteur suit ce contrat.
