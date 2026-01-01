"""Risk Detector API routes"""
from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from app.openai_client import get_openai_client
from app.config import settings
import json


router = APIRouter()


class PracticeInput(BaseModel):
    id: str
    title: str
    description: str
    frequency: Optional[str] = None


class PolicyInput(BaseModel):
    id: str
    documentId: str
    title: str


class AnalyzeRequest(BaseModel):
    department: str
    setting: str
    practices: List[PracticeInput]
    policies: List[PolicyInput]
    tenantId: str = "default"


class PolicyCitation(BaseModel):
    policyId: str
    title: str
    documentId: str
    citations: List[Dict[str, Any]]  # [{pageNumber, snippet}]


class PracticeResult(BaseModel):
    practiceId: str
    status: str  # "Covered" | "Partial" | "NoPolicy" | "Conflict"
    relatedPolicies: List[PolicyCitation]
    severity: str  # "Low" | "Med" | "High" | "Critical"
    likelihood: float  # 0-1
    riskScore: int  # 0-100
    recommendations: List[str]


class AnalyzeResponse(BaseModel):
    practices: List[PracticeResult]
    metadata: Optional[Dict[str, Any]] = None


@router.post("/v1/risk-detector/analyze", response_model=AnalyzeResponse)
async def analyze_gaps(request: AnalyzeRequest):
    """
    Analyze practices against policies to detect gaps.
    
    For each practice, determines:
    - status: Covered/Partial/NoPolicy/Conflict
    - relatedPolicies: Matching policies with citations
    - severity, likelihood, riskScore
    - recommendations
    """
    try:
        client = get_openai_client()
        if not client:
            raise HTTPException(
                status_code=503,
                detail="OpenAI client not available. Check OPENAI_API_KEY."
            )

        results = []

        for practice in request.practices:
            # Build prompt for this practice
            policies_text = "\n".join([
                f"- {p.title} (ID: {p.documentId})" for p in request.policies[:20]  # Limit to 20 policies
            ])

            prompt = f"""You are a healthcare risk assessment assistant. Analyze if a daily practice is covered by existing policies.

**Department**: {request.department}
**Setting**: {request.setting}
**Practice**:
- Title: {practice.title}
- Description: {practice.description}
- Frequency: {practice.frequency or 'Unknown'}

**Available Policies** (relevant to department or hospital-wide):
{policies_text if policies_text else "No policies available"}

Analyze whether this practice is:
1. **Covered**: Fully addressed by existing policies
2. **Partial**: Partially addressed, but some gaps exist
3. **NoPolicy**: Not covered by any existing policy (risk)
4. **Conflict**: Conflicting guidance between policies

Return JSON in this format:
{{
  "status": "NoPolicy",
  "relatedPolicies": [
    {{
      "policyId": "policy-id-1",
      "title": "Policy Title",
      "documentId": "POL-2025-XXXXX",
      "citations": [
        {{"pageNumber": 1, "snippet": "relevant text excerpt..."}}
      ]
    }}
  ],
  "severity": "High",
  "likelihood": 0.8,
  "riskScore": 75,
  "recommendations": [
    "Create a policy for...",
    "Clarify guidance on..."
  ]
}}

Guidelines:
- status: "Covered" if practice fully addressed, "Partial" if partially, "NoPolicy" if not addressed, "Conflict" if contradictions
- severity: "Low", "Med", "High", or "Critical" based on impact
- likelihood: 0.0-1.0 (probability of issue occurring)
- riskScore: 0-100 (severity * likelihood * 100, rounded)
- recommendations: 2-4 actionable recommendations
- Include relatedPolicies only if status is "Covered", "Partial", or "Conflict"
- If status is "NoPolicy", relatedPolicies should be empty or minimal
"""

            # Call OpenAI
            model = "gpt-4o-mini"
            response = await client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a healthcare risk assessment expert. Analyze practices against policies and provide structured JSON responses."
                    },
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                response_format={"type": "json_object"},
            )

            result_text = response.choices[0].message.content
            if not result_text:
                raise HTTPException(
                    status_code=500,
                    detail=f"Empty response from AI for practice {practice.id}"
                )

            # Parse JSON response
            try:
                result = json.loads(result_text)
            except json.JSONDecodeError as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"Invalid JSON response from AI: {str(e)}"
                )

            # Validate and structure result
            status = result.get("status", "NoPolicy")
            if status not in ["Covered", "Partial", "NoPolicy", "Conflict"]:
                status = "NoPolicy"

            severity = result.get("severity", "Med")
            if severity not in ["Low", "Med", "High", "Critical"]:
                severity = "Med"

            likelihood = float(result.get("likelihood", 0.5))
            likelihood = max(0.0, min(1.0, likelihood))

            # Calculate riskScore if not provided
            severity_multiplier = {"Low": 0.25, "Med": 0.5, "High": 0.75, "Critical": 1.0}.get(severity, 0.5)
            risk_score = int(round(severity_multiplier * likelihood * 100))
            if "riskScore" in result:
                risk_score = int(result["riskScore"])
            risk_score = max(0, min(100, risk_score))

            related_policies = []
            if "relatedPolicies" in result and isinstance(result["relatedPolicies"], list):
                for rp in result["relatedPolicies"][:10]:  # Limit to 10
                    if isinstance(rp, dict) and "policyId" in rp:
                        # Find matching policy to get documentId
                        matching_policy = next(
                            (p for p in request.policies if p.id == rp.get("policyId")),
                            None
                        )
                        if matching_policy:
                            citations = rp.get("citations", [])
                            if not isinstance(citations, list):
                                citations = []
                            related_policies.append({
                                "policyId": rp["policyId"],
                                "title": rp.get("title", matching_policy.title),
                                "documentId": matching_policy.documentId,
                                "citations": citations[:5],  # Limit citations
                            })

            recommendations = result.get("recommendations", [])
            if not isinstance(recommendations, list):
                recommendations = []
            recommendations = recommendations[:5]  # Limit to 5

            results.append({
                "practiceId": practice.id,
                "status": status,
                "relatedPolicies": related_policies,
                "severity": severity,
                "likelihood": likelihood,
                "riskScore": risk_score,
                "recommendations": recommendations,
            })

        from datetime import datetime
        metadata = {
            "totalPractices": len(request.practices),
            "policiesAnalyzed": len(request.policies),
            "model": model,
            "analyzedAt": datetime.utcnow().isoformat() + "Z",
        }

        return {
            "practices": results,
            "metadata": metadata,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in analyze_gaps: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to analyze gaps: {str(e)}"
        )
