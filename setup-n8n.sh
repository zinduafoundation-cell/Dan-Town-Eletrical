#!/bin/bash
# n8n + Supabase Setup Script
# Run this script to configure n8n with Supabase credentials

echo "================================"
echo "N8N + Supabase Setup"
echo "================================"
echo ""

# Check if n8n is already running
if command -v n8n &> /dev/null; then
    echo "✓ n8n is installed"
else
    echo "✗ n8n not found. Install it:"
    echo "  npm install -g n8n"
    exit 1
fi

echo ""
echo "Step 1: Supabase Credentials"
echo "=============================="
echo ""
echo "Go to Supabase Dashboard → Settings → API"
echo ""

read -p "Enter your Supabase Project URL (e.g., https://xxxxx.supabase.co): " SUPABASE_URL
read -p "Enter your Supabase Anon Key: " SUPABASE_ANON_KEY
read -p "Enter your Supabase Service Role Key (optional, press Enter to skip): " SUPABASE_SERVICE_ROLE_KEY

echo ""
echo "Step 2: N8N Webhook Secret"
echo "=============================="
echo ""
read -p "Enter a secure secret for N8N_WEBHOOK_SECRET (or press Enter to auto-generate): " N8N_SECRET

if [ -z "$N8N_SECRET" ]; then
    N8N_SECRET=$(openssl rand -base64 32)
    echo "Generated: $N8N_SECRET"
fi

echo ""
echo "Step 3: Environment Setup"
echo "=============================="
echo ""

# Create .env file for n8n
cat > .env.n8n << EOF
# Supabase Configuration
SUPABASE_URL=$SUPABASE_URL
SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY

# N8N Webhook Secret
N8N_WEBHOOK_SECRET=$N8N_SECRET

# N8N Configuration
N8N_PROTOCOL=http
N8N_HOST=localhost
N8N_PORT=5678
N8N_TIMEZONE=Africa/Nairobi

# Dantown API Configuration
DANTOWN_API_URL=http://localhost:3000/api/automation/stock-intake
EOF

echo "✓ Created .env.n8n with your configuration"
echo ""

# Create .env update for Dantown
cat > .env.dantown.append << EOF

# N8N Integration
N8N_WEBHOOK_SECRET=$N8N_SECRET
EOF

echo "Step 4: Update Dantown .env"
echo "=============================="
echo ""
echo "Add this to your Dantown .env.local:"
echo ""
cat .env.dantown.append
echo ""
echo "Command:"
echo "  cat .env.dantown.append >> apps/web/.env.local"
echo ""

echo "Step 5: Next Steps"
echo "=============================="
echo ""
echo "1. Update Dantown environment:"
echo "   cat .env.dantown.append >> apps/web/.env.local"
echo ""
echo "2. Start n8n:"
echo "   set -a && source .env.n8n && set +a"
echo "   n8n"
echo ""
echo "3. Access n8n:"
echo "   http://localhost:5678"
echo ""
echo "4. Add Supabase Credential:"
echo "   - Credentials → New Credential"
echo "   - Search for 'Supabase'"
echo "   - Fill in the form with your details"
echo ""
echo "5. Import n8n workflow:"
echo "   - Open n8n"
echo "   - Click Import"
echo "   - Upload: automation/n8n/n8n_workflow_stock_intake.json"
echo ""
echo "6. Update workflow with your credentials:"
echo "   - Edit HTTP Request node"
echo "   - Update URL if different from localhost"
echo "   - Save and test"
echo ""

# Cleanup temp files
rm -f .env.dantown.append

echo "✓ Setup complete!"
echo ""
