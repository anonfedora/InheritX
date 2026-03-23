use crate::api_error::ApiError;
use crate::app::AppState;
use crate::auth::AuthenticatedAdmin;
use crate::service::{
    AdminService, ClaimMetricsService, LendingMonitoringService, PlanStatisticsService,
    RevenueMetricsService, UserMetricsService,
};
use axum::{
    extract::{Query, State},
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

#[derive(Deserialize)]
pub struct RevenueRangeQuery {
    #[serde(default = "default_range")]
    pub range: String,
}

fn default_range() -> String {
    "monthly".to_string()
}

/// GET /api/admin/analytics/overview
/// Returns high-level protocol metrics: total revenue, plans, claims, users.
async fn get_overview(
    State(state): State<Arc<AppState>>,
    AuthenticatedAdmin(_admin): AuthenticatedAdmin,
) -> Result<Json<Value>, ApiError> {
    let metrics = AdminService::get_metrics_overview(&state.db).await?;
    Ok(Json(json!({
        "status": "success",
        "data": {
            "totalRevenue": metrics.total_revenue,
            "totalPlans": metrics.total_plans,
            "totalClaims": metrics.total_claims,
            "activePlans": metrics.active_plans,
            "totalUsers": metrics.total_users,
        }
    })))
}

/// GET /api/admin/analytics/users
/// Returns user growth metrics: total, new (7d/30d), active.
async fn get_user_metrics(
    State(state): State<Arc<AppState>>,
    AuthenticatedAdmin(_admin): AuthenticatedAdmin,
) -> Result<Json<Value>, ApiError> {
    let metrics = UserMetricsService::get_user_growth_metrics(&state.db).await?;
    Ok(Json(json!({
        "status": "success",
        "data": metrics
    })))
}

/// GET /api/admin/analytics/plans
/// Returns plan statistics broken down by status.
async fn get_plan_metrics(
    State(state): State<Arc<AppState>>,
    AuthenticatedAdmin(_admin): AuthenticatedAdmin,
) -> Result<Json<Value>, ApiError> {
    let stats = PlanStatisticsService::get_plan_statistics(&state.db).await?;
    Ok(Json(json!({
        "status": "success",
        "data": stats
    })))
}

/// GET /api/admin/analytics/claims
/// Returns claim processing statistics.
async fn get_claim_metrics(
    State(state): State<Arc<AppState>>,
    AuthenticatedAdmin(_admin): AuthenticatedAdmin,
) -> Result<Json<Value>, ApiError> {
    let stats = ClaimMetricsService::get_claim_statistics(&state.db).await?;
    Ok(Json(json!({
        "status": "success",
        "data": stats
    })))
}

/// GET /api/admin/analytics/revenue?range=daily|weekly|monthly
/// Returns time-series revenue breakdown. Defaults to monthly.
async fn get_revenue_metrics(
    State(state): State<Arc<AppState>>,
    AuthenticatedAdmin(_admin): AuthenticatedAdmin,
    Query(params): Query<RevenueRangeQuery>,
) -> Result<Json<Value>, ApiError> {
    let breakdown = RevenueMetricsService::get_revenue_breakdown(&state.db, &params.range).await?;
    Ok(Json(json!({
        "status": "success",
        "data": breakdown
    })))
}

/// GET /api/admin/analytics/lending
/// Returns DeFi lending pool metrics: TVL, utilization rate, active loans.
async fn get_lending_metrics(
    State(state): State<Arc<AppState>>,
    AuthenticatedAdmin(_admin): AuthenticatedAdmin,
) -> Result<Json<Value>, ApiError> {
    let metrics = LendingMonitoringService::get_lending_metrics(&state.db).await?;
    Ok(Json(json!({
        "status": "success",
        "data": metrics
    })))
}

/// Aggregated dashboard endpoint — all metrics in one request.
/// GET /api/admin/analytics/dashboard
async fn get_dashboard(
    State(state): State<Arc<AppState>>,
    AuthenticatedAdmin(_admin): AuthenticatedAdmin,
) -> Result<Json<Value>, ApiError> {
    let (overview, users, plans, claims, lending) = tokio::try_join!(
        AdminService::get_metrics_overview(&state.db),
        UserMetricsService::get_user_growth_metrics(&state.db),
        PlanStatisticsService::get_plan_statistics(&state.db),
        ClaimMetricsService::get_claim_statistics(&state.db),
        LendingMonitoringService::get_lending_metrics(&state.db),
    )?;

    Ok(Json(json!({
        "status": "success",
        "data": {
            "overview": {
                "totalRevenue": overview.total_revenue,
                "totalPlans": overview.total_plans,
                "totalClaims": overview.total_claims,
                "activePlans": overview.active_plans,
                "totalUsers": overview.total_users,
            },
            "users": users,
            "plans": plans,
            "claims": claims,
            "lending": lending,
        }
    })))
}

pub fn analytics_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/api/admin/analytics/dashboard", get(get_dashboard))
        .route("/api/admin/analytics/overview", get(get_overview))
        .route("/api/admin/analytics/users", get(get_user_metrics))
        .route("/api/admin/analytics/plans", get(get_plan_metrics))
        .route("/api/admin/analytics/claims", get(get_claim_metrics))
        .route("/api/admin/analytics/revenue", get(get_revenue_metrics))
        .route("/api/admin/analytics/lending", get(get_lending_metrics))
}
