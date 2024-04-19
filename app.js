const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const app = express()
app.use(express.json())
let database = null
let dbFilePath = path.join(__dirname, './covid19IndiaPortal.db')
const port = 3000

const connectServerWithDb = async () => {
  try {
    database = await open({
      filename: dbFilePath,
      driver: sqlite3.Database,
    })
    app.listen(port, () => {
      console.log(`Server Started on : http://localhost:3000/`)
    })
  } catch (error) {
    console.log(`Error : ${error.message}`)
    process.exit(1)
  }
}
connectServerWithDb()

const stateKeyChange = obj => {
  // Function to transform state object keys
  return {
    stateId: obj.state_id,
    stateName: obj.state_name,
    population: obj.population,
  }
}

const districtKeyChange = obj => {
  // Function to transform district object keys
  return {
    districtId: obj.district_id,
    districtName: obj.district_name,
    stateId: obj.state_id,
    cases: obj.cases,
    cured: obj.cured,
    active: obj.active,
    deaths: obj.deaths,
  }
}

const authToken = (req, res, next) => {
  // Middleware function for JWT token authentication
  const authHeader = req.headers['authorization']
  if (authHeader === undefined) {
    res.status(401)
    res.send(`Invalid JWT Token`)
  } else {
    let jwtToken = authHeader.split(' ')[1]
    jwt.verify(jwtToken, 'SECRET_KEY_SOHAN', async (error, payload) => {
      if (error) {
        res.status(401)
        res.send(`Invalid JWT Token`)
      } else {
        next()
      }
    })
  }
}

app.post('/login/', async (req, res) => {
  // Endpoint for user login
  let {username, password} = req.body
  let checkUserExists = `SELECT * FROM user WHERE username = '${username}'`
  let checkInDatabase = await database.get(checkUserExists)
  if (checkInDatabase === undefined) {
    res.status(400)
    res.send(`Invalid user`)
  } else {
    let isPasswordMatched = await bcrypt.compare(
      password,
      checkInDatabase.password,
    )
    if (!isPasswordMatched) {
      res.status(400)
      res.send(`Invalid password`)
    } else {
      let payload = {
        username: username,
      }
      let jwtToken = jwt.sign(payload, 'SECRET_KEY_SOHAN')
      res.send({jwtToken})
    }
  }
})

app.get('/states/', authToken, async (req, res) => {
  // Endpoint to retrieve states
  let getStates = `SELECT * FROM state`
  let dbResponse = await database.all(getStates)
  res.send(dbResponse.map(el => stateKeyChange(el)))
})

app.get('/states/:stateId/', authToken, async (req, res) => {
  // Endpoint to retrieve a specific state
  let {stateId} = req.params
  let getStateById = `SELECT * FROM state WHERE state_id = '${stateId}'`
  let dbResponse = await database.get(getStateById)
  res.send(stateKeyChange(dbResponse))
})

app.post('/districts/', authToken, async (req, res) => {
  // Endpoint to add a district
  let {districtName, stateId, cases, cured, active, deaths} = req.body
  let addDistrict = `INSERT INTO district (district_name,state_id,cases,cured,active ,deaths) VALUES('${districtName}','${stateId}','${cases}','${cured}','${active}','${deaths}')`
  let dbResponse = await database.run(addDistrict)
  res.send(`District Successfully Added`)
})

app.get('/districts/:districtId/', authToken, async (req, res) => {
  // Endpoint to retrieve a specific district
  let {districtId} = req.params
  let getDistrict = `SELECT * FROM district  WHERE district_id = '${districtId}'`
  let dbResponse = await database.get(getDistrict)
  res.send(districtKeyChange(dbResponse))
})

app.delete('/districts/:districtId/', authToken, async (req, res) => {
  // Endpoint to delete a district
  let {districtId} = req.params
  let getDistrict = `DELETE FROM district  WHERE district_id = '${districtId}'`
  let dbResponse = await database.run(getDistrict)
  res.send(`District Removed`)
})

app.put('/districts/:districtId/', authToken, async (req, res) => {
  // Endpoint to update a district
  let {districtId} = req.params
  let {districtName, stateId, cases, cured, active, deaths} = req.body
  let updateDistrictQuery = `UPDATE district SET district_name = '${districtName}',state_id = '${stateId}',cases = '${cases}',cured = '${cured}',active = '${active}',deaths = '${deaths}' WHERE district_id = '${districtId}'`
  let dbResponse = await database.run(updateDistrictQuery)
  res.send(`District Details Updated`)
})

app.get('/states/:stateId/stats/', authToken, async (req, res) => {
  // Endpoint to retrieve stats for a state
  let {stateId} = req.params
  let statsQuery = `SELECT sum(cases) as totalCases, sum(cured) as totalCured, sum(active) as totalActive, sum(deaths) as totalDeaths from district WHERE state_id = '${stateId}'`
  let dbResponse = await database.get(statsQuery)
  res.send(dbResponse)
})

module.exports = app
