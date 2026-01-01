#!/bin/bash
# Script to add dynamic exports to API routes that need them

# List of API route files that need dynamic export
# These are routes that use cookies, authentication, or sessions

FILES=(
  "app/api/auth/me/route.ts"
  "app/api/auth/logout/route.ts"
  "app/api/auth/dashboard-access/route.ts"
  "app/api/admin/audit/route.ts"
  "app/api/admin/users/route.ts"
  "app/api/admin/users/[id]/route.ts"
  "app/api/admin/groups/route.ts"
  "app/api/admin/groups/[id]/route.ts"
  "app/api/admin/hospitals/route.ts"
  "app/api/admin/hospitals/[id]/route.ts"
  "app/api/admin/quotas/route.ts"
  "app/api/admin/quotas/[id]/route.ts"
  "app/api/admin/patients/route.ts"
  "app/api/admin/patients/[id]/route.ts"
  "app/api/admin/privileges/grant/route.ts"
  "app/api/admin/privileges/revoke/route.ts"
  "app/api/admin/notes/route.ts"
  "app/api/admin/tasks/route.ts"
  "app/api/admin/orders/route.ts"
  "app/api/admin/encounters/route.ts"
  "app/api/admin/ehr/users/route.ts"
  "app/api/admin/ehr/patients/route.ts"
  "app/api/admin/ehr/patients/[id]/route.ts"
  "app/api/admin/ehr/notes/route.ts"
  "app/api/admin/ehr/orders/route.ts"
  "app/api/admin/ehr/encounters/route.ts"
  "app/api/admin/ehr/tasks/route.ts"
  "app/api/admin/ehr/audit/route.ts"
  "app/api/admin/ehr/privileges/grant/route.ts"
  "app/api/admin/ehr/privileges/revoke/route.ts"
  "app/api/cdo/dashboard/route.ts"
  "app/api/cdo/flags/route.ts"
  "app/api/cdo/metrics/route.ts"
  "app/api/cdo/outcomes/route.ts"
  "app/api/cdo/quality-indicators/route.ts"
  "app/api/cdo/prompts/route.ts"
  "app/api/cdo/prompts/[promptId]/route.ts"
  "app/api/cdo/prompts/unacknowledged/route.ts"
  "app/api/cdo/analysis/route.ts"
  "app/api/cdo/analysis/preview/route.ts"
  "app/api/policy-engine/policies/route.ts"
  "app/api/policy-engine/policies/[policyId]/route.ts"
  "app/api/policy-engine/policies/[policyId]/file/route.ts"
  "app/api/policy-engine/policies/[policyId]/reprocess/route.ts"
  "app/api/policy-engine/policies/[policyId]/rewrite/route.ts"
  "app/api/policy-engine/jobs/[jobId]/route.ts"
  "app/api/policy-engine/conflicts/route.ts"
  "app/api/policy-engine/issues/ai/route.ts"
  "app/api/policies/list/route.ts"
  "app/api/policies/search/route.ts"
  "app/api/policies/upload/route.ts"
  "app/api/policies/[documentId]/route.ts"
  "app/api/policies/view/[documentId]/route.ts"
  "app/api/notifications/route.ts"
  "app/api/notifications/[id]/route.ts"
  "app/api/notifications/mark-all-read/route.ts"
  "app/api/patient-experience/route.ts"
  "app/api/patient-experience/cases/route.ts"
  "app/api/patient-experience/cases/[id]/route.ts"
  "app/api/patient-experience/cases/[id]/audit/route.ts"
  "app/api/patient-experience/visits/route.ts"
  "app/api/patient-experience/summary/route.ts"
  "app/api/patient-experience/analytics/summary/route.ts"
  "app/api/patient-experience/analytics/trends/route.ts"
  "app/api/patient-experience/analytics/breakdown/route.ts"
  "app/api/patient-experience/data/route.ts"
  "app/api/dashboard/stats/route.ts"
  "app/api/opd/dashboard/stats/route.ts"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    # Check if dynamic export already exists
    if ! grep -q "export const dynamic" "$file"; then
      # Add dynamic exports after imports, before other code
      # Find the line number of the first export or function
      first_export=$(grep -n "^export" "$file" | head -1 | cut -d: -f1)
      if [ -z "$first_export" ]; then
        first_export=$(grep -n "^async function\|^function" "$file" | head -1 | cut -d: -f1)
      fi
      if [ -n "$first_export" ]; then
        # Insert dynamic exports before first export/function
        sed -i.bak "${first_export}i\\
export const dynamic = 'force-dynamic';\\
export const revalidate = 0;\\
" "$file"
        rm -f "${file}.bak"
        echo "Added dynamic exports to $file"
      fi
    else
      echo "Skipping $file (already has dynamic export)"
    fi
  fi
done
