from flask import Flask, jsonify, request
from flask_cors import CORS
from sqlalchemy import text
from database import engine
from simulator import (
    run_simulation, load_elo, sim_match_score,
    get_league_groups, get_league_elo, LEAGUE_TEAMS
)

app = Flask(__name__)
CORS(app)


@app.route("/")
def home():
    return "API is running!"


@app.route("/api/teams")
def get_teams():
    league_id = request.args.get("league_id", type=int)

    # Build the team list from our curated league data first
    base = LEAGUE_TEAMS.get(league_id, LEAGUE_TEAMS[39])

    # Enrich with DB metadata (venue, country, founded, logo id) where available
    with engine.connect() as conn:
        db_rows = conn.execute(text(
            "SELECT team_id, team_name, venue_name, venue_city, country, founded FROM teams"
        )).fetchall()
        elo_rows = conn.execute(text(
            "SELECT team_name, elo_rating FROM elo_ratings"
        )).fetchall()

    db_map  = {r[1]: r for r in db_rows}
    elo_map = {r[0]: r[1] for r in elo_rows}

    result = []
    for team_name, base_elo in sorted(base.items(), key=lambda x: x[1], reverse=True):
        db = db_map.get(team_name)
        result.append({
            "team_id":    db[0] if db else None,
            "team_name":  team_name,
            "venue_name": db[2] if db else None,
            "venue_city": db[3] if db else None,
            "country":    db[4] if db else None,
            "founded":    db[5] if db else None,
            "elo_rating": round(elo_map.get(team_name, base_elo), 1),
        })
    return jsonify(result)


@app.route("/api/groups/<int:league_id>")
def get_groups(league_id):
    groups_dict = get_league_groups(league_id)
    league_elo  = get_league_elo(league_id)

    # Enrich with team_id from DB
    with engine.connect() as conn:
        db_rows = conn.execute(text(
            "SELECT team_name, team_id FROM teams"
        )).fetchall()
    tid_map = {r[0]: r[1] for r in db_rows}

    result = {}
    for gname, team_names in groups_dict.items():
        result[gname] = [{
            "team_name":  t,
            "team_id":    tid_map.get(t),
            "elo_rating": round(league_elo.get(t, 1500), 1),
        } for t in team_names]
    return jsonify(result)


@app.route("/api/simulate", methods=["POST"])
def simulate():
    n         = request.json.get("n_iterations", 10000)
    league_id = request.json.get("league_id", 39)
    elo       = load_elo()
    results   = run_simulation(n, elo, league_id)

    with engine.connect() as conn:
        run_id = conn.execute(text("""
            INSERT INTO simulation_runs (n_iterations, status)
            VALUES (:n, 'complete') RETURNING id
        """), {"n": n}).scalar()

        for team in results["qualify"]:
            conn.execute(text("""
                INSERT INTO qualification_results
                    (simulation_run_id, team_name, qualified_count,
                     finished_first_count, finished_second_count)
                VALUES (:rid, :t, :qc, :fc, :sc)
            """), {
                "rid": run_id, "t": team,
                "qc": results["qualify"][team],
                "fc": results["first"][team],
                "sc": results["second"][team],
            })
            conn.execute(text("""
                INSERT INTO championship_results
                    (simulation_run_id, team_name, champion_count,
                     finalist_count, semifinal_count)
                VALUES (:rid, :t, :cc, :fl, :sf)
            """), {
                "rid": run_id, "t": team,
                "cc": results["champions"][team],
                "fl": results["finals"][team],
                "sf": results["semis"][team],
            })
        conn.commit()
    return jsonify({"run_id": run_id, "n_iterations": n})


@app.route("/api/probabilities/<int:run_id>")
def probabilities(run_id):
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT
                q.team_name,
                ROUND(q.qualified_count      * 100.0 / s.n_iterations, 1) AS p_qualify,
                ROUND(q.finished_first_count * 100.0 / s.n_iterations, 1) AS p_first,
                ROUND(q.finished_second_count* 100.0 / s.n_iterations, 1) AS p_second,
                ROUND(c.semifinal_count      * 100.0 / s.n_iterations, 1) AS p_semifinal,
                ROUND(c.finalist_count       * 100.0 / s.n_iterations, 1) AS p_finalist,
                ROUND(c.champion_count       * 100.0 / s.n_iterations, 1) AS p_champion,
                e.elo_rating
            FROM qualification_results q
            JOIN championship_results c
              ON q.team_name = c.team_name
             AND q.simulation_run_id = c.simulation_run_id
            JOIN simulation_runs s ON s.id = q.simulation_run_id
            LEFT JOIN elo_ratings e ON e.team_name = q.team_name
            WHERE q.simulation_run_id = :rid
            ORDER BY p_champion DESC
        """), {"rid": run_id}).mappings().all()
        return jsonify([dict(r) for r in rows])


@app.route("/api/runs")
def get_runs():
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT id, run_timestamp, n_iterations
            FROM simulation_runs ORDER BY id DESC LIMIT 10
        """)).mappings().all()
        return jsonify([dict(r) for r in rows])


@app.route("/api/matches")
def get_matches():
    team    = request.args.get("team")
    season  = request.args.get("season")
    outcome = request.args.get("outcome")

    query  = "SELECT match_date, home_team, away_team, home_goals, away_goals, outcome, season FROM matches WHERE 1=1"
    params = {}
    if team:
        query += " AND (home_team = :team OR away_team = :team)"
        params["team"] = team
    if season:
        query += " AND season = :season"
        params["season"] = int(season)
    if outcome:
        query += " AND outcome = :outcome"
        params["outcome"] = outcome
    query += " ORDER BY match_date DESC LIMIT 200"

    with engine.connect() as conn:
        rows = conn.execute(text(query), params).mappings().all()
        return jsonify([dict(r) for r in rows])


@app.route("/api/simulate_match", methods=["POST"])
def simulate_single_match():
    home      = request.json.get("home")
    away      = request.json.get("away")
    league_id = request.json.get("league_id", 39)
    if not home or not away:
        return jsonify({"error": "home and away required"}), 400
    elo    = load_elo()
    league = get_league_elo(league_id)
    merged = {**elo, **league}
    return jsonify(sim_match_score(home, away, merged))


@app.route("/api/players/random_pair")
def random_player_pair():
    exclude_id = request.args.get("exclude_id", type=int)
    with engine.connect() as conn:
        total = conn.execute(text("SELECT COUNT(*) FROM players")).scalar()
        if total < 2:
            return jsonify({"error": "Not enough players in DB"}), 400

        if exclude_id is not None:
            row = conn.execute(text(
                "SELECT id, name, team_name, transfer_value, image_url FROM players WHERE id != :eid ORDER BY RANDOM() LIMIT 1"
            ), {"eid": exclude_id}).fetchone()
            if not row:
                row = conn.execute(text(
                    "SELECT id, name, team_name, transfer_value, image_url FROM players ORDER BY RANDOM() LIMIT 1"
                )).fetchone()
            return jsonify(dict(row._mapping))
        else:
            rows = conn.execute(text(
                "SELECT id, name, team_name, transfer_value, image_url FROM players ORDER BY RANDOM() LIMIT 2"
            )).fetchall()
            # Retry once if same id returned
            if rows[0][0] == rows[1][0]:
                rows = conn.execute(text(
                    "SELECT id, name, team_name, transfer_value, image_url FROM players ORDER BY RANDOM() LIMIT 2"
                )).fetchall()
            return jsonify([dict(r._mapping) for r in rows])


if __name__ == "__main__":
    app.run(debug=True, port=5000)