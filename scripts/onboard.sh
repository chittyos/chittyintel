#!/bin/bash
set -euo pipefail
echo "=== chittyintel Onboarding ==="
curl -s -X POST "${GETCHITTY_ENDPOINT:-https://get.chitty.cc/api/onboard}" \
  -H "Content-Type: application/json" \
  -d '{"service_name":"chittyintel","organization":"CHITTYAPPS","type":"service","tier":4,"domains":["intel-app.chitty.cc"]}' | jq .
