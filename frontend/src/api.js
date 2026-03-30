import axios from 'axios'
const B = 'http://localhost:5000/api'

export const getTeams             = (league_id) => axios.get(`${B}/teams`, { params: { league_id } }).then(r => r.data)
export const getGroups            = (league_id) => axios.get(`${B}/groups/${league_id}`).then(r => r.data)
export const getRuns              = () => axios.get(`${B}/runs`).then(r => r.data)
export const getMatches           = (params) => axios.get(`${B}/matches`, { params }).then(r => r.data)
export const runSimulation        = (n, league_id) => axios.post(`${B}/simulate`, { n_iterations: n, league_id }).then(r => r.data)
export const getProbabilities     = (id) => axios.get(`${B}/probabilities/${id}`).then(r => r.data)
export const simulateMatch        = (home, away, league_id = 39) => axios.post(`${B}/simulate_match`, { home, away, league_id }).then(r => r.data)
export const getInitialPlayerPair = () => axios.get(`${B}/players/random_pair`).then(r => r.data)
export const getNextPlayer        = (exclude_id) => axios.get(`${B}/players/random_pair`, { params: { exclude_id } }).then(r => r.data)
export const getHighScores        = (game_type) => axios.get(`${B}/highscores`, { params: { game_type } }).then(r => r.data)
export const postHighScore        = (game_type, score) => axios.post(`${B}/highscores`, { game_type, score }).then(r => r.data)
export const getTeamStats         = (team, league_id) => axios.get(`${B}/team_stats`, { params: { team, league_id } }).then(r => r.data)

export const teamLogoUrl = (teamId) =>
  teamId ? `https://media.api-sports.io/football/teams/${teamId}.png` : null