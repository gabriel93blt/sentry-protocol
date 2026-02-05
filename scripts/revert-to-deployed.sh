#!/bin/bash
# Quick fix: Revert to old Program ID and clean database

echo "🔄 Reverting to deployed Program ID..."

# Update Program ID in all files
OLD_PROGRAM="EPccz8vhrRpLK6w4WwPQn5aMC2Hh6onsD24qmtUVK1sm"
NEW_PROGRAM="2f438Z16QoVnArKRhN3P6oJysen1aimVnnr7vS5nTPaY"

# Revert files
sed -i "s/$NEW_PROGRAM/$OLD_PROGRAM/g" programs/sentry/src/lib.rs
sed -i "s/$NEW_PROGRAM/$OLD_PROGRAM/g" api/server.ts
sed -i "s/$NEW_PROGRAM/$OLD_PROGRAM/g" Anchor.toml
echo "✅ Program ID reverted to: $OLD_PROGRAM"

# Revert IDL
sed -i "s/$NEW_PROGRAM/$OLD_PROGRAM/g" target/idl/sentry.json
echo "✅ IDL updated"

# Rebuild API
cd api
npm run build
cd ..

echo ""
echo "🎉 Done! Program is already deployed on Devnet."
echo "   Program ID: $OLD_PROGRAM"
echo ""
echo "Next steps:"
echo "1. git add -A && git commit -m 'Revert to deployed Program ID'"
echo "2. git push origin main"
echo "3. Deploy on Render"
echo "4. Reset Supabase database"
