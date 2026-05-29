from __future__ import annotations

from copy import deepcopy
from datetime import timezone
from uuid import uuid4

from sqlalchemy import delete, select
from sqlalchemy.orm import Session, joinedload

from app.schemas.scenario import (
    CommuteAnalysis,
    LifestyleAnalysis,
    PreferenceProfile,
    Recommendation,
    ScenarioResponse,
    ScenarioStatus,
    Workplace,
    Zone,
)

_store: dict[str, ScenarioResponse] = {}
_DEFAULT_USER_EMAIL = "local-user@relocateiq.dev"
_DEFAULT_USER_NAME = "Local User"
_DB_READY = True
_DB_BOOTSTRAPPED = False


def _db_models():
    from app.db.models import (
        CommuteAnalysis as DbCommuteAnalysis,
        CommuteScenario,
        LifestyleAnalysis as DbLifestyleAnalysis,
        PreferenceProfile as DbPreferenceProfile,
        Recommendation as DbRecommendation,
        ScenarioStatus as DbScenarioStatus,
        User,
        Workplace as DbWorkplace,
        Zone as DbZone,
    )

    return {
        "CommuteAnalysis": DbCommuteAnalysis,
        "CommuteScenario": CommuteScenario,
        "LifestyleAnalysis": DbLifestyleAnalysis,
        "PreferenceProfile": DbPreferenceProfile,
        "Recommendation": DbRecommendation,
        "ScenarioStatus": DbScenarioStatus,
        "User": User,
        "Workplace": DbWorkplace,
        "Zone": DbZone,
    }


def _get_session() -> Session | None:
    global _DB_READY, _DB_BOOTSTRAPPED
    if not _DB_READY:
        return None
    try:
        from app.db.database import SessionLocal, init_db

        if not _DB_BOOTSTRAPPED:
            init_db()
            _DB_BOOTSTRAPPED = True
        return SessionLocal()
    except Exception:
        _DB_READY = False
        return None


def _disable_db() -> None:
    global _DB_READY
    _DB_READY = False


def _to_db_status(status: ScenarioStatus, db_status_enum) -> object:
    return db_status_enum(status.value)


def _to_schema_status(status) -> ScenarioStatus:
    return ScenarioStatus(status.value if hasattr(status, "value") else status)


def _ensure_default_user(db: Session, models: dict[str, object]) -> str:
    User = models["User"]
    existing = db.scalar(select(User).where(User.email == _DEFAULT_USER_EMAIL))
    if existing is not None:
        return existing.user_id
    user = User(name=_DEFAULT_USER_NAME, email=_DEFAULT_USER_EMAIL)
    db.add(user)
    db.flush()
    return user.user_id


def _upsert_zone(db: Session, models: dict[str, object], zone: Zone) -> None:
    DbZone = models["Zone"]
    row = db.scalar(select(DbZone).where(DbZone.zone_id == zone.zone_id))
    if row is None:
        row = DbZone(zone_id=zone.zone_id)
        db.add(row)
    row.name = zone.name
    row.boundary_geo_json = zone.boundary_geojson
    row.center_lat = zone.center_lat
    row.center_lng = zone.center_lng


def _to_schema_response(db_scenario) -> ScenarioResponse:
    workplace = db_scenario.workplace
    profile = db_scenario.preference_profile
    recommendations: list[Recommendation] = []
    for rec in db_scenario.recommendations:
        commute = rec.commute_analysis
        lifestyle = rec.lifestyle_analysis
        zone = rec.zone
        recommendations.append(
            Recommendation(
                rank=rec.rank,
                total_score=rec.total_score,
                explanation_summary=rec.explanation_summary or "",
                zone=Zone(
                    zone_id=zone.zone_id,
                    name=zone.name,
                    boundary_geojson=zone.boundary_geo_json or "",
                    center_lat=zone.center_lat,
                    center_lng=zone.center_lng,
                ),
                commute_analysis=CommuteAnalysis(
                    drive_time_peak_minutes=int(round(commute.drive_time_peak_minutes)),
                    transit_time_peak_minutes=int(round(commute.transit_time_peak_minutes)),
                    walking_minutes_to_stop=int(round(commute.walking_minutes_to_stop)),
                    transfer_count=commute.transfer_count,
                    congestion_level=commute.congestion_level,
                ),
                lifestyle_analysis=LifestyleAnalysis(
                    walkability_score=int(round(lifestyle.walkability_score)),
                    grocery_score=int(round(lifestyle.grocery_score)),
                    park_score=int(round(lifestyle.park_score)),
                    nightlife_score=int(round(lifestyle.nightlife_score)),
                    quietness_score=int(round(lifestyle.quietness_score)),
                ),
            )
        )

    created_at = db_scenario.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    return ScenarioResponse(
        scenario_id=db_scenario.scenario_id,
        search_radius_miles=db_scenario.search_radius_miles,
        created_at=created_at,
        status=_to_schema_status(db_scenario.status),
        workplace=Workplace(
            address=workplace.address if workplace else "",
            latitude=workplace.latitude if workplace else 0.0,
            longitude=workplace.longitude if workplace else 0.0,
        ),
        preference_profile=PreferenceProfile(
            max_commute_minutes=profile.max_commute_minutes if profile else 45,
            avoid_highways=profile.avoid_highways if profile else False,
            max_transfers=profile.max_transfers if profile else 3,
            prefers_transit=profile.prefers_transit if profile else False,
            prefers_driving=profile.prefers_driving if profile else False,
            wants_quiet_area=profile.wants_quiet_area if profile else False,
        ),
        recommendations=recommendations,
    )


def _load_scenario_with_relationships(db: Session, models: dict[str, object], scenario_id: str):
    CommuteScenario = models["CommuteScenario"]
    RecommendationModel = models["Recommendation"]
    stmt = (
        select(CommuteScenario)
        .where(CommuteScenario.scenario_id == scenario_id)
        .options(
            joinedload(CommuteScenario.workplace),
            joinedload(CommuteScenario.preference_profile),
            joinedload(CommuteScenario.recommendations).joinedload(RecommendationModel.zone),
            joinedload(CommuteScenario.recommendations).joinedload(RecommendationModel.commute_analysis),
            joinedload(CommuteScenario.recommendations).joinedload(RecommendationModel.lifestyle_analysis),
        )
    )
    return db.execute(stmt).unique().scalars().first()


def save_scenario(scenario: ScenarioResponse) -> None:
    db = _get_session()
    if db is None:
        _store[scenario.scenario_id] = deepcopy(scenario)
        return

    models = _db_models()
    CommuteScenario = models["CommuteScenario"]
    DbPreferenceProfile = models["PreferenceProfile"]
    DbWorkplace = models["Workplace"]
    DbRecommendation = models["Recommendation"]
    DbCommuteAnalysis = models["CommuteAnalysis"]
    DbLifestyleAnalysis = models["LifestyleAnalysis"]
    DbScenarioStatus = models["ScenarioStatus"]

    try:
        row = db.scalar(select(CommuteScenario).where(CommuteScenario.scenario_id == scenario.scenario_id))
        if row is None:
            row = CommuteScenario(
                scenario_id=scenario.scenario_id,
                user_id=_ensure_default_user(db, models),
                search_radius_miles=scenario.search_radius_miles,
                created_at=scenario.created_at,
                status=_to_db_status(scenario.status, DbScenarioStatus),
            )
            db.add(row)
            db.flush()
        else:
            row.search_radius_miles = scenario.search_radius_miles
            row.status = _to_db_status(scenario.status, DbScenarioStatus)

        pref = db.scalar(
            select(DbPreferenceProfile).where(DbPreferenceProfile.scenario_id == scenario.scenario_id)
        )
        if pref is None:
            pref = DbPreferenceProfile(
                profile_id=str(uuid4()),
                scenario_id=scenario.scenario_id,
            )
            db.add(pref)
        pref.max_commute_minutes = scenario.preference_profile.max_commute_minutes
        pref.avoid_highways = scenario.preference_profile.avoid_highways
        pref.max_transfers = scenario.preference_profile.max_transfers
        pref.prefers_transit = scenario.preference_profile.prefers_transit
        pref.prefers_driving = scenario.preference_profile.prefers_driving
        pref.wants_quiet_area = scenario.preference_profile.wants_quiet_area

        wp = db.scalar(select(DbWorkplace).where(DbWorkplace.scenario_id == scenario.scenario_id))
        if wp is None:
            wp = DbWorkplace(
                workplace_id=str(uuid4()),
                scenario_id=scenario.scenario_id,
            )
            db.add(wp)
        wp.address = scenario.workplace.address
        wp.latitude = scenario.workplace.latitude
        wp.longitude = scenario.workplace.longitude

        db.execute(delete(DbRecommendation).where(DbRecommendation.scenario_id == scenario.scenario_id))
        db.flush()

        for rec in scenario.recommendations:
            _upsert_zone(db, models, rec.zone)
            rec_row = DbRecommendation(
                recommendation_id=str(uuid4()),
                scenario_id=scenario.scenario_id,
                zone_id=rec.zone.zone_id,
                rank=rec.rank,
                total_score=rec.total_score,
                explanation_summary=rec.explanation_summary or None,
            )
            db.add(rec_row)
            db.flush()

            commute = rec.commute_analysis
            lifestyle = rec.lifestyle_analysis
            db.add(
                DbCommuteAnalysis(
                    analysis_id=str(uuid4()),
                    recommendation_id=rec_row.recommendation_id,
                    drive_time_peak_minutes=commute.drive_time_peak_minutes,
                    transit_time_peak_minutes=commute.transit_time_peak_minutes,
                    walking_minutes_to_stop=commute.walking_minutes_to_stop,
                    transfer_count=commute.transfer_count,
                    congestion_level=commute.congestion_level,
                )
            )
            db.add(
                DbLifestyleAnalysis(
                    analysis_id=str(uuid4()),
                    recommendation_id=rec_row.recommendation_id,
                    walkability_score=lifestyle.walkability_score,
                    grocery_score=lifestyle.grocery_score,
                    park_score=lifestyle.park_score,
                    nightlife_score=lifestyle.nightlife_score,
                    quietness_score=lifestyle.quietness_score,
                )
            )

        db.commit()
    except Exception:
        db.rollback()
        _disable_db()
        _store[scenario.scenario_id] = deepcopy(scenario)
    finally:
        db.close()


def get_scenario(scenario_id: str) -> ScenarioResponse | None:
    db = _get_session()
    if db is None:
        scenario = _store.get(scenario_id)
        if scenario is None:
            return None
        return deepcopy(scenario)

    models = _db_models()
    try:
        scenario = _load_scenario_with_relationships(db, models, scenario_id)
        if scenario is None:
            return None
        return _to_schema_response(scenario)
    except Exception:
        _disable_db()
        fallback = _store.get(scenario_id)
        if fallback is None:
            return None
        return deepcopy(fallback)
    finally:
        db.close()


def update_status(scenario_id: str, status: ScenarioStatus) -> ScenarioResponse | None:
    db = _get_session()
    if db is None:
        scenario = _store.get(scenario_id)
        if scenario is None:
            return None
        scenario.status = status
        return deepcopy(scenario)

    models = _db_models()
    DbScenarioStatus = models["ScenarioStatus"]
    try:
        scenario = _load_scenario_with_relationships(db, models, scenario_id)
        if scenario is None:
            return None
        scenario.status = _to_db_status(status, DbScenarioStatus)
        db.commit()
        db.refresh(scenario)
        return _to_schema_response(scenario)
    except Exception:
        db.rollback()
        _disable_db()
        fallback = _store.get(scenario_id)
        if fallback is None:
            return None
        fallback.status = status
        return deepcopy(fallback)
    finally:
        db.close()
