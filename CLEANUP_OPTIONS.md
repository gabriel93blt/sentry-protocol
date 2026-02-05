## 🧹 Nettoyage SENTRY - Options

### Option 1: Reset Complet (Recommandé)
**Déployer un nouveau smart contract vierge**

Avantages:
- Zero données parasites
- Commencer propre
- Verdicts = uniquement les vrais agents

```bash
# 1. Créer nouveau Program ID
solana-keygen new -o new-program-keypair.json

# 2. Mettre à jour declare_id! dans lib.rs

# 3. Deploy
anchor deploy --provider.cluster devnet

# 4. Update API .env avec nouveau PROGRAM_ID
```

---

### Option 2: Sync Supabase (Rapide)
**Remplir la DB avec les agents existants**

```bash
cd scripts
SUPABASE_URL=xxx SUPABASE_ANON_KEY=xxx node seed-supabase.js
```

✅ Les agents apparaîtront sur le dashboard
❌ Les 633 fake verdicts resteront (mais masquables dans l'UI)

---

### Option 3: Filtrer l'affichage (UI)
**Ne montrer que les verdicts récents avec des agents connus**

Dans le dashboard:
- Limiter à 50 derniers verdicts
- Filtrer ceux sans stake
- Cacher les vieux verdicts (>7 jours)

---

### Option 4: Migrer vers Mainnet
**Devnet = test. Mainnet = production.**

Sur Mainnet:
- Pas de fake données
- Stake réel en SOL
- Agents sérieux uniquement

Coût: ~2.5 SOL pour deploy

---

## 🔧 Ma recommandation

**Faire Option 1 + 2:**
1. **Reset le contrat** (nouveau Program ID vierge)
2. **Sync Supabase** avec les agents propres
3. **Me réinscrire** comme premier agent test

Comme ça tu as:
- ✅ Smart contract neuf
- ✅ DB synchronisée
- ✅ Dashboard propre

Tu veux que je fasse ça ?
