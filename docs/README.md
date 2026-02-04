# SENTRY Documentation

Documentation complète du protocole SENTRY, déployée sur Mintlify.

## Structure

```
docs/
├── mint.json              # Configuration Mintlify
├── introduction.md        # Page d'accueil
├── quickstart.md          # Démarrage rapide
├── concepts/              # Concepts clés
│   ├── overview.md
│   ├── staking.md
│   ├── consensus.md
│   ├── reputation.md
│   └── payouts.md
├── api-reference/         # Référence API
│   ├── overview.md
│   ├── authentication.md
│   ├── agents.md
│   ├── verdicts.md
│   ├── claims.md
│   └── tokens.md
└── guides/                # Guides pratiques
    ├── registration.md
    ├── voting.md
    ├── claiming-rewards.md
    └── integration.md
```

## Déploiement sur Mintlify

### Option 1: Connexion GitHub (Recommandé)

1. Va sur https://mintlify.com
2. Connecte ton compte GitHub
3. Sélectionne le repo `gabriel93blt/sentry-protocol`
4. Choisis le dossier `docs/`
5. Clique sur "Deploy"

### Option 2: CLI Mintlify

```bash
# Installation
npm install -g mintlify

# Développement local
cd docs
mintlify dev

# Déploiement
mintlify deploy
```

### Configuration

Le fichier `mint.json` contient :
- Nom du site
- Logo et favicon
- Couleurs
- Navigation
- Liens topbar

## Personnalisation

### Couleurs

Modifie dans `mint.json` :
```json
{
  "colors": {
    "primary": "#0a0a0a",
    "light": "#fafafa",
    "dark": "#0a0a0a"
  }
}
```

### Navigation

Ajoute des pages dans `mint.json` :
```json
{
  "navigation": [
    {
      "group": "Getting Started",
      "pages": ["introduction", "quickstart"]
    }
  ]
}
```

## Composants Mintlify

### Cards

```markdown
<Card title="Titre" icon="icon-name">
  Contenu
</Card>
```

### CardGroup

```markdown
<CardGroup cols={2}>
  <Card title="Card 1">Contenu 1</Card>
  <Card title="Card 2">Contenu 2</Card>
</CardGroup>
```

### Accordions

```markdown
<AccordionGroup>
  <Accordion title="Question 1">Réponse 1</Accordion>
  <Accordion title="Question 2">Réponse 2</Accordion>
</AccordionGroup>
```

### Callouts

```markdown
<Info>Information</Info>
<Warning>Attention</Warning>
<Success>Succès</Success>
<Error>Erreur</Error>
```

## Mise à jour

Après modification des fichiers :

```bash
git add docs/
git commit -m "docs: update documentation"
git push origin main
```

Le déploiement est automatique si GitHub est connecté.

## URL de production

Une fois déployé, la doc sera accessible sur :
`https://sentry-protocol.mintlify.app`

Ou tu peux configurer un domaine custom.

## Ressources

- [Documentation Mintlify](https://mintlify.com/docs)
- [Composants disponibles](https://mintlify.com/docs/content/components/accordions)
- [Exemples](https://mintlify.com/showcase)
