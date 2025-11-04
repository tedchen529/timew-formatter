const fs = require('fs')
const path = require('path')

function checkCategories() {
  // Read categories.json
  const categoriesPath = path.join(
    __dirname,
    'json',
    'settings',
    'categories.json'
  )
  let categories = {}

  try {
    const categoriesData = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'))
    // Flatten the categories object to get all session names
    for (const categoryData of categoriesData) {
      for (const [categoryName, sessionNames] of Object.entries(categoryData)) {
        for (const sessionName of sessionNames) {
          categories[sessionName] = categoryName
        }
      }
    }
  } catch (error) {
    console.error('Error reading categories.json:', error.message)
    return
  }

  // Read all clean JSON files
  const cleanDir = path.join(__dirname, 'json', 'clean')
  let allSessionNames = new Set()

  try {
    const files = fs.readdirSync(cleanDir)
    const jsonFiles = files.filter((file) => file.endsWith('.json'))

    for (const file of jsonFiles) {
      const filePath = path.join(cleanDir, file)
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))

        // Extract session names from each entry
        for (const entry of data) {
          if (entry.session_name) {
            allSessionNames.add(entry.session_name)
          }
        }
      } catch (error) {
        console.error(`Error reading ${file}:`, error.message)
      }
    }
  } catch (error) {
    console.error('Error reading clean directory:', error.message)
    return
  }

  // Find session names without categories
  const uncategorizedSessions = []
  for (const sessionName of allSessionNames) {
    if (!categories[sessionName]) {
      uncategorizedSessions.push(sessionName)
    }
  }

  // Output results
  if (uncategorizedSessions.length === 0) {
    console.log('All session names have categories assigned.')
  } else {
    console.log('Session names without categories:')
    console.log('=====================================')
    uncategorizedSessions.sort().forEach((sessionName) => {
      console.log(`- ${sessionName}`)
    })
    console.log(
      `\nTotal uncategorized sessions: ${uncategorizedSessions.length}`
    )
  }
}

// Check command line arguments
const args = process.argv.slice(2)
if (args.length === 0 || args[0] !== 'categories') {
  console.log('Usage: node check.js categories')
  process.exit(1)
}

checkCategories()
