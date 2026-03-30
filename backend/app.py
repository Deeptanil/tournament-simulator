from flask import Flask, jsonify, request
from flask_cors import CORS
from sqlalchemy import text
from database import engine
from simulator import (
    run_simulation, load_elo, sim_match_score,
    get_league_groups, get_league_elo, LEAGUE_TEAMS
)
from team_ids import TEAM_IDS

app = Flask(__name__)
CORS(app)


@app.route("/")
def home():
    return "API is running!"


@app.route("/api/teams")
def get_teams():
    league_id = request.args.get("league_id", type=int)

    base = LEAGUE_TEAMS.get(league_id, LEAGUE_TEAMS[39])

    # Enrich with DB metadata where available (venue, country, founded)
    with engine.connect() as conn:
        try:
            db_rows  = conn.execute(text(
                "SELECT team_id, team_name, venue_name, venue_city, country, founded FROM teams"
            )).fetchall()
            elo_rows = conn.execute(text(
                "SELECT team_name, elo_rating FROM elo_ratings"
            )).fetchall()
        except Exception:
            db_rows, elo_rows = [], []

    db_map  = {r[1]: r for r in db_rows}
    elo_map = {r[0]: r[1] for r in elo_rows}

    result = []
    for team_name, base_elo in sorted(base.items(), key=lambda x: x[1], reverse=True):
        db     = db_map.get(team_name)
        # Prefer DB-computed Elo, fall back to curated estimate
        real_elo = elo_map.get(team_name, base_elo)
        # Prefer DB team_id, fall back to our TEAM_IDS mapping
        team_id  = (db[0] if db else None) or TEAM_IDS.get(team_name)
        result.append({
            "team_id":    team_id,
            "team_name":  team_name,
            "venue_name": db[2] if db else None,
            "venue_city": db[3] if db else None,
            "country":    db[4] if db else None,
            "founded":    db[5] if db else None,
            "elo_rating": round(real_elo, 1),
        })
    return jsonify(result)


@app.route("/api/groups/<int:league_id>")
def get_groups(league_id):
    groups_dict = get_league_groups(league_id)
    league_elo  = get_league_elo(league_id)

    with engine.connect() as conn:
        try:
            db_rows = conn.execute(text("SELECT team_name, team_id FROM teams")).fetchall()
        except Exception:
            db_rows = []
    db_tid = {r[0]: r[1] for r in db_rows}

    result = {}
    for gname, team_names in groups_dict.items():
        result[gname] = [{
            "team_name":  t,
            "team_id":    db_tid.get(t) or TEAM_IDS.get(t),
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
    team      = request.args.get("team")
    season    = request.args.get("season")
    outcome   = request.args.get("outcome")
    league_id = request.args.get("league_id", type=int)

    query  = "SELECT match_date, home_team, away_team, home_goals, away_goals, outcome, season FROM matches WHERE 1=1"
    params = {}

    if team:
        query += " AND (home_team = :team OR away_team = :team)"
        params["team"] = team
    elif league_id and league_id in LEAGUE_TEAMS:
        # Filter to only matches involving teams from this league
        team_list = list(LEAGUE_TEAMS[league_id].keys())
        placeholders = ",".join(f":t{i}" for i in range(len(team_list)))
        query += f" AND (home_team IN ({placeholders}) OR away_team IN ({placeholders}))"
        for i, t in enumerate(team_list):
            params[f"t{i}"] = t

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


@app.route("/api/seasons")
def get_seasons():
    with engine.connect() as conn:
        rows = conn.execute(text("SELECT DISTINCT season FROM matches ORDER BY season DESC")).fetchall()
        return jsonify([r[0] for r in rows])


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
            if rows[0][0] == rows[1][0]:
                rows = conn.execute(text(
                    "SELECT id, name, team_name, transfer_value, image_url FROM players ORDER BY RANDOM() LIMIT 2"
                )).fetchall()
            return jsonify([dict(r._mapping) for r in rows])



@app.route("/api/highscores", methods=["GET"])
def get_highscores():
    game_type = request.args.get("game_type", "higher_lower")
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT score, created_at FROM high_scores
            WHERE game_type = :gt
            ORDER BY score DESC LIMIT 10
        """), {"gt": game_type}).mappings().all()
    return jsonify([dict(r) for r in rows])


@app.route("/api/highscores", methods=["POST"])
def post_highscore():
    game_type = request.json.get("game_type", "higher_lower")
    score     = int(request.json.get("score", 0))
    if score <= 0:
        return jsonify({"ok": False})
    with engine.begin() as conn:
        conn.execute(text(
            "INSERT INTO high_scores (game_type, score) VALUES (:gt, :s)"
        ), {"gt": game_type, "s": score})
    return jsonify({"ok": True})


@app.route("/api/team_stats")
def team_stats():
    team      = request.args.get("team")
    league_id = request.args.get("league_id", type=int)
    if not team:
        return jsonify({"error": "team required"}), 400
    with engine.connect() as conn:
        params = {"team": team}
        lid_filter = " AND league_id = :lid" if league_id else ""
        if league_id:
            params["lid"] = league_id
        home = conn.execute(text(
            "SELECT COUNT(*) as g,"
            " SUM(CASE WHEN outcome='Home Win' THEN 1 ELSE 0 END) as w,"
            " SUM(CASE WHEN outcome='Draw'     THEN 1 ELSE 0 END) as d,"
            " SUM(CASE WHEN outcome='Away Win' THEN 1 ELSE 0 END) as l,"
            " SUM(home_goals) as gf, SUM(away_goals) as ga"
            " FROM matches WHERE home_team=:team" + lid_filter
        ), params).mappings().one()
        away = conn.execute(text(
            "SELECT COUNT(*) as g,"
            " SUM(CASE WHEN outcome='Away Win' THEN 1 ELSE 0 END) as w,"
            " SUM(CASE WHEN outcome='Draw'     THEN 1 ELSE 0 END) as d,"
            " SUM(CASE WHEN outcome='Home Win' THEN 1 ELSE 0 END) as l,"
            " SUM(away_goals) as gf, SUM(home_goals) as ga"
            " FROM matches WHERE away_team=:team" + lid_filter
        ), params).mappings().one()
    def s(v): return int(v or 0)
    games = s(home["g"]) + s(away["g"])
    wins  = s(home["w"]) + s(away["w"])
    draws = s(home["d"]) + s(away["d"])
    losses= s(home["l"]) + s(away["l"])
    gf    = s(home["gf"])+ s(away["gf"])
    ga    = s(home["ga"])+ s(away["ga"])
    return jsonify({
        "team": team, "played": games, "wins": wins, "draws": draws,
        "losses": losses, "gf": gf, "ga": ga, "gd": gf - ga,
        "win_pct": round(wins / games * 100, 1) if games else 0,
    })

if __name__ == "__main__":
    app.run(debug=True, port=5000)
@app.route('/api/highscores', methods=['GET'])
def get_highscores():
    game_type = request.args.get('game_type', 'higher_lower')
    with engine.connect() as conn:
        rows = conn.execute(text('''
            SELECT score, created_at FROM high_scores
            WHERE game_type = :gt
            ORDER BY score DESC LIMIT 10
        '''), {'gt': game_type}).mappings().all()
    return jsonify([dict(r) for r in rows])


@app.route('/api/highscores', methods=['POST'])
def post_highscore():
    game_type = request.json.get('game_type', 'higher_lower')
    score     = request.json.get('score', 0)
    if score <= 0:
        return jsonify({'ok': False})
    with engine.begin() as conn:
        conn.execute(text('''
            INSERT INTO high_scores (game_type, score) VALUES (:gt, :s)
        '''), {'gt': game_type, 's': score})
    return jsonify({'ok': True})


@app.route('/api/team_stats')
def team_stats():
    team      = request.args.get('team')
    league_id = request.args.get('league_id', type=int)
    if not team:
        return jsonify({'error': 'team required'}), 400
    with engine.connect() as conn:
        params = {'team': team}
        lid_filter = ' AND league_id = :lid' if league_id else ''
        if league_id:
            params['lid'] = league_id
        home = conn.execute(text(f'''
            SELECT COUNT(*) as g,
                   SUM(CASE WHEN outcome=''Home Win'' THEN 1 ELSE 0 END) as w,
                   SUM(CASE WHEN outcome=''Draw''     THEN 1 ELSE 0 END) as d,
                   SUM(CASE WHEN outcome=''Away Win'' THEN 1 ELSE 0 END) as l,
                   SUM(home_goals) as gf, SUM(away_goals) as ga
            FROM matches WHERE home_team=:team {lid_filter}
        '''), params).mappings().one()
        away = conn.execute(text(f'''
            SELECT COUNT(*) as g,
                   SUM(CASE WHEN outcome=''Away Win'' THEN 1 ELSE 0 END) as w,
                   SUM(CASE WHEN outcome=''Draw''     THEN 1 ELSE 0 END) as d,
                   SUM(CASE WHEN outcome=''Home Win'' THEN 1 ELSE 0 END) as l,
                   SUM(away_goals) as gf, SUM(home_goals) as ga
            FROM matches WHERE away_team=:team {lid_filter}
        '''), params).mappings().one()
    def s(v): return int(v or 0)
    games = s(home['g']) + s(away['g'])
    wins  = s(home['w']) + s(away['w'])
    draws = s(home['d']) + s(away['d'])
    losses= s(home['l']) + s(away['l'])
    gf    = s(home['gf'])+ s(away['gf'])
    ga    = s(home['ga'])+ s(away['ga'])
    return jsonify({
        'team': team, 'played': games, 'wins': wins, 'draws': draws,
        'losses': losses, 'gf': gf, 'ga': ga, 'gd': gf - ga,
        'win_pct': round(wins / games * 100, 1) if games else 0,
    })


if __name__ == '__main__':    app.run(debug=True, port=5000)
