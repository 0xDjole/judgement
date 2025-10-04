import { useState } from 'react'
import * as XLSX from 'xlsx'
import './App.css'

function App() {
  const [judges, setJudges] = useState([])
  const [games, setGames] = useState([])
  const [assignments, setAssignments] = useState([])
  const [workloadStats, setWorkloadStats] = useState([])
  const [error, setError] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    setError(null)
    const reader = new FileReader()

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result)
        const workbook = XLSX.read(data, { type: 'array' })

        // Read Judges sheet
        const judgesSheet = workbook.Sheets['Judges']
        if (!judgesSheet) {
          throw new Error('Sheet "Judges" not found. Please ensure your Excel file has a sheet named "Judges".')
        }
        const judgesData = XLSX.utils.sheet_to_json(judgesSheet)

        // Read Games sheet
        const gamesSheet = workbook.Sheets['Games']
        if (!gamesSheet) {
          throw new Error('Sheet "Games" not found. Please ensure your Excel file has a sheet named "Games".')
        }
        const gamesData = XLSX.utils.sheet_to_json(gamesSheet)

        // Validate data
        if (judgesData.length === 0) {
          throw new Error('Judges sheet is empty')
        }
        if (gamesData.length === 0) {
          throw new Error('Games sheet is empty')
        }

        // Process judges data
        const processedJudges = judgesData.map((j, idx) => ({
          id: idx,
          name: j.Name || `Judge ${idx + 1}`,
          team: j.Team || null
        }))

        // Process games data
        const processedGames = gamesData.map((g, idx) => ({
          id: idx,
          team: g.Team,
          judgesNeeded: parseInt(g.Judges_Needed) || 1
        }))

        setJudges(processedJudges)
        setGames(processedGames)
        setAssignments([])
        setWorkloadStats([])
      } catch (err) {
        setError(err.message)
      }
    }

    reader.readAsArrayBuffer(file)
  }

  const scheduleJudges = () => {
    setIsProcessing(true)
    setError(null)

    try {
      // Calculate total judges needed
      const totalJudgesNeeded = games.reduce((sum, game) => sum + game.judgesNeeded, 0)

      if (judges.length < Math.max(...games.map(g => g.judgesNeeded))) {
        throw new Error(`Not enough judges. At least ${Math.max(...games.map(g => g.judgesNeeded))} judges required for games with highest requirement.`)
      }

      // Initialize assignments
      const gameAssignments = games.map(game => ({
        gameId: game.id,
        team: game.team,
        judgesNeeded: game.judgesNeeded,
        assignedJudges: []
      }))

      // Track workload for each judge
      const judgeWorkload = judges.map(j => ({ judgeId: j.id, count: 0 }))

      // Assign judges to games using greedy algorithm with balancing
      for (let game of gameAssignments) {
        const eligibleJudges = judges.filter(judge => {
          // Judge cannot judge their own team's game
          if (judge.team && judge.team === game.team) {
            return false
          }
          // Judge cannot be assigned to same game twice
          if (game.assignedJudges.includes(judge.id)) {
            return false
          }
          return true
        })

        if (eligibleJudges.length < game.judgesNeeded) {
          throw new Error(`Cannot assign judges to game ${game.gameId + 1} (${game.team}). Not enough eligible judges.`)
        }

        // Sort eligible judges by current workload (assign least busy judges first)
        eligibleJudges.sort((a, b) => {
          const aWorkload = judgeWorkload.find(w => w.judgeId === a.id).count
          const bWorkload = judgeWorkload.find(w => w.judgeId === b.id).count
          return aWorkload - bWorkload
        })

        // Assign required number of judges
        for (let i = 0; i < game.judgesNeeded; i++) {
          const selectedJudge = eligibleJudges[i]
          game.assignedJudges.push(selectedJudge.id)
          judgeWorkload.find(w => w.judgeId === selectedJudge.id).count++
        }
      }

      // Format assignments for display
      const formattedAssignments = gameAssignments.map(game => {
        const judgeNames = game.assignedJudges.map(judgeId => {
          const judge = judges.find(j => j.id === judgeId)
          return judge.name
        })

        return {
          team: game.team,
          judges: judgeNames.join(', ')
        }
      })

      setAssignments(formattedAssignments)

      // Format workload statistics for display
      const formattedWorkload = judgeWorkload.map(w => {
        const judge = judges.find(j => j.id === w.judgeId)
        return {
          name: judge.name,
          team: judge.team || 'None',
          gamesAssigned: w.count
        }
      }).sort((a, b) => b.gamesAssigned - a.gamesAssigned)

      setWorkloadStats(formattedWorkload)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const loadExampleData = () => {
    // Example judges data - 10 judges from 3 teams
    const exampleJudges = [
      { id: 0, name: 'Marko Petrović', team: 'Kozara' },
      { id: 1, name: 'Jovana Nikolić', team: null },
      { id: 2, name: 'Stefan Jovanović', team: 'Gradiška1' },
      { id: 3, name: 'Ana Stojanović', team: 'Gradiška2' },
      { id: 4, name: 'Nikola Đorđević', team: null },
      { id: 5, name: 'Milica Ilić', team: 'Kozara' },
      { id: 6, name: 'Dimitrije Pavlović', team: 'Gradiška1' },
      { id: 7, name: 'Jelena Marinković', team: null },
      { id: 8, name: 'Dušan Stanković', team: 'Gradiška2' },
      { id: 9, name: 'Teodora Radovanović', team: null }
    ]

    // Example games data - 9 games (Kozara needs 1 judge, Gradiška teams need 3)
    const exampleGames = [
      { id: 0, team: 'Kozara', judgesNeeded: 1 },
      { id: 1, team: 'Kozara', judgesNeeded: 1 },
      { id: 2, team: 'Gradiška1', judgesNeeded: 3 },
      { id: 3, team: 'Kozara', judgesNeeded: 1 },
      { id: 4, team: 'Gradiška2', judgesNeeded: 1 },
      { id: 5, team: 'Gradiška1', judgesNeeded: 3 },
      { id: 6, team: 'Kozara', judgesNeeded: 1 },
      { id: 7, team: 'Gradiška2', judgesNeeded: 3 },
      { id: 8, team: 'Kozara', judgesNeeded: 1 }
    ]

    setJudges(exampleJudges)
    setGames(exampleGames)
    setAssignments([])
    setWorkloadStats([])
    setError(null)
  }

  const exportToExcel = () => {
    if (assignments.length === 0) {
      setError('No assignments to export')
      return
    }

    // Create workbook
    const wb = XLSX.utils.book_new()

    // Add assignments sheet
    const wsData = [
      ['Team', 'Assigned Judges'],
      ...assignments.map(a => [a.team, a.judges])
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    XLSX.utils.book_append_sheet(wb, ws, 'Assignments')

    // Download file
    XLSX.writeFile(wb, 'judge-assignments.xlsx')
  }

  return (
    <div className="app">
      <header>
        <h1>Judge Scheduler</h1>
        <p>Upload your Excel file with Judges and Games sheets</p>
      </header>

      <div className="format-guide">
        <h3>📋 Excel Format Example</h3>
        <p className="guide-subtitle">Your Excel file should have 2 sheets with the following structure:</p>

        <div className="example-tables">
          <div className="example-sheet">
            <h4>Sheet 1: "Judges"</h4>
            <table className="example-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Team</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Marko Petrović</td>
                  <td>Kozara</td>
                </tr>
                <tr>
                  <td>Jovana Nikolić</td>
                  <td><em>(blank - not a player)</em></td>
                </tr>
                <tr>
                  <td>Stefan Jovanović</td>
                  <td>Gradiška1</td>
                </tr>
                <tr>
                  <td>Ana Stojanović</td>
                  <td>Gradiška2</td>
                </tr>
                <tr>
                  <td>Nikola Đorđević</td>
                  <td><em>(blank)</em></td>
                </tr>
                <tr>
                  <td>Milica Ilić</td>
                  <td>Kozara</td>
                </tr>
                <tr>
                  <td>Dimitrije Pavlović</td>
                  <td>Gradiška1</td>
                </tr>
                <tr>
                  <td>Jelena Marinković</td>
                  <td><em>(blank)</em></td>
                </tr>
                <tr>
                  <td>Dušan Stanković</td>
                  <td>Gradiška2</td>
                </tr>
                <tr>
                  <td>Teodora Radovanović</td>
                  <td><em>(blank)</em></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="example-sheet">
            <h4>Sheet 2: "Games"</h4>
            <table className="example-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Judges_Needed</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Kozara</td>
                  <td>1</td>
                </tr>
                <tr>
                  <td>Kozara</td>
                  <td>1</td>
                </tr>
                <tr>
                  <td>Gradiška1</td>
                  <td>3</td>
                </tr>
                <tr>
                  <td>Kozara</td>
                  <td>1</td>
                </tr>
                <tr>
                  <td>Gradiška2</td>
                  <td>1</td>
                </tr>
                <tr>
                  <td>Gradiška1</td>
                  <td>3</td>
                </tr>
                <tr>
                  <td>Kozara</td>
                  <td>1</td>
                </tr>
                <tr>
                  <td>Gradiška2</td>
                  <td>3</td>
                </tr>
                <tr>
                  <td>Kozara</td>
                  <td>1</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="example-actions">
          <button onClick={loadExampleData} className="example-button">
            🚀 Try with Example Data
          </button>
        </div>
      </div>

      <div className="upload-section">
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileUpload}
          id="file-upload"
        />
        <label htmlFor="file-upload" className="upload-button">
          Choose Excel File
        </label>
      </div>

      {error && (
        <div className="error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {judges.length > 0 && games.length > 0 && (
        <div className="data-summary">
          <div className="summary-card">
            <h3>Loaded Data</h3>
            <p><strong>{judges.length}</strong> judges</p>
            <p><strong>{games.length}</strong> games</p>
            <p><strong>{games.reduce((sum, g) => sum + g.judgesNeeded, 0)}</strong> total assignments needed</p>
          </div>

          <button
            onClick={scheduleJudges}
            className="process-button"
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Generate Schedule'}
          </button>
        </div>
      )}

      {assignments.length > 0 && (
        <div className="results">
          <div className="results-header">
            <h2>Judge Assignments</h2>
            <button onClick={exportToExcel} className="export-button">
              Download Excel
            </button>
          </div>

          <table>
            <thead>
              <tr>
                <th>Team</th>
                <th>Assigned Judges</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment, idx) => (
                <tr key={idx}>
                  <td>{assignment.team}</td>
                  <td>{assignment.judges}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="workload-section">
            <h2>Judge Workload Distribution</h2>
            <table>
              <thead>
                <tr>
                  <th>Judge</th>
                  <th>Team</th>
                  <th>Games Assigned</th>
                </tr>
              </thead>
              <tbody>
                {workloadStats.map((stat, idx) => (
                  <tr key={idx}>
                    <td>{stat.name}</td>
                    <td>{stat.team}</td>
                    <td><strong>{stat.gamesAssigned}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
