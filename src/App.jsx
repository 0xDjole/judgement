import { useState } from 'react'
import * as XLSX from 'xlsx'
import './App.css'

// Example test data - defined once, used everywhere
const EXAMPLE_DATA = {
  judges: [
    { name: 'Marko Petrović', team: 'Kozara' },
    { name: 'Jovana Nikolić', team: '' },
    { name: 'Stefan Jovanović', team: 'Gradiška1' },
    { name: 'Ana Stojanović', team: 'Gradiška2' },
    { name: 'Nikola Đorđević', team: '' },
    { name: 'Milica Ilić', team: 'Kozara' },
    { name: 'Dimitrije Pavlović', team: 'Gradiška1' },
    { name: 'Jelena Marinković', team: '' },
    { name: 'Dušan Stanković', team: 'Gradiška2' },
    { name: 'Teodora Radovanović', team: '' }
  ],
  games: [
    { team: 'Kozara', judgesNeeded: 1 },
    { team: 'Kozara', judgesNeeded: 1 },
    { team: 'Gradiška1', judgesNeeded: 3 },
    { team: 'Kozara', judgesNeeded: 1 },
    { team: 'Gradiška2', judgesNeeded: 1 },
    { team: 'Gradiška1', judgesNeeded: 3 },
    { team: 'Kozara', judgesNeeded: 1 },
    { team: 'Gradiška2', judgesNeeded: 3 },
    { team: 'Kozara', judgesNeeded: 1 }
  ]
}

function App() {
  const [judges, setJudges] = useState([])
  const [games, setGames] = useState([])
  const [assignments, setAssignments] = useState([])
  const [workloadStats, setWorkloadStats] = useState([])
  const [error, setError] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleJudgesUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    setError(null)
    const reader = new FileReader()

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const judgesData = XLSX.utils.sheet_to_json(sheet)

        if (judgesData.length === 0) {
          throw new Error('Judges file is empty')
        }

        const processedJudges = judgesData.map((j, idx) => ({
          id: idx,
          name: j.Name || `Judge ${idx + 1}`,
          team: j.Team || null
        }))

        setJudges(processedJudges)
      } catch (err) {
        setError(err.message)
      }
    }

    reader.readAsArrayBuffer(file)
  }

  const handleGamesUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    setError(null)
    const reader = new FileReader()

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const gamesData = XLSX.utils.sheet_to_json(sheet)

        if (gamesData.length === 0) {
          throw new Error('Games file is empty')
        }

        const processedGames = gamesData.map((g, idx) => ({
          id: idx,
          team: g.Team,
          judgesNeeded: parseInt(g.Judges_Needed) || 1
        }))

        setGames(processedGames)
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

  const downloadExampleExcel = () => {
    // Helper function for iOS-compatible downloads
    const downloadFile = (workbook, filename) => {
      const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }

    // Create Judges workbook
    const wbJudges = XLSX.utils.book_new()
    const judgesData = [
      ['Name', 'Team'],
      ...EXAMPLE_DATA.judges.map(j => [j.name, j.team])
    ]
    const wsJudges = XLSX.utils.aoa_to_sheet(judgesData)
    XLSX.utils.book_append_sheet(wbJudges, wsJudges, 'Judges')
    downloadFile(wbJudges, 'judges.xlsx')

    // Create Games workbook (slight delay to trigger second download)
    setTimeout(() => {
      const wbGames = XLSX.utils.book_new()
      const gamesData = [
        ['Team', 'Judges_Needed'],
        ...EXAMPLE_DATA.games.map(g => [g.team, g.judgesNeeded])
      ]
      const wsGames = XLSX.utils.aoa_to_sheet(gamesData)
      XLSX.utils.book_append_sheet(wbGames, wsGames, 'Games')
      downloadFile(wbGames, 'games.xlsx')
    }, 300)
  }

  const loadExampleData = () => {
    // Transform EXAMPLE_DATA to state format
    const exampleJudges = EXAMPLE_DATA.judges.map((j, idx) => ({
      id: idx,
      name: j.name,
      team: j.team || null
    }))

    const exampleGames = EXAMPLE_DATA.games.map((g, idx) => ({
      id: idx,
      team: g.team,
      judgesNeeded: g.judgesNeeded
    }))

    setJudges(exampleJudges)
    setGames(exampleGames)
    setAssignments([])
    setWorkloadStats([])
    setError(null)
  }

  const exportAssignmentsToExcel = () => {
    if (assignments.length === 0) {
      setError('No assignments to export')
      return
    }

    const wb = XLSX.utils.book_new()
    const assignmentsData = [
      ['Team', 'Assigned Judges'],
      ...assignments.map(a => [a.team, a.judges])
    ]
    const wsAssignments = XLSX.utils.aoa_to_sheet(assignmentsData)
    XLSX.utils.book_append_sheet(wb, wsAssignments, 'Assignments')

    // iOS-compatible download
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'judge-assignments.xlsx'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const exportWorkloadToExcel = () => {
    if (workloadStats.length === 0) {
      setError('No workload data to export')
      return
    }

    const wb = XLSX.utils.book_new()
    const workloadData = [
      ['Judge', 'Team', 'Games Assigned'],
      ...workloadStats.map(s => [s.name, s.team, s.gamesAssigned])
    ]
    const wsWorkload = XLSX.utils.aoa_to_sheet(workloadData)
    XLSX.utils.book_append_sheet(wb, wsWorkload, 'Workload')

    // iOS-compatible download
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'judge-workload.xlsx'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="app">
      <header>
        <h1>Judge Scheduler</h1>
        <p>Upload 2 Excel files: Judges and Games</p>
      </header>

      <div className="format-guide">
        <h3>📋 Excel Format Example</h3>
        <p className="guide-subtitle">You need 2 separate Excel files with the following structure:</p>

        <div className="example-tables">
          <div className="example-sheet">
            <h4>File 1: "judges.xlsx"</h4>
            <table className="example-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Team</th>
                </tr>
              </thead>
              <tbody>
                {EXAMPLE_DATA.judges.map((judge, idx) => (
                  <tr key={idx}>
                    <td>{judge.name}</td>
                    <td>{judge.team || <em>(blank - not a player)</em>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="example-sheet">
            <h4>File 2: "games.xlsx"</h4>
            <table className="example-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Judges_Needed</th>
                </tr>
              </thead>
              <tbody>
                {EXAMPLE_DATA.games.map((game, idx) => (
                  <tr key={idx}>
                    <td>{game.team}</td>
                    <td>{game.judgesNeeded}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="example-actions">
          <button onClick={loadExampleData} className="example-button">
            🚀 Try with Example Data
          </button>
          <button onClick={downloadExampleExcel} className="download-example-button">
            📥 Download Test Data (2 Excel Files)
          </button>
        </div>
      </div>

      <div className="upload-section">
        <div className="upload-group">
          <h3>Upload Files</h3>
          <div className="upload-row">
            <div className="upload-item">
              <label>Judges File</label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleJudgesUpload}
                id="judges-upload"
              />
              <label htmlFor="judges-upload" className="upload-button">
                Choose Judges.xlsx
              </label>
            </div>
            <div className="upload-item">
              <label>Games File</label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleGamesUpload}
                id="games-upload"
              />
              <label htmlFor="games-upload" className="upload-button">
                Choose Games.xlsx
              </label>
            </div>
          </div>
        </div>
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
            <button onClick={exportAssignmentsToExcel} className="export-button">
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
            <div className="results-header">
              <h2>Judge Workload Distribution</h2>
              <button onClick={exportWorkloadToExcel} className="export-button">
                Download Excel
              </button>
            </div>
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
