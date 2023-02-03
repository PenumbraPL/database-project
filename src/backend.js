const express = require('express')
var bodyParser = require('body-parser')
var cors = require('cors')

const app = express()
const port = 80
var jsonParser = bodyParser.json()

app.use(cors())

const { Client } = require('pg')
const client = new Client({
  user: "postgres",
  password: "postgres",
  host: "localhost",
  database: "postgres",
  port: 5432
}) 


app.listen(port, async () => {
  console.log(`Example app listening on port ${port}`)

  await client.connect()
  try{
    const res = await client.query('SELECT $1::text as message', ['Hello world!'])
    console.log(res.rows[0].message) // Hello world!
  }catch(err){
    console.log("loggin error" + err.message)
  }


})

async function authenticateUser(email, password) {
  let status = 400
  let data

  try{
    const r = await client.query('SELECT * FROM uzytkownik WHERE email=$1 ', [email])
    if (r.rows.length > 0) {
      const dbUser = r.rows[0]
      console.log(dbUser)

      if(password === dbUser.haslo) {
        status = 200
        data = { 
          uzytkownikId: dbUser.uzytkownik_id,
        }
      }
    } else {
      status = 404
    }
  }catch (err) {
    console.log(err)
  }

  return { status, data }
}

async function authenticateUserFromReq(req) {
  if (!req.headers.authorization || !req.headers.authorization.startsWith('Basic ')) {
    return { status: 402 }
  }
  const auth = Buffer.from(req.headers.authorization.slice('Basic '.length), 'base64').toString('ascii');
  console.log('auth', auth)
  const email = auth.split(':')[0]
  const password = auth.split(':')[1]
  console.log('email+pass: ', email, password)
  return await authenticateUser(email, password)
}


async function authenticateEmployee(email, password) {
  let status = 400
  let data

  try{
    const r = await client.query('SELECT * FROM pracownik WHERE email=$1 ', [email])
    if (r.rows.length > 0) {
      const dbUser = r.rows[0]
      console.log(dbUser)

      if(password === dbUser.haslo) {
        status = 200
        if(dbUser.punkt_pocztowy){
          data = { 
            pracownikId: dbUser.pracownik_id,
            poczta: dbUser.punkt_pocztowy,
            admin: dbUser.admin
          }
        }else{
          data = { 
            pracownikId: dbUser.pracownik_id,
            admin: dbUser.admin
          }
        }
      }
    } else {
      status = 404
    }
  }catch (err) {
    console.log(err)
  }

  return { status, data }
}

async function authenticateEmployeeFromReq(req) {
  if (!req.headers.authorization || !req.headers.authorization.startsWith('Basic ')) {
    return { status: 402 }
  }
  const auth = Buffer.from(req.headers.authorization.slice('Basic '.length), 'base64').toString('ascii');
  console.log(auth)
  const email = auth.split(':')[0]
  const password = auth.split(':')[1]
  return await authenticateEmployee(email, password)
}

async function authenticateAdmin(email, password) {
  let status = 400
  let data

  try{
    const r = await client.query('SELECT * FROM pracownik WHERE email=$1 ', [email])
    if (r.rows.length > 0) {
      const dbUser = r.rows[0]
      console.log(dbUser)

      if(password === dbUser.haslo && dbUser.admin === true) {
        status = 200
        if(dbUser.punkt_pocztowy){
          data = { 
            pracownikId: dbUser.pracownik_id,
            poczta: dbUser.punkt_pocztowy,
            admin: dbUser.admin
          }
        }else{
          data = { 
            pracownikId: dbUser.pracownik_id,
            admin: dbUser.admin
          }
        }
      }
    } else {
      status = 404
    }
  }catch (err) {
    console.log(err)
  }

  return { status, data }
}

async function authenticateAdminFromReq(req) {
  if (!req.headers.authorization || !req.headers.authorization.startsWith('Basic ')) {
    return { status: 402 }
  }
  const auth = Buffer.from(req.headers.authorization.slice('Basic '.length), 'base64').toString('ascii');
  console.log(auth)
  const email = auth.split(':')[0]
  const password = auth.split(':')[1]
  return await authenticateAdmin(email, password)
}



/* ===================================================================================================== */

app.all('/api', function (req, res, next) {
  console.log(req.method, req.url);
  //authorizeUser(req)
  //authorizeEmployee(req)
  next();
});

app.get('/', async (req, res) => {
   const r = await client.query('SELECT * FROM paczka')
   console.log(r.rows)
   res.send(r.rows)
})



// ----- User --------
app.post('/sign-up', jsonParser, async function (req, res) {
  const user = req.body
  console.log(user)

  let status = 400
  let result
  try{
    result = await client.query('INSERT INTO public.uzytkownik (imie, nazwisko, data_urodzenia, kod_pocztowy, numer_telefonu, email, haslo) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING * ;', [user.name, user.surname, user.date_of_birth, user.postal_code, user.phone, user.email, user.password])
    status = 200
  }catch (err) {
    console.log(err)
    return res.status(404).json({"message" : err.message})
  }

  res.status(status).json(result.rows)
})

// tylko dla uzytkownikow - nie dla pracownikow
app.post('/sign-in', jsonParser, async function (req, res) {
  const user = req.body
  console.log(user)
  const { status, data } = await authenticateUser(user.email, user.password)

  console.log(data)
  res.status(status).json(data)
})


app.post('/register-package', jsonParser, async function (req, res) {
  let {status, data} = await authenticateUserFromReq(req)
  
  if (status !== 200) {
    return res.status(status).json()
  }
 
  const pkg = req.body
  let result
  try{
    const r = await client.query('SELECT * FROM uzytkownik WHERE email=$1 ', [pkg.resever])
    if(r.rows.length > 0) {
      const dbUser = r.rows[0]
      console.log(dbUser)
      status = 200
      const resever = dbUser.uzytkownik_id
      const sender = data.uzytkownikId
      console.log(resever)
      console.log(sender)
      result = client.query('INSERT INTO public.paczka(tytul, opis, waga, nadawca, odbiorca, punkt_nadania, punkt_odbioru) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;', [pkg.title, pkg.description, pkg.mass, sender, resever, pkg.source_point, pkg.destination_point])
    } else {
      status = 404
    }
  }catch (err) {
    console.log(err)
    res.status(400).json({ message: err.message })
    return
  }
  console.log(result)
  res.status(status).json(data) //json(result.rows)
})

app.get('/track-package', async (req, res) => {
  let {status, data} = await authenticateUserFromReq(req)
  
  if (status !== 200) {
    return res.status(status).json()
  }
  
  const r = await client.query(`SELECT * FROM zlaczone_paczki_dla_uzytkownika($1)
                                FULL JOIN aktualny_stan USING (paczka_id);
                                `, [data.uzytkownikId])

  const length = r.rowCount
  const result = []
  for(let i=0; i<length; i++){
    let x = 
    {
      title: r.rows[i].tytul,
      description: r.rows[i].opis,
      mass: r.rows[i].waga,
      status: r.rows[i].status === null ? "Zarejestrowano" : r.rows[i].status,
      last_date_of_update: r.rows[i].min === null ? "" : r.rows[i].min,
      sender: r.rows[i].nadawca,
      resever: r.rows[i].odbiorca,
      destination_point: r.rows[i].punkt_odbioru
    }
    result.push(x)
  }
res.json(result)
})


// ADMIN API
app.post('/admin/sign-in', jsonParser, async function (req, res) {
  const user = req.body
  console.log(user)
  const { status, data } = await authenticateEmployee(user.email, user.password)

  console.log(data)
  res.status(status).json(data)
})

app.post('/admin/register-vehicle', jsonParser, async function (req, res) {
  const {status, data} = await authenticateAdminFromReq(req)
  
  if (status !== 200) {
    return res.status(status).json()
  }
  
  const vehicle = req.body
  console.log(vehicle)
  try{
    const r = await client.query('INSERT INTO pojazd (lokalizacja, marka, model, rejestracja, udzwig) VALUES ($1, $2, $3, $4, $5)',
                               [vehicle.mail_id, vehicle.brand, vehicle.model, vehicle.number_plate, vehicle.max_mass])
  }catch (err) {
    console.log(err)
    return res.status(400).json(data)  
  }
  res.status(status).json(data)  
})

app.post('/admin/register-mail', jsonParser, async function (req, res) {
  const {status, data} = await authenticateAdminFromReq(req)
  
  if (status !== 200) {
    return res.status(status).json()
  }
  
  const mail = req.body
  console.log(mail)
  try{
    const r = await client.query('INSERT INTO punkt_pocztowy (nazwa, miejscowosc) VALUES ($1, $2)', [mail.name, mail.place])
  }catch (err) {
    console.log(err)
  }
  res.status(status).json(data)
})

app.post('/admin/register-transport', jsonParser, async function (req, res) {
  const {status, data} = await authenticateEmployeeFromReq(req)
  
  if (status !== 200) {
    return res.status(status).json()
  }
  const transport = req.body
  console.log(transport)
  try{
    const r1 = await client.query('INSERT INTO transport (pojazd, punkt_nadania, punkt_odbioru) VALUES ($1, $2, $3);',
     [transport.vehicle_id, data.poczta, transport.mail_id])
  }catch (err) {
    console.log(err)
  }
  res.status(status).json(data)
})

app.post('/admin/sign-up', jsonParser, async function (req, res) {
  const {status, data} = await authenticateAdminFromReq(req)
  
  if (status !== 200) {
    return res.status(status).json()
  }

  const worker = req.body
  console.log(worker)
  let result
  try{
    result = await client.query('INSERT INTO public.pracownik(imie, nazwisko, admin, punkt_pocztowy, email, haslo) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;', [worker.name, worker.surname, worker.is_admin, worker.mail, worker.email, worker.password])
  }catch (err) {
    console.log(err)
    res.status(400).json({ message: err.message })
    return
  }
  console.log(result)
  res.status(status).json(result.rows)
})


app.post('/admin/mails', jsonParser, async function (req, res) {
  const {status, data} = await authenticateEmployeeFromReq(req)
  
  if (status !== 200) {
    return res.status(status).json()
  }

  const mail = req.body
  console.log(mail)
  let result
  try{
    result = await client.query('INSERT INTO public.punkt_pocztowy(nazwa, miejscowosc) VALUES ($1, $2) RETURNING *;', [mail.name, mail.place])
  }catch (err) {
    console.log(err)
    res.status(400).json({ message: err.message })
    return
  }
  console.log(result)
  res.json(result.rows)
})

app.get('/admin/mails', jsonParser, async function (req, res) {
  let result
  try{
    result = await client.query('SELECT punkt_id, nazwa FROM public.punkt_pocztowy')
  }catch(err){
    console.log(err)
    res.status(400).json({ message: err.message })
    return
  }
  res.json(result.rows)
})

app.get('/admin/vehicles', jsonParser, async function (req, res) {
  const {status, data} = await authenticateEmployeeFromReq(req)
  
  if (status !== 200) {
    return res.status(status).json()
  }

  let result
  try{
    result = await client.query(`SELECT pojazd_id, marka, model, rejestracja
                                FROM public.pojazd 
                                WHERE lokalizacja = $1`,
                                [data.poczta])
  }catch(err){
    console.log(err)
    res.status(400).json({ message: err.message })
    return
  }
  res.json(result.rows)
})

app.get('/admin/transports', jsonParser, async function (req, res) {
  const {status, data} = await authenticateEmployeeFromReq(req)
  
  if (status !== 200) {
    return res.status(status).json()
  }

  let result
  try{
    result = await client.query(` SELECT DISTINCT transport_id, marka || ' ' || model AS pojazd, pp.nazwa , udzwig
                                  FROM status_dla_transportu JOIN public.transport t USING(transport_id)
                                  JOIN punkt_pocztowy pp ON pp.punkt_id = t.punkt_odbioru
                                  JOIN pojazd p ON t.pojazd = p.pojazd_id
                                  WHERE t.punkt_nadania = $1 AND status IS NULL;
                                `, [data.poczta])
  }catch(err){
    console.log(err)
    res.status(400).json({ message: err.message })
    return
  }
  res.json(result.rows)
})

app.get('/admin/package-status', jsonParser, async function (req, res) {
  const {status, data} = await authenticateEmployeeFromReq(req)
  
  if (status !== 200) {
    return res.status(status).json()
  }
// zaktualizowac
  const r = await client.query(` SELECT DISTINCT u1.imie || \' \' || u1.nazwisko as nadawca, u2.imie || \' \' || u2.nazwisko as odbiorca,
                               status, czas as aktualizacja, waga, transport_id, paczka_id
                                FROM aktualny_stan
                                FULL JOIN public.paczka  USING(paczka_id)
                                JOIN uzytkownik u1 ON u1.uzytkownik_id = nadawca
                                JOIN uzytkownik u2 ON u2.uzytkownik_id = odbiorca
                                WHERE (punkt_nadania = $1 OR punkt_odbioru = $1) AND status IS NULL;
                              `, [data.poczta])
  const length = r.rowCount
  const result = []
  for(let i=0; i<length; i++){
    let x = 
    {
      sender: r.rows[i].nadawca,
      resever: r.rows[i].odbiorca,
      status: r.rows[i].status,
      date: r.rows[i].aktualizacja,
      mass: r.rows[i].waga,
      transport: r.rows[i].transport_id,
      package_id: r.rows[i].paczka_id
    }
    result.push(x)
  }
  console.log(result)
  res.status(status).json(result)
})


app.get('/admin/track-transport', jsonParser, async function (req, res) {
  const {status, data} = await authenticateEmployeeFromReq(req)
  if (status !== 200) {
    return res.status(status).json()
  }

  const r = await client.query(`SELECT DISTINCT transport_id, marka, model, rejestracja, nazwa, status FROM pojazd
                                FULL JOIN status_dla_transportu USING(pojazd_id)
                                JOIN punkt_pocztowy ON punkt_odbioru = punkt_id
                                WHERE punkt_nadania = $1 AND status IS NULL
                                ORDER BY transport_id;
                                `, [data.poczta])
  const length = r.rowCount
  const result = []
  for(let i=0; i<length; i++){
    let x = 
    {
      transport_id: r.rows[i].transport_id,
      brand: r.rows[i].marka,
      model: r.rows[i].model,
      number_plate: r.rows[i].rejestracja,
      mail: r.rows[i].nazwa,
      status: r.rows[i].status === null ? "Nie nadano" : r.rows[i].status
    }
    result.push(x)
  }
  res.status(status).json(result)
})

app.get('/admin/test-track-transport', jsonParser, async function (req, res) {
  const {status, data} = await authenticateEmployeeFromReq(req)
  
  if (status !== 200) {
    return res.status(status).json()
  }
 
  const r = await client.query(`SELECT DISTINCT transport_id, marka, model, rejestracja, nazwa, status, czas FROM pojazd
                                FULL JOIN status_dla_transportu USING(pojazd_id)
                                JOIN punkt_pocztowy ON punkt_odbioru = punkt_id
                                WHERE punkt_nadania = $1 AND status IS NOT NULL
                                ORDER BY transport_id;
                                `, [data.poczta])
  const length = r.rowCount
  const result = []
  for(let i=0; i<length; i++){
    let x = 
    {
      transport_id: r.rows[i].transport_id,
      brand: r.rows[i].marka,
      model: r.rows[i].model,
      number_plate: r.rows[i].rejestracja,
      date: r.rows[i].czas,
      mail: r.rows[i].nazwa,
      status: r.rows[i].status
    }
    result.push(x)
  }
  res.json(result)
})

app.post('/admin/register-transport-packages', jsonParser, async function (req, res) {
  const {status, data} = await authenticateEmployeeFromReq(req)
  
  if (status !== 200) {
    return res.status(status).json()
  }
  const pkg = req.body
  const rows = pkg.rows

  const x = rows.map(r => `(${pkg.transport_id}, ${r})`).join(',')
  let values = String()
  for(const i of x){
    values += i
  }

  try{
  const r1 = await client.query(`INSERT INTO paczki_transportu (transport_id, paczka_id) VALUES ` + values + ` RETURNING *;`)
  const pt_id = r1.rows
  console.log(pt_id)
  const sp_values = pt_id.map(r => `(${r.paczki_transportu_id}, \'${pkg.status}\', NOW())`).join(',').toString()
  const r2 = await client.query(`INSERT INTO status_paczki (paczki_transportu_id, status, czas) VALUES ` + sp_values + `;`)
  }catch(err){
    console.log(err)
    return res.status(400).json(err.message)
  }
  res.status(status).json(data)
})