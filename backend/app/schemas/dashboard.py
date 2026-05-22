from pydantic import BaseModel
from typing import List, Dict, Any, Optional

class KPIStats(BaseModel):
    open_cases: int
    total_revenue: float
    sla_compliance_rate: float
    overdue_invoices: int

class ChartDataPoint(BaseModel):
    label: str
    value: float

class DashboardData(BaseModel):
    kpis: KPIStats
    cases_over_time: List[Dict[str, Any]]
    status_breakdown: List[ChartDataPoint]
    cost_by_case_type: List[ChartDataPoint]
    top_providers: List[Dict[str, Any]]
