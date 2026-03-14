#!/usr/bin/env bash
# Forge Local Demo
# Run: bash demo.sh
set -e

CLI="node packages/cli/dist/index.js"

echo ""
echo "━━━ FORGE DEMO ━━━"
echo ""

# Clean prior state
rm -rf .forge

# ── Validate ──
echo "━━━ Step 1: Validate configuration ━━━"
echo ""
$CLI validate -c examples/basic-agent/forge.yaml
echo ""
$CLI validate -c examples/multi-agent-pipeline/forge.yaml
echo ""
$CLI validate -c examples/mcp-with-memory/forge.yaml
echo ""

# ── Diff (fresh state) ──
echo "━━━ Step 2: Diff against empty state ━━━"
echo ""
$CLI diff -c examples/basic-agent/forge.yaml
echo ""

# ── Deploy basic agent ──
echo "━━━ Step 3: Deploy basic-assistant to dev ━━━"
echo ""
$CLI deploy -c examples/basic-agent/forge.yaml --auto-approve --env dev
echo ""

# ── Idempotency check ──
echo "━━━ Step 4: Deploy again (idempotency check) ━━━"
echo ""
$CLI deploy -c examples/basic-agent/forge.yaml --auto-approve --env dev
echo ""

# ── Deploy different config to show diff ──
echo "━━━ Step 5: Deploy support-triage to production ━━━"
echo ""
$CLI deploy -c examples/multi-agent-pipeline/forge.yaml --auto-approve --env production
echo ""

# ── Show diff from current state to basic agent ──
echo "━━━ Step 6: Diff — what would change to revert to basic-assistant ━━━"
echo ""
$CLI diff -c examples/basic-agent/forge.yaml
echo ""

# ── Dry run ──
echo "━━━ Step 7: Dry run deploy (no changes written) ━━━"
echo ""
$CLI deploy -c examples/basic-agent/forge.yaml --dry-run --env dev
echo ""

# ── Show state file ──
echo "━━━ Step 8: Current state ━━━"
echo ""
echo "State file (.forge/state.json):"
python3 -c "import json,sys; print(json.dumps(json.load(open('.forge/state.json')),indent=2))" 2>/dev/null || cat .forge/state.json
echo ""

# ── Rollback info ──
echo "━━━ Step 9: Rollback ━━━"
echo ""
$CLI rollback
echo ""

# Cleanup
rm -rf .forge

echo "━━━ Demo complete ━━━"
echo ""
