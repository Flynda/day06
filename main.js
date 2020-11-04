// v2

const express = require('express')
const handlebars = require('express-handlebars')
const mysql = require('mysql2/promise')

// SQL
// never use string concatenation!
// place all SQL statements here
// by default, mySQL2 only support single statements
const SQL_FIND_BY_NAME = 'select * from apps where name like ? limit ? offset ?'
const SQL_TOTAL_RESULTS = 'select count(*) as totalCount from apps where name like ?'

// configure PORT
const PORT = parseInt(process.argv[2]) || parseInt(process.env.PORT) || 3000;

// create the datebase connection pool
// createPool will take an object
// do NOT have default user
// it is as good as giving up the database
// critical to set timezone 
const pool = mysql.createPool({
    host: process.env.DB_host || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME || 'playstore',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 4,
    timezone: '+08:00'
})


// to ensure that the connection is working
const startApp = async (app, pool) => {
    try {
        // acquire a connection from the connection pool in application
        const conn = await pool.getConnection();

        console.info('Pinging database')
        await conn.ping()

        // release connection when done
        conn.release()

        app.listen(PORT, () => {
            console.info(`Application started on port ${PORT} at ${new Date()}`)
        })

    } catch(e) {
        console.error('Cannot ping database:', e)
    }
}


// create an instance of application
const app = express();

// configure handlebars
app.engine('hbs', handlebars({defaultLayout: 'default.hbs'}))
app.set('view engine', 'hbs')

// configure the application
app.get('/', (req, resp) => {
    resp.status(200)
    resp.type('text/html')
    resp.render('index')
})

app.get('/search',
    async (req, resp) => {
        const setLimit = 10
        const q = req.query['q']
        const offsetBy = parseInt(req.query['offset']) || 0
        let conn, recs, totalResults;

        console.info('search term is', q)
        console.info('offset is ', offsetBy)

        try {
            conn = await pool.getConnection();
            // perform the query
            // with parameterised query, SQL knows it is a string
            // so don't have to put '?'
            const result = await conn.query(SQL_FIND_BY_NAME, [`%${q}%`, setLimit, offsetBy])
            // will return an array of 2 elements
            // first column will be an array of 10 records
            // second column will be the metadata
            recs = result[0]
            // another way is 
        //    const [recs, _] = await conn.query(SQL_FIND_BY_NAME, [`%${q}%`, 10])
            console.info('recs = ', recs)

            const tResult = await conn.query(SQL_TOTAL_RESULTS, [`%${q}%`])
            totalResults = tResult[0][0].totalCount
            console.info('totalResults = ', totalResults)

        } catch(e) {
            console.error('Error:', e)

        } finally {
            // release the connection
            conn.release()
        }

        const totalPages = Math.ceil(totalResults / setLimit)
        console.info('number of pages: ', totalPages)

        page = offsetBy/setLimit + 1
        console.info('offset', offsetBy)
        console.info('limit: ', setLimit)
        console.info('page: ', page)

        const prevPage = (page > 1) ? 'Previous' : ''
        const nextPage = (page < totalPages) ? 'Next' : ''
        
        console.info('p:', prevPage)
        console.info('n:', nextPage)

        resp.status(200)
        resp.type('text/html')
        resp.render('result', {
            recs: recs,
            hasContent: !!recs.length,
            prevPage: !!prevPage,
            nextPage: !!nextPage,
            q: q,
            prevOffset: offsetBy - setLimit,
            nextOffset: offsetBy + setLimit
        })
    }
)

app.use(
    express.static(__dirname + '/static')
)

startApp(app, pool)