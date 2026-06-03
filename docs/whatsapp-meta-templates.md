# Templates Meta WhatsApp - MVP

Ces templates doivent etre crees et approuves dans Meta avant tout envoi proactif hors fenetre de conversation 24h.

## 1. `whatspoint_create_space_fr`

Categorie recommandee : Marketing ou Utility selon validation Meta.

Texte propose :

```text
Bonjour {{1}},

Votre demande WhatsPoint est prete.
Vous pouvez creer votre espace ici :
{{2}}

WhatsPoint est un service edite par Astauria.
```

Variables :

- `{{1}}` : nom ou "Bonjour"
- `{{2}}` : lien d'inscription

## 2. `whatspoint_demo_fr`

Categorie recommandee : Marketing.

Texte propose :

```text
Bonjour {{1}},

Voici la demo WhatsPoint : pointage, planning et demandes terrain depuis WhatsApp.
Repondez a ce message pour echanger avec Astauria, ou creez votre espace ici :
{{2}}
```

Variables :

- `{{1}}` : nom ou "Bonjour"
- `{{2}}` : lien d'inscription ou page demo

## 3. `whatspoint_planning_reminder_fr`

Categorie recommandee : Utility.

Texte propose :

```text
Bonjour {{1}},

Votre planning WhatsPoint a ete mis a jour.
Consultez vos horaires depuis WhatsApp ou rapprochez-vous de votre manager.
```

Variables :

- `{{1}}` : prenom collaborateur

## Appel API WhatsPoint

Une fois le template approuve, un outil metier peut appeler :

```json
{
  "phoneNumber": "+33600000000",
  "templateName": "whatspoint_demo_fr",
  "templateLanguage": "fr",
  "templateVars": ["Bonjour", "https://app.whatspoint.com/register?source=whatsapp"]
}
```

Les variables simples sont converties automatiquement en composants `body`.
Pour des headers, boutons ou documents, utiliser `templateComponents`.
